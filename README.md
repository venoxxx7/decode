# decode. — Trading Journal & Analytics

Static web app (no build step) using Supabase for login, database (with Row Level Security),
screenshot storage and realtime sync.

## Files
- `index.html` – the whole app
- `backend.js` – Supabase adapter and login form
- `config.js` – your Supabase URL, anon key, admin email(s)
- `supabase.sql` – table + Row Level Security + storage policies
- `render.yaml` – optional Render static-site config

## Setup
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase.sql`.
3. Authentication → Providers → Email: **turn off "Allow new users to sign up"**
   (otherwise anyone could join the team journal).
4. Authentication → Users → **Add user** (tick auto-confirm) for the admin and the three members.
5. Authentication → URL Configuration: set Site URL to your deployed address (used by password reset).
6. Edit `config.js` with the Project URL, anon key and admin email(s).
7. Push this folder to GitHub, then deploy as a Static Site on Render (publish directory `.`, no build command).

## Privacy model
- `team/main/*` rows: readable/writable by every signed-in member.
- `data/users/<uid>/*` rows: readable/writable only by that user (enforced by RLS, not by the UI).
- Never put the Supabase **service role** key in this repo.

## Not included
- AI features (Analyse my trades, chart zone scanner, AI insights) need a server-side call to an AI API;
  they show "AI is not available" here.
- Automatic backups: use Supabase's backups (paid plans) and the app's CSV/JSON export.
