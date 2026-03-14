"""
generate.py — Content transformation & lecture processing routes
Part of SimplifiED backend (split from main.py)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

# These are imported from main.py shared context
# (db, generate_with_gemini are passed in via init)

router = APIRouter()

# ── Pydantic Models ────────────────────────────────────────────────────────────

class LectureCreate(BaseModel):
    userId: str
    transcription: str

class LectureUpdate(BaseModel):
    transcription: str = None
    simpleText: str = None
    detailedSteps: str = None
    mindMap: str = None
    summary: str = None

class ContentTransformRequest(BaseModel):
    text: str
    userId: str = "anonymous"


# ── Shared state (injected from main.py) ──────────────────────────────────────

_db = None
_generate_fn = None

def init(db, generate_with_gemini):
    """Call this from main.py to inject shared dependencies."""
    global _db, _generate_fn
    _db = db
    _generate_fn = generate_with_gemini


# ── Helpers ───────────────────────────────────────────────────────────────────

def chunk_text(text: str, max_chunk_size: int = 500) -> list:
    """Split text into smaller chunks for faster processing."""
    sentences = text.replace("?", ".").replace("!", ".").split(".")
    sentences = [s.strip() for s in sentences if s.strip()]
    chunks, current_chunk, current_length = [], [], 0
    for sentence in sentences:
        sentence_length = len(sentence)
        if current_length + sentence_length > max_chunk_size and current_chunk:
            chunks.append(". ".join(current_chunk) + ".")
            current_chunk = [sentence]
            current_length = sentence_length
        else:
            current_chunk.append(sentence)
            current_length += sentence_length
    if current_chunk:
        chunks.append(". ".join(current_chunk) + ".")
    return chunks


# ── Lecture Endpoints ─────────────────────────────────────────────────────────

@router.post("/api/lectures")
async def create_lecture(lecture: LectureCreate):
    """Create a new lecture with transcription."""
    try:
        lecture_data = {
            "userId": lecture.userId,
            "transcription": lecture.transcription,
            "simpleText": "",
            "detailedSteps": "",
            "mindMap": "",
            "summary": "",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }
        doc_ref = _db.collection("lectures").document()
        doc_ref.set(lecture_data)
        return {"id": doc_ref.id, **lecture_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/lectures/{lecture_id}")
async def get_lecture(lecture_id: str):
    """Get a specific lecture."""
    try:
        doc = _db.collection("lectures").document(lecture_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Lecture not found")
        return {"id": doc.id, **doc.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/lectures/user/{user_id}/latest")
async def get_latest_lecture(user_id: str):
    """Get the latest lecture for a user."""
    try:
        from firebase_admin import firestore
        docs = _db.collection("lectures") \
            .where("userId", "==", user_id) \
            .order_by("createdAt", direction=firestore.Query.DESCENDING) \
            .limit(1).stream()
        for doc in docs:
            return {"id": doc.id, **doc.to_dict()}
        raise HTTPException(status_code=404, detail="No lectures found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/lectures/user/{user_id}")
async def get_user_lectures(user_id: str):
    """Get all lectures for a user."""
    try:
        from firebase_admin import firestore
        docs = _db.collection("lectures") \
            .where("userId", "==", user_id) \
            .order_by("createdAt", direction=firestore.Query.DESCENDING) \
            .stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/lectures/{lecture_id}")
async def update_lecture(lecture_id: str, updates: LectureUpdate):
    """Update lecture fields."""
    try:
        update_data = {k: v for k, v in updates.dict().items() if v is not None}
        update_data["updatedAt"] = datetime.now()
        _db.collection("lectures").document(lecture_id).update(update_data)
        doc = _db.collection("lectures").document(lecture_id).get()
        return {"id": doc.id, **doc.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str):
    """Delete a lecture."""
    try:
        _db.collection("lectures").document(lecture_id).delete()
        return {"message": "Lecture deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/lectures/{lecture_id}/process")
async def process_lecture(lecture_id: str):
    """Process lecture transcription through Gemini AI."""
    try:
        doc = _db.collection("lectures").document(lecture_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Lecture not found")

        transcription = doc.to_dict().get("transcription", "")
        if not transcription:
            raise HTTPException(status_code=400, detail="No transcription to process")

        print(f"[START] Processing lecture {lecture_id}...")
        start_time = time.time()
        chunks = chunk_text(transcription, max_chunk_size=600)
        print(f"[INFO] Split into {len(chunks)} chunks")

        breakdown_prompt = f"""Break down by splitting words into syllables with hyphens. Keep sentences intact.
Example: "Photosynthesis is the process" → "Pho-to-syn-the-sis is the pro-cess"
Text: {transcription}
Output only the syllable breakdown:"""

        steps_prompt = f"""Break this lecture into clear numbered steps (max 5-7). Be concise.
Text: {transcription}
Output only the numbered steps:"""

        mindmap_prompt = f"""Create a brief mind map with main topic and 3-4 key points only.
Text: {transcription}
Format:
Main Topic
├─ Point 1
├─ Point 2
└─ Point 3"""

        summary_prompt = f"""Summarize in 2-3 sentences: main topic, key points, conclusion.
