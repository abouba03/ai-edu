from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings
from app.prompting import build_pedagogy_block, parse_json_response
from typing import Any
import ast
import re
import traceback
import io
from contextlib import redirect_stdout

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")


def _normalize_item(text: str, max_len: int = 120) -> str:
    normalized = " ".join(text.replace("\n", " ").split()).strip("-• ")
    if len(normalized) <= max_len:
        return normalized
    return normalized[: max_len - 1].rstrip() + "…"


def _to_short_list(value: Any, max_items: int = 2, max_len: int = 120) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for raw in value:
        if not isinstance(raw, str):
            continue
        item = _normalize_item(raw, max_len=max_len)
        if not item:
            continue
        if item.lower().startswith("il semble que la solution"):
            continue
        if item.lower().startswith("néanmoins"):
            continue
        if item not in cleaned:
            cleaned.append(item)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _short_comment(value: Any, max_len: int = 280) -> str:
    if not isinstance(value, str):
        return ""
    text = " ".join(value.replace("\n", " ").split())
    text = text.replace("Il semble que la solution proposée n'a pas été incluse dans votre message, donc je ne peux pas l'évaluer directement.", "")
    text = text.replace("Néanmoins, je suis là pour vous guider sur comment aborder ce type de problème.", "")
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _is_valid_function_name(name: str) -> bool:
    return bool(re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name))


def _safe_literal_eval(value: str) -> Any:
    if not isinstance(value, str) or len(value) > 2000:
        raise ValueError("Literal invalide ou trop long")
    return ast.literal_eval(value)


def _generate_dynamic_test_suite(challenge_description: str, pedagogy_context: dict[str, Any] | None = None) -> dict[str, Any] | None:
    pedagogy_block = build_pedagogy_block(pedagogy_context)
    prompt = f"""
{pedagogy_block}

Ты генератор тестов Python для учебной задачи.
Условие задачи:
{challenge_description}

Цель:
- Определи ожидаемую функцию (имя и сигнатура).
- Предложи 3-5 уместных unit-тестов.
- Каждый тест должен быть однозначным и исполняемым.

Строгие правила:
- Верни только валидный JSON.
- `function_name` должен быть корректным идентификатором Python.
- `args_literal` должен быть сериализованным списком Python.
- `expected_literal` должен быть сериализованным ожидаемым значением.
- Не добавляй полное решение задачи.

Ожидаемый JSON:
{{
  "prompt_version": "v3.1-tests-gen",
  "function_name": "nom_fonction",
  "tests": [
    {{"name": "cas 1", "args_literal": "[...]", "expected_literal": "..."}},
    {{"name": "cas 2", "args_literal": "[...]", "expected_literal": "..."}}
  ]
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
    except Exception:
        return None

    raw = response.choices[0].message.content or ""
    try:
        parsed = parse_json_response(raw)
    except Exception:
        return None

    function_name = str(parsed.get("function_name") or "").strip()
    tests_raw = parsed.get("tests") if isinstance(parsed.get("tests"), list) else []

    if not function_name or not _is_valid_function_name(function_name):
        return None

    tests: list[dict[str, Any]] = []
    for item in tests_raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "test").strip() or "test"
        args_literal = str(item.get("args_literal") or "").strip()
        expected_literal = str(item.get("expected_literal") or "").strip()
        if not args_literal or not expected_literal:
            continue
        try:
            args = _safe_literal_eval(args_literal)
            expected = _safe_literal_eval(expected_literal)
            if not isinstance(args, list):
                continue
        except Exception:
            continue

        tests.append({
            "name": name,
            "args": args,
            "expected": expected,
        })
        if len(tests) >= 5:
            break

    if len(tests) < 2:
        return None

    return {
        "id": "dynamic-generated",
        "mode": "function",
        "function_name": function_name,
        "tests": tests,
    }


def _generate_dynamic_stdio_test_suite(challenge_description: str, pedagogy_context: dict[str, Any] | None = None) -> dict[str, Any] | None:
    pedagogy_block = build_pedagogy_block(pedagogy_context)
    prompt = f"""
{pedagogy_block}

