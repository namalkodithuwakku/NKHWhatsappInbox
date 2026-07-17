-- Run once in Supabase SQL Editor. This does not change or delete existing data.
create table if not exists public.inbox_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null check (actor_role in ('ADMIN', 'TEAM')),
  action text not null,
  entity_type text not null check (entity_type in ('conversation', 'property')),
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inbox_audit_logs_created_at_idx
  on public.inbox_audit_logs (created_at desc);

alter table public.inbox_audit_logs enable row level security;
