Comment executer le Docker:
CMD:
->     \ai-edu-platform\backend> docker build -t code-runner .
->     \ai-edu-platform\backend> docker run -i --rm code-runner

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

Comment executer le Backend:

Terminal dans le dossier: /backend:
->      env\Scripts\activate 
->      uvicorn app.main:app --reload

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

Comment executer le Frontend:
Terminal dans le dossier: /frontend:
->      npm run dev