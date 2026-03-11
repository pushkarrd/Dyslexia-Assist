"""
FastAPI router for the dyslexia screening assessment endpoints.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import firebase_admin
from firebase_admin import firestore

from app.schemas.assessment import (
    AssessmentSubmitRequest,
    AssessmentResponse,
    AssessmentStartResponse,
    SeverityResult,
)
from app.services.severity_model import predict_severity

router = APIRouter(prefix="/assessment", tags=["Assessment"])


@router.get("/start", response_model=AssessmentStartResponse)
async def start_assessment():
    """Return the 10 screener questions, instructions, and answer scale."""
    try:
        return AssessmentStartResponse()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit", response_model=AssessmentResponse)
async def submit_assessment(request: AssessmentSubmitRequest):
    """Score the questionnaire, run the ML model, save to Firestore, and return results."""

    # Step 1 — validate question count
    if len(request.questionnaire_answers) != 10:
        raise HTTPException(
            status_code=422, detail="Exactly 10 questionnaire answers required"
        )

    # Step 2 — compute weighted questionnaire score (0-100)
    WEIGHTS = {6: 1.5, 7: 1.5}
    weighted_sum = sum(
        a.answer * WEIGHTS.get(a.question_id, 1.0)
        for a in request.questionnaire_answers
    )
    max_possible = sum(
        5 * WEIGHTS.get(a.question_id, 1.0) for a in request.questionnaire_answers
    )
    questionnaire_score = round((weighted_sum / max_possible) * 100, 2)

    # Step 3 — run ML prediction
    try:
        severity_result = predict_severity(
            task_results=[t.model_dump() for t in request.task_results],
            age=request.age,
            gender=request.gender,
            native_english=request.native_english,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="ML model not available. Contact support.")
    except Exception as e:
        print(f"ML prediction error: {e}")
        raise HTTPException(status_code=500, detail="Error processing assessment results")

    # Step 4 — personalised message
    messages = {
        "none": "Great news! No significant dyslexia indicators were found. Keep up the amazing work!",
        "mild": "Some mild indicators were found. A personalized plan will help you improve quickly.",
        "moderate": "Moderate indicators detected. Your custom learning path is ready — you have got this!",
        "severe": "Significant indicators found. We will support you every step of the way.",
    }
    message = messages.get(severity_result["label"], "Assessment complete.")

    # Step 5 — save to Firestore
    try:
        db = firestore.client()
        doc_data = {
            "user_id": request.user_id,
            "questionnaire_answers": [a.model_dump() for a in request.questionnaire_answers],
            "task_results": [t.model_dump() for t in request.task_results],
            "questionnaire_score": questionnaire_score,
            "severity_label": severity_result["label"],
            "severity_score": severity_result["score"],
            "severity_probability": severity_result["probability"],
            "group_scores": severity_result["group_scores"],
            "weakest_areas": severity_result["weakest_areas"],
            "recommendations": severity_result["recommendations"],
            "age": request.age,
            "gender": request.gender,
            "native_english": request.native_english,
            "total_duration_seconds": request.total_duration_seconds,
            "created_at": firestore.SERVER_TIMESTAMP,
        }
        doc_ref = db.collection("assessments").document()
        doc_ref.set(doc_data)
        assessment_id = doc_ref.id
    except Exception as e:
        print(f"Firestore save error: {e}")
        assessment_id = "local_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")

    # Step 6 — return response
    return AssessmentResponse(
        assessment_id=assessment_id,
        user_id=request.user_id,
        severity=SeverityResult(**severity_result),
        questionnaire_score=questionnaire_score,
        message=message,
        created_at=datetime.utcnow().isoformat(),
    )
