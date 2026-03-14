"""
handwriting.py — Handwriting analysis route
Part of SimplifiED backend (split from main.py)
"""

import base64
import json
import re
import time
import asyncio
import traceback
from io import BytesIO

from fastapi import APIRouter, HTTPException, File, UploadFile

try:
    from PIL import Image, ImageEnhance
except ImportError:
    Image = None
    ImageEnhance = None
    print("[WARNING] Pillow not installed — handwriting image enhancement disabled")

router = APIRouter()

# ── Shared state (injected from main.py) ──────────────────────────────────────

_db = None
_get_gemini_key_fn = None
_rotate_gemini_key_fn = None
_throttle_fn = None
_gemini_vision_model = None
_gemini_api_base = None

def init(db, get_gemini_key, rotate_gemini_key, throttle_gemini, vision_model, api_base):
    """Call this from main.py to inject shared dependencies."""
    global _db, _get_gemini_key_fn, _rotate_gemini_key_fn, _throttle_fn
    global _gemini_vision_model, _gemini_api_base
    _db = db
    _get_gemini_key_fn = get_gemini_key
    _rotate_gemini_key_fn = rotate_gemini_key
    _throttle_fn = throttle_gemini
    _gemini_vision_model = vision_model
    _gemini_api_base = api_base


# ── Handwriting Analysis Endpoint ────────────────────────────────────────────

