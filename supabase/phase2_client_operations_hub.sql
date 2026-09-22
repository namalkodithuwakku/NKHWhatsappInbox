-- Phase 2: Client Operations Hub
-- Additive migration. Apply after phase1_reliable_ai_inbox.sql.

create table if not exists public.wa_client_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  contact_id uuid,
  property_id uuid,
  source_message_id uuid,
  dashboard_task_id text,
  request_type text not null default 'Other',
  subject text not null,
  status text not null default 'Open'
    check (status in ('Open','In progress','Waiting','Completed','Cancelled')),
  priority text not null default 'Normal'
    check (priority in ('Normal','High','Urgent')),
  assigned_to text,
  due_at timestamptz,
  completion_note text,
  completed_at timestamptz,
  client_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_client_requests_conversation_idx
  on public.wa_client_requests (conversation_id, status, created_at desc);
create index if not exists wa_client_requests_property_idx
  on public.wa_client_requests (property_id, status, created_at desc);
create unique index if not exists wa_client_requests_source_message_uidx
  on public.wa_client_requests (source_message_id)
  where source_message_id is not null;

alter table if exists public.wa_client_requests enable row level security;

-- Optional tracking fields used by the AI workflow. Safe if already present.
alter table if exists public.wa_messages
  add column if not exists ai_reply_status text,
  add column if not exists ai_reply_message_id text,
  add column if not exists ai_reply_error text,
  add column if not exists ai_task_status text,
  add column if not exists ai_task_id text,
  add column if not exists ai_task_reason text,
  add column if not exists ai_task_payload jsonb;
