import { randomScrambleForEvent } from 'cubing';
import type { EventId } from '../types';

const EVENT_MAP: Record<EventId, string> = {
  '222': '222',
  '333': '333',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  '333bf': '333bf',
  '333oh': '333oh',
  clock: 'clock',
  minx: 'minx',
  pyram: 'pyram',
  skewb: 'skewb',
  sq1: 'sq1',
  '333fm': '333fm'
};

export async function generateScramble(event: EventId): Promise<string> {
  try {
    const scramble = await randomScrambleForEvent(EVENT_MAP[event]);
    return scramble ? String(scramble) : fallbackScramble(event);
  } catch {
    return fallbackScramble(event);
  }
}

export function fallbackScramble(event: EventId): string {
  const moves = ['R', 'U', 'L', 'D', 'F', 'B', "R'", "U'", "L'", "D'", "F'", "B'", 'R2', 'U2', 'L2', 'D2', 'F2', 'B2'];
  const countMap: Record<EventId, number> = {
    '222': 20,
    '333': 22,
    '444': 40,
    '555': 50,
    '666': 80,
    '777': 100,
    '333bf': 20,
    '333oh': 20,
    clock: 20,
    minx: 35,
    pyram: 20,
    skewb: 20,
    sq1: 20,
    '333fm': 12
  };

  const result: string[] = [];
  const count = countMap[event] || 20;
  for (let index = 0; index < count; index += 1) {
    result.push(moves[Math.floor(Math.random() * moves.length)]);
  }
  return result.join(' ');
}
