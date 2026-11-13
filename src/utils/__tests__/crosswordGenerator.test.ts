import { kidsWords } from '@/core/data/index';
import { generateCrossword } from '@/core/utils/crosswordGenerator';

describe('crosswordGenerator', () => {
  it('builds valid bounded grids (width <= 10, height <= 13) with valid clue placement', () => {
    const categories = Array.from(new Set(kidsWords.map((w) => w.category)));

    for (const cat of categories) {
      const subset = kidsWords.filter((w) => w.category === cat);
      const pool = subset.length >= 6 ? subset : kidsWords;
      const puzzle = generateCrossword(pool, 10);

      expect(puzzle).not.toBeNull();
      if (!puzzle) continue;

      expect(puzzle.width).toBeGreaterThanOrEqual(1);
      expect(puzzle.width).toBeLessThanOrEqual(10);
      expect(puzzle.height).toBeGreaterThanOrEqual(1);
      expect(puzzle.height).toBeLessThanOrEqual(13);
      expect(puzzle.wordList.length).toBeGreaterThanOrEqual(1);

      for (const wordEntry of puzzle.wordList) {
        expect(wordEntry.cells.length).toBe(wordEntry.word.pt.length);

        const clueCell = puzzle.grid[wordEntry.clueR]?.[wordEntry.clueC];
        expect(clueCell?.type).toBe('clue');

        for (let i = 0; i < wordEntry.cells.length; i += 1) {
          const coords = wordEntry.cells[i];
          expect(coords).toBeDefined();
          if (!coords) continue;
          const [r, c] = coords;
          const cell = puzzle.grid[r]?.[c];
          expect(cell?.type).toBe('letter');
          if (cell?.type === 'letter') {
            const expectedChar = wordEntry.word.pt[i]?.toUpperCase();
            expect(cell.solution.toUpperCase()).toBe(expectedChar);
            expect(cell.wordIds).toContain(wordEntry.id);
          }
        }
      }
    }
  });

  it('places 9–12 words when given the full vocabulary pool', () => {
    const puzzle = generateCrossword(kidsWords, 12);
    expect(puzzle).not.toBeNull();
    if (!puzzle) return;

    expect(puzzle.wordList.length).toBeGreaterThanOrEqual(9);
    expect(puzzle.wordList.length).toBeLessThanOrEqual(12);
  });
});
