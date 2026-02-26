from __future__ import annotations

import json
from typing import Any

PROMPT_VERSION = "v2.1"


def build_pedagogy_block(context: dict[str, Any] | None) -> str:
    context = context or {}

    level = str(context.get("level") or "débutant")
    progress_percent = context.get("progressPercent")
    ai_tone = str(context.get("aiTone") or "Coach motivant et précis")
    pedagogical_style = str(context.get("pedagogicalStyle") or "Apprentissage actif")
    target_audience = str(context.get("targetAudience") or "Étudiant en progression")
    pass_threshold = context.get("passThreshold")
    weekly_goal_hours = context.get("weeklyGoalHours")

    progress_text = "inconnu" if progress_percent is None else str(progress_percent)
    pass_threshold_text = "inconnu" if pass_threshold is None else str(pass_threshold)
    weekly_goal_text = "inconnu" if weekly_goal_hours is None else str(weekly_goal_hours)

    return (
        f"Prompt-Version: {PROMPT_VERSION}\n"
        f"Niveau: {level}\n"
        f"Progression (%): {progress_text}\n"
        f"Ton IA attendu: {ai_tone}\n"
        f"Style pédagogique: {pedagogical_style}\n"
        f"Audience cible: {target_audience}\n"
        f"Seuil de validation (%): {pass_threshold_text}\n"
        f"Objectif hebdo (heures): {weekly_goal_text}\n"
    )


def extract_json_payload(raw_text: str) -> str:
    content = (raw_text or "").strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if len(lines) >= 3:
            content = "\n".join(lines[1:-1]).strip()
    return content


def parse_json_response(raw_text: str) -> dict[str, Any]:
    payload = extract_json_payload(raw_text)
    parsed = json.loads(payload)
    if not isinstance(parsed, dict):
        raise ValueError("Expected JSON object")
    return parsed
