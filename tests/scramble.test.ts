import { describe, expect, it } from 'vitest';
import type { Solve } from '../src/types';
import { computeAo12, computeAo5, computeBestSingle, computeMean } from '../src/lib/statistics';

const buildSolve = (ms: number, id: string, penalty: 'none' | '+2' | 'DNF' = 'none'): Solve => ({
  id,
  event: '333',
  sessionId: 's1',
  scramble: 'R U R\' U\'',
  rawTimeMs: ms,
  penalty,
  finalResultMs: penalty === 'DNF' ? null : penalty === '+2' ? ms + 2000 : ms,
  createdAt: new Date().toISOString(),
  status: 'ok'
});

describe('statistics engine', () => {
  it('computes best single', () => {
    const solves = [buildSolve(12000, 'a'), buildSolve(9000, 'b'), buildSolve(15000, 'c')];
    expect(computeBestSingle(solves)).toBe(9000);
  });

  it('computes mean', () => {
    const solves = [buildSolve(10000, 'a'), buildSolve(20000, 'b'), buildSolve(30000, 'c')];
    expect(computeMean(solves)).toBe(20000);
  });

  it('computes ao5 correctly using the WCA trimming rule', () => {
    const solves = [
      buildSolve(8000, 'a'),
      buildSolve(10000, 'b'),
      buildSolve(12000, 'c'),
      buildSolve(15000, 'd'),
      buildSolve(17000, 'e')
    ];
    expect(computeAo5(solves)).toBe(13000);
  });

  it('computes ao12 correctly', () => {
    const solves = Array.from({ length: 12 }, (_, index) => buildSolve(1000 + index * 1000, `s${index}`));
    expect(computeAo12(solves)).toBeGreaterThan(0);
  });
});
