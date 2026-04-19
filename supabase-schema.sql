-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists vehicles (
  id         text primary key,
  plate      text not null default '',
  driver     text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- NEW: routes are vehicle-level, independent of any specific day
create table if not exists routes (
  id                 text primary key,
  vehicle_id         text not null references vehicles(id) on delete cascade,
  title              text not null default '',
  origin             text not null default '',
  destination        text not null default '',
  departure_date     text,          -- ISO date YYYY-MM-DD
  departure_time     text default '',
  arrival_date       text,
  arrival_time       text default '',
  distance_km        numeric,
  estimated_minutes  numeric,
  source             text,
  company            jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

-- NEW: day-level notes/tags, separate from routes
create table if not exists day_notes (
  id         text primary key,  -- vehicleId_YYYY-MM-DD
  vehicle_id text not null references vehicles(id) on delete cascade,
  date_str   text not null,
  notes      text not null default '',
  tags       text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Legacy cells table kept for reference, no longer used by app
create table if not exists cells (
  id         text primary key,
  vehicle_id text not null references vehicles(id) on delete cascade,
  date_str   text not null,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id         text primary key,
  label      text not null,
  color      text not null default 'blue',
  position   integer not null default 0,
  category   text not null default 'ruta',   -- 'vehiculo' | 'ruta' | 'dia'
  created_at timestamptz not null default now()
);

-- Migration for existing installs (run once if table already exists):
-- alter table tags add column if not exists category text not null default 'ruta';

-- ── Tag category migration ────────────────────────────────────────────────────
-- Run this block to add the category column and fix known tag categories:
alter table tags add column if not exists category text not null default 'ruta';

update tags set category = 'dia'      where id in ('extra', 'fiesta', 'urgente');
update tags set category = 'ruta'     where id in ('ups', 'dsv', 'retraso');
update tags set category = 'vehiculo' where id in ('mantenim', 'averia', 'revision');
update tags set category = 'dia'      where id in ('festivo', 'lluvia', 'trafico');

create table if not exists settings (
  key   text primary key,
  value text not null default ''
);

-- Row Level Security (no auth — public access)
alter table vehicles  enable row level security;
alter table routes    enable row level security;
alter table day_notes enable row level security;
alter table cells     enable row level security;
alter table tags      enable row level security;
alter table settings  enable row level security;

create policy "public vehicles"  on vehicles  for all using (true) with check (true);
create policy "public routes"    on routes    for all using (true) with check (true);
create policy "public day_notes" on day_notes for all using (true) with check (true);
create policy "public cells"     on cells     for all using (true) with check (true);
create policy "public tags"      on tags      for all using (true) with check (true);
create policy "public settings"  on settings  for all using (true) with check (true);

-- Indexes for common queries
create index if not exists routes_vehicle_id_idx    on routes(vehicle_id);
create index if not exists routes_departure_date_idx on routes(departure_date);
create index if not exists day_notes_vehicle_id_idx  on day_notes(vehicle_id);