Ты генератор тестов для интерактивного Python-скрипта (input/print).
Условие задачи:
{challenge_description}

Цель:
- Предложи 3-5 тестов вход/выход для проверки скрипта.
- Каждый тест должен задавать входные данные и ожидаемый итоговый вывод.

Строгие правила:
- Верни только валидный JSON.
- `stdin_lines` — список строк для input по порядку.
- `expected_stdout` — ожидаемый итоговый вывод.
- Не добавляй полное решение.

Ожидаемый JSON:
{{
  "prompt_version": "v3.1-stdio-tests-gen",
  "tests": [
    {{"name": "cas 1", "stdin_lines": ["..."], "expected_stdout": "..."}},
    {{"name": "cas 2", "stdin_lines": ["..."], "expected_stdout": "..."}}
  ]
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
    except Exception:
        return None

    raw = response.choices[0].message.content or ""
    try:
        parsed = parse_json_response(raw)
    except Exception:
        return None

    tests_raw = parsed.get("tests") if isinstance(parsed.get("tests"), list) else []
    tests: list[dict[str, Any]] = []

    for item in tests_raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "test").strip() or "test"
        stdin_lines_raw = item.get("stdin_lines")
        expected_stdout = str(item.get("expected_stdout") or "").strip()

        if not isinstance(stdin_lines_raw, list) or not expected_stdout:
            continue

        stdin_lines: list[str] = []
        for value in stdin_lines_raw:
            if isinstance(value, (str, int, float, bool)):
                stdin_lines.append(str(value))

        tests.append({
            "name": name,
            "stdin_lines": stdin_lines,
            "expected_stdout": expected_stdout,
        })
        if len(tests) >= 5:
            break

    if len(tests) < 2:
        return None

    return {
        "id": "dynamic-generated-stdio",
        "mode": "script",
        "tests": tests,
    }


def _normalize_stdout(value: Any) -> str:
    return "\n".join(str(value or "").replace("\r\n", "\n").strip().splitlines()).strip()


def _run_test_suite(student_code: str, suite: dict[str, Any]) -> dict[str, Any]:
    mode = str(suite.get("mode") or "function").strip().lower()

    if mode == "script":
        tests = suite.get("tests") if isinstance(suite.get("tests"), list) else []
        results: list[dict[str, Any]] = []
        passed = 0

        for test_case in tests:
            if not isinstance(test_case, dict):
                continue

            test_name = str(test_case.get("name") or "test")
            stdin_lines = test_case.get("stdin_lines") if isinstance(test_case.get("stdin_lines"), list) else []
            stdin_values = [str(item) for item in stdin_lines]
            expected_stdout = _normalize_stdout(test_case.get("expected_stdout"))

            iterator = iter(stdin_values)

            def fake_input(_: str = "") -> str:
                try:
                    return next(iterator)
                except StopIteration:
                    raise RuntimeError("Недостаточно входных данных для этого теста")

            output_buffer = io.StringIO()
            namespace: dict[str, Any] = {"__builtins__": __builtins__}
            namespace["input"] = fake_input

            try:
                with redirect_stdout(output_buffer):
                    exec(student_code, namespace, namespace)
                actual_stdout = _normalize_stdout(output_buffer.getvalue())
                ok = actual_stdout == expected_stdout
                if ok:
                    passed += 1
                results.append({
                    "name": test_name,
                    "status": "passed" if ok else "failed",
                    "input": repr(stdin_values),
                    "expected": repr(expected_stdout),
                    "actual": repr(actual_stdout),
                })
            except Exception as exc:
                results.append({
                    "name": test_name,
                    "status": "error",
                    "input": repr(stdin_values),
                    "expected": repr(expected_stdout),
                    "actual": "<exception>",
                    "error": str(exc),
                })

        total = len(tests)
        failed = total - passed
        return {
            "suite_id": suite.get("id", "dynamic-generated-stdio"),
            "mode": "script",
            "function_name": "",
            "total": total,
            "passed": passed,
            "failed": failed,
            "all_passed": passed == total and total > 0,
            "runtime_error": "",
            "results": results,
        }

    namespace: dict[str, Any] = {}
    try:
        exec(student_code, {"__builtins__": __builtins__}, namespace)
    except Exception as exc:
        return {
            "suite_id": suite["id"],
            "mode": "function",
            "function_name": suite["function_name"],
            "total": len(suite["tests"]),
            "passed": 0,
            "failed": len(suite["tests"]),
            "all_passed": False,
            "runtime_error": f"Ошибка выполнения: {exc}",
            "results": [],
            "trace": traceback.format_exc(limit=1),
        }

    func = namespace.get(suite["function_name"])
    if not callable(func):
        return {
            "suite_id": suite["id"],
            "mode": "function",
            "function_name": suite["function_name"],
            "total": len(suite["tests"]),
            "passed": 0,
            "failed": len(suite["tests"]),
            "all_passed": False,
            "runtime_error": f"Функция `{suite['function_name']}` не найдена.",
            "results": [],
        }

    results: list[dict[str, Any]] = []
    passed = 0
    for test_case in suite["tests"]:
        args = test_case.get("args", [])
        expected = test_case.get("expected")
        test_name = str(test_case.get("name") or "test")

        try:
            actual = func(*args)
            ok = actual == expected
            if ok:
                passed += 1
            results.append({
                "name": test_name,
                "status": "passed" if ok else "failed",
                "input": repr(args),
                "expected": repr(expected),
                "actual": repr(actual),
            })
        except Exception as exc:
            results.append({
                "name": test_name,
                "status": "error",
                "input": repr(args),
                "expected": repr(expected),
                "actual": "<exception>",
                "error": str(exc),
            })

    total = len(suite["tests"])
    failed = total - passed
    return {
        "suite_id": suite["id"],
        "mode": "function",
        "function_name": suite["function_name"],
        "total": total,
        "passed": passed,
        "failed": failed,
        "all_passed": passed == total,
        "runtime_error": "",
        "results": results,
    }


def _test_based_submission_feedback(challenge_description: str, student_code: str, pedagogy_context: dict[str, Any] | None = None) -> dict[str, Any] | None:
    code_looks_like_script = "def " not in student_code

    if code_looks_like_script:
        suite = _generate_dynamic_stdio_test_suite(challenge_description, pedagogy_context)
        if suite is None:
            suite = _generate_dynamic_test_suite(challenge_description, pedagogy_context)
    else:
        suite = _generate_dynamic_test_suite(challenge_description, pedagogy_context)
        if suite is None:
            suite = _generate_dynamic_stdio_test_suite(challenge_description, pedagogy_context)

    if suite is None:
        return None

    return _test_feedback_from_suite(student_code, suite, prompt_version="v3.1-tests-hybrid")


def _fallback_submission_feedback(student_code: str, challenge_description: str = "") -> dict[str, Any]:
        stripped = student_code.strip()
        lower_code = stripped.lower()
        code_len = len(stripped)
        has_function = "def " in lower_code
        has_return = "return " in lower_code

        if code_len < 20:
            note = "2/10"
            commentaire = "Код слишком короткий для проверки. Добавь рабочее решение и отправь снова."
            consignes = ["Напиши хотя бы одну полную функцию по условию."]
            idees = ["Начни с минимальной версии для простого случая."]
            prochaines = ["Отправь рабочую версию, даже базовую."]
        elif not has_function:
            note = "4/10"
            commentaire = "Логика есть, но требуемая функция не определена явно."
            consignes = ["Явно объяви функцию, которая нужна по условию."]
            idees = ["Проверь имя функции и параметры."]
            prochaines = ["Отправь снова после правки структуры функции."]
        elif not has_return:
            note = "4/10"
            commentaire = "Структура есть, но ожидаемое значение не возвращается корректно."
            consignes = ["Добавь явный return с ожидаемым результатом."]
            idees = ["Проверь функцию на простом входе и сравни вывод."]
            prochaines = ["Исправь return и отправь снова."]
        else:
            note = "6/10"
            commentaire = "Хорошая база. Уточни логику, чтобы точно выполнить критерии задачи."
            consignes = ["Проверь каждое условие и каждый ожидаемый результат."]
            idees = ["Прогони несколько типичных случаев и найди расхождения."]
            prochaines = ["Исправь один конкретный сбой и отправь снова."]

        formatted = f"Оценка: {note}\nКомментарий: {commentaire}\nЧто сделать:\n- {consignes[0]}\nИдея:\n- {idees[0]}\nДальше:\n- {prochaines[0]}"
        return {
                "evaluation": formatted,
                "evaluation_json": {
                        "prompt_version": "v2.3-fallback-submit",
                        "note": note,
                        "commentaire": commentaire,
                        "consignes": consignes,
                        "idees": idees,
                        "prochaines_etapes": prochaines,
                },
                "source": "fallback-submit",
        }

class SubmissionRequest(BaseModel):
    challenge_description: str
    student_code: str
    challenge_tests: dict[str, Any] | None = None
    pedagogy_context: dict[str, Any] | None = None

class ChallengeRequest(BaseModel):
    level: str = "intermédiaire"
    language: str = "Python"
    challenge_topic: str | None = None
    course_description: str | None = None
    pedagogy_context: dict[str, Any] | None = None


def _build_suite_from_generated_tests(challenge_tests: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(challenge_tests, dict):
        return None

    mode = str(challenge_tests.get("mode") or "function").strip().lower()
    tests_raw = challenge_tests.get("test_cases") if isinstance(challenge_tests.get("test_cases"), list) else []

    if mode == "script":
        tests: list[dict[str, Any]] = []
        for item in tests_raw:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "test").strip() or "test"
            stdin_lines = item.get("stdin_lines") if isinstance(item.get("stdin_lines"), list) else []
            expected_stdout = str(item.get("expected_stdout") or "").strip()
            if not expected_stdout:
                continue
            normalized_inputs = [str(value) for value in stdin_lines if isinstance(value, (str, int, float, bool))]
            tests.append({
                "name": name,
                "stdin_lines": normalized_inputs,
                "expected_stdout": expected_stdout,
            })
            if len(tests) >= 8:
                break

        if len(tests) < 2:
            return None

        return {
            "id": "generated-challenge-suite",
            "mode": "script",
            "tests": tests,
        }

    function_name = str(challenge_tests.get("function_name") or "").strip()
    if not function_name or not _is_valid_function_name(function_name):
        return None

    tests: list[dict[str, Any]] = []
    for item in tests_raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "test").strip() or "test"

        args_value = item.get("args")
        expected_value = item.get("expected")
        if isinstance(args_value, list):
            args = args_value
            expected = expected_value
        else:
            args_literal = str(item.get("args_literal") or "").strip()
            expected_literal = str(item.get("expected_literal") or "").strip()
            if not args_literal or not expected_literal:
                continue
            try:
                args = _safe_literal_eval(args_literal)
                expected = _safe_literal_eval(expected_literal)
            except Exception:
                continue

        if not isinstance(args, list):
            continue

        tests.append({
            "name": name,
            "args": args,
            "expected": expected,
        })
        if len(tests) >= 8:
            break

    if len(tests) < 2:
        return None

    return {
        "id": "generated-challenge-suite",
        "mode": "function",
        "function_name": function_name,
        "tests": tests,
    }


