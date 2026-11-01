import type { FriendRecord, FriendRequest, LocalData, Profile, Session, Settings, Solve } from '../types';
import { defaultProfile, defaultSessions, defaultSettings, STORAGE_KEY, safeReadStorage, safeWriteStorage } from '../types';

export const initialData: LocalData = {
  profile: defaultProfile,
  settings: { ...defaultSettings },
  sessions: [...defaultSessions],
  solves: [],
  friendRequests: [],
  friends: []
};

export function loadData(): LocalData {
  const data = safeReadStorage<Partial<LocalData>>(STORAGE_KEY, initialData);
  return {
    profile: { ...initialData.profile, ...data.profile },
    settings: { ...initialData.settings, ...data.settings },
    sessions: Array.isArray(data.sessions) && data.sessions.length ? data.sessions : [...defaultSessions],
    solves: Array.isArray(data.solves) ? data.solves : [],
    friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : [],
    friends: Array.isArray(data.friends) ? data.friends : []
  };
}

export function saveData(data: LocalData): void {
  safeWriteStorage(STORAGE_KEY, data);
}

export function addSolveToStorage(solve: Solve): void {
  const existing = loadData();
  existing.solves = [solve, ...existing.solves];
  saveData(existing);
}

export function updateSessions(newSessions: Session[]): void {
  const data = loadData();
  data.sessions = newSessions;
  saveData(data);
}

export function updateProfile(newProfile: Profile): void {
  const data = loadData();
  data.profile = newProfile;
  saveData(data);
}

export function updateSettings(newSettings: Settings): void {
  const data = loadData();
  data.settings = newSettings;
  saveData(data);
}

export function updateFriends(newFriends: FriendRecord[], requests: FriendRequest[] = []): void {
  const data = loadData();
  data.friends = newFriends;
  data.friendRequests = requests;
  saveData(data);
}
