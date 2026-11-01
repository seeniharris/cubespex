import { describe, expect, it } from 'vitest';
import type { Solve } from '../src/types';
import { computeAo12, computeAo5, computeBestSingle, computeMean } from '../src/lib/statistics';

const makeSolve = (ms: number, id: string, penalty: 'none' | '+2' | 'DNF' = 'none'): Solve => ({
  id,
  event: '333',
  sessionId: 'session-1',
  scramble: 'R U R\' U\'',
  rawTimeMs: ms,
  penalty,
  finalResultMs: penalty === 'DNF' ? null : penalty === '+2' ? ms + 2000 : ms,
  createdAt: new Date().toISOString(),
  status: 'ok'
});

describe('statistics engine', () => {
  it('computes best single', () => {
    const solves = [makeSolve(13000, 'a'), makeSolve(9000, 'b'), makeSolve(15000, 'c')];
    expect(computeBestSingle(solves)).toBe(9000);
  });

  it('computes mean', () => {
    const solves = [makeSolve(10000, 'a'), makeSolve(20000, 'b'), makeSolve(30000, 'c')];
    expect(computeMean(solves)).toBe(20000);
  });

  it('computes ao5 with trimmed values', () => {
    const solves = [
      makeSolve(7000, 'a'),
      makeSolve(8000, 'b'),
      makeSolve(10000, 'c'),
      makeSolve(12000, 'd'),
      makeSolve(15000, 'e')
    ];
    expect(computeAo5(solves)).toBe(10000);
  });

  it('computes ao12', () => {
    const solves = Array.from({ length: 12 }, (_, index) => makeSolve(1000 + index * 500, `s${index}`));
    expect(computeAo12(solves)).toBeGreaterThan(0);
  });
});