@router.post("/api/handwriting/analyze")
async def analyze_handwriting(file: UploadFile = File(...), userId: str = "anonymous"):
    """
    Analyze handwriting image for dyslexia-related errors using Gemini Vision AI.
    Returns detailed scoring, extracted text, error highlights, and improvement tips.
    """
    try:
        import requests as req_lib
        from datetime import datetime

        file_content = await file.read()

        # Validate file size (50 MB limit)
        if len(file_content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 50 MB limit.")

        # ── Enhance image ─────────────────────────────────────────────────────
        try:
            if Image is None:
                raise ImportError("Pillow not installed")
            img = Image.open(BytesIO(file_content))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img = ImageEnhance.Contrast(img).enhance(1.5)
            img = ImageEnhance.Sharpness(img).enhance(2.0)
            img = ImageEnhance.Brightness(img).enhance(1.1)
            buf = BytesIO()
            img.save(buf, format='JPEG', quality=95)
            enhanced_bytes = buf.getvalue()
            base64_image = base64.b64encode(enhanced_bytes).decode('utf-8')
            mime_type = 'image/jpeg'
            print(f"[IMG] Enhanced: {img.size[0]}x{img.size[1]}, {len(enhanced_bytes)} bytes")
        except Exception as img_err:
            print(f"[WARN] Image enhancement failed ({img_err}), using original")
            base64_image = base64.b64encode(file_content).decode('utf-8')
            mime_type = file.content_type or 'image/jpeg'

        # ── Build request ─────────────────────────────────────────────────────
        headers = {"Content-Type": "application/json"}

        system_prompt = """You are a dyslexia handwriting analyst. Analyze the handwriting image and respond with ONLY a JSON object (no markdown, no code fences, no extra text).

Instructions:
1. Extract all text as "extractedText" (max 300 chars, truncate with ... if longer)
2. Score each category 0-100 independently:
   - letterFormation: letter shapes, b/d p/q reversals
   - spacing: letter/word/line spacing consistency
   - alignment: baseline, slant uniformity
   - spelling: correct spelling (flag every error)
   - sizing: letter size consistency
   - legibility: overall readability
3. Overall score = weighted avg: letterFormation 25%, spacing 15%, alignment 15%, spelling 25%, sizing 10%, legibility 10%
4. List errors (max 8) and spelling errors (max 10)
5. Keep all descriptions SHORT (under 50 chars each)

JSON format — output ONLY this:
{"score":N,"extractedText":"...","summary":"...","categoryScores":{"letterFormation":N,"spacing":N,"alignment":N,"spelling":N,"sizing":N,"legibility":N},"errors":[{"type":"...","severity":"high|medium|low","word":"...","correction":"...","description":"...","suggestion":"..."}],"spellingErrors":[{"wrong":"...","correct":"...","type":"misspelling|abbreviation|missing_letter|extra_letter|transposition"}],"strengths":["..."],"recommendations":[{"title":"...","description":"...","priority":"high|medium|low"}]}"""

        payload = {
            "contents": [{
                "role": "user",
                "parts": [
                    {"text": f"{system_prompt}\n\nAnalyze this handwriting. Output ONLY valid JSON."},
                    {"inlineData": {"mimeType": mime_type, "data": base64_image}}
                ]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json"
            }
        }

        # ── Retry loop ────────────────────────────────────────────────────────
        result_text = None
        max_retries = 5
        for attempt in range(max_retries):
            _throttle_fn()
            attempt_url = f"{_gemini_api_base}/{_gemini_vision_model}:generateContent?key={_get_gemini_key_fn()}"
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, lambda: req_lib.post(attempt_url, headers=headers, json=payload, timeout=120)
                )
            except req_lib.exceptions.RequestException as req_err:
                print(f"[WARN] Request failed (attempt {attempt+1}): {req_err}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(10)
                    continue
                raise HTTPException(status_code=500, detail=f"Network error: {str(req_err)}")

            if response.status_code == 429:
                _rotate_gemini_key_fn()
                retry_after = response.headers.get('Retry-After')
                wait_time = min(int(retry_after), 90) if retry_after else min((2 ** attempt) * 10, 90)
                print(f"[RATE] Vision rate limited (attempt {attempt+1}/{max_retries}), waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue

            if response.status_code != 200:
                print(f"[ERROR] Gemini Vision API {response.status_code}: {response.text}")
                raise HTTPException(status_code=500, detail=f"Vision API error: {response.text}")

            result_text = response.json()['candidates'][0]['content']['parts'][0]['text']
            break

        if result_text is None:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait 1-2 minutes and try again.")

        # ── Parse JSON response ───────────────────────────────────────────────
        try:
            cleaned = result_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned[cleaned.index('\n') + 1:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            json_start = cleaned.find('{')
            json_end = cleaned.rfind('}') + 1
            json_str = cleaned[json_start:json_end] if json_start >= 0 and json_end > json_start else cleaned

            print(f"[PARSE] Parsing JSON response ({len(json_str)} chars)...")
            result = json.loads(json_str)
            print(f"[OK] Parsed. Score from AI: {result.get('score', 'N/A')}")

            # Recompute weighted score from category scores
            if "categoryScores" in result and isinstance(result["categoryScores"], dict):
                cats = result["categoryScores"]
                weights = {"letterFormation": 0.25, "spacing": 0.15, "alignment": 0.15,
                           "spelling": 0.25, "sizing": 0.10, "legibility": 0.10}
                result["score"] = round(sum(cats.get(k, 50) * w for k, w in weights.items()))
                print(f"[SCORE] Weighted score: {result['score']} | Categories: {cats}")

            result.setdefault("extractedText", "")
            result.setdefault("summary", "Analysis complete.")
            if "categoryScores" not in result:
                s = result.get("score", 50)
                result["categoryScores"] = {k: s for k in ["letterFormation","spacing","alignment","spelling","sizing","legibility"]}
            result.setdefault("errors", [])
            result.setdefault("spellingErrors", [])
            result.setdefault("strengths", [])
            result.setdefault("recommendations", [])

        except (json.JSONDecodeError, ValueError) as parse_err:
            print(f"[ERROR] JSON parse failed: {parse_err}")
            print(f"[ERROR] Raw response (first 500 chars): {result_text[:500]}")

            # Try to repair truncated JSON
            try:
                json_match = re.search(r'\{[\s\S]*', result_text)
                if not json_match:
                    raise ValueError("No JSON object found")
                truncated = re.sub(r'[\x00-\x1f\x7f-\x9f]', ' ', json_match.group())
                repaired = truncated.rstrip()
                if repaired.count('"') % 2 != 0:
                    repaired += '"'
                repaired += ']' * max(0, repaired.count('[') - repaired.count(']'))
                repaired += '}' * max(0, repaired.count('{') - repaired.count('}'))
                result = json.loads(repaired)
                print(f"[OK] Recovered truncated JSON. Score: {result.get('score', 'N/A')}")
                result.setdefault("extractedText", "")
                result.setdefault("summary", "Analysis complete (response was truncated).")
                result.setdefault("categoryScores", {})
                result.setdefault("errors", [])
                result.setdefault("spellingErrors", [])
                result.setdefault("strengths", [])
                result.setdefault("recommendations", [])
            except Exception as repair_err:
                print(f"[ERROR] JSON repair failed: {repair_err}")
                score_match = re.search(r'"score"\s*:\s*(\d+)', result_text)
                text_match = re.search(r'"extractedText"\s*:\s*"([^"]*)', result_text)
                score_val = int(score_match.group(1)) if score_match else 50
                cats = {}
                for cat in ["letterFormation", "spacing", "alignment", "spelling", "sizing", "legibility"]:
                    m = re.search(rf'"{cat}"\s*:\s*(\d+)', result_text)
                    cats[cat] = int(m.group(1)) if m else score_val
                result = {
                    "score": score_val,
                    "extractedText": text_match.group(1) if text_match else "",
                    "summary": "Analysis partially recovered.",
                    "categoryScores": cats,
                    "errors": [],
                    "spellingErrors": [],
                    "strengths": [],
                    "recommendations": [{"title": "Try again", "description": "Upload a clearer photo with good lighting.", "priority": "medium"}]
                }
                print(f"[WARN] Regex fallback. Score: {score_val}")

        # ── Save to Firestore ─────────────────────────────────────────────────
        try:
            from datetime import datetime
            _db.collection("handwritingUploads").add({
                "userId": userId,
                "score": result.get("score", 0),
                "errorCount": len(result.get("errors", [])),
                "errors": result.get("errors", []),
                "createdAt": datetime.now()
            })
        except Exception as save_err:
            print(f"[WARN] Failed to save handwriting result: {save_err}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Handwriting analysis error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")