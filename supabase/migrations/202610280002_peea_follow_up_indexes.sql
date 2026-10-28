create index if not exists peea_participations_event_idx
  on public.peea_event_participations(event_id);

create index if not exists peea_actions_contact_idx
  on public.peea_follow_up_actions(contact_id);
