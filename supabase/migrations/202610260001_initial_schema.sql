create extension if not exists pgcrypto;

create table if not exists sources (
  id uuid primary key default gen_random_uuid(), name text not null unique, kind text not null default 'html',
  config jsonb not null default '{}', enabled boolean not null default false, official boolean not null default false,
  public_analysis boolean not null default false, retain_content boolean not null default false,
  access_method text not null default 'public_html', restrictions text not null default '', frequency_minutes integer not null default 60,
  last_success timestamptz, last_error text, discovered integer not null default 0, next_run timestamptz not null default now(),
  cursor jsonb, created_at timestamptz not null default now(), check (kind in ('html','rss','api','search'))
);

create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(), source_id uuid references sources on delete cascade,
  query text not null, language text not null default 'fr'
);

create table if not exists source_items (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references sources on delete cascade,
  native_id text not null, canonical_url text not null unique, current_version integer not null default 1,
  discovered_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), unique(source_id,native_id)
);

create table if not exists source_versions (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references source_items on delete cascade,
  version integer not null, title text not null, content text not null, content_hash text not null,
  published_at timestamptz, collected_at timestamptz not null default now(), access_level text not null default 'metadata',
  rights jsonb not null default '{}', structured jsonb not null default '{}', state text not null default 'pending',
  attempts integer not null default 0, processing_outcome text, processing_details jsonb not null default '{}',
  processed_at timestamptz, author_name text, unique(item_id,version), check (access_level in ('metadata','full'))
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(), name text not null, identity_key text not null unique, website text
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(), name text not null, identity_key text not null unique, profile_url text
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(), identity_key text not null unique, title text not null, data jsonb not null default '{}',
  relevance integer not null default 0 check (relevance between 0 and 100), verification text not null default 'unverified',
  status text not null default 'scheduled', is_demo boolean not null default false, last_verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), merged_into uuid references events
);
create index if not exists events_live_idx on events(status, is_demo, relevance desc);

create table if not exists publications (
  id uuid primary key default gen_random_uuid(), item_id uuid not null unique references source_items on delete cascade,
  author_id uuid references people, platform text not null, summary text, published_at timestamptz
);

create table if not exists event_mentions (
  event_id uuid references events on delete cascade, publication_id uuid references publications on delete cascade,
  version_id uuid references source_versions on delete cascade, primary key(event_id,publication_id,version_id)
);

create table if not exists event_participants (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references events on delete cascade,
  person_id uuid references people, organization_id uuid references organizations, role text not null,
  version_id uuid references source_versions, evidence jsonb not null default '{}', identity_key text not null unique
);

create table if not exists partnership_opportunities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations,
  event_id uuid not null references events, evidence text not null, suggestion text not null,
  status text not null default 'identified', notes text not null default '', updated_at timestamptz not null default now(),
  unique(organization_id,event_id)
);

create table if not exists event_changes (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references events on delete cascade,
  version_id uuid references source_versions, kind text not null, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(), unique_key text not null unique, kind text not null,
  body jsonb not null default '{}', state text not null default 'pending', attempts integer not null default 0,
  next_attempt timestamptz, sent_at timestamptz, error text, created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key, action text not null, entity_id text,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);

alter table sources enable row level security;
alter table source_items enable row level security;
alter table source_versions enable row level security;
alter table events enable row level security;
alter table publications enable row level security;
alter table organizations enable row level security;
alter table partnership_opportunities enable row level security;

-- Les routes Next.js utilisent exclusivement la clé secrète serveur, qui contourne la RLS.
-- Aucune clé secrète ne doit être exposée au navigateur.
