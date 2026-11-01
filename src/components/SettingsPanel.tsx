import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EventId, Solve } from '../types';
import { computeAo12, computeAo5, computeBestSingle, computeMean, computeSessionStats } from '../lib/statistics';
import { formatDuration } from '../types';

interface StatsPanelProps {
  solves: Solve[];
  selectedEvent: EventId;
}

export function StatsPanel({ solves, selectedEvent }: StatsPanelProps) {
  const eventSolves = solves.filter((solve) => solve.event === selectedEvent);
  const stats = computeSessionStats(eventSolves);
  const chartData = eventSolves
    .slice()
    .reverse()
    .map((solve, index) => ({
      name: index + 1,
      value: solve.finalResultMs ?? 0,
      date: solve.createdAt
    }));

  const cards = [
    { label: 'Best single', value: stats.bestSingle ? formatDuration(stats.bestSingle) : '--' },
    { label: 'Best Ao5', value: stats.ao5 ? formatDuration(stats.ao5) : '--' },
    { label: 'Best Ao12', value: stats.ao12 ? formatDuration(stats.ao12) : '--' },
    { label: 'Mean', value: stats.mean ? formatDuration(stats.mean) : '--' },
    { label: 'Total solves', value: String(stats.total) },
    { label: 'PBs', value: '0' }
  ];

  return (
    <div className="space-y-5">
      <div className="grid-panel">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="muted text-xs uppercase tracking-[0.15em]">{card.label}</div>
            <div className="mt-3 text-2xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h3 className="mb-4 text-lg font-semibold">Solve progression</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="progress" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#a3e635" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#a3e635" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(value) => formatDuration(value)} />
              <Tooltip formatter={(value) => formatDuration(Number(value))} />
              <Area type="monotone" dataKey="value" stroke="#a3e635" strokeWidth={3} fill="url(#progress)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
