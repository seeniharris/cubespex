@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  font-family: Inter, 'Segoe UI', sans-serif;
  background: #0c1116;
  color: #f3f4f6;
}

html, body, #root {
  margin: 0;
  min-height: 100%;
  min-width: 0;
  background: #0c1116;
}

body {
  min-height: 100vh;
}

* {
  box-sizing: border-box;
}

button, select, input, textarea {
  font: inherit;
}

.card {
  @apply rounded-2xl border border-slate-700 bg-slate-900/80 shadow-soft;
}

.panel-button {
  @apply rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:border-lime-400 hover:text-lime-300;
}

.grid-panel {
  @apply grid gap-4 md:grid-cols-2 xl:grid-cols-3;
}

.theme-light {
  --bg: #f4f7f8;
  --panel: #ffffff;
  --panel-alt: #edf2f4;
  --text: #0f172a;
  --muted: #475569;
  --border: #dbe4ea;
}

.theme-dark {
  --bg: #0c1116;
  --panel: #111827;
  --panel-alt: #1f2937;
  --text: #f8fafc;
  --muted: #94a3b8;
  --border: #233141;
}

.app-shell {
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.main-panel {
  background: var(--panel);
  border: 1px solid var(--border);
}

.secondary-panel {
  background: var(--panel-alt);
  border: 1px solid var(--border);
}

.muted {
  color: var(--muted);
}

.timer-display {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 1;
}

.stat-card {
  @apply rounded-2xl border border-slate-700 p-4;
  background: rgba(15, 23, 42, 0.92);
}

@media (max-width: 640px) {
  .timer-display {
    font-size: clamp(2.6rem, 12vw, 5.5rem);
  }
}
