import type { Penalty, Solve } from '../types';

export function sortByNewest(a: Solve, b: Solve): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function computeBestSingle(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).map((solve) => solve.finalResultMs as number);
  if (!valid.length) return null;
  return Math.min(...valid);
}

export function computeMean(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).map((solve) => solve.finalResultMs as number);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function computeAo5(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).slice(-5);
  if (valid.length < 5) return null;
  const sorted = [...valid].map((solve) => solve.finalResultMs as number).sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  if (trimmed.length !== 3) return null;
  return trimmed.reduce((sum, value) => sum + value, 0) / 3;
}

export function computeAo12(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).slice(-12);
  if (valid.length < 12) return null;
  const sorted = [...valid].map((solve) => solve.finalResultMs as number).sort((a, b) => a - b);
  const trimmed = sorted.slice(2, -2);
  if (trimmed.length !== 8) return null;
  return trimmed.reduce((sum, value) => sum + value, 0) / 8;
}

export function computeWorstSingle(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).map((solve) => solve.finalResultMs as number);
  if (!valid.length) return null;
  return Math.max(...valid);
}

export function calculateStreaks(solves: Solve[]): { current: number; longest: number; activeDays: number } {
  const days = new Set(
    solves
      .filter((solve) => solve.finalResultMs !== null)
      .map((solve) => new Date(solve.createdAt).toISOString().slice(0, 10))
  );

  const ordered = Array.from(days).sort();
  if (!ordered.length) return { current: 0, longest: 0, activeDays: 0 };

  let current = 1;
  let longest = 1;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = new Date(`${ordered[index - 1]}T12:00:00Z`).getTime();
    const next = new Date(`${ordered[index]}T12:00:00Z`).getTime();
    const diffDays = Math.round((next - previous) / 86400000);
    if (diffDays === 1) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return { current, longest, activeDays: ordered.length };
}

export function computeSessionStats(solves: Solve[]) {
  return {
    total: solves.length,
    bestSingle: computeBestSingle(solves),
    mean: computeMean(solves),
    ao5: computeAo5(solves),
    ao12: computeAo12(solves),
    worst: computeWorstSingle(solves)
  };
}

export function getPenaltyLabel(penalty: Penalty): string {
  if (penalty === 'DNF') return 'DNF';
  if (penalty === '+2') return '+2';
  return 'None';
}
