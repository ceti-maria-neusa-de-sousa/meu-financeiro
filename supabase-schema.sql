-- Execute este arquivo no SQL Editor do projeto Supabase.
-- Ele cria as tabelas usadas pelo Meu Financeiro e protege cada dado por usuário.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_entries_user_id_idx
  on public.finance_entries(user_id);

create table if not exists public.finance_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payments jsonb not null default '[]'::jsonb,
  categories jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_settings enable row level security;

drop policy if exists "Profiles: owner access" on public.profiles;
create policy "Profiles: owner access" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Entries: owner access" on public.finance_entries;
create policy "Entries: owner access" on public.finance_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Settings: owner access" on public.finance_settings;
create policy "Settings: owner access" on public.finance_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
