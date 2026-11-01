import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Friends, Gauge, LayoutDashboard, LogOut, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { TimerPanel } from './components/TimerPanel';
import { SessionManager } from './components/SessionManager';
import { StatsPanel } from './components/StatsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { loadData, saveData, updateFriends, updateProfile, updateSettings, updateSessions } from './lib/storage';
import { EVENT_OPTIONS, type EventId, type FriendRecord, type FriendRequest, type LocalData, type Penalty, type Session, type Settings, type Solve, type TabId } from './types';
import { getSupabaseStatusMessage } from './lib/supabase';

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'timer', label: 'Timer', icon: <Gauge className="h-4 w-4" /> },
  { id: 'statistics', label: 'Statistics', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'leaderboards', label: 'Leaderboards', icon: <Trophy className="h-4 w-4" /> },
  { id: 'friends', label: 'Friends', icon: <Friends className="h-4 w-4" /> },
  { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <ShieldCheck className="h-4 w-4" /> }
];

function App() {
  const [data, setData] = useState<LocalData>(loadData());
  const [selectedEvent, setSelectedEvent] = useState<EventId>('333');
  const [selectedTab, setSelectedTab] = useState<TabId>('timer');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(data.sessions[0]?.id || 'default-session');

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    const sessionExists = data.sessions.some((session) => session.id === selectedSessionId);
    if (!sessionExists && data.sessions[0]) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [data.sessions, selectedSessionId]);

  const activeSession = useMemo(
    () => data.sessions.find((session) => session.id === selectedSessionId) || data.sessions[0],
    [data.sessions, selectedSessionId]
  );

  const onCreateSession = (name: string, event: EventId) => {
    const nextSession: Session = {
      id: `session-${Date.now()}`,
      name,
      event
    };
    const nextSessions = [...data.sessions, nextSession];
    setData((prev) => ({ ...prev, sessions: nextSessions }));
    setSelectedSessionId(nextSession.id);
  };

  const onRenameSession = (id: string, name: string) => {
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => (session.id === id ? { ...session, name } : session))
    }));
  };

  const onDeleteSession = (id: string) => {
    if (data.sessions.length <= 1) return;
    if (!window.confirm('Delete this session and its local solve history?')) return;
    const nextSessions = data.sessions.filter((session) => session.id !== id);
    setData((prev) => ({
      ...prev,
      sessions: nextSessions,
      solves: prev.solves.filter((solve) => solve.sessionId !== id)
    }));
    setSelectedSessionId(nextSessions[0].id);
  };

  const onNewScramble = (scramble: string) => {
    // no-op here; the timer handles local scramble generation.
  };

  const onSaveSolve = (payload: {
    event: EventId;
    sessionId: string;
    scramble: string;
    rawTimeMs: number;
    penalty: Penalty;
    finalResultMs: number | null;
    createdAt: string;
  }) => {
    const solve: Solve = {
      id: `solve-${Date.now()}`,
      event: payload.event,
      sessionId: payload.sessionId,
      scramble: payload.scramble,
      rawTimeMs: payload.rawTimeMs,
      penalty: payload.penalty,
      finalResultMs: payload.finalResultMs,
      createdAt: payload.createdAt,
      status: 'ok'
    };

    setData((prev) => ({ ...prev, solves: [solve, ...prev.solves] }));
  };

  const handleDeleteSolve = (id: string) => {
    setData((prev) => ({
      ...prev,
      solves: prev.solves.filter((solve) => solve.id !== id)
    }));
  };

  const leaderboards = useMemo(() => {
    const rows = data.solves
      .filter((solve) => solve.finalResultMs !== null)
      .map((solve) => ({
        name: data.profile.displayName,
        event: solve.event,
        best: solve.finalResultMs as number,
        solveCount: data.solves.filter((item) => item.event === solve.event).length
      }));

    return rows.length ? rows.slice(0, 6) : [];
  }, [data.profile.displayName, data.solves]);

  return (
    <div className="app-shell theme-dark">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6">
        <header className="main-panel mb-5 rounded-2xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight">CubeSpex</div>
              <div className="muted text-sm">Speedcubing timer and community dashboard</div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="rounded-full border border-lime-500/30 bg-lime-400/10 px-2 py-1 text-lime-300">
                Local-first mode
              </span>
              <span>{getSupabaseStatusMessage()}</span>
            </div>
          </div>
        </header>

        <nav className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                selectedTab === tab.id
                  ? 'border-lime-400 bg-lime-500/10 text-lime-300'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
              }`}
              onClick={() => setSelectedTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {selectedTab === 'timer' && activeSession && (
          <div className="grid gap-5 xl:grid-cols-[1.8fr_0.8fr]">
            <TimerPanel
              event={selectedEvent}
              session={activeSession}
              sessions={data.sessions}
              settings={data.settings}
              hasLocalSolve={data.solves.length > 0}
              onEventChange={setSelectedEvent}
              onSessionChange={setSelectedSessionId}
              onNewScramble={() => undefined}
              onSaveSolve={onSaveSolve}
            />

            <div className="space-y-5">
              <SessionManager
                sessions={data.sessions}
                selectedSessionId={selectedSessionId}
                activeEvent={selectedEvent}
                onSelectSession={setSelectedSessionId}
                onCreateSession={onCreateSession}
                onRenameSession={onRenameSession}
                onDeleteSession={onDeleteSession}
              />

              <HistoryPanel solves={data.solves} onDelete={handleDeleteSolve} />
            </div>
          </div>
        )}

        {selectedTab === 'statistics' && (
          <StatsPanel solves={data.solves} selectedEvent={selectedEvent} />
        )}

        {selectedTab === 'leaderboards' && (
          <div className="card p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value as EventId)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2"
              >
                {EVENT_OPTIONS.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {leaderboards.length ? (
                leaderboards.map((row, index) => (
                  <div key={`${row.event}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3">
                    <div>
                      <div className="font-medium">#{index + 1} {row.name}</div>
                      <div className="muted text-xs">{row.event} • {row.solveCount} solves</div>
                    </div>
                    <div className="text-right text-sm font-semibold">{row.best ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(row.best / 1000) + 's' : '--'}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                  No eligible solves yet. Complete a few local solves to populate the leaderboard.
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'friends' && (
          <div className="card p-4">
            <h2 className="mb-4 text-xl font-semibold">Friends</h2>
            <p className="muted mb-4 text-sm">
              Local friend system is active for guest mode. Supabase friend integration can be added later without changing the UI.
            </p>
            <div className="space-y-2">
              {data.friends.length ? (
                data.friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3">
                    <div>
                      <div className="font-medium">{data.profile.displayName}</div>
                      <div className="muted text-xs">Friend code: {data.profile.friendCode}</div>
                    </div>
                    <button
                      className="text-red-400"
                      onClick={() => setData((prev) => ({ ...prev, friends: prev.friends.filter((item) => item.id !== friend.id) }))}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
                  No friends yet. Add local friend connections later when social sync is enabled.
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'profile' && (
          <div className="card p-4">
            <h2 className="mb-4 text-xl font-semibold">Profile</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-sm text-slate-400">Display name</div>
                <div className="mt-2 text-2xl font-semibold">{data.profile.displayName}</div>
                <div className="mt-1 text-sm text-slate-300">@{data.profile.username}</div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-sm text-slate-400">Friend code</div>
                <div className="mt-2 text-2xl font-semibold">{data.profile.friendCode}</div>
                <div className="mt-1 text-sm text-slate-300">Created {new Date(data.profile.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'settings' && (
          <SettingsPanel
            settings={data.settings}
            onChange={(next) => setData((prev) => ({ ...prev, settings: next }))}
          />
        )}
      </div>
    </div>
  );
}

export default App;
