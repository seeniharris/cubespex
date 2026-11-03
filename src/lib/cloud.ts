import type { Session as AuthSession, User } from '@supabase/supabase-js';
import type { EventId, LocalData, Penalty, Profile, Session, Solve } from '../types';
import { requireSupabase } from './supabaseClient';

interface DbProfile {
  id: string; display_name: string; username: string; friend_code: string;
  avatar_url: string | null; bio: string | null; created_at: string;
  privacy_settings: Record<string, unknown> | null;
}
interface DbSession { id: string; client_id: string | null; name: string; event: string }
interface DbSolve {
  id: string; client_id: string | null; session_id: string | null; event: string;
  scramble: string | null; raw_time: number; penalty: Penalty;
  final_result: string | null; status: string; created_at: string;
}

export type LeaderboardEntry = {
  username: string; display_name: string; avatar_url: string | null;
  best_time?: number; mean_time?: number; solve_count: number;
};
export type FriendSearchResult = {
  id: string; username: string; display_name: string; avatar_url: string | null;
  friend_code: string;
};
export type RequestRow = {
  id: string; sender_id: string; receiver_id: string; status: 'pending' | 'accepted' | 'rejected'; created_at: string;
  sender?: FriendSearchResult; receiver?: FriendSearchResult;
};

const checked = <T>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

export function mapProfile(row: DbProfile): Profile {
  const privacy = row.privacy_settings ?? {};
  return {
    id: row.id, displayName: row.display_name, username: row.username, friendCode: row.friend_code,
    avatarUrl: row.avatar_url ?? '', bio: row.bio ?? '', createdAt: row.created_at,
    privacy: {
      profilePublic: privacy.profile_public !== false,
      statsPublic: privacy.stats_public !== false,
      friendRequests: 'everyone',
      leaderboardVisible: privacy.leaderboard_public !== false
    }
  };
}

export const authApi = {
  async restore(): Promise<{ user: User | null; session: AuthSession | null }> {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    return { user: data.session?.user ?? null, session: data.session };
  },
  async signUp(email: string, password: string, displayName: string) {
    if (displayName.trim().length < 1 || displayName.trim().length > 40) throw new Error('Display name must be 1–40 characters.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    return checked(await requireSupabase().auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } }));
  },
  async signIn(email: string, password: string) {
    return checked(await requireSupabase().auth.signInWithPassword({ email: email.trim(), password }));
  },
  async signOut() { return checked(await requireSupabase().auth.signOut()); },
  async resetPassword(email: string) {
    return checked(await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }));
  },
  onChange(callback: (user: User | null) => void) {
    const { data } = requireSupabase().auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }
};

export const profileApi = {
  async load(userId: string): Promise<Profile> {
    const row = checked(await requireSupabase().from('profiles').select('*').eq('id', userId).single()) as DbProfile;
    return mapProfile(row);
  },
  async update(userId: string, profile: Pick<Profile, 'username' | 'displayName' | 'avatarUrl' | 'bio' | 'privacy'>) {
    const username = profile.username.trim();
    const displayName = profile.displayName.trim();
    const bio = profile.bio.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3–20 letters, numbers, or underscores.');
    if (!displayName || displayName.length > 40) throw new Error('Display name must be 1–40 characters.');
    if (bio.length > 300) throw new Error('Bio cannot exceed 300 characters.');
    const row = checked(await requireSupabase().from('profiles').update({
      username, display_name: displayName, avatar_url: profile.avatarUrl.trim() || null, bio: bio || null,
      privacy_settings: { profile_public: profile.privacy.profilePublic, leaderboard_public: profile.privacy.leaderboardVisible, stats_public: profile.privacy.statsPublic }
    }).eq('id', userId).select('*').single()) as DbProfile;
    return mapProfile(row);
  }
};

const mapSession = (row: DbSession): Session => ({ id: row.client_id ?? row.id, name: row.name, event: row.event as EventId });
const mapSolve = (row: DbSolve, localSessionId: string): Solve => ({
  id: row.client_id ?? row.id, event: row.event as EventId, sessionId: localSessionId, scramble: row.scramble ?? '',
  rawTimeMs: row.raw_time * 1000, penalty: row.penalty,
  finalResultMs: row.penalty === 'DNF' || row.final_result === 'DNF' ? null : Number(row.final_result ?? row.raw_time) * 1000,
  createdAt: row.created_at, status: row.status === 'DNF' ? 'manual' : 'ok'
});