def _test_feedback_from_suite(student_code: str, suite: dict[str, Any], prompt_version: str) -> dict[str, Any]:
    report = _run_test_suite(student_code, suite)
    total = int(report.get("total", 0))
    passed = int(report.get("passed", 0))
    runtime_error = str(report.get("runtime_error") or "")
    test_mode = str(report.get("mode") or "function")
    results = report.get("results", []) if isinstance(report.get("results"), list) else []

    if runtime_error:
        note = "1/10"
        commentaire = "Код нельзя проверить: выполнение падает до тестов. Сначала исправь ошибку запуска."
        consignes = ["Исправь ошибку выполнения перед повторной отправкой."]
        idees = ["Проверь синтаксис и сравни поведение с ожидаемым."]
        prochaines = ["Запусти тесты снова после исправления."]
    else:
        score = 0 if total == 0 else round((passed / total) * 10)
        if score < 1 and total > 0:
            score = 1
        note = f"{score}/10"

        if total > 0 and passed == total:
            commentaire = "Все тесты пройдены. Решение соответствует условиям задачи."
            consignes = ["Сохрани эту логику и ясность решения."]
            idees = ["Можно добавить дополнительные тесты для надежности."]
            prochaines = ["Переходи к следующей задаче."]
        else:
            commentaire = f"Пройдено {passed}/{total} тестов. Есть прогресс, но часть условий еще не выполнена."
            consignes = ["Сначала исправь первый непройденный тест."]
            idees = ["Сравни фактический и ожидаемый вывод по каждому тесту."]
            prochaines = ["После точечной правки отправь решение снова."]

    failed_test_names = [item.get("name") for item in results if isinstance(item, dict) and item.get("status") in {"failed", "error"}]
    failed_test_names = [str(name) for name in failed_test_names if isinstance(name, str)]

    summary_line = f"Тесты: {passed}/{total}"
    if failed_test_names:
        summary_line += f" | Исправить: {', '.join(failed_test_names[:2])}"

    formatted = (
        f"Оценка: {note}\n"
        f"Комментарий: {commentaire}\n"
        f"{summary_line}\n"
        f"Что сделать:\n- {consignes[0]}\n"
        f"Идея:\n- {idees[0]}\n"
        f"Дальше:\n- {prochaines[0]}"
    )

    return {
        "evaluation": formatted,
        "evaluation_json": {
            "prompt_version": prompt_version,
            "note": note,
            "commentaire": commentaire,
            "consignes": consignes,
            "idees": idees,
            "prochaines_etapes": prochaines,
            "evaluation_mode": "tests",
            "test_mode": test_mode,
            "test_summary": {
                "passed": passed,
                "total": total,
                "all_passed": total > 0 and passed == total,
                "runtime_error": runtime_error,
            },
            "test_results": results,
        },
        "source": "tests-engine",
    }


