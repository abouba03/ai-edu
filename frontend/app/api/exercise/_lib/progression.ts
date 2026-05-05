// Shared progression rules for exercise mode.
export const THRESHOLDS = {
  debutant: { points: 500, passed: 8 },
  intermediaire: { points: 1500, passed: 20 },
} as const;

export function computeLevel(totalPoints: number, passedCount: number): string {
  if (totalPoints >= THRESHOLDS.intermediaire.points && passedCount >= THRESHOLDS.intermediaire.passed) {
    return 'avance';
  }
  if (totalPoints >= THRESHOLDS.debutant.points && passedCount >= THRESHOLDS.debutant.passed) {
    return 'intermediaire';
  }
  return 'debutant';
}
