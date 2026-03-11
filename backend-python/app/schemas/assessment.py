"""
Pydantic v2 schemas for the dyslexia screening assessment feature.
"""

from pydantic import BaseModel, model_validator, Field
from typing import List, Dict, Optional
from datetime import datetime


class TaskResult(BaseModel):
    task_number: int
    game_type: str = ""
    clicks: int = 0
    hits: int = 0
    misses: int = 0
    score: float = 0.0
    accuracy: float = 0.0
    missrate: float = 0.0
    duration_seconds: Optional[float] = None


class QuestionnaireAnswer(BaseModel):
    question_id: int
    question_text: str
    answer: int  # 1-5
    category: str


class AssessmentSubmitRequest(BaseModel):
    user_id: str
    questionnaire_answers: List[QuestionnaireAnswer]
    task_results: List[TaskResult]
    age: int = 10
    gender: str = "prefer_not_to_say"
    native_english: bool = True
    total_duration_seconds: Optional[float] = None

    @model_validator(mode="after")
    def check_question_count(self):
        if len(self.questionnaire_answers) != 10:
            raise ValueError("Exactly 10 questionnaire answers are required")
        return self


class SeverityResult(BaseModel):
    probability: float
    label: str
    display: str
    score: int
    color: str
    confidence: float
    group_scores: Dict[str, float]
    weakest_areas: List[str]
    recommendations: List[str]


class AssessmentResponse(BaseModel):
    assessment_id: str
    user_id: str
    severity: SeverityResult
    questionnaire_score: float
    message: str
    created_at: str


# ---------------------------------------------------------------------------
# Screener questions (10 items across 8 cognitive / emotional categories)
# ---------------------------------------------------------------------------

SCREENER_QUESTIONS: List[dict] = [
    {
        "id": 1,
        "text": "Do you find it hard to recognize when two words rhyme, like cat and hat?",
        "category": "phonological",
        "hint": "e.g. cat and hat rhyme, dog and log rhyme",
    },
    {
        "id": 2,
        "text": "Is it hard to sound out a brand new or made-up word you have never seen before?",
        "category": "phonological",
        "hint": "Tests your phonics decoding ability",
    },
    {
        "id": 3,
        "text": "How often do you confuse letters that look similar, like b and d, or p and q?",
        "category": "phoneme_grapheme",
        "hint": "Letter reversal is very common in dyslexia",
    },
    {
        "id": 4,
        "text": "Do you lose your place while reading a line of text and have to re-read it?",
        "category": "lexical",
        "hint": "This is called tracking difficulty",
    },
    {
        "id": 5,
        "text": "Do you make spelling mistakes in words you have seen many times before?",
        "category": "orthographic",
        "hint": "Visual word memory difficulty",
    },
    {
        "id": 6,
        "text": "Are you confused by word endings like -ing, -ed, -tion, or -ness?",
        "category": "morphological",
        "hint": "This area has the strongest link to dyslexia",
    },
    {
        "id": 7,
        "text": "Is it hard to recognize that run, running, and runner all come from the same root word?",
        "category": "morphological",
        "hint": "Called morphological awareness",
    },
    {
        "id": 8,
        "text": "Do you often have to re-read sentences multiple times to understand the meaning?",
        "category": "syntactic",
        "hint": "Sentence comprehension difficulty",
    },
    {
        "id": 9,
        "text": "Do you forget a word mid-sentence while you are speaking or reading?",
        "category": "working_memory",
        "hint": "Working memory plays a key role in reading",
    },
    {
        "id": 10,
        "text": "Do you feel anxious or tend to avoid situations where you have to read aloud?",
        "category": "emotional",
        "hint": "Emotional impact is an important indicator",
    },
]


class AssessmentStartResponse(BaseModel):
    questions: List[dict] = Field(default_factory=lambda: SCREENER_QUESTIONS)
    instructions: str = (
        "Answer honestly — there are no right or wrong answers. "
        "This helps us personalize your learning path."
    )
    estimated_minutes: int = 4
    answer_scale: dict = Field(
        default_factory=lambda: {
            "1": "Never",
            "2": "Rarely",
            "3": "Sometimes",
            "4": "Often",
            "5": "Always",
        }
    )
