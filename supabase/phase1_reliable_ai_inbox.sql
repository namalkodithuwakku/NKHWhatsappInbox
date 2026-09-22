-- Phase 1: Reliable automatic inbox foundation.
-- Safe additive migration: creates new tables/columns without deleting existing data.

alter table if exists public.wa_conversations
  add column if not exists ai_mode text not null default 'auto'
    check (ai_mode in ('auto','paused','human')),
  add column if not exists ai_paused_by text,
  add column if not exists ai_paused_at timestamptz,
  add column if not exists summary text,
  add column if not exists next_action text,
  add column if not exists next_action_deadline timestamptz,
  add column if not exists attention_reason text,
  add column if not exists outcome text;

create table if not exists public.nkh_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'company'
    check (scope in ('company','sales','operations','property')),
  property_id uuid,
  title text not null,
  content text not null,
  owner text not null,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','approved','retired')),
  last_updated_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_until timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists nkh_knowledge_entries_lookup_idx
  on public.nkh_knowledge_entries (scope, approval_status, last_updated_at desc);

create index if not exists nkh_knowledge_entries_property_idx
  on public.nkh_knowledge_entries (property_id)
  where property_id is not null;

create table if not exists public.wa_ai_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  message_id uuid,
  event_type text not null
    check (event_type in ('answer','acknowledge','task_created','clarification','escalation','skipped','error')),
  decision text,
  model text,
  knowledge_entry_ids uuid[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wa_ai_events_conversation_idx
  on public.wa_ai_events (conversation_id, created_at desc);

alter table if exists public.nkh_knowledge_entries enable row level security;
alter table if exists public.wa_ai_events enable row level security;
