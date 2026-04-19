# Planificador de Rutas — Truck Dispatch Board

Weekly route planner for truck fleets. Built with React + Vite, backed by Supabase, deployed on Vercel.

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS      |
| Forms      | react-hook-form                   |
| Icons      | lucide-react                      |
| Database   | Supabase (PostgreSQL + REST API)  |
| Routing distances | OpenRouteService API (HGV) + Haversine fallback |
| Deployment | Vercel                            |

---

## Environment Variables

Create `.env.local` for local development:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_KEY=<your-supabase-publishable-key>
VITE_ORS_KEY=<your-openrouteservice-api-key>
```

`VITE_ORS_KEY` is optional. Without it, distances are estimated via straight-line × 1.3.

---

## Local Development

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Database Setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New query**
3. Paste and run the full contents of `supabase-schema.sql`

That creates all tables, indexes, and Row Level Security policies.

### Schema overview

| Table       | Purpose                                          |
|-------------|--------------------------------------------------|
| `vehicles`  | Fleet — plate, driver name, display order        |
| `routes`    | Individual routes per vehicle and date           |
| `day_notes` | Per-vehicle per-day notes and tags               |
| `tags`      | User-defined labels (route, vehicle, day types)  |
| `settings`  | App-wide key/value settings (API key, etc.)      |

### Adding columns after initial setup

If you already have a running database and need to add new columns:

```sql
-- Reminder settings per route (added in v1.1)
alter table routes add column if not exists reminder jsonb not null default '{}';

-- Tags per route (added in v1.1)
alter table routes add column if not exists tags text[] not null default '{}';
```

---

## Deploy to Vercel

### First deploy

```bash
npm install -g vercel
vercel login
vercel --prod
```

Vercel auto-detects Vite. When prompted, accept all defaults.

### Environment variables on Vercel

After the first deploy, go to **Vercel Dashboard → Project → Settings → Environment Variables** and add:

| Name                | Value                            | Environment        |
|---------------------|----------------------------------|--------------------|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co`  | Production, Preview |
| `VITE_SUPABASE_KEY` | `<publishable key>`              | Production, Preview |
| `VITE_ORS_KEY`      | `<ors key>` (optional)           | Production, Preview |

Then trigger a redeploy: **Deployments → Redeploy**.

### Subsequent deploys

```bash
vercel --prod
```

Or connect the Vercel project to a Git repo for automatic deploys on push.

### SPA routing

Vercel handles SPA routing automatically for Vite projects. No `vercel.json` needed.

---

## Driving Time Rules (CE 561/2006)

The app enforces EU driving time regulations:

| Rule                        | Value                              |
|-----------------------------|------------------------------------|
| Max speed used for estimate | 90 km/h                            |
| Mandatory break after       | 4 h 30 min continuous driving      |
| Break duration              | 45 min                             |
| Daily max driving (standard)| 9 h                                |
| Daily max driving (extended)| 10 h (max 2× per week)             |
| Minimum daily rest          | 9 h (reduced) / 11 h (standard)    |
| Weekly max driving          | 56 h                               |

---

## Project Structure

```
src/
  App.jsx                 # Root — data fetching, state, notifications
  constants.js            # Shared constants and reminder options
  utils.js                # Pure helpers (date math, geocoding, driving time)
  components/
    CellEditor.jsx         # Day panel — route forms, reminders, compliance
    CellContent.jsx        # Grid cell — visual summary of a day
    AddressInput.jsx       # Autocomplete address input
    TrucksModal.jsx        # Fleet management modal
    SettingsModal.jsx      # API key + tag management
    OpsBar.jsx             # Operations summary bar
    LogisticsPanel.jsx     # Weekly logistics overview
    ConfirmDialog.jsx      # Generic confirmation dialog
    primitives.jsx         # IconInput, SectionLabel
  lib/
    supabase.js            # Supabase client init
    db.js                  # All database operations
supabase-schema.sql        # Full DB schema — run once on new Supabase project
```
