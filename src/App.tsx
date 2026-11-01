import React, { useMemo } from 'react';
import type { Solve } from '../types';
import { formatDuration } from '../types';

interface HistoryPanelProps {
  solves: Solve[];
  onDelete: (id: string) => void;
}

export function HistoryPanel({ solves, onDelete }: HistoryPanelProps) {
  const sorted = useMemo(() => [...solves].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [solves]);

  return (
    <div className="card p-4">
      <h2 className="mb-4 text-lg font-semibold">Solve history</h2>
      <div className="space-y-2">
        {sorted.map((solve) => (
          <div key={solve.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm">
            <div>
              <div className="font-medium">{solve.event} • {solve.penalty}</div>
              <div className="muted text-xs">{new Date(solve.createdAt).toLocaleString()}</div>
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
