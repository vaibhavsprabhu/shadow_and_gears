export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

export function clampHighestUnlocked(value: number): number {
  if (!Number.isFinite(value)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(value)));
}

export function canDeployLevel(levelId: number, highestUnlocked: number): boolean {
  const safeHighest = clampHighestUnlocked(highestUnlocked);
  return Number.isInteger(levelId) && levelId >= MIN_LEVEL && levelId <= safeHighest;
}

export function clampRequestedLevel(
  requestedLevel: number,
  highestUnlocked: number
): number {
  const safeHighest = clampHighestUnlocked(highestUnlocked);
  if (!Number.isFinite(requestedLevel)) return MIN_LEVEL;
  const normalized = Math.floor(requestedLevel);
  if (normalized < MIN_LEVEL) return MIN_LEVEL;
  return Math.min(safeHighest, normalized);
}

export function getUnlockedLevelAfterCompletion(
  currentHighest: number,
  completedLevelId: number
): number {
  const safeHighest = clampHighestUnlocked(currentHighest);
  if (!Number.isInteger(completedLevelId) || completedLevelId < MIN_LEVEL) {
    return safeHighest;
  }
  if (completedLevelId > safeHighest) {
    return safeHighest;
  }
  return clampHighestUnlocked(Math.max(safeHighest, completedLevelId + 1));
}

export function getLevelLockMessage(
  levelId: number,
  highestUnlocked: number
): string | null {
  const safeHighest = clampHighestUnlocked(highestUnlocked);
  if (levelId <= safeHighest) return null;
  if (safeHighest === 1) {
    return 'Complete Level 1 first to unlock';
  }
  return `Complete Level ${levelId - 1} first to unlock`;
}
