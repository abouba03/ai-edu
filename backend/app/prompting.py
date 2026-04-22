from __future__ import annotations

import json
from typing import Any

PROMPT_VERSION = "v2.1"


def build_pedagogy_block(context: dict[str, Any] | None) -> str:
    context = context or {}

    level = str(context.get("level") or "начинающий")
    progress_percent = context.get("progressPercent")
    ai_tone = str(context.get("aiTone") or "Доброжелательный и точный наставник")
    pedagogical_style = str(context.get("pedagogicalStyle") or "Пошаговое активное обучение")
    target_audience = str(context.get("targetAudience") or "Ученик")
    pass_threshold = context.get("passThreshold")
    weekly_goal_hours = context.get("weeklyGoalHours")

    progress_text = "inconnu" if progress_percent is None else str(progress_percent)
    pass_threshold_text = "inconnu" if pass_threshold is None else str(pass_threshold)
    weekly_goal_text = "inconnu" if weekly_goal_hours is None else str(weekly_goal_hours)

    return (
        f"Prompt-Version: {PROMPT_VERSION}\n"
        f"Язык ответа: русский (простой).\n"
        f"Уровень: {level}\n"
        f"Прогресс (%): {progress_text}\n"
        f"Тон ИИ: {ai_tone}\n"
        f"Стиль обучения: {pedagogical_style}\n"
        f"Целевая аудитория: {target_audience}\n"
        f"Порог успеха (%): {pass_threshold_text}\n"
        f"Цель на неделю (часы): {weekly_goal_text}\n"
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
