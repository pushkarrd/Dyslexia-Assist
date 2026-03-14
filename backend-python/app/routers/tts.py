"""
Simple TTS Proxy - Fetches audio from Google Translate (avoids CORS)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import base64

router = APIRouter(prefix="/api/tts", tags=["tts"])

class TTSRequest(BaseModel):
    text: str
    language: str = "en"  # 'en', 'hi', 'kn'
    rate: float = 1.0

@router.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Fetch audio from Google Translate TTS (backend proxy to avoid CORS)
    Returns base64-encoded audio
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")

        # Language mapping
        lang_map = {"en": "en", "hi": "hi", "kn": "kn"}
        if request.language not in lang_map:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")

        lang_code = lang_map[request.language]
        text = request.text.strip()

        print(f"[TTS] Request: {request.language}, {len(text)} chars")

        # Fetch audio from Google Translate
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={requests.utils.quote(text)}&tl={lang_code}&client=tw-ob"

        try:
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                raise Exception(f"Google Translate returned {response.status_code}")

            audio_bytes = response.content
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

            print(f"[OK] Got audio: {len(audio_bytes)} bytes")

            return {
                "audio": audio_base64,
                "mimeType": "audio/mpeg",
                "language": request.language,
                "text": text[:100]  # First 100 chars for reference
            }

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Request failed: {e}")
            raise HTTPException(status_code=503, detail=f"Google Translate service unavailable: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")

@router.get("/health")
async def tts_health():
    """Check TTS service health"""
    return {"status": "ok", "service": "TTS Proxy ready"}