@router.post("/submit-challenge/")
async def submit_challenge(req: SubmissionRequest):
    if not req.student_code.strip() or len(req.student_code.strip()) < 6:
        return {
            "evaluation": (
                "Оценка: 0/10\n"
                "Комментарий: Код не найден. Добавь минимально рабочее решение и отправь снова.\n"
                "Что сделать:\n"
                "- Добавь хотя бы одну функцию или полный логический блок\n"
                "Идея:\n"
                "- Начни с простой версии, которая проходит один тест\n"
                "Дальше:\n"
                "- Отправь первую версию, даже если она неполная"
            ),
            "evaluation_json": {
                "prompt_version": "v2.3",
                "note": "0/10",
                "commentaire": "Код не найден. Добавь минимально рабочее решение и отправь снова.",
                "consignes": ["Добавь хотя бы одну функцию или полный логический блок"],
                "idees": ["Начни с простой версии, которая проходит один тест"],
                "prochaines_etapes": ["Отправь первую версию, даже если она неполная"],
            },
        }

    generated_suite = _build_suite_from_generated_tests(req.challenge_tests or {}) if req.challenge_tests else None
    if generated_suite is not None:
        return _test_feedback_from_suite(req.student_code, generated_suite, prompt_version="v3.2-generated-suite")

    tests_feedback = _test_based_submission_feedback(req.challenge_description, req.student_code, req.pedagogy_context)
    if tests_feedback is not None:
        return tests_feedback

    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    prompt = f"""
{pedagogy_block}

Вот условие задачи:

{req.challenge_description}

Вот решение студента:

{req.student_code}

1. Проанализируй решение и проверь корректность.
2. Поставь оценку по шкале 10.
3. Дай короткий практичный комментарий (до 2 фраз).
4. Дай только короткие пункты: что сделать, идея, дальше.

ВАЖНЫЕ ПРАВИЛА:
- Не давай полное готовое решение.
- Не давай полный исполняемый код ответа.
- Не давай прямой окончательный ответ задачи.
- Можно давать короткие общие алгоритмические подсказки.
- Если код есть, не пиши, что решение отсутствует.
- Ответ должен быть коротким.

Пиши только на простом русском языке.
Верни строго JSON:
{{
    "prompt_version": "v2.3",
    "note": ".../10",
    "commentaire": "до 280 символов",
    "consignes": ["максимум 1-2 пункта"],
    "idees": ["максимум 1-2 пункта"],
    "prochaines_etapes": ["максимум 1-2 пункта"]
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )
    except Exception:
        return _fallback_submission_feedback(req.student_code, req.challenge_description)

    raw = response.choices[0].message.content or ""
    try:
        parsed = parse_json_response(raw)
        note = str(parsed.get("note") or "N/A")
        commentaire = _short_comment(parsed.get("commentaire"))
        consignes = _to_short_list(parsed.get("consignes"), max_items=2)
        idees = _to_short_list(parsed.get("idees"), max_items=2)
        prochaines_etapes = _to_short_list(parsed.get("prochaines_etapes"), max_items=2)

        parsed["prompt_version"] = "v2.3"
        parsed["commentaire"] = commentaire
        parsed["consignes"] = consignes
        parsed["idees"] = idees
        parsed["prochaines_etapes"] = prochaines_etapes

        consignes_text = "\n".join([f"- {item}" for item in consignes if isinstance(item, str)])
        idees_text = "\n".join([f"- {item}" for item in idees if isinstance(item, str)])
        prochaines_etapes_text = "\n".join([f"- {item}" for item in prochaines_etapes if isinstance(item, str)])

        formatted = f"Оценка: {note}\nКомментарий: {commentaire}"
        if consignes_text:
            formatted += f"\nЧто сделать:\n{consignes_text}"
        if idees_text:
            formatted += f"\nИдея:\n{idees_text}"
        if prochaines_etapes_text:
            formatted += f"\nДальше:\n{prochaines_etapes_text}"

        return {
            "evaluation": formatted,
            "evaluation_json": parsed,
        }
    except Exception:
        return {"evaluation": raw}



@router.post("/generate-challenge/")
async def generate_challenge(req: ChallengeRequest):
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    title = (req.challenge_topic or "").strip() or str((req.pedagogy_context or {}).get("courseTitle") or "").strip()
    description = (req.course_description or "").strip() or str((req.pedagogy_context or {}).get("courseDescription") or "").strip()
    topic = f"{title}. Description: {description}" if description else title
    prompt = f"""
{pedagogy_block}

