-- Apply before deploying the new API. No existing domain rows are deleted.
begin;

create table if not exists public.external_write_limits (
  actor text not null, bucket timestamptz not null, writes integer not null,
  primary key (actor, bucket)
);
alter table public.external_write_limits enable row level security;
revoke all on public.external_write_limits from public, anon, authenticated;

create table if not exists public.external_write_receipts (
  actor text not null, operation text not null, request_hash text not null,
  event_id uuid references public.events on delete cascade,
  publication_id uuid references public.publications on delete cascade,
  primary key(actor,operation,request_hash)
);
alter table public.external_write_receipts enable row level security;
revoke all on public.external_write_receipts from public, anon, authenticated;
grant select,insert,update,delete on public.external_write_limits,public.external_write_receipts to service_role;

create or replace function public.peea_identity_part(value text)
returns text language sql immutable strict set search_path = public, pg_temp as $$
  select trim(regexp_replace(lower(regexp_replace(normalize(value, NFD), U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Canonical identities share the native collector's local day for French events.
-- Organizer disambiguates otherwise identical titles/days/cities.
create or replace function public.peea_event_identity(candidate jsonb)
returns text language sql stable set search_path = public, pg_temp as $$
  select case when nullif(candidate->>'externalId', '') is not null then
    'external|' || coalesce(candidate->>'identityNamespace', '') || '|' || (candidate->>'externalId')
  else public.peea_identity_part(candidate->>'title') || '|' ||
    coalesce(to_char((candidate->>'startsAt')::timestamptz at time zone 'Europe/Paris', 'YYYY-MM-DD'), 'undated') || '|' ||
    public.peea_identity_part(coalesce(candidate->>'city', 'online')) || '|' ||
    public.peea_identity_part(coalesce(candidate->>'organizer', '')) end;
$$;

create or replace function public.peea_external_write(
  p_kind text, p_candidate jsonb, p_evidence jsonb,
  p_target_id uuid default null, p_actor text default 'internal', p_dry_run boolean default false
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_source uuid; v_item public.source_items%rowtype; v_version public.source_versions%rowtype;
  v_publication public.publications%rowtype; v_before_publication public.publications%rowtype;
  v_event public.events%rowtype; v_before public.events%rowtype;
  v_candidate jsonb := p_candidate; v_data jsonb; v_proof jsonb := p_evidence;
  v_identity text; v_legacy text; v_org uuid; v_content text; v_hash text;
  v_created boolean := false; v_changed boolean := false; v_new_version boolean := false;
  v_linked integer := 0; v_writes integer; v_result jsonb; v_detail text;
  v_request_hash text; v_receipt public.external_write_receipts%rowtype;
  v_bucket timestamptz := date_trunc('minute', now());
begin
  -- Row changes below, including the rate counter, are rolled back in a dry run.
  begin
    if p_kind not in ('event','event_patch','publication','publication_patch') then
      raise exception 'Invalid operation' using errcode = '22023';
    end if;
    if p_evidence->>'sourceUrl' is null or p_evidence->>'sourceUrl' !~ '^https?://' then
      raise exception 'Public HTTP(S) evidence required' using errcode = '22023';
    end if;
    if p_candidate ? 'verification' and p_candidate->>'verification' not in ('unverified','corroborated','contradictory') then
      raise exception 'Invalid external verification' using errcode = '22023';
    end if;
    if not p_dry_run then
      insert into public.external_write_limits(actor,bucket,writes) values (p_actor,v_bucket,1)
        on conflict (actor,bucket) do update set writes = external_write_limits.writes + 1 returning writes into v_writes;
      if v_writes > 120 then raise exception 'Write rate exceeded' using errcode = 'P0429'; end if;
      delete from public.external_write_limits where bucket < now() - interval '1 day';
    end if;

    v_request_hash := encode(sha256(convert_to(jsonb_build_object('candidate',p_candidate,'evidence',p_evidence,'target',p_target_id)::text,'UTF8')),'hex');
    perform pg_advisory_xact_lock(hashtextextended(p_actor || p_kind || v_request_hash,0));
    select * into v_receipt from public.external_write_receipts where actor = p_actor and operation = p_kind and request_hash = v_request_hash;
    if found then
      if p_dry_run then return jsonb_build_object('valid',true,'dry_run',true,'action','duplicate'); end if;
      if v_receipt.event_id is not null then
        select * into v_event from public.events where id = v_receipt.event_id;
        return jsonb_build_object('id',v_event.id,'created',false,'action','duplicate','event',to_jsonb(v_event),'publicationId',v_receipt.publication_id);
      else
        select * into v_publication from public.publications where id = v_receipt.publication_id;
        return jsonb_build_object('id',v_publication.id,'created',false,'action','duplicate','publication',to_jsonb(v_publication));
      end if;
    end if;

    if p_kind = 'event_patch' then
      select * into v_before from public.events where id = p_target_id for update;
      if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
      -- Merge under the lock, avoiding lost updates from a stale REST read.
      v_candidate := v_before.data || jsonb_build_object('title',v_before.title) || p_candidate;
      if p_candidate ? 'relevance' then v_candidate := v_candidate || jsonb_build_object('relevance',p_candidate->'relevance');
      else v_candidate := v_candidate || jsonb_build_object('relevance',v_before.relevance); end if;
    elsif p_kind in ('publication','publication_patch') then
      if p_candidate ? 'eventId' then
        perform 1 from public.events where id = (p_candidate->>'eventId')::uuid for key share;
        if not found then raise exception 'Invalid eventId' using errcode = '23503'; end if;
      end if;
      if p_kind = 'publication_patch' then
        select * into v_before_publication from public.publications where id = p_target_id for update;
        if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
        perform 1 from public.source_items where id = v_before_publication.item_id and canonical_url = p_evidence->>'sourceUrl';
        if not found then raise exception 'Publication source mismatch' using errcode = 'P0004'; end if;
      end if;
      v_proof := p_evidence || jsonb_build_object('title',p_candidate->>'title','content',p_candidate->>'content');
    end if;

    if p_kind in ('event','event_patch') then
      if nullif(v_candidate->>'startsAt','') is null or nullif(v_candidate->>'city','') is null then
        raise exception 'A verified start time and city are required' using errcode = '22023';
      end if;
      if p_kind = 'event' and (v_candidate->>'startsAt')::timestamptz <= now() then
        raise exception 'New events must be future events' using errcode = '22023';
      end if;
      if v_candidate ? 'endsAt' and (v_candidate->>'endsAt')::timestamptz < (v_candidate->>'startsAt')::timestamptz then
        raise exception 'Event ends before it starts' using errcode = '22023';
      end if;
      v_candidate := v_candidate || jsonb_build_object('identityNamespace',split_part(split_part(p_evidence->>'sourceUrl','://',2),'/',1));
      v_identity := public.peea_event_identity(v_candidate);
      -- Serialize identities even when the event row doesn't exist yet.
      perform pg_advisory_xact_lock(hashtextextended(v_identity,0));
      if p_kind = 'event' then
        select * into v_before from public.events where identity_key = v_identity for update;
        if not found and not (v_candidate ? 'externalId') then
          v_legacy := public.peea_identity_part(v_candidate->>'title') || '|' ||
            to_char((v_candidate->>'startsAt')::timestamptz at time zone 'Europe/Paris','YYYY-MM-DD') || '|' || public.peea_identity_part(v_candidate->>'city');
          select * into v_before from public.events where identity_key = v_legacy
            and public.peea_identity_part(coalesce(data->>'organizer','')) = public.peea_identity_part(coalesce(v_candidate->>'organizer','')) for update;
        end if;
      end if;
      v_created := v_before.id is null;
      -- Omitted fields in a repeat import also preserve the stored values.
      if not v_created then v_candidate := v_before.data || jsonb_build_object('title',v_before.title) || p_candidate; end if;
      v_proof := v_proof || jsonb_build_object('title',coalesce(v_proof->>'title',v_candidate->>'title'),
        'content',coalesce(nullif(v_proof->>'content',''),v_candidate->>'description',''));
    end if;

    insert into public.sources(name,kind,config,enabled,official,public_analysis,retain_content,access_method,restrictions,frequency_minutes)
      values (coalesce(p_evidence->>'sourceName','Recherche externe'),'html',jsonb_build_object('base_url',p_evidence->>'sourceUrl','connector','external'),
        true,coalesce((p_evidence->>'official')::boolean,false),true,true,'public_html','Contenu public transmis avec preuve d’origine',1440)
      on conflict (name) do update set name = excluded.name returning id into v_source;
    insert into public.source_items(source_id,native_id,canonical_url)
      values(v_source,coalesce(p_evidence->>'externalId',md5(p_evidence->>'sourceUrl')),p_evidence->>'sourceUrl')
      on conflict (canonical_url) do update set last_seen_at = now() returning * into v_item;
    -- The upsert locks the item, so version numbering is safe across API callers.
    select * into v_version from public.source_versions where item_id = v_item.id order by version desc limit 1;
    v_content := coalesce(nullif(v_proof->>'content',''),v_proof->>'title',p_evidence->>'sourceUrl');
    v_hash := md5(coalesce(v_proof->>'title','') || E'\n' || v_content || E'\n' || coalesce(v_proof->>'publishedAt',''));
    if v_version.id is null or v_version.content_hash <> v_hash then
      insert into public.source_versions(item_id,version,title,content,content_hash,published_at,access_level,rights,structured,state,attempts,processing_outcome,processing_details,processed_at)
        values(v_item.id,coalesce(v_version.version,0)+1,coalesce(v_proof->>'title','Information externe'),v_content,v_hash,
          (v_proof->>'publishedAt')::timestamptz,'metadata',jsonb_build_object('source_url',p_evidence->>'sourceUrl'),
          jsonb_build_object('external',true,'official',coalesce((p_evidence->>'official')::boolean,false)),
          'processed',1,'accepted',jsonb_build_object('connector','external'),now()) returning * into v_version;
      update public.source_items set current_version = v_version.version where id = v_item.id;
      v_new_version := true;
    end if;
    select * into v_before_publication from public.publications where item_id = v_item.id;
    insert into public.publications(item_id,platform,summary,published_at)
      values(v_item.id,coalesce(p_evidence->>'sourceName','Recherche externe'),left(coalesce(v_proof->>'content',''),1000),(v_proof->>'publishedAt')::timestamptz)
      on conflict(item_id) do update set summary = excluded.summary,
        published_at = coalesce(excluded.published_at,publications.published_at) returning * into v_publication;

    if p_kind in ('event','event_patch') then
      if nullif(v_candidate->>'organizer','') is not null then
        insert into public.organizations(name,identity_key,website)
          values(v_candidate->>'organizer',public.peea_identity_part(v_candidate->>'organizer'),v_candidate->>'organizerWebsite')
          on conflict(identity_key) do update set website = coalesce(excluded.website,organizations.website) returning id into v_org;
      end if;
      v_data := coalesce(v_before.data,'{}'::jsonb) || (v_candidate - array['title','relevance','verification','status','identityNamespace']);
      v_data := v_data || jsonb_build_object('sourceUrl',p_evidence->>'sourceUrl');
      if v_org is not null then v_data := v_data || jsonb_build_object('organizerId',v_org); end if;
      if v_created then v_data := jsonb_build_object('description','','countries','[]'::jsonb,'country','France','category','Économie & diaspora') || v_data; end if;
      v_changed := v_created or v_before.title is distinct from v_candidate->>'title' or v_before.data is distinct from v_data
        or (p_candidate ? 'verification' and v_before.verification is distinct from p_candidate->>'verification')
        or (p_candidate ? 'status' and v_before.status is distinct from p_candidate->>'status')
        or (p_candidate ? 'relevance' and v_before.relevance is distinct from (p_candidate->>'relevance')::integer);
      if v_created then
        insert into public.events(identity_key,title,data,relevance,verification,status,is_demo,last_verified_at)
          values(v_identity,v_candidate->>'title',v_data,coalesce((v_candidate->>'relevance')::integer,0),
            coalesce(p_candidate->>'verification','unverified'),coalesce(p_candidate->>'status','scheduled'),false,now()) returning * into v_event;
      elsif v_changed then
        update public.events set title = v_candidate->>'title', data = v_data,
          relevance = coalesce((p_candidate->>'relevance')::integer,v_before.relevance),
          verification = coalesce(p_candidate->>'verification',v_before.verification), status = coalesce(p_candidate->>'status',v_before.status),
          -- Preserve existing external identities; use the changed semantic key for semantic records.
          identity_key = case when v_before.identity_key like 'external|%' then v_before.identity_key else v_identity end,
          last_verified_at = now(), updated_at = now() where id = v_before.id returning * into v_event;
        insert into public.event_changes(event_id,version_id,kind,before_data,after_data)
          values(v_event.id,v_version.id,'external_enrichment',to_jsonb(v_before),to_jsonb(v_event));
      else v_event := v_before;
      end if;
      insert into public.event_mentions(event_id,publication_id,version_id) values(v_event.id,v_publication.id,v_version.id) on conflict do nothing;
      get diagnostics v_linked = row_count;
      v_result := jsonb_build_object('id',v_event.id,'created',v_created,'action',case when v_created then 'created' when v_changed or v_new_version or v_linked > 0 then 'updated' else 'duplicate' end,
        'event',to_jsonb(v_event),'publicationId',v_publication.id,'versionId',v_version.id);
    else
      if p_candidate ? 'eventId' then
        insert into public.event_mentions(event_id,publication_id,version_id) values((p_candidate->>'eventId')::uuid,v_publication.id,v_version.id) on conflict do nothing;
        get diagnostics v_linked = row_count;
      end if;
      v_changed := v_before_publication.id is null or v_before_publication.summary is distinct from v_publication.summary or v_new_version or v_linked > 0;
      v_result := jsonb_build_object('id',v_publication.id,'created',v_before_publication.id is null,
        'action',case when v_before_publication.id is null then 'created' when v_changed then 'updated' else 'duplicate' end,
        'publication',to_jsonb(v_publication),'versionId',v_version.id);
    end if;
    -- Audit is part of the transaction: if it fails, nothing is committed.
    if v_result->>'action' <> 'duplicate' then
      insert into public.audit_logs(action,entity_id,details) values('external.' || p_kind || '.' || (v_result->>'action'),v_result->>'id',
        jsonb_build_object('source_url',p_evidence->>'sourceUrl','version_id',v_version.id,'actor',p_actor));
    end if;
    insert into public.external_write_receipts(actor,operation,request_hash,event_id,publication_id)
      values(p_actor,p_kind,v_request_hash,v_event.id,v_publication.id);
    if p_dry_run then raise exception 'Dry run rollback' using errcode = 'P0003', detail = v_result::text; end if;
    return v_result;
  exception when sqlstate 'P0003' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return (v_detail::jsonb - array['id','event','publication','publicationId','versionId']) || jsonb_build_object('valid',true,'dry_run',true);
  end;
end;
$$;
revoke all on function public.peea_external_write(text,jsonb,jsonb,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.peea_external_write(text,jsonb,jsonb,uuid,text,boolean) to service_role;
-- Helpers cannot write and must remain callable by the invoker.
notify pgrst, 'reload schema';
commit;
