"""
Assessment data model (plain dataclass — Firebase is the persistence layer).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional


@dataclass
class AssessmentRecord:
    """Mirrors the Firestore document structure for an assessment."""

    user_id: str
    questionnaire_answers: List[dict] = field(default_factory=list)
    task_results: List[dict] = field(default_factory=list)
    questionnaire_score: float = 0.0
    severity_label: str = "none"
    severity_score: int = 0
    severity_probability: float = 0.0
    group_scores: Dict[str, float] = field(default_factory=dict)
    weakest_areas: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    age: int = 10
    gender: str = "prefer_not_to_say"
    native_english: bool = True
    total_duration_seconds: Optional[float] = None
    created_at: Optional[datetime] = None

    def to_firestore_dict(self) -> dict:
        """Serialise to a plain dict suitable for Firestore."""
        data = {
            "user_id": self.user_id,
            "questionnaire_answers": self.questionnaire_answers,
            "task_results": self.task_results,
            "questionnaire_score": self.questionnaire_score,
            "severity_label": self.severity_label,
            "severity_score": self.severity_score,
            "severity_probability": self.severity_probability,
            "group_scores": self.group_scores,
            "weakest_areas": self.weakest_areas,
            "recommendations": self.recommendations,
            "age": self.age,
            "gender": self.gender,
            "native_english": self.native_english,
            "total_duration_seconds": self.total_duration_seconds,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
        }
        return data

    @classmethod
    def from_firestore_dict(cls, doc_id: str, data: dict) -> "AssessmentRecord":
        """Build an AssessmentRecord from a Firestore document dict."""
        created = data.get("created_at")
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created)
            except (ValueError, TypeError):
                created = None

        return cls(
            user_id=data.get("user_id", ""),
            questionnaire_answers=data.get("questionnaire_answers", []),
            task_results=data.get("task_results", []),
            questionnaire_score=data.get("questionnaire_score", 0.0),
            severity_label=data.get("severity_label", "none"),
            severity_score=data.get("severity_score", 0),
            severity_probability=data.get("severity_probability", 0.0),
            group_scores=data.get("group_scores", {}),
            weakest_areas=data.get("weakest_areas", []),
            recommendations=data.get("recommendations", []),
            age=data.get("age", 10),
            gender=data.get("gender", "prefer_not_to_say"),
            native_english=data.get("native_english", True),
            total_duration_seconds=data.get("total_duration_seconds"),
            created_at=created,
        )