Ты преподаватель программирования. Создай задачу для ученика уровня {req.level} на {req.language}.
Контекст курса (название + описание): {topic or 'не указан'}
Задача должна содержать:

1. Ясное условие
2. Два-три конкретных ограничения
3. Одна-две обучающие подсказки (без готового решения)
4. Пример входа/выхода
5. Стартовый шаблон кода (starter code)

Требования к качеству:
- Реалистичная задача по теме курса.
- Короткий и понятный текст по уровню ученика.
- Без полного готового решения.
- Задача должна явно соответствовать теме курса.
- Логичная учебная сложность и понятная цель.
- По умолчанию НЕ требовать интерактивный input()/print().
- Предпочитать чистую тестируемую функцию (параметры -> результат).
- Требовать input()/print() только если это явно нужно по контексту курса.

Пиши только на простом русском языке.
Верни строго JSON:
{{
    "prompt_version": "v2.5",
    "enonce": "...",
    "contraintes": ["...", "...", "..."],
    "hints": ["...", "..."],
    "exemple": "...",
    "starter_code": "...",
    "evaluation": {{
        "mode": "function",
        "function_name": "nom_fonction",
        "test_cases": [
            {{"name": "cas nominal", "args_literal": "[... ]", "expected_literal": "...", "constraint": "..."}},
            {{"name": "cas limite", "args_literal": "[... ]", "expected_literal": "...", "constraint": "..."}}
        ],
        "quality_checks": ["...", "..."]
    }}
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )

        raw = response.choices[0].message.content or ""
        print("[DEBUG] OpenAI response received successfully")
        try:
            parsed = parse_json_response(raw)
            enonce = str(parsed.get("enonce") or "")
            contraintes = parsed.get("contraintes") if isinstance(parsed.get("contraintes"), list) else []
            hints = parsed.get("hints") if isinstance(parsed.get("hints"), list) else []
            contraintes_text = "\n".join([f"- {item}" for item in contraintes if isinstance(item, str)])
            hints_text = "\n".join([f"- {item}" for item in hints if isinstance(item, str)])
            exemple = str(parsed.get("exemple") or "")
            starter_code = str(parsed.get("starter_code") or "").strip()
            evaluation = parsed.get("evaluation") if isinstance(parsed.get("evaluation"), dict) else {}
            challenge_tests = {
                "mode": str(evaluation.get("mode") or "function"),
                "function_name": str(evaluation.get("function_name") or ""),
                "test_cases": evaluation.get("test_cases") if isinstance(evaluation.get("test_cases"), list) else [],
                "quality_checks": evaluation.get("quality_checks") if isinstance(evaluation.get("quality_checks"), list) else [],
            }

            if not challenge_tests["test_cases"]:
                fallback_suite = _generate_dynamic_test_suite(enonce, req.pedagogy_context)
                if fallback_suite and fallback_suite.get("mode") == "function":
                    challenge_tests = {
                        "mode": "function",
                        "function_name": str(fallback_suite.get("function_name") or ""),
                        "test_cases": [
                            {
                                "name": str(item.get("name") or "test"),
                                "args_literal": repr(item.get("args", [])),
                                "expected_literal": repr(item.get("expected")),
                                "constraint": "Проверь ожидаемое поведение",
                            }
                            for item in (fallback_suite.get("tests") or [])
                            if isinstance(item, dict)
                        ],
                        "quality_checks": [
                            "Соблюдай требуемую сигнатуру функции.",
                            "Обработай граничные случаи из тестов.",
                        ],
                    }

            if not enonce.strip():
                raise HTTPException(status_code=502, detail="Неполный ответ ИИ: отсутствует условие задачи.")

            if not contraintes_text.strip():
                raise HTTPException(status_code=502, detail="Неполный ответ ИИ: отсутствуют ограничения.")

            if not hints_text.strip():
                hints_text = "- Commence par une version minimale qui fonctionne sur un cas simple.\n- Ajoute ensuite un cas limite avant de soumettre."

            if not starter_code:
                starter_code = (
                    "def solution(*args):\n"
                    "    \"\"\"\n"
                    "    TODO: реализуй логику по условию задачи.\n"
                    "    \"\"\"\n"
                    "    pass\n"
                )
            formatted = f"Задание: {enonce}\nПравила:\n{contraintes_text}\nПодсказки:\n{hints_text}\nПример: {exemple}"
            return {
                "challenge": formatted,
                "challenge_json": parsed,
                "starter_code": starter_code,
                "challenge_tests": challenge_tests,
                "source": "openai",
            }
        except HTTPException:
            raise
        except Exception:
            if raw.strip():
                return {"challenge": raw, "source": "openai-raw"}
                raise HTTPException(status_code=502, detail="Ответ ИИ не удалось использовать для этой задачи.")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = str(e)
        tb = traceback.format_exc()
        print(f"[ERROR] OpenAI Error: {error_msg}")
        print(f"[ERROR] Traceback: {tb}")
        raise HTTPException(status_code=503, detail=f"Сервис генерации ИИ временно недоступен: {error_msg}")
