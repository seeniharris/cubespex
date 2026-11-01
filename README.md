# CubeSpex

CubeSpex is a modern speedcubing timer and social platform built with Vite, React, TypeScript, Tailwind, and a Supabase-ready architecture.

## Features

- WCA-style inspection timer with hold-to-start controls and touch support
- Event-based scrambling and solve tracking
- Personal statistics and charting
- Multi-session support
- Local persistence and offline-first behavior
- Optional Supabase auth and cloud sync
- Friends, leaderboard, profile sharing, streak tracking
- Settings, export/import, delete flows

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the values if you have a Supabase project.
3. Install dependencies:

   npm install

4. Start the app:

   npm run dev

## Production build

npm run build

## Test suite

npm test

## Supabase setup

- Create a project in Supabase.
- Copy the project URL and anon key into `.env`.
- Run the migration in `supabase/migrations/001_init.sql`.
- Configure Row Level Security policies and auth as needed.

## Notes

- The app supports guest use without credentials.
- Cloud features are activated when valid Supabase values are configured.
- The app intentionally avoids exposing secrets in the frontend.
