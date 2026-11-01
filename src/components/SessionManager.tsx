import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Play, RotateCcw, Sparkles, Square, TimerReset, Zap } from 'lucide-react';
import { EVENT_OPTIONS, type EventId, type Penalty, type Session, type Settings } from '../types';
import { formatDuration } from '../types';
import { generateScramble } from '../lib/scramble';

interface TimerPanelProps {
  event: EventId;
  session: Session;
  sessions: Session[];
  settings: Settings;
  hasLocalSolve: boolean;
  onEventChange: (event: EventId) => void;
  onSessionChange: (sessionId: string) => void;
  onNewScramble: (scramble: string) => void;
  onSaveSolve: (payload: { event: EventId; sessionId: string; scramble: string; rawTimeMs: number; penalty: Penalty; finalResultMs: number | null; createdAt: string }) => void;
}

function getPenaltyFromInspection(delayMs: number): Penalty {
  if (delayMs >= 2000) return 'DNF';
  if (delayMs > 0) return '+2';
  return 'none';
}

export function TimerPanel(props: TimerPanelProps) {
  const [scramble, setScramble] = useState('');
  const [displayMs, setDisplayMs] = useState(0);
  const [state, setState] = useState<'idle' | 'holding' | 'ready' | 'running' | 'inspection' | 'stopped'>('idle');
  const [inspectionRemainingMs, setInspectionRemainingMs] = useState(15000);
  const [inspectionDelay, setInspectionDelay] = useState(0);
  const [lastSolveTime, setLastSolveTime] = useState<number | null>(null);
  const [bestSingle, setBestSingle] = useState<number | null>(null);
  const [currentAo5, setCurrentAo5] = useState<number | null>(null);
  const [currentAo12, setCurrentAo12] = useState<number | null>(null);
  const [solveCount, setSolveCount] = useState(0);
  const [statusText, setStatusText] = useState('Idle');

  const holdStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const inspectionDeadlineRef = useRef<number | null>(null);
  const readyAtRef = useRef<number | null>(null);
  const pendingPenaltyRef = useRef<Penalty>('none');
  const isTouchRef = useRef(false);

  useEffect(() => {
    let active = true;
    generateScramble(props.event).then((value) => {
      if (active) {
        setScramble(value);
        props.onNewScramble(value);
      }
    });
    return () => {
      active = false;
    };
  }, [props.event, props.onNewScramble]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!props.settings.keyboardEnabled) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (event.repeat) return;
        handleSpacePress();
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        clearHold();
        cancelInspection();
        setState('idle');
        setStatusText('Cancelled');
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!props.settings.keyboardEnabled) return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleSpaceRelease();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [state, props.settings.keyboardEnabled, props.settings.inspection, inspectionRemainingMs]);

  const stopAnimationFrame = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const clearHold = () => {
    if (holdStartRef.current !== null) {
      holdStartRef.current = null;
    }
    if (readyAtRef.current !== null) {
      readyAtRef.current = null;
    }
  };

  const cancelInspection = () => {
    stopAnimationFrame();
    inspectionDeadlineRef.current = null;
    setInspectionRemainingMs(15000);
    setInspectionDelay(0);
    pendingPenaltyRef.current = 'none';
  };

  const beginInspectionCountdown = () => {
    if (!props.settings.inspection) {
      beginSolveTimer('none');
      return;
    }

    setState('inspection');
    setStatusText('Inspection 15s');
    const deadline = performance.now() + 15000;
    inspectionDeadlineRef.current = deadline;

    const tick = () => {
      if (!inspectionDeadlineRef.current) return;
      const remaining = Math.max(0, inspectionDeadlineRef.current - performance.now());
      setInspectionRemainingMs(remaining);

      if (remaining <= 0) {
        setStatusText('Inspection complete');
        stopAnimationFrame();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    stopAnimationFrame();
    rafRef.current = requestAnimationFrame(tick);
  };

  const beginSolveTimer = (penalty: Penalty) => {
    setState('running');
    setStatusText('Running');
    startTimestampRef.current = performance.now();
    pendingPenaltyRef.current = penalty;
    const update = () => {
      if (startTimestampRef.current === null) return;
      const value = performance.now() - startTimestampRef.current;
      setDisplayMs(value);
      rafRef.current = requestAnimationFrame(update);
    };
    stopAnimationFrame();
    rafRef.current = requestAnimationFrame(update);
  };

  const completeSolve = () => {
    stopAnimationFrame();
    const rawMs = displayMs;
    const penalty = pendingPenaltyRef.current;
    const finalResultMs = penalty === 'DNF' ? null : penalty === '+2' ? rawMs + 2000 : rawMs;
    const solveData = {
      event: props.event,
      sessionId: props.session.id,
      scramble,
      rawTimeMs: rawMs,
      penalty,
      finalResultMs,
      createdAt: new Date().toISOString()
    };

    props.onSaveSolve(solveData);
    setLastSolveTime(rawMs);
    setState('stopped');
    setStatusText('Solved');
    setInspectionRemainingMs(15000);
    setInspectionDelay(0);
    pendingPenaltyRef.current = 'none';
    clearHold();
    setDisplayMs(0);
    setTimeout(() => {
      setState('idle');
      setStatusText('Idle');
      generateScramble(props.event).then((next) => {
        setScramble(next);
        props.onNewScramble(next);
      });
    }, 300);
  };

  const handleSpacePress = () => {
    if (state === 'running') {
      completeSolve();
      return;
    }

    if (state === 'holding' || state === 'ready') {
      return;
    }

    if (state === 'inspection') {
      const relevantDelay = performance.now() - (inspectionDeadlineRef.current || performance.now());
      const delayMs = Math.max(0, Math.abs(relevantDelay));
      setInspectionDelay(delayMs);
      const penalty = getPenaltyFromInspection(delayMs);
      pendingPenaltyRef.current = penalty;
      beginSolveTimer(penalty);
      return;
    }

    setState('holding');
    setStatusText('Holding...');
    holdStartRef.current = performance.now();
    setTimeout(() => {
      if (holdStartRef.current === null) return;
      setState('ready');
      setStatusText('Ready');
      readyAtRef.current = performance.now();
    }, props.settings.holdDelayMs);
  };

  const handleSpaceRelease = () => {
    if (state === 'holding') {
      clearHold();
      setState('idle');
      setStatusText('Idle');
      return;
    }

    if (state === 'ready') {
      setState('idle');
      setStatusText('Armed');
      if (props.settings.inspection) {
        beginInspectionCountdown();
      } else {
        beginSolveTimer('none');
      }
      clearHold();
      readyAtRef.current = null;
    }
  };

  const countdownLabel = useMemo(() => {
    if (state === 'inspection') {
      return (inspectionRemainingMs / 1000).toFixed(1) + 's';
    }
    return state;
  }, [inspectionRemainingMs, state]);

  useEffect(() => {
    const timerTheme = document.documentElement.classList;
    if (props.settings.theme === 'light') {
      timerTheme.remove('theme-dark');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    }
  }, [props.settings.theme]);

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={props.event}
              onChange={(e) => props.onEventChange(e.target.value as EventId)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {EVENT_OPTIONS.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </select>

            <select
              value={props.session.id}
              onChange={(e) => props.onSessionChange(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {props.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Sparkles className="h-4 w-4 text-lime-400" />
            <span>{props.hasLocalSolve ? 'Local data ready' : 'Guest session active'}</span>
          </div>
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>{props.event}</span>
          <span>{props.session.name}</span>
        </div>

        <div className="mt-4 rounded-2xl border border-lime-500/30 bg-slate-950/80 p-4 text-center">
          <div className="mb-3 text-sm text-slate-300">{scramble}</div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="panel-button" onClick={() => navigator.clipboard.writeText(scramble).catch(() => undefined)}>
              Copy scramble
            </button>
            <button
              className="panel-button"
              onClick={() => generateScramble(props.event).then((value) => {
                setScramble(value);
                props.onNewScramble(value);
              })}
            >
              New scramble
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6 md:p-8">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Status</span>
          <span>{countdownLabel}</span>
        </div>

        <div
          onPointerDown={(e) => {
            if (!props.settings.mobileControls) return;
            e.preventDefault();
            isTouchRef.current = true;
            handleSpacePress();
          }}
          onPointerUp={() => {
            if (!props.settings.mobileControls) return;
            handleSpaceRelease();
          }}
          onPointerCancel={() => {
            if (!props.settings.mobileControls) return;
            clearHold();
            setState('idle');
            setStatusText('Cancelled');
          }}
          className="flex min-h-[260px] cursor-pointer select-none items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/70 text-center transition active:scale-[0.99]"
          style={{
            borderColor:
              state === 'ready' ? '#a3e635' : state === 'holding' ? '#fbbf24' : state === 'running' ? '#f8fafc' : '#334155'
          }}
        >
          <div>
            <div className="timer-display text-5xl font-bold text-white md:text-7xl">
              {state === 'inspection' ? `${(inspectionRemainingMs / 1000).toFixed(1)}s` : formatDuration(displayMs)}
            </div>
            <div className="mt-4 text-sm uppercase tracking-[0.2em] text-slate-400">
              {state === 'running' ? 'RUNNING' : statusText}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Previous</div>
            <div className="mt-2 text-xl font-semibold">{lastSolveTime ? formatDuration(lastSolveTime) : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Best Single</div>
            <div className="mt-2 text-xl font-semibold">{bestSingle ? formatDuration(bestSingle) : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Ao5</div>
            <div className="mt-2 text-xl font-semibold">{currentAo5 ? formatDuration(currentAo5) : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">Ao12</div>
            <div className="mt-2 text-xl font-semibold">{currentAo12 ? formatDuration(currentAo12) : '--'}</div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock3 className="h-4 w-4" />
            <span>Solve count: {solveCount}</span>
          </div>
          <div className="flex gap-2">
            <button className="panel-button" onClick={() => setDisplayMs(0)}>
              <TimerReset className="mr-1 inline h-4 w-4" /> Reset
            </button>
            <button
              className="panel-button"
              onClick={() => {
                setState('idle');
                setStatusText('Idle');
                clearHold();
                cancelInspection();
                setDisplayMs(0);
              }}
            >
              <RotateCcw className="mr-1 inline h-4 w-4" /> Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
