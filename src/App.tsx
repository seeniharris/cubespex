import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Clock3,
  Gauge,
  Settings as SettingsIcon,
  Trophy,
  UserRound,
  Users,
  Zap
} from 'lucide-react';
import { generateScramble } from './lib/scramble';
import { computeAo12, computeAo5, computeBestSingle, computeMean, computeSessionStats, calculateStreaks } from './lib/statistics';
import { loadData, saveData } from './lib/storage';
import { EVENT_OPTIONS, formatDuration, type EventId, type LocalData, type Penalty, type Session, type Solve, type TabId } from './types';

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'timer', label: 'Timer', icon: <Gauge className="h-4 w-4" /> },
  { id: 'statistics', label: 'Statistics', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'leaderboards', label: 'Leaderboards', icon: <Trophy className="h-4 w-4" /> },
  { id: 'friends', label: 'Friends', icon: <Users className="h-4 w-4" /> },
  { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> }
];

function App() {
  const [data, setData] = useState<LocalData>(loadData());
  const [selectedEvent, setSelectedEvent] = useState<EventId>('333');
  const [selectedTab, setSelectedTab] = useState<TabId>('timer');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(data.sessions[0]?.id || 'default-session');
  const [newFriendName, setNewFriendName] = useState('');

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!data.sessions.some((session) => session.id === selectedSessionId) && data.sessions[0]) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [data.sessions, selectedSessionId]);

  const activeSession = useMemo(
    () => data.sessions.find((session) => session.id === selectedSessionId) || data.sessions[0],
    [data.sessions, selectedSessionId]
  );

  const onCreateSession = (name: string, event: EventId) => {
    const id = `session-${Date.now()}`;
    const nextSessions = [...data.sessions, { id, name, event }];
    setData((prev) => ({ ...prev, sessions: nextSessions }));
    setSelectedSessionId(id);
  };

  const onRenameSession = (id: string, name: string) => {
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => (session.id === id ? { ...session, name } : session))
    }));
  };

  const onDeleteSession = (id: string) => {
    if (data.sessions.length <= 1) return;
    if (!window.confirm('Delete this session and all local solves from it?')) return;
    const nextSessions = data.sessions.filter((session) => session.id !== id);
    setData((prev) => ({
      ...prev,
      sessions: nextSessions,
      solves: prev.solves.filter((solve) => solve.sessionId !== id)
    }));
    setSelectedSessionId(nextSessions[0].id);
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
    setData((prev) => ({ ...prev, solves: prev.solves.filter((solve) => solve.id !== id) }));
  };

  const currentEventSolves = data.solves.filter((solve) => solve.event === selectedEvent);
  const stats = computeSessionStats(currentEventSolves);
  const streaks = calculateStreaks(data.solves);

  const leaderboardRows = [...data.solves]
    .filter((solve) => solve.finalResultMs !== null)
    .sort((a, b) => (a.finalResultMs ?? Infinity) - (b.finalResultMs ?? Infinity))
    .slice(0, 8)
    .map((solve, index) => ({
      rank: index + 1,
      name: data.profile.displayName,
      value: solve.finalResultMs ?? 0,
      event: solve.event
    }));

  return (
    <div className="app-shell theme-dark">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6">
        <header className="main-panel mb-5 rounded-2xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight">CubeSpex</div>
              <div className="muted text-sm">Local-first speedcubing timer and community dashboard</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="rounded-full border border-lime-500/30 bg-lime-500/10 px-2 py-1 text-lime-300">
                Local-first mode
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">
                Supabase ready: placeholder only
              </span>
            </div>
          </div>
        </header>

        <nav className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                selectedTab === tab.id ? 'border-lime-400 bg-lime-500/10 text-lime-300' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
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
              onEventChange={setSelectedEvent}
              onSessionChange={setSelectedSessionId}
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
          <div className="space-y-5">
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-300">Event</label>
                <select
                  value={selectedEvent}
                  onChange={(event) => setSelectedEvent(event.target.value as EventId)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                >
                  {EVENT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-panel">
              {[
                { label: 'Best single', value: stats.bestSingle ? formatDuration(stats.bestSingle) : '--' },
                { label: 'Best Ao5', value: stats.ao5 ? formatDuration(stats.ao5) : '--' },
                { label: 'Best Ao12', value: stats.ao12 ? formatDuration(stats.ao12) : '--' },
                { label: 'Mean', value: stats.mean ? formatDuration(stats.mean) : '--' },
                { label: 'Total solves', value: String(stats.total) },
                { label: 'PBs', value: '0' }
              ].map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">{item.label}</div>
                  <div className="mt-3 text-2xl font-semibold">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <h3 className="mb-3 text-lg font-semibold">Activity and progression</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Current streak</div>
                  <div className="mt-2 text-2xl font-semibold">{streaks.current}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Longest streak</div>
                  <div className="mt-2 text-2xl font-semibold">{streaks.longest}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">Active days</div>
                  <div className="mt-2 text-2xl font-semibold">{streaks.activeDays}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'leaderboards' && (
          <div className="card p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={selectedEvent}
                onChange={(event) => setSelectedEvent(event.target.value as EventId)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            {leaderboardRows.length ? (
              <div className="space-y-2">
                {leaderboardRows.map((row) => (
                  <div key={`${row.event}-${row.rank}`} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3">
                    <div>
                      <div className="font-medium">#{row.rank} {row.name}</div>
                      <div className="text-xs text-slate-400">{row.event} • local leaderboard</div>
                    </div>
                    <div className="text-sm font-semibold text-lime-300">{formatDuration(row.value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
                No eligible solves yet. Complete a few local solves to populate leaderboard rankings.
              </div>
            )}
          </div>
        )}

        {selectedTab === 'friends' && (
          <div className="card p-4">
            <h2 className="mb-4 text-xl font-semibold">Friends</h2>
            <div className="mb-4 flex gap-2">
              <input
                value={newFriendName}
                onChange={(event) => setNewFriendName(event.target.value)}
                placeholder="Search by username or friend code"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                className="panel-button"
                onClick={() => {
                  if (!newFriendName.trim()) return;
                  setData((prev) => ({
                    ...prev,
                    friends: [
                      ...prev.friends,
                      { id: `friend-${Date.now()}`, friendId: newFriendName.trim(), createdAt: new Date().toISOString() }
                    ]
                  }));
                  setNewFriendName('');
                }}
              >
                Add friend
              </button>
            </div>

            {data.friends.length ? (
              <div className="space-y-2">
                {data.friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3">
                    <div>
                      <div className="font-medium">{friend.friendId}</div>
                      <div className="text-xs text-slate-400">Local friend record</div>
                    </div>
                    <button
                      className="text-red-400"
                      onClick={() => setData((prev) => ({ ...prev, friends: prev.friends.filter((item) => item.id !== friend.id) }))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                No friends added yet.
              </div>
            )}
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

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="panel-button"
                onClick={() => {
                  const nextName = window.prompt('Update display name', data.profile.displayName) || data.profile.displayName;
                  setData((prev) => ({ ...prev, profile: { ...prev.profile, displayName: nextName.trim() || prev.profile.displayName } }));
                }}
              >
                Edit display name
              </button>
              <button
                className="panel-button"
                onClick={() => {
                  const nextBio = window.prompt('Update bio', data.profile.bio) || data.profile.bio;
                  setData((prev) => ({ ...prev, profile: { ...prev.profile, bio: nextBio.trim() } }));
                }}
              >
                Edit bio
              </button>
            </div>
          </div>
        )}

        {selectedTab === 'settings' && (
          <div className="space-y-5">
            <div className="card p-4">
              <h2 className="mb-4 text-xl font-semibold">Settings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <span className="mb-2 block text-sm">Theme</span>
                  <select
                    value={data.settings.theme}
                    onChange={(event) => setData((prev) => ({ ...prev, settings: { ...prev.settings, theme: event.target.value as 'dark' | 'light' } }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>

                <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <span className="mb-2 block text-sm">Inspection mode</span>
                  <input
                    type="checkbox"
                    checked={data.settings.inspection}
                    onChange={(event) => setData((prev) => ({ ...prev, settings: { ...prev.settings, inspection: event.target.checked } }))}
                  />
                </label>

                <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <span className="mb-2 block text-sm">Hold delay (ms)</span>
                  <input
                    type="number"
                    min={100}
                    max={1000}
                    value={data.settings.holdDelayMs}
                    onChange={(event) => setData((prev) => ({ ...prev, settings: { ...prev.settings, holdDelayMs: Number(event.target.value) || 250 } }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2"
                  />
                </label>

                <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <span className="mb-2 block text-sm">Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={data.settings.volume}
                    onChange={(event) => setData((prev) => ({ ...prev, settings: { ...prev.settings, volume: Number(event.target.value) } }))}
                    className="w-full"
                  />
                </label>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  className="panel-button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'cubespex-export.json';
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export JSON
                </button>
                <button
                  className="panel-button"
                  onClick={() => {
                    const csv = ['event,session,penalty,time,createdAt']
                      .concat(
                        data.solves.map((solve) => `${solve.event},${solve.sessionId},${solve.penalty},${solve.finalResultMs ?? 'DNF'},${solve.createdAt}`)
                      )
                      .join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'cubespex-export.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </button>
                <button
                  className="panel-button"
                  onClick={() => {
                    if (window.confirm('Clear all local solve data?')) {
                      setData((prev) => ({ ...prev, solves: [] }));
                    }
                  }}
                >
                  Clear local solves
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TimerPanelProps {
  event: EventId;
  session: Session;
  sessions: Session[];
  settings: any;
  onEventChange: (event: EventId) => void;
  onSessionChange: (sessionId: string) => void;
  onSaveSolve: (payload: {
    event: EventId;
    sessionId: string;
    scramble: string;
    rawTimeMs: number;
    penalty: Penalty;
    finalResultMs: number | null;
    createdAt: string;
  }) => void;
}

function TimerPanel({ event, session, sessions, settings, onEventChange, onSessionChange, onSaveSolve }: TimerPanelProps) {
  const [scramble, setScramble] = useState('');
  const [displayMs, setDisplayMs] = useState(0);
  const [timerState, setTimerState] = useState<'idle' | 'holding' | 'ready' | 'running' | 'inspection' | 'stopped'>('idle');
  const [statusText, setStatusText] = useState('Idle');
  const [inspectionLeft, setInspectionLeft] = useState(15000);
  const [lastSolve, setLastSolve] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const inspectionEndRef = useRef<number | null>(null);
  const pendingPenaltyRef = useRef<Penalty>('none');

  const cancelRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    let active = true;
    generateScramble(event).then((next) => {
      if (active) setScramble(next);
    });
    return () => { active = false; };
  }, [event]);

  const beginRunning = (penalty: Penalty = 'none') => {
    cancelRaf();
    pendingPenaltyRef.current = penalty;
    setTimerState('running');
    setStatusText('Running');
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current === null) return;
      setDisplayMs(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const finishSolve = () => {
    cancelRaf();
    const rawMs = displayMs;
    const penalty = pendingPenaltyRef.current;
    const finalResultMs = penalty === 'DNF' ? null : penalty === '+2' ? rawMs + 2000 : rawMs;
    onSaveSolve({
      event,
      sessionId: session.id,
      scramble,
      rawTimeMs: rawMs,
      penalty,
      finalResultMs,
      createdAt: new Date().toISOString()
    });
    setLastSolve(rawMs);
    setTimerState('stopped');
    setStatusText('Solved');
    setTimeout(() => {
      setTimerState('idle');
      setStatusText('Idle');
      setDisplayMs(0);
      setInspectionLeft(15000);
      generateScramble(event).then(setScramble);
    }, 400);
  };

  const handlePress = () => {
    if (timerState === 'running') {
      finishSolve();
      return;
    }

    if (timerState === 'inspection') {
      const elapsed = 15000 - inspectionLeft;
      const nextPenalty = elapsed >= 17000 ? 'DNF' : elapsed >= 15000 ? '+2' : 'none';
      pendingPenaltyRef.current = nextPenalty;
      beginRunning(nextPenalty);
      setInspectionLeft(0);
      inspectionEndRef.current = null;
      return;
    }

    if (timerState === 'holding' || timerState === 'ready') return;

    setTimerState('holding');
    setStatusText('Holding...');

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = window.setTimeout(() => {
      setTimerState('ready');
      setStatusText('Ready');
    }, settings.holdDelayMs ?? 250);
  };

  const handleRelease = () => {
    if (timerState === 'holding') {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      setTimerState('idle');
      setStatusText('Idle');
      return;
    }

    if (timerState === 'ready') {
      if (settings.inspection) {
        setTimerState('inspection');
        setStatusText('Inspection');
        inspectionEndRef.current = performance.now() + 15000;
        const tick = () => {
          if (!inspectionEndRef.current) return;
          const remaining = Math.max(0, inspectionEndRef.current - performance.now());
          setInspectionLeft(remaining);
          if (remaining <= 0) {
            setStatusText('Inspection complete');
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        cancelRaf();
        rafRef.current = requestAnimationFrame(tick);
      } else {
        beginRunning('none');
      }
      return;
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!settings.keyboardEnabled) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (event.repeat) return;
        handlePress();
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        cancelRaf();
        setTimerState('idle');
        setStatusText('Cancelled');
        setDisplayMs(0);
        setInspectionLeft(15000);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!settings.keyboardEnabled) return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleRelease();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [settings.keyboardEnabled, settings.inspection, timerState, inspectionLeft]);

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={event}
              onChange={(e) => onEventChange(e.target.value as EventId)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {EVENT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <select
              value={session.id}
              onChange={(e) => onSessionChange(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Zap className="h-4 w-4 text-lime-400" />
            <span>{settings.inspection ? 'WCA-style inspection enabled' : 'Inspection disabled'}</span>
          </div>
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>{event}</span>
          <span>{session.name}</span>
        </div>

        <div className="mt-4 rounded-2xl border border-lime-500/30 bg-slate-950/80 p-4 text-center">
          <div className="mb-3 text-sm text-slate-300">{scramble || 'Generating scramble...'}</div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="panel-button" onClick={() => generateScramble(event).then(setScramble)}>New scramble</button>
            <button className="panel-button" onClick={() => navigator.clipboard.writeText(scramble).catch(() => undefined)}>Copy</button>
          </div>
        </div>
      </div>

      <div className="card p-6 md:p-8">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Status</span>
          <span>{timerState === 'inspection' ? `${(inspectionLeft / 1000).toFixed(1)}s` : timerState}</span>
        </div>

        <div
          onPointerDown={(e) => {
            if (!settings.mobileControls) return;
            e.preventDefault();
            handlePress();
          }}
          onPointerUp={() => {
            if (!settings.mobileControls) return;
            handleRelease();
          }}
          onPointerCancel={() => {
            if (!settings.mobileControls) return;
            cancelRaf();
            setTimerState('idle');
            setStatusText('Cancelled');
          }}
          className="flex min-h-[260px] cursor-pointer select-none items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/70 text-center transition active:scale-[0.99]"
          style={{ borderColor: timerState === 'ready' ? '#a3e635' : timerState === 'holding' ? '#fbbf24' : timerState === 'running' ? '#f8fafc' : '#334155' }}
        >
          <div>
            <div className="timer-display text-5xl font-bold text-white md:text-7xl">
              {timerState === 'inspection' ? `${(inspectionLeft / 1000).toFixed(1)}s` : formatDuration(displayMs)}
            </div>
            <div className="mt-4 text-sm uppercase tracking-[0.2em] text-slate-400">{statusText}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Previous</div>
            <div className="mt-2 text-xl font-semibold">{lastSolve ? formatDuration(lastSolve) : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Best Single</div>
            <div className="mt-2 text-xl font-semibold">--</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Ao5</div>
            <div className="mt-2 text-xl font-semibold">--</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Ao12</div>
            <div className="mt-2 text-xl font-semibold">--</div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock3 className="h-4 w-4" />
            <span>Solve count: 0</span>
          </div>
          <div className="flex gap-2">
            <button className="panel-button" onClick={() => setDisplayMs(0)} >Reset</button>
            <button className="panel-button" onClick={() => { cancelRaf(); setTimerState('idle'); setStatusText('Idle'); setDisplayMs(0); setInspectionLeft(15000); }}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SessionManagerProps {
  sessions: Session[];
  selectedSessionId: string;
  activeEvent: EventId;
  onSelectSession: (id: string) => void;
  onCreateSession: (name: string, event: EventId) => void;
  onRenameSession: (id: string, name: string) => void;
  onDeleteSession: (id: string) => void;
}

function SessionManager({ sessions, selectedSessionId, activeEvent, onSelectSession, onCreateSession, onRenameSession, onDeleteSession }: SessionManagerProps) {
  const [draftName, setDraftName] = useState('');

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <button
          className="panel-button"
          onClick={() => {
            const name = draftName.trim() || `Practice ${sessions.length + 1}`;
            onCreateSession(name, activeEvent);
            setDraftName('');
          }}
        >
          New
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="Session name"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
            <button className="flex-1 text-left text-sm font-medium" onClick={() => onSelectSession(session.id)}>
              {session.name}
            </button>
            <button className="text-xs text-slate-300" onClick={() => {
              const next = window.prompt('Rename session', session.name);
              if (next && next.trim()) onRenameSession(session.id, next.trim());
            }}>Rename</button>
            <button className="text-red-400" onClick={() => onDeleteSession(session.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HistoryPanelProps {
  solves: Solve[];
  onDelete: (id: string) => void;
}

function HistoryPanel({ solves, onDelete }: HistoryPanelProps) {
  const sorted = useMemo(() => [...solves].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [solves]);

  return (
    <div className="card p-4">
      <h2 className="mb-4 text-lg font-semibold">Solve history</h2>
      <div className="space-y-2">
        {sorted.map((solve) => (
          <div key={solve.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm">
            <div>
              <div className="font-medium">{solve.event} • {solve.penalty}</div>
              <div className="text-xs text-slate-400">{new Date(solve.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <span>{solve.finalResultMs !== null ? formatDuration(solve.finalResultMs) : 'DNF'}</span>
              <button className="text-red-400" onClick={() => onDelete(solve.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;




































































 
																																																																																																																																																																			
test



































































































