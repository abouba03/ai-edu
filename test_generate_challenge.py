import urllib.request
import json
import traceback

url = 'http://localhost:8000/generate-challenge/'
payload = {
    'level': 'débutant',
    'language': 'Python',
    'challenge_topic': 'Test',
    'course_description': 'Test course description',
    'pedagogy_context': {
        'level': 'débutant',
        'progressPercent': 5,
        'aiTone': 'Coach',
        'pedagogicalStyle': 'Test',
        'targetAudience': 'Test',
        'courseTitle': 'Test',
        'courseDescription': 'Test',
        'passThreshold': 70,
        'weeklyGoalHours': 5,
    },
}
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print('status', r.status)
        print(r.read().decode('utf-8')[:1000])
except Exception:
    traceback.print_exc()
