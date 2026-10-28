create table if not exists public.peea_event_participations (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  event_id uuid references public.events(id) on delete set null,
  event_name text not null,
  occurred_on date,
  ends_on date,
  time_text text,
  venue text,
  source_url text,
  representatives text[] not null default '{}',
  appointment_status text not null default 'unknown'
    check (appointment_status in ('validated', 'not_validated', 'in_progress', 'unknown')),
  attended boolean,
  comments text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.peea_relationship_contacts (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  participation_id uuid references public.peea_event_participations(id) on delete set null,
  full_name text not null,
  met_at text,
  organization_or_role text,
  phones text[] not null default '{}',
  email text,
  peea_referrers text[] not null default '{}',
  notes text,
  linkedin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.peea_follow_up_actions (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  contact_id uuid references public.peea_relationship_contacts(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'done', 'cancelled')),
  owners text[] not null default '{}',
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists peea_participations_date_idx
  on public.peea_event_participations(occurred_on desc nulls last);
create index if not exists peea_contacts_participation_idx
  on public.peea_relationship_contacts(participation_id);
create index if not exists peea_actions_status_due_idx
  on public.peea_follow_up_actions(status, due_date nulls last);

alter table public.peea_event_participations enable row level security;
alter table public.peea_relationship_contacts enable row level security;
alter table public.peea_follow_up_actions enable row level security;

revoke all on public.peea_event_participations from public, anon, authenticated;
revoke all on public.peea_relationship_contacts from public, anon, authenticated;
revoke all on public.peea_follow_up_actions from public, anon, authenticated;
