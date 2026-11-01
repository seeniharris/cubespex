export const STORAGE_KEY = 'cubespex.local';

export const defaultSettings = {
  theme: 'dark',
  inspection: true,
  inspectionWarnings: true,
  holdDelayMs: 250,
  soundEnabled: true,
  volume: 0.45,
  keyboardEnabled: true,
  mobileControls: true,
  displayPrecision: 'hundredths'
} as const;

export const defaultProfile = {
  id: 'guest-user',
  displayName: 'Guest Cuber',
  username: 'guest_cuber',
  friendCode: 'CT-GUEST',
  avatarUrl: '',
  bio: 'Local guest profile for CubeSpex.',
  createdAt: new Date().toISOString(),
  privacy: {
    profilePublic: false,
    statsPublic: false,
    friendRequests: 'everyone',
    leaderboardVisible: false
  }
};

export const defaultSessions = [{ id: 'default-session', name: 'Main 3x3 Session', event: '333' }];

export function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWriteStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota issues gracefully
  }
}

export function formatDuration(ms: number, precision: 'hundredths' | 'tenths' = 'hundredths'): string {
  if (!Number.isFinite(ms)) return '00:00.00';
  const totalMs = Math.max(0, ms);
  const totalSeconds = totalMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const suffix = precision === 'hundredths' ? 2 : 1;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(suffix).padStart(suffix === 2 ? 5 : 4, '0')}`;
}

export function getFinalResult(rawMs: number, penalty: 'none' | '+2' | 'DNF'): number | null {
  if (penalty === 'DNF') return null;
  if (penalty === '+2') return rawMs + 2000;
  return rawMs;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
