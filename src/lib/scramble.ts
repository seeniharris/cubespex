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
  return valid.reduce((sum, time) => sum + time, 0) / valid.length;
}

export function computeAo5(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).slice(-5);
  if (valid.length < 5) return null;
  const sorted = [...valid].sort((a, b) => (a.finalResultMs as number) - (b.finalResultMs as number));
  const trimmed = sorted.slice(1, -1);
  if (trimmed.length !== 3) return null;
  return trimmed.reduce((sum, solve) => sum + (solve.finalResultMs as number), 0) / 3;
}

export function computeAo12(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).slice(-12);
  if (valid.length < 12) return null;
  const sorted = [...valid].sort((a, b) => (a.finalResultMs as number) - (b.finalResultMs as number));
  const trimmed = sorted.slice(2, -2);
  if (trimmed.length !== 8) return null;
  return trimmed.reduce((sum, solve) => sum + (solve.finalResultMs as number), 0) / 8;
}

export function computeWorstSingle(solves: Solve[]): number | null {
  const valid = solves.filter((solve) => solve.finalResultMs !== null).map((solve) => solve.finalResultMs as number);
  if (!valid.length) return null;
  return Math.max(...valid);
}

export function calculateStreaks(solves: Solve[]): { current: number; longest: number; activeDays: number } {
  const uniqueDays = new Set(
    solves
      .filter((solve) => solve.finalResultMs !== null)
      .map((solve) => new Date(solve.createdAt).toISOString().slice(0, 10))
  );

  const dayList = Array.from(uniqueDays).sort();
  if (!dayList.length) return { current: 0, longest: 0, activeDays: 0 };

  let longest = 1;
  let current = 1;
  let previous: Date | null = null;

  const dates = dayList.map((value) => new Date(`${value}T12:00:00Z`));
  dates.forEach((date, index) => {
    if (index === 0) {
      previous = date;
      return;
    }
    const diffDays = Math.round((date.getTime() - (previous as Date).getTime()) / 86400000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
    previous = date;
  });

  return { current, longest, activeDays: dayList.length };
}

export function computeSessionStats(solves: Solve[]) {
  const valid = solves.filter((solve) => solve.finalResultMs !== null);
  return {
    total: solves.length,
    validTotal: valid.length,
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
