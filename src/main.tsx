import { randomScrambleForEvent } from 'cubing';
import type { EventId } from '../types';

const eventMap: Record<EventId, string> = {
  '222': '222',
  '333': '333',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  '333bf': '333bf',
  '333oh': '333oh',
  'clock': 'clock',
  minx: 'minx',
  pyram: 'pyram',
  skewb: 'skewb',
  sq1: 'sq1',
  '333fm': '333fm'
};

export async function generateScramble(event: EventId): Promise<string> {
  try {
    const result = await randomScrambleForEvent(eventMap[event]);
    return String(result || fallbackScramble(event));
  } catch {
    return fallbackScramble(event);
  }
}

export function fallbackScramble(event: EventId): string {
  const pool = [
    'R', 'U', 'L', 'D', 'F', 'B',
    'R2', 'U2', 'L2', 'D2', 'F2', 'B2',
    'R\'', 'U\'', 'L\'', 'D\'', 'F\'', 'B\''
  ];

  const countByEvent: Record<EventId, number> = {
    '222': 20,
    '333': 22,
    '444': 40,
    '555': 60,
    '666': 80,
    '777': 100,
    '333bf': 25,
    '333oh': 25,
    clock: 20,
    minx: 35,
    pyram: 20,
    skewb: 20,
    sq1: 25,
    '333fm': 10
  };

  const moves: string[] = [];
  const target = countByEvent[event] || 25;
  for (let i = 0; i < target; i += 1) {
    const move = pool[Math.floor(Math.random() * pool.length)];
    moves.push(move);
  }
  return moves.join(' ');
}

export function formatScrambleLabel(event: EventId): string {
  return event === '333' ? '3x3 scramble' : event;
}
