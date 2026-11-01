import React from 'react';
import type { Settings } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  onChange: (next: Settings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div className="card p-4">
      <h2 className="mb-4 text-xl font-semibold">Settings</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
          <span className="mb-2 block text-sm">Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
          <span className="mb-2 block text-sm">Inspection</span>
          <input
            type="checkbox"
            checked={settings.inspection}
            onChange={(e) => update({ inspection: e.target.checked })}
          />
        </label>

        <label className="rounded-xl border border-slate-700 bg-slate-800 p-3">
          <span className="mb-2 block text-sm">Hold delay (ms)</span>
          <input
            type="number"
            min={100}
            max={1000}
            value={settings.holdDelayMs}
            onChange={(e) => update({ holdDelayMs: Number(e.target.value) || 250 })}
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
            value={settings.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>
    </div>
  );
}
