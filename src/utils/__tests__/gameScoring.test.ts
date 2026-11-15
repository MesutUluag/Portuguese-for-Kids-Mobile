import {
  GAME3_PAIR_POINTS,
  GAME6_FALLBACK_POINTS,
  GAME6_PUZZLE_POINTS,
  GAME8_BOARD_BONUS,
  scoreGame1,
  scoreGame2,
  scoreGame3BoardBonus,
  scoreGame4,
  scoreGame5,
  scoreGame7,
  scoreGame8Word,
} from '@/utils/gameScoring';

describe('gameScoring (web parity)', () => {
  it('scoreGame1 awards 6 with 0 mistakes and 4 otherwise', () => {
    expect(scoreGame1(0)).toBe(6);
    expect(scoreGame1(1)).toBe(4);
    expect(scoreGame1(4)).toBe(4);
  });

  it('scoreGame2 awards 7 with 0 attempts and 5 otherwise', () => {
    expect(scoreGame2(0)).toBe(7);
    expect(scoreGame2(1)).toBe(5);
    expect(scoreGame2(3)).toBe(5);
  });

  it('Game 3 awards 4 per pair and board bonus 13 (<=4 turns) or 8', () => {
    expect(GAME3_PAIR_POINTS).toBe(4);
    expect(scoreGame3BoardBonus(3)).toBe(13);
    expect(scoreGame3BoardBonus(4)).toBe(13);
    expect(scoreGame3BoardBonus(5)).toBe(8);
  });

  it('scoreGame4 awards 7 cleanly and 5 after a wrong attempt', () => {
    expect(scoreGame4(false)).toBe(7);
    expect(scoreGame4(true)).toBe(5);
  });

  it('scoreGame5 awards 10 (<=4) or 14 (5+) plus 3 clean bonus if not reset', () => {
    expect(scoreGame5(3, false)).toBe(13);
    expect(scoreGame5(4, false)).toBe(13);
    expect(scoreGame5(4, true)).toBe(10);
    expect(scoreGame5(5, false)).toBe(17);
    expect(scoreGame5(7, true)).toBe(14);
  });

  it('Game 6 awards 30 on solved puzzle and 5 on fallback acknowledgment', () => {
    expect(GAME6_PUZZLE_POINTS).toBe(30);
    expect(GAME6_FALLBACK_POINTS).toBe(5);
  });

  it('scoreGame7 awards 7 cleanly and 5 after wrong drops', () => {
    expect(scoreGame7(0)).toBe(7);
    expect(scoreGame7(1)).toBe(5);
    expect(scoreGame7(3)).toBe(5);
  });

  it('scoreGame8Word deducts 2 once for audio and 2 per hint, and awards 0 when solved solely via hints', () => {
    expect(GAME8_BOARD_BONUS).toBe(25);
    expect(scoreGame8Word(false, 0)).toBe(10);
    expect(scoreGame8Word(true, 0)).toBe(8);
    expect(scoreGame8Word(false, 2)).toBe(6);
    expect(scoreGame8Word(true, 1)).toBe(6);
    expect(scoreGame8Word(false, 4)).toBe(2);
    expect(scoreGame8Word(true, 5)).toBe(0);
    expect(scoreGame8Word(false, 3, true)).toBe(0);
  });
});
