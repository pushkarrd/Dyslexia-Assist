"""
Dyslexia severity prediction service using pre-trained Random Forest classifier.
Loads dyslexai_severity_model.pkl and provides prediction + recommendation functions.
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional

MODEL_PATH = Path(__file__).parent.parent / "ml" / "models" / "dyslexai_severity_model.pkl"
_package: Optional[dict] = None


def load_model() -> dict:
    """Load the pre-trained severity model from disk (cached after first call)."""
    global _package
    if _package is not None:
        return _package

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Place dyslexai_severity_model.pkl in app/ml/models/"
        )

    pkg = joblib.load(MODEL_PATH)
    metrics = pkg.get("metrics", {})
    f1 = metrics.get("f1", 0.0)
    auc = metrics.get("auc", 0.0)
    model_name = type(pkg["model"]).__name__
    print(f"✅ Severity model loaded: {model_name} | F1={f1:.3f} | AUC={auc:.3f}")

    _package = pkg
    return _package


def _fix_accuracy(val: Any) -> float:
    """Fix accuracy/missrate values that may be encoded as decimal * 1000."""
    if val is None:
        return 0.0
    try:
        fval = float(val)
    except (ValueError, TypeError):
        return 0.0
    if np.isnan(fval):
        return 0.0
    if fval > 1.0:
        return fval / 1000.0
    return fval


COGNITIVE_GROUPS: Dict[str, List[int]] = {
    "letter_recognition": [1, 2, 3],
    "phoneme_grapheme": [4, 5, 6],
    "lexical_decision": [7, 8, 9],
    "phonological_awareness": [10, 11, 12],
    "orthographic": [13, 14, 15],
    "visual_word_recog": [16, 17, 18],
    "nonword_reading": [19, 20, 21],
    "morphological": [22, 23, 24],
    "syntactic": [25, 26],
    "working_memory": [27, 28, 29, 30],
    "rapid_naming": [31, 32],
}


def build_feature_vector(
    task_results: List[Dict],
    age: int,
    gender: str,
    native_english: bool,
) -> pd.DataFrame:
    """Build a 188-feature DataFrame row from raw task results + demographics."""
    task_lookup: Dict[int, Dict] = {t["task_number"]: t for t in task_results}
    row: Dict[str, float] = {}

    # Step B — per-task features
    for i in range(1, 33):
        t = task_lookup.get(i, {})
        row[f"acc_t{i}"] = _fix_accuracy(t.get("accuracy", 0))
        row[f"miss_t{i}"] = _fix_accuracy(t.get("missrate", 0))
        row[f"score_t{i}"] = float(t.get("score", 0))
        row[f"clicks_t{i}"] = float(t.get("clicks", 0))

    # Step C — cognitive group aggregates
    for group, tasks in COGNITIVE_GROUPS.items():
        accs = [row[f"acc_t{t}"] for t in tasks]
        misses = [row[f"miss_t{t}"] for t in tasks]
        scores = [row[f"score_t{t}"] for t in tasks]
        row[f"{group}_mean_acc"] = float(np.mean(accs))
        row[f"{group}_min_acc"] = float(np.min(accs))
        row[f"{group}_mean_miss"] = float(np.mean(misses))
        row[f"{group}_total_score"] = float(np.sum(scores))

    # Step D — overall summary features
    all_accs = [row[f"acc_t{i}"] for i in range(1, 33)]
    all_misses = [row[f"miss_t{i}"] for i in range(1, 33)]
    total_hits = sum(float(task_lookup.get(i, {}).get("hits", 0)) for i in range(1, 33))
    total_clicks = sum(row[f"clicks_t{i}"] for i in range(1, 33))

    row["overall_mean_accuracy"] = float(np.mean(all_accs))
    row["overall_std_accuracy"] = float(np.std(all_accs))
    row["overall_min_accuracy"] = float(np.min(all_accs))
    row["overall_max_accuracy"] = float(np.max(all_accs))
    row["overall_mean_missrate"] = float(np.mean(all_misses))
    row["overall_total_hits"] = total_hits
    row["overall_total_clicks"] = total_clicks
    row["global_hit_rate"] = (total_hits / total_clicks) if total_clicks > 0 else 0.0
    row["tasks_zero_accuracy"] = sum(1 for a in all_accs if a == 0)

    # Step E — top discriminative task aggregates
    top_disc = [23, 26, 4, 19, 25, 22, 5, 6, 24, 20]
    row["top_disc_mean_acc"] = float(np.mean([row[f"acc_t{t}"] for t in top_disc]))
    row["top_disc_mean_miss"] = float(np.mean([row[f"miss_t{t}"] for t in top_disc]))

    # Step F — demographics
    row["age"] = float(age)
    row["is_male"] = 1 if gender.lower() == "male" else 0
    row["is_native"] = 1 if native_english else 0
    row["other_lang"] = 0

    # Step G — build DataFrame aligned to model's expected columns
    df = pd.DataFrame([row])
    pkg = load_model()
    for col in pkg["feature_names"]:
        if col not in df.columns:
            df[col] = 0.0
    df = df[pkg["feature_names"]]
    df = df.replace([np.inf, -np.inf], 0).fillna(0)
    return df


def predict_severity(
    task_results: List[Dict],
    age: int = 10,
    gender: str = "unknown",
    native_english: bool = True,
) -> dict:
    """Run the full prediction pipeline and return a structured result dict."""
    pkg = load_model()
    X_df = build_feature_vector(task_results, age, gender, native_english)

    if pkg.get("needs_scaling") and pkg.get("scaler") is not None:
        X_input = pkg["scaler"].transform(X_df)
    else:
        X_input = X_df.values

    prob = float(pkg["model"].predict_proba(X_input)[0][1])

    # Map probability to severity tier
    if prob < 0.30:
        label, display, color = "none", "No Indicators", "#10B981"
    elif prob < 0.55:
        label, display, color = "mild", "Mild", "#F59E0B"
    elif prob < 0.75:
        label, display, color = "moderate", "Moderate", "#F97316"
    else:
        label, display, color = "severe", "Severe", "#EF4444"

    # Compute per-group accuracy scores (0-100)
    task_lookup: Dict[int, Dict] = {t["task_number"]: t for t in task_results}
    group_scores: Dict[str, float] = {}
    for group_name, tasks in COGNITIVE_GROUPS.items():
        accs = [_fix_accuracy(task_lookup.get(t, {}).get("accuracy", 0)) for t in tasks]
        group_scores[group_name] = round(float(np.mean(accs)) * 100, 1)

    weakest_areas = [
        name for name, _ in sorted(group_scores.items(), key=lambda x: x[1])[:3]
    ]
    recommendations = _get_recommendations(label, weakest_areas)

    return {
        "probability": round(prob, 4),
        "label": label,
        "display": display,
        "score": int(round(prob * 100)),
        "color": color,
        "confidence": round(max(prob, 1 - prob), 4),
        "group_scores": group_scores,
        "weakest_areas": weakest_areas,
        "recommendations": recommendations,
    }


def _get_recommendations(severity: str, weak_groups: List[str]) -> List[str]:
    """Return up to 5 actionable recommendations based on severity + weak cognitive groups."""
    base: Dict[str, List[str]] = {
        "none": [
            "Keep reading daily!",
            "Challenge yourself with longer texts",
            "Explore advanced vocabulary games",
        ],
        "mild": [
            "Practice phonics games for 15 minutes daily",
            "Use text-to-speech for long reading passages",
            "Track your progress weekly",
        ],
        "moderate": [
            "Daily phonics drills are strongly recommended",
            "Enable OpenDyslexic font in your reader settings",
            "Work with a reading coach 3 times per week",
        ],
        "severe": [
            "Daily 1-on-1 reading sessions are recommended",
            "Start from letter-sound basics",
            "Enable all accessibility tools in settings",
        ],
    }

    group_tips: Dict[str, str] = {
        "phoneme_grapheme": "Practice sound-to-letter matching games daily",
        "morphological": "Work on word families and endings (-ing, -ed, -ness)",
        "syntactic": "Read simple sentences aloud every day",
        "nonword_reading": "Practice phonics blending with nonsense words",
        "letter_recognition": "Do letter shape recognition drills (b/d/p/q)",
        "phonological_awareness": "Play rhyming and syllable clapping games",
        "orthographic": "Practice common English spelling patterns",
        "working_memory": "Try letter and number sequence memory games",
        "lexical_decision": "Practice rapid word recognition flashcards",
        "visual_word_recog": "Read along with audio books to match sound and text",
        "rapid_naming": "Play timed letter and object naming games",
    }

    recs: List[str] = list(base.get(severity, base["none"]))
    for wg in weak_groups:
        tip = group_tips.get(wg)
        if tip and tip not in recs:
            recs.append(tip)

    return recs[:5]
