export type EventId =
  | '222'
  | '333'
  | '444'
  | '555'
  | '666'
  | '777'
  | '333bf'
  | '333oh'
  | 'clock'
  | 'minx'
  | 'pyram'
  | 'skewb'
  | 'sq1'
  | '333fm';

export type Penalty = 'none' | '+2' | 'DNF';
export type Theme = 'dark' | 'light';
export type TabId = 'timer' | 'statistics' | 'leaderboards' | 'friends' | 'profile' | 'settings';

export interface Settings {
  theme: Theme;
  inspection: boolean;
  inspectionWarnings: boolean;
  holdDelayMs: number;
  soundEnabled: boolean;
  volume: number;
  keyboardEnabled: boolean;
  mobileControls: boolean;
  displayPrecision: 'hundredths' | 'tenths';
}

export interface Session {
  id: string;
  name: string;
  event: EventId;
}

export interface Solve {
  id: string;
  event: EventId;
  sessionId: string;
  scramble: string;
  rawTimeMs: number;
  penalty: Penalty;
  finalResultMs: number | null;
  createdAt: string;
  status: 'ok' | 'manual' | 'deleted';
}

export interface Profile {
  id: string;
  displayName: string;
  username: string;
  friendCode: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  privacy: {
    profilePublic: boolean;
    statsPublic: boolean;
    friendRequests: 'everyone' | 'friends' | 'off';
    leaderboardVisible: boolean;
  };
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface FriendRecord {
  id: string;
  friendId: string;
  createdAt: string;
}

export interface LocalData {
  profile: Profile;
  settings: Settings;
  sessions: Session[];
  solves: Solve[];
  friendRequests: FriendRequest[];
  friends: FriendRecord[];
}

export const EVENT_OPTIONS: Array<{ id: EventId; label: string }> = [
  { id: '222', label: '2x2' },
  { id: '333', label: '3x3' },
  { id: '444', label: '4x4' },
  { id: '555', label: '5x5' },
  { id: '666', label: '6x6' },
  { id: '777', label: '7x7' },
  { id: '333bf', label: '3x3 Blindfolded' },
  { id: '333oh', label: '3x3 One-Handed' },
  { id: 'clock', label: 'Clock' },
  { id: 'minx', label: 'Megaminx' },
  { id: 'pyram', label: 'Pyraminx' },
  { id: 'skewb', label: 'Skewb' },
  { id: 'sq1', label: 'Square-1' },
  { id: '333fm', label: 'Fewest Moves Challenge' }
];

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '00:00.00';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}
