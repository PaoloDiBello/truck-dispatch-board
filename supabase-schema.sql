-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists vehicles (
  id         text primary key,
  plate      text not null default '',
  driver     text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cells (
  id         text primary key,  -- format: vehicleId_YYYY-MM-DD
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
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value text not null default ''
);

-- Enable Row Level Security but allow all for now (no auth)
alter table vehicles enable row level security;
alter table cells    enable row level security;
alter table tags     enable row level security;
alter table settings enable row level security;

create policy "public read vehicles"  on vehicles for select using (true);
create policy "public write vehicles" on vehicles for all    using (true) with check (true);
create policy "public read cells"     on cells    for select using (true);
create policy "public write cells"    on cells    for all    using (true) with check (true);
create policy "public read tags"      on tags     for select using (true);
create policy "public write tags"     on tags     for all    using (true) with check (true);
create policy "public read settings"  on settings for select using (true);
create policy "public write settings" on settings for all    using (true) with check (true);
