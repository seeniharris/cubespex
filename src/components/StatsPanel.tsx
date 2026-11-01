import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { EventId, Session } from '../types';
import { makeId } from '../types';

interface SessionManagerProps {
  sessions: Session[];
  selectedSessionId: string;
  activeEvent: EventId;
  onSelectSession: (id: string) => void;
  onCreateSession: (name: string, event: EventId) => void;
  onRenameSession: (id: string, name: string) => void;
  onDeleteSession: (id: string) => void;
}

export function SessionManager(props: SessionManagerProps) {
  const [draftName, setDraftName] = React.useState('');

  const addSession = () => {
    const name = draftName.trim() || `Practice ${props.sessions.length + 1}`;
    props.onCreateSession(name, props.activeEvent);
    setDraftName('');
  };

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <button className="panel-button" onClick={addSession}>
          <Plus className="mr-1 inline h-4 w-4" /> New
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Session name"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {props.sessions.map((session) => (
          <div key={session.id} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
            <button
              className="flex-1 text-left text-sm font-medium"
              onClick={() => props.onSelectSession(session.id)}
            >
              {session.name}
            </button>
            <button
              className="text-xs text-slate-300"
              onClick={() => {
                const name = window.prompt('Rename session', session.name);
                if (name && name.trim()) props.onRenameSession(session.id, name.trim());
              }}
            >
              Rename
            </button>
            <button
              className="text-red-400"
              onClick={() => props.onDeleteSession(session.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
