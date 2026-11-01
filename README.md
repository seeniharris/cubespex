import { describe, expect, it } from 'vitest';
import { fallbackScramble, generateScramble } from '../src/lib/scramble';

describe('scramble generation', () => {
  it('returns a fallback scramble for 3x3', () => {
    const scramble = fallbackScramble('333');
    expect(scramble.length).toBeGreaterThan(0);
  });

  it('returns a non-empty value from generateScramble', async () => {
    const scramble = await generateScramble('333');
    expect(typeof scramble).toBe('string');
    expect(scramble.length).toBeGreaterThan(0);
  });
});