/** Upload local data idempotently; client_id has a per-user unique index in migration 002. */
export async function syncLocalData(userId: string, data: LocalData): Promise<{ sessions: Session[]; solves: Solve[] }> {
  const client = requireSupabase();
  const sessionRows = data.sessions.map((session) => ({ user_id: userId, client_id: session.id, name: session.name.trim().slice(0, 60) || 'Session', event: session.event }));
  if (sessionRows.length) checked(await client.from('sessions').upsert(sessionRows, { onConflict: 'user_id,client_id' }));
  const dbSessions = checked(await client.from('sessions').select('id,client_id,name,event').eq('user_id', userId)) as DbSession[];
  const sessionByClientId = new Map(dbSessions.map((session) => [session.client_id ?? session.id, session.id]));
  const solveRows = data.solves.filter((solve) => Number.isFinite(solve.rawTimeMs) && solve.rawTimeMs > 0)
    .map((solve) => ({
      user_id: userId, client_id: solve.id, session_id: sessionByClientId.get(solve.sessionId) ?? null,
      event: solve.event, scramble: solve.scramble, raw_time: solve.rawTimeMs / 1000,
      penalty: solve.penalty, final_result: solve.finalResultMs === null ? 'DNF' : String(solve.finalResultMs / 1000),
      status: solve.finalResultMs === null ? 'DNF' : 'ok', created_at: solve.createdAt
    }));
  if (solveRows.length) checked(await client.from('solves').upsert(solveRows, { onConflict: 'user_id,client_id' }));
  const rows = checked(await client.from('solves').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5000)) as DbSolve[];
  const localIdByDbId = new Map(dbSessions.map((session) => [session.id, session.client_id ?? session.id]));
  return { sessions: dbSessions.map(mapSession), solves: rows.map((row) => mapSolve(row, row.session_id ? localIdByDbId.get(row.session_id) ?? row.session_id : '')) };
}

export const solveApi = {
  async remove(userId: string, id: string) {
    checked(await requireSupabase().from('solves').delete().eq('user_id', userId).eq('client_id', id));
  },
  async updatePenalty(userId: string, id: string, penalty: Penalty) {
    if (!['none', '+2', 'DNF'].includes(penalty)) throw new Error('Invalid solve penalty.');
    checked(await requireSupabase().from('solves').update({ penalty, status: penalty === 'DNF' ? 'DNF' : 'ok' }).eq('user_id', userId).eq('client_id', id));
  }
};

export const friendsApi = {
  async search(query: string): Promise<FriendSearchResult[]> {
    const term = query.trim();
    if (term.length < 2 || term.length > 40) throw new Error('Enter at least 2 characters to search.');
    return checked(await requireSupabase().rpc('search_users', { search_query: term })) as FriendSearchResult[];
  },
  async send(targetUserId: string) { checked(await requireSupabase().rpc('send_friend_request', { target_user_id: targetUserId })); },
  async respond(requestId: string, accept: boolean) { checked(await requireSupabase().rpc('respond_friend_request', { request_id: requestId, accept_request: accept })); },
  async remove(friendUserId: string) { checked(await requireSupabase().rpc('remove_friend', { target_user_id: friendUserId })); },
  async block(targetUserId: string) { checked(await requireSupabase().from('blocked_users').upsert({ blocked_id: targetUserId }, { onConflict: 'blocker_id,blocked_id' })); },
  async lists(userId: string) {
    const client = requireSupabase();
    const [friendRows, requests] = await Promise.all([
      client.from('friendships').select('friend_id,created_at').eq('user_id', userId),
      client.from('friend_requests').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'pending')
    ]);
    const friendships = checked(friendRows) as Array<{ friend_id: string; created_at: string }>;
    const pending = checked(requests) as RequestRow[];
    const ids = [...new Set([...friendships.map((row) => row.friend_id), ...pending.flatMap((row) => [row.sender_id, row.receiver_id])])];
    const profiles = ids.length ? checked(await client.from('profiles').select('id,username,display_name,avatar_url,friend_code').in('id', ids)) as Array<FriendSearchResult> : [];
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    return {
      friends: friendships.map((row) => ({ ...byId.get(row.friend_id), id: row.friend_id, createdAt: row.created_at })),
      incoming: pending.filter((row) => row.receiver_id === userId).map((row) => ({ ...row, sender: byId.get(row.sender_id) })),
      outgoing: pending.filter((row) => row.sender_id === userId).map((row) => ({ ...row, receiver: byId.get(row.receiver_id) }))
    };
  }
};

export const leaderboardApi = {
  async global(event: EventId, metric: 'single' | 'mean' = 'single', limit = 50): Promise<LeaderboardEntry[]> {
    const client = requireSupabase();
    return checked(await client.rpc(metric === 'single' ? 'get_leaderboard' : 'get_mean_leaderboard', { target_event: event, result_limit: Math.max(1, Math.min(100, limit)) })) as LeaderboardEntry[];
  },
  async friends(event: EventId, metric: 'single' | 'mean' = 'single', limit = 50): Promise<LeaderboardEntry[]> {
    return checked(await requireSupabase().rpc('get_friends_leaderboard', { target_event: event, ranking_metric: metric, result_limit: Math.max(1, Math.min(100, limit)) })) as LeaderboardEntry[];
  }
};
