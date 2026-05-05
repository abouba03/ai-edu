export type TutorStrategy = 'coach' | 'socratique' | 'creatif';

export type TutorHistoryItem = {
  step: number;
  studentAnswer: string;
  assistantResponse: string;
  tutorStrategy: TutorStrategy;
  createdAt: string;
};

export type TutorSession = {
  id: string;
  level: string;
  challengeDescription: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  history: TutorHistoryItem[];
};

const sessions = new Map<string, TutorSession>();

export function getTutorSession(id: string): TutorSession | null {
  return sessions.get(id) ?? null;
}

export function saveTutorSession(session: TutorSession): void {
  sessions.set(session.id, session);
}

export function createTutorSession(payload: {
  id: string;
  level: string;
  challengeDescription: string;
  code: string;
}): TutorSession {
  const now = new Date().toISOString();
  const session: TutorSession = {
    id: payload.id,
    level: payload.level,
    challengeDescription: payload.challengeDescription,
    code: payload.code,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  sessions.set(session.id, session);
  return session;
}
