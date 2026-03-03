from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_rejects_empty_prompt():
    response = client.post("/generate/", json={"prompt": "   "})

    assert response.status_code == 400
    assert "prompt est vide" in response.json()["detail"]


def test_generate_success(monkeypatch):
    async def mock_generate_code(prompt: str, pedagogy_context=None):
        return "print('ok')"

    monkeypatch.setattr("app.main.generate_code", mock_generate_code)

    response = client.post("/generate/", json={"prompt": "fais une boucle"})

    assert response.status_code == 200
    assert response.json()["code"] == "print('ok')"


def test_correct_rejects_empty_code():
    response = client.post("/correct/", json={"code": "  "})

    assert response.status_code == 400
    assert "code est vide" in response.json()["detail"]


def test_correct_success(monkeypatch):
    monkeypatch.setattr("app.main.correct_code", lambda code, pedagogy_context=None, **kwargs: "code corrigé")

    response = client.post("/correct/", json={"code": "print('x')"})

    assert response.status_code == 200
    assert response.json()["corrected_code"] == "code corrigé"


def test_interactive_debug_rejects_invalid_level():
    response = client.post(
        "/interactive-debug/",
        json={
            "code": "print('x')",
            "level": "expert",
            "step": 0,
            "student_answer": "",
        },
    )

    assert response.status_code == 400
    assert "Niveau invalide" in response.json()["detail"]


def test_interactive_debug_success(monkeypatch, tmp_path):
    class MockMessage:
        content = "Question : ...\nIndice : ..."

    class MockChoice:
        message = MockMessage()

    class MockResponse:
        choices = [MockChoice()]

    def mock_create(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("app.routers.interactive_debug.client.chat.completions.create", mock_create)
    monkeypatch.setattr("app.routers.interactive_debug.SESSIONS_FILE", tmp_path / "debug_sessions_test.json")

    response = client.post(
        "/interactive-debug/",
        json={
            "code": "print('x')",
            "level": "débutant",
            "step": 0,
            "student_answer": "",
        },
    )

    assert response.status_code == 200
    assert "response" in response.json()
    assert "session_id" in response.json()
    assert isinstance(response.json().get("history"), list)


def test_interactive_debug_session_resume(monkeypatch, tmp_path):
    class MockMessage:
        content = "Feedback : ...\nNouvelle question ou indice : ..."

    class MockChoice:
        message = MockMessage()

    class MockResponse:
        choices = [MockChoice()]

    def mock_create(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("app.routers.interactive_debug.client.chat.completions.create", mock_create)
    monkeypatch.setattr("app.routers.interactive_debug.SESSIONS_FILE", tmp_path / "debug_sessions_test.json")

    first = client.post(
        "/interactive-debug/",
        json={
            "code": "print('x')",
            "level": "débutant",
            "step": 0,
            "student_answer": "",
        },
    )

    assert first.status_code == 200
    first_payload = first.json()
    session_id = first_payload.get("session_id")
    assert session_id
    assert len(first_payload.get("history", [])) == 1

    second = client.post(
        "/interactive-debug/",
        json={
            "session_id": session_id,
            "code": "",
            "level": "débutant",
            "step": 1,
            "student_answer": "Je pense que c'est une erreur d'indentation",
        },
    )

    assert second.status_code == 200
    second_payload = second.json()
    assert second_payload.get("session_id") == session_id
    assert len(second_payload.get("history", [])) == 2
