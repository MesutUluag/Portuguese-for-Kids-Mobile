/**
 * Pure scoring functions for Games 1–5 and Game 8, matching the exact
 * logic of the original web components in Portugese-for-Kids/src/components/.
 */

export const GAME3_PAIR_POINTS = 4;
export const GAME8_BOARD_BONUS = 25;

/**
 * Game 1 (Picture Match):
 * 6 pts on first try (0 mistakes), 4 pts after any wrong guess.
 */
export function scoreGame1(mistakes: number): number {
  return mistakes === 0 ? 6 : 4;
}

/**
 * Game 2 (Listen & Find):
 * 7 pts on first try (0 wrong attempts), 5 pts after any wrong attempt.
 */
export function scoreGame2(attempts: number): number {
  return attempts === 0 ? 7 : 5;
}

/**
 * Game 3 (Memory Match):
 * Each matched pair awards +4 pts immediately (`GAME3_PAIR_POINTS`),
 * and completing the 3-pair board awards a bonus: 13 pts (<= 4 turns) or 8 pts.
 */
export function scoreGame3BoardBonus(turns: number): number {
  return turns <= 4 ? 13 : 8;
}

/**
 * Game 4 (Fill Missing Letter):
 * 7 pts on first try, 5 pts if a wrong letter was attempted.
 */
export function scoreGame4(hasWrongAttempt: boolean): number {
  return hasWrongAttempt ? 5 : 7;
}

/**
 * Game 5 (Unscramble Word):
 * Base 10 pts (<= 4 letters) or 14 pts (5+ letters), +3 pts bonus if solved without reset/error.
 */
export function scoreGame5(wordLength: number, hadReset: boolean): number {
  const base = wordLength <= 4 ? 10 : 14;
  const bonus = hadReset ? 0 : 3;
  return base + bonus;
}

/**
 * Game 8 (Crossword / Çengel Bulmaca):
 * 10 pts base per word, -2 once if pronunciation audio was played,
 * -2 per letter hint used on that word.
 * Returns 0 pts if solved completely with hints (`solvedOnlyWithHints`) or when deductions reach 10+.
 */
export function scoreGame8Word(
  audioUsed: boolean,
  hintsCount: number,
  solvedOnlyWithHints = false,
): number {
  if (solvedOnlyWithHints) return 0;
  const safeHints = Math.max(0, Math.floor(hintsCount));
  const deductions = (audioUsed ? 2 : 0) + safeHints * 2;
  return Math.max(0, 10 - deductions);
}
