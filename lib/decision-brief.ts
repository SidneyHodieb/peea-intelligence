import type { EventRecord } from './types';
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function eventOpportunity(event: EventRecord) {
  const text = normalize(`${event.title} ${event.description} ${event.organizer}`);
  const diaspora = /diaspor/.test(text);
  const investment = /invest|financ|bancabil|capitaux|capital|bailleurs/.test(text);
  const africa = /afri|cameroun|senegal|benin|comor|mauritani|congo|ivoir/.test(text);
  const business = /b2b|entrepren|affaires|econom|partenari|entreprise/.test(text);
  const tier = diaspora && investment ? 3 : africa && (investment || business) ? 2 : diaspora && business ? 1 : 0;
  const reason = tier === 3 ? 'Diaspora et financement réunis dans l’annonce : un point d’entrée pour les partenariats économiques du PEEA.' : tier === 2 ? 'Échanges économiques liés à l’Afrique : une piste pour développer le réseau de partenaires du PEEA.' : tier === 1 ? 'Entrepreneuriat diasporique : une piste pour rencontrer des porteurs de projets.' : 'Lien avec les objectifs du PEEA à préciser avant de mobiliser une délégation.';
  return { tier, reason };
}
export function decisionBrief(events: EventRecord[], now: number) {
  const upcoming = events.filter(e => Number.isFinite(Date.parse(e.date)) && Date.parse(e.date) > now);
  const eligible = upcoming.filter(e => e.verification !== 'Contradictoire');
  const ranked = [...eligible].sort((a,b) => eventOpportunity(b).tier - eventOpportunity(a).tier || b.score-a.score || Date.parse(a.date)-Date.parse(b.date) || a.id.localeCompare(b.id));
  const days = (e: EventRecord) => Math.ceil((Date.parse(e.date)-now)/86400000);
  const urgent = [...eligible].filter(e => days(e)<=14 && eventOpportunity(e).tier>0).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  return { upcoming, ranked, urgent, within30: upcoming.filter(e=>days(e)<=30), core: eligible.filter(e=>eventOpportunity(e).tier===3), uncertain: upcoming.filter(e=>e.verification==='À vérifier'||e.verification==='Contradictoire') };
}