Text: {transcription}
Summary:"""

        with ThreadPoolExecutor(max_workers=4) as executor:
            bf = executor.submit(_generate_fn, breakdown_prompt, "Break words into syllables. Output only the result.")
            sf = executor.submit(_generate_fn, steps_prompt, "Create numbered steps. Be concise.")
            mf = executor.submit(_generate_fn, mindmap_prompt, "Create a brief mind map.")
            smf = executor.submit(_generate_fn, summary_prompt, "Write a 2-3 sentence summary.")
            breakdown_text = bf.result()
            detailed_steps = sf.result()
            mind_map = mf.result()
            summary = smf.result()

        elapsed_time = time.time() - start_time
        update_data = {
            "simpleText": breakdown_text,
            "detailedSteps": detailed_steps,
            "mindMap": mind_map,
            "summary": summary,
            "updatedAt": datetime.now(),
            "processingTime": elapsed_time
        }
        _db.collection("lectures").document(lecture_id).update(update_data)
        print(f"[DONE] Processing complete in {elapsed_time:.1f}s")
        return {"id": lecture_id, **update_data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Lecture processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Content Transform Endpoint ────────────────────────────────────────────────

@router.post("/api/content/transform")
async def transform_content(request: ContentTransformRequest):
    """Transform educational content into simplified notes, flashcards, quiz, mind map."""
    try:
        text = request.text
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text provided")

        print(f"[TRANSFORM] Transforming content ({len(text)} chars)...")
        start_time = time.time()
        short_text = text[:200] if len(text) > 200 else text

        # ── Fallback content ──────────────────────────────────────────────────
        fallback_notes = f"""SIMPLIFIED NOTES\n\nMain Topic: {short_text[:80]}...\n\nKey Points:\n- Read the text carefully\n- Look for important ideas\n- Break them into smaller parts\n\nWhy This Matters:\nUnderstanding the basic ideas helps you learn better and remember longer."""
        fallback_flashcards = "Q: What is the main topic?\nA: The content covers important concepts you need to understand.\n\nQ: Why should you study this?\nA: Because it helps you learn and remember better."
        fallback_quiz = "1. What is the main idea?\nA. Not important\nB. Something you need to learn (correct)\nC. Only for smart students\nD. A waste of time"
        fallback_mindmap = "Main Topic\n├─ Key Ideas\n│  ├─ Idea 1\n│  └─ Idea 2\n└─ Examples\n   └─ Example 1"

        # ── Prompts ───────────────────────────────────────────────────────────
        notes_prompt = f"""You are a teacher helping a dyslexic student. Rewrite in simple, detailed notes.
Rules: simple words, short sentences (max 15 words), bullet points with dashes, NO markdown symbols, plain text headings only, min 300 words, cover ALL main ideas.
Text: {text}\nSimplified notes:"""

        flashcard_prompt = f"""Create 8-10 flashcards for a dyslexic student.
Format EXACTLY:
Q: Question here?
A: Answer here.

Text: {text}\nFlashcards:"""

        quiz_prompt = f"""Create a 5-question multiple choice quiz. Simple language. Mark correct with (correct).
Format EXACTLY:
1. Question?
A. Option
B. Option (correct)
C. Option
D. Option

Text: {text}\nQuiz:"""

        mindmap_prompt = f"""Create a detailed text mind map with 4-5 categories, 2-3 details each.
Use tree characters (├─ │ └─). Simple words.
Text: {text}\nMind Map:"""

        # ── Generate all 4 in parallel ────────────────────────────────────────
        simplified_notes = fallback_notes
        flashcards = fallback_flashcards
        quiz = fallback_quiz
        mind_map = fallback_mindmap

        with ThreadPoolExecutor(max_workers=4) as executor:
            nf = executor.submit(_generate_fn, notes_prompt,     "You are a dyslexia specialist teacher. Write detailed easy-to-read notes. NO markdown symbols.")
            ff = executor.submit(_generate_fn, flashcard_prompt, "Create flashcards using ONLY Q: and A: format.")
            qf = executor.submit(_generate_fn, quiz_prompt,      "Create a multiple choice quiz. Mark correct answer with (correct).")
            mf = executor.submit(_generate_fn, mindmap_prompt,   "Create a detailed text mind map using tree characters.")

            for label, future in [("notes", nf), ("flashcards", ff), ("quiz", qf), ("mindmap", mf)]:
                try:
                    result = future.result()
                    if label == "notes":        simplified_notes = result
                    elif label == "flashcards": flashcards = result
                    elif label == "quiz":       quiz = result
                    elif label == "mindmap":    mind_map = result
                    print(f"[OK] {label} generated")
                except Exception as e:
                    print(f"[WARN] {label} generation failed, using fallback: {e}")
                    traceback.print_exc()

        elapsed = time.time() - start_time
        print(f"[DONE] Content transformation complete in {elapsed:.1f}s")
        return {
            "simplifiedNotes": simplified_notes,
            "flashcards": flashcards,
            "quiz": quiz,
            "mindMap": mind_map,
            "processingTime": elapsed
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Content transformation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")


# ── Analytics / Recommendations ───────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    userId: str
    readingSessions: int = 0
    avgQuizScore: float = 0
    handwritingErrors: int = 0


@router.post("/api/analytics/recommend")
async def get_recommendations(request: RecommendationRequest):
    """Generate AI-powered learning recommendations based on user stats."""
    try:
        import json
        prompt = f"""Based on these learning statistics for a dyslexic student, provide 4-5 personalized practice recommendations:
- Reading sessions: {request.readingSessions}
- Average quiz score: {request.avgQuizScore}%
- Handwriting errors: {request.handwritingErrors}

Format as JSON array:
[{{"title": "...", "description": "...", "priority": "high|medium|low"}}]"""

        result = _generate_fn(prompt, "You are an educational psychologist. Respond with valid JSON only.")
        try:
            json_start = result.find('[')
            json_end = result.rfind(']') + 1
            recommendations = json.loads(result[json_start:json_end])
        except Exception:
            recommendations = [
                {"title": "Practice daily reading", "description": "Spend 15-20 minutes with the Reading Assistant.", "priority": "high"},
                {"title": "Review weak areas", "description": "Focus on topics where quiz scores are lowest.", "priority": "medium"},
            ]
        return {"recommendations": recommendations}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")