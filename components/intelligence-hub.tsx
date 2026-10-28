"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, Building2, CalendarDays, ChevronDown, ChevronRight, Clock3,
  CheckCircle2, DatabaseZap, ExternalLink, FileSearch, Filter, Gauge, LayoutDashboard, ListTodo, MapPin, Menu,
  Network, Plus, Radar, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, TrendingUp,
  UsersRound, X,
} from "lucide-react";
import type { EventRecord, OrganizationRecord, PeeaActionStatus, PeeaFollowUpData, PublicationRecord, VerificationStatus } from "@/lib/types";
import { PeeaFollowUpView } from "@/components/peea-follow-up-view";

import { decisionBrief, eventOpportunity } from "@/lib/decision-brief";

type View = "Dashboard" | "Agenda" | "Intelligence" | "Suivi PEEA" | "Partenariats" | "Sources" | "Notifications" | "Administration";
type CollectionHealth = { connectors?: Record<string, string>; catalog?: { sources: number; rss: number }; last_success?: string | null; storage?: { events: number; publications: number; organizations: number } };
const nav: { label: View; icon: typeof Radar }[] = [
  { label: "Dashboard", icon: LayoutDashboard }, { label: "Agenda", icon: CalendarDays },
  { label: "Intelligence", icon: FileSearch }, { label: "Suivi PEEA", icon: ListTodo },
  { label: "Partenariats", icon: Network },
  { label: "Sources", icon: DatabaseZap }, { label: "Notifications", icon: Bell },
  { label: "Administration", icon: Settings2 },
];

const statusStyle: Record<VerificationStatus, string> = {
  "Source officielle": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Corroboré": "bg-green-50 text-green-800 border-green-200",
  "À vérifier": "bg-amber-50 text-amber-800 border-amber-200",
  "Contradictoire": "bg-rose-50 text-rose-800 border-rose-200",
};

function Logo() {
  return <div className="flex items-center gap-3"><div className="relative grid h-11 w-11 place-items-center rounded-full border border-amber-300/35 bg-amber-400/10"><Radar className="h-6 w-6 text-amber-400"/><span className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-[#251a0c]"/></div><div><div className="font-display text-xl font-bold tracking-tight text-white">PEEA</div><div className="text-[9px] font-bold uppercase tracking-[.24em] text-amber-300/80">Intelligence Hub</div></div></div>;
}

function Badge({ children, tone = "amber" }: { children: React.ReactNode; tone?: "amber" | "green" | "gray" }) {
  const cls = tone === "green" ? "border-green-200 bg-green-50 text-green-800" : tone === "gray" ? "border-stone-200 bg-stone-50 text-stone-600" : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${cls}`}>{children}</span>;
}

function Sidebar({ view, setView, health }: { view: View; setView: (view: View) => void; health: CollectionHealth | null }) {
  const connectorStates = Object.values(health?.connectors ?? {});
  const readyCount = connectorStates.filter(state => state === "configured" || state === "ready").length;
  const operational = connectorStates.length > 0 && readyCount === connectorStates.length;
  return <aside className="sidebar desktop-sidebar fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-amber-300/10 p-5 text-white">
    <Logo /><div className="my-6 h-px bg-gradient-to-r from-amber-400/45 to-transparent" />
    <nav className="space-y-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setView(label)} className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${view === label ? "bg-amber-400 text-[#2b1e08] shadow-lg shadow-amber-900/20" : "text-stone-300 hover:bg-white/7 hover:text-white"}`}><Icon className="h-[18px] w-[18px]"/><span>{label}</span></button>)}</nav>
    <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><div className={`mb-2 flex items-center gap-2 text-xs font-bold ${operational?"text-green-300":"text-amber-300"}`}><span className={`h-2 w-2 rounded-full ${operational?"bg-green-400 animate-pulse":"bg-amber-400"}`}/>{operational?"Système opérationnel":"Vérification en cours"}</div><p className="text-[11px] leading-5 text-stone-400">Dernière collecte réussie<br/><span className="font-semibold text-stone-200">{health?.last_success?new Date(health.last_success).toLocaleString("fr-FR") : "En attente"}</span></p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-amber-400" style={{width:`${connectorStates.length?Math.round(readyCount/connectorStates.length*100):0}%`}}/></div><p className="mt-1.5 text-[9px] uppercase tracking-wider text-stone-500">{readyCount} connecteurs sur {connectorStates.length||5}</p></div>
  </aside>;
}

function Topbar({ view, onMenu, query, setQuery }: { view: View; onMenu: () => void; query: string; setQuery: (v: string) => void }) {
  return <header className="sticky top-0 z-20 flex h-[76px] items-center gap-4 border-b border-stone-200/80 bg-[#faf8f2]/90 px-5 backdrop-blur-xl lg:px-8">
    <button onClick={onMenu} className="rounded-lg border border-stone-200 bg-white p-2 lg:hidden" aria-label="Menu"><Menu className="h-5 w-5"/></button>
    <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-amber-700">Observatoire Afrique–Diaspora</p><h1 className="truncate font-display text-xl font-bold text-[#332108]">{view}</h1></div>
    <div className="ml-auto hidden w-full max-w-md items-center rounded-xl border border-stone-200 bg-white px-3 shadow-sm sm:flex"><Search className="h-4 w-4 text-stone-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un événement, une organisation…" className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-stone-400"/><kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">⌘K</kbd></div>
    <button className="relative rounded-xl border border-stone-200 bg-white p-2.5 text-stone-600 shadow-sm"><Bell className="h-4 w-4"/></button>
    <div className="hidden items-center gap-2 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#2b1e0c] text-xs font-bold text-amber-300">PE</div><div className="text-xs"><p className="font-bold text-stone-800">Équipe PEEA</p><p className="text-stone-500">Administrateur</p></div><ChevronDown className="h-4 w-4 text-stone-400"/></div>
  </header>;
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Radar; label: string; value: string; detail: string; tone: string }) {
  return <div className="card rounded-2xl p-4"><div className="flex items-start justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5"/></div><span className="flex items-center gap-1 text-[10px] font-bold text-green-700"><TrendingUp className="h-3 w-3"/>actif</span></div><p className="mt-5 text-3xl font-extrabold tracking-tight text-[#302009]">{value}</p><p className="text-xs font-bold text-stone-700">{label}</p><p className="mt-1 text-[10px] text-stone-500">{detail}</p></div>;
}

function Status({ value }: { value: VerificationStatus }) { return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${statusStyle[value]}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{value}</span>; }

function Score({ value }: { value: number }) {
  const color = value >= 80 ? "text-green-700" : value >= 60 ? "text-amber-700" : "text-stone-600";
  return <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${value >= 80 ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${value}%` }}/></div><span className={`text-xs font-extrabold ${color}`}>{value}</span></div>;
}

function EventRow({ event, onOpen }: { event: EventRecord; onOpen: () => void }) {
  const d = new Date(event.date);
  return <button onClick={onOpen} className="grid w-full grid-cols-[58px_1fr_auto] items-center gap-4 border-b border-stone-100 px-4 py-4 text-left transition last:border-0 hover:bg-amber-50/40 md:grid-cols-[58px_minmax(220px,1.6fr)_minmax(120px,.8fr)_110px_130px_24px]">
    <div className="rounded-xl border border-amber-200 bg-amber-50 py-2 text-center"><p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700">{d.toLocaleDateString("fr-FR", { month: "short", timeZone: "Europe/Paris" })}</p><p className="text-xl font-black text-[#3a2608]">{d.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" })}</p></div>
    <div className="min-w-0"><p className="truncate text-sm font-extrabold text-stone-900">{event.title}</p><p className="mt-1 flex items-center gap-1 truncate text-[11px] text-stone-500"><Building2 className="h-3 w-3"/>{event.organizer}</p></div>
    <div className="hidden md:block"><p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700"><MapPin className="h-3.5 w-3.5 text-amber-600"/>{event.city}</p><p className="mt-1 text-[10px] text-stone-400">{event.region}</p></div>
    <div className="hidden md:block"><Score value={event.score}/></div>
    <div className="hidden md:block"><Status value={event.verification}/></div>
    <ChevronRight className="h-4 w-4 text-stone-300"/>
  </button>;
}

function Dashboard({ query, openEvent, go, events, publications, organizations, health, followUp }: { query: string; openEvent: (e: EventRecord) => void; go: (v: View) => void; events: EventRecord[]; publications: PublicationRecord[]; organizations: OrganizationRecord[]; health: CollectionHealth | null; followUp: PeeaFollowUpData }) {
  const recommendations = decisionBrief(events, Date.now()).ranked
    .filter(event => eventOpportunity(event).tier > 0)
    .filter(event => `${event.title} ${event.description} ${event.organizer} ${event.city}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3);
  const priorityCount = events.filter(event => event.score >= 80).length;
  const updatedToday = events.filter(event => new Date(event.updatedAt).toDateString() === new Date().toDateString()).length;
  const openActions = followUp.actions.filter(action => action.status === "waiting" || action.status === "in_progress");
  const unassigned = openActions.filter(action => action.owners.length === 0);
  const contradictions = openActions.filter(action => /date à confirmer|contradic/i.test(action.comments ?? ""));
  const nextDue = [...openActions].filter(action => action.dueDate).sort((a,b)=>(a.dueDate??"").localeCompare(b.dueDate??""))[0];
  const awaitingDecision = followUp.participations.filter(item => item.appointmentStatus === "in_progress" || item.appointmentStatus === "unknown");
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-[#2c1d09] p-6 text-white shadow-xl shadow-amber-950/10 soft-grid lg:p-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl"/><div className="relative max-w-2xl"><Badge>Brief du {new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</Badge><h2 className="mt-4 font-display text-3xl font-bold leading-tight lg:text-4xl">Votre radar Afrique & Diaspora est à jour.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">{updatedToday} signaux ont été actualisés aujourd’hui. {priorityCount} événement{priorityCount>1?"s":""} atteignent le seuil de priorité élevée.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => go("Agenda")} className="rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-[#2a1b07] transition hover:bg-amber-300">Voir les priorités</button><button onClick={() => go("Intelligence")} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10">Lire le brief quotidien</button></div></div><div className="absolute bottom-6 right-7 hidden items-end gap-1 lg:flex">{[28,48,34,70,52,84,62,92,74,100].map((h,i)=><span key={i} className="w-2 rounded-full bg-amber-400/50" style={{height:h/2}}/>)}</div></section>
    <section className="card overflow-hidden rounded-2xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-amber-700">Insights du suivi PEEA</p><h3 className="mt-1 font-display text-xl font-bold">Ce qui demande une décision</h3></div><button onClick={()=>go("Suivi PEEA")} className="rounded-xl bg-[#302009] px-4 py-2.5 text-xs font-bold text-white">Ouvrir le suivi →</button></div><div className="grid md:grid-cols-2">
      <div className="border-b border-stone-100 p-5 md:border-r"><p className="text-2xl font-black text-[#302009]">{unassigned.length}</p><p className="mt-1 text-xs font-bold text-stone-700">action{unassigned.length>1?"s":""} sans responsable</p><p className="mt-2 text-xs leading-5 text-stone-500">{unassigned.length ? unassigned.slice(0,2).map(action=>action.contactName??action.title).join(" · ") : "Toutes les actions ouvertes sont attribuées."}</p></div>
      <div className="border-b border-stone-100 p-5"><p className="text-2xl font-black text-[#302009]">{awaitingDecision.length}</p><p className="mt-1 text-xs font-bold text-stone-700">participation{awaitingDecision.length>1?"s":""} à décider</p><p className="mt-2 text-xs leading-5 text-stone-500">{awaitingDecision.length ? awaitingDecision.slice(0,2).map(item=>item.eventName).join(" · ") : "Aucune validation en attente."}</p></div>
      <div className="border-b border-stone-100 p-5 md:border-b-0 md:border-r"><p className="text-2xl font-black text-[#302009]">{contradictions.length}</p><p className="mt-1 text-xs font-bold text-stone-700">information contradictoire</p><p className="mt-2 text-xs leading-5 text-stone-500">{contradictions.length ? "La date liée à Chris NDILOU doit être confirmée avant la relance." : "Aucune contradiction ouverte dans le suivi."}</p></div>
      <div className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Prochaine échéance</p><p className="mt-2 text-sm font-bold text-stone-800">{nextDue ? nextDue.title : "Aucune échéance renseignée"}</p><p className="mt-1 text-xs text-stone-500">{nextDue?.dueDate ? new Date(`${nextDue.dueDate}T12:00:00+01:00`).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : "À planifier"}</p></div>
    </div></section>
    <div><section id="peea-selection" className="min-w-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-display text-xl font-bold">La sélection à examiner</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">Lecture indicative des annonces : diaspora + investissement d’abord, puis lien économique avec l’Afrique, score de pertinence et date. La décision de participation appartient au PEEA.</p></div><button onClick={() => go("Agenda")} className="shrink-0 rounded-xl bg-amber-400 px-4 py-3 text-xs font-extrabold text-[#2a1b07] hover:bg-amber-300">Voir tous les événements →</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">{recommendations.map((event,i)=><article key={event.id} className="card flex flex-col rounded-2xl border-t-4 border-t-amber-400 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{eventOpportunity(event).tier===3?"Cœur de cible":"Réseau & partenariats"}</Badge><span className="text-xs font-bold text-stone-400">0{i+1}</span></div><h4 className="mt-4 text-base font-bold leading-snug">{event.title}</h4><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-stone-600"><CalendarDays className="h-4 w-4 shrink-0"/>{new Date(event.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Paris"})} · {event.city||"Ville à confirmer"}</p><p className="mt-2 text-xs text-stone-500">{event.organizer||"Organisateur à confirmer"}</p><div className="mt-4 rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pourquoi l’examiner</p><p className="mt-2 text-xs leading-5 text-stone-700">{eventOpportunity(event).reason}</p></div><button onClick={()=>openEvent(event)} className="mt-4 self-start rounded-lg bg-[#2c1d09] px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-900">Examiner la fiche et les sources →</button></article>)}</div>{!recommendations.length&&<div className="card rounded-2xl p-8 text-sm text-stone-500">Aucun rendez-vous correspondant à cette sélection. Consultez l’agenda ou élargissez votre recherche.</div>}<div className="mt-4 flex justify-center"><button onClick={() => go("Agenda")} className="rounded-xl bg-amber-400 px-4 py-3 text-xs font-extrabold text-[#2a1b07] hover:bg-amber-300">Voir tous les événements →</button></div></section></div>
  </div>;
}

function AgendaView({ query, openEvent, events }: { query: string; openEvent: (e: EventRecord) => void; events: EventRecord[] }) {
  const [city,setCity] = useState("Toutes"); const [verification,setVerification] = useState("Tous");
  const filtered = events
    .filter(e => (city === "Toutes" || e.city === city) && (verification === "Tous" || e.verification === verification) && `${e.title} ${e.organizer} ${e.city}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => eventOpportunity(b).tier - eventOpportunity(a).tier || Date.parse(a.date) - Date.parse(b.date) || b.score - a.score);
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><Badge tone="green">{filtered.length} résultats</Badge><h2 className="mt-2 font-display text-3xl font-bold">Agenda stratégique</h2><p className="mt-1 text-sm text-stone-500">Chaque rendez-vous est présenté comme une piste à examiner, en privilégiant les liens diaspora, investissement et partenariats.</p></div><div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-bold text-green-800"><DatabaseZap className="h-4 w-4"/>Données actualisées</div></div><div className="card flex flex-wrap items-center gap-3 rounded-2xl p-3"><div className="flex items-center gap-2 px-2 text-xs font-bold text-stone-600"><Filter className="h-4 w-4"/>Filtres</div><select value={city} onChange={e=>setCity(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs outline-none"><option>Toutes</option>{[...new Set(events.map(e=>e.city))].map(c=><option key={c}>{c}</option>)}</select><select value={verification} onChange={e=>setVerification(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs outline-none"><option>Tous</option><option>Source officielle</option><option>Corroboré</option><option>À vérifier</option><option>Contradictoire</option></select><button onClick={()=>{setCity("Toutes");setVerification("Tous")}} className="ml-auto flex items-center gap-1 text-[11px] font-bold text-stone-500"><RefreshCw className="h-3 w-3"/>Réinitialiser</button></div><section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.length ? filtered.map((event,index)=>{const opportunity=eventOpportunity(event); return <article key={event.id} className="card flex flex-col rounded-2xl border-t-4 border-t-amber-400 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{opportunity.tier===3?"Cœur de cible":opportunity.tier>0?"Réseau & partenariats":"À qualifier"}</Badge><span className="text-xs font-bold text-stone-400">{String(index+1).padStart(2,"0")}</span></div><h3 className="mt-4 text-lg font-bold leading-snug text-stone-900">{event.title}</h3><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-stone-600"><CalendarDays className="h-4 w-4 shrink-0"/>{new Date(event.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Paris"})} · {event.city||"Ville à confirmer"}</p><p className="mt-2 text-xs text-stone-500">{event.organizer||"Organisateur à confirmer"}</p><div className="mt-4 rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pourquoi l’examiner</p><p className="mt-2 text-xs leading-5 text-stone-700">{opportunity.reason}</p></div><button onClick={()=>openEvent(event)} className="mt-4 self-start rounded-lg bg-[#2c1d09] px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-900">Examiner la fiche et les sources →</button></article>}) : <div className="card col-span-full p-12 text-center"><Search className="mx-auto h-8 w-8 text-stone-300"/><p className="mt-3 font-bold">Aucun événement ne correspond aux filtres</p><p className="text-xs text-stone-500">Élargissez votre recherche ou réinitialisez les filtres.</p></div>}</section></div>;
}

function IntelligenceView({ query, publications }: { query: string; publications: PublicationRecord[] }) {
  const list = publications.filter(p=>`${p.title} ${p.author} ${p.organization}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="grid gap-6 xl:grid-cols-[1.5fr_.75fr]"><section><div><Badge>Flux qualifié</Badge><h2 className="mt-2 font-display text-3xl font-bold">Qui publie quoi ?</h2><p className="mt-1 text-sm text-stone-500">Publications, auteurs et événements reliés avec leurs preuves.</p></div><div className="mt-5 space-y-3">{list.map((p,i)=><article key={p.id} className="card rounded-2xl p-5"><div className="flex items-start gap-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${i===0?"bg-blue-100 text-blue-700":i===1?"bg-green-100 text-green-700":"bg-amber-100 text-amber-700"}`}><FileSearch className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone="gray">{p.source}</Badge><Status value={p.quality}/><span className="ml-auto text-[10px] text-stone-400">{p.publishedAt ? new Date(p.publishedAt).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}) : "Date de publication inconnue"}</span></div><h3 className="mt-3 font-bold text-stone-900">{p.title}</h3><p className="mt-2 text-xs leading-5 text-stone-600">{p.excerpt}</p><div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-stone-500"><span className="flex items-center gap-1"><UsersRound className="h-3 w-3"/>{p.author}</span><span className="flex items-center gap-1"><Building2 className="h-3 w-3"/>{p.organization}</span>{p.sourceUrl&&<a href={p.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 font-bold text-amber-700">Source originale <ExternalLink className="h-3 w-3"/></a>}</div></div></div></article>)}</div></section><aside className="space-y-4"><div className="card rounded-2xl p-5"><h3 className="font-display text-lg font-bold">Signaux collectés</h3><div className="mt-4 space-y-4">{[[String(publications.length),"Publications enregistrées"],[String(publications.filter(p=>p.quality==="Source officielle").length),"Sources officielles"],[String(new Set(publications.map(p=>p.source)).size),"Canaux distincts"]].map(([n,l])=><div key={l} className="flex items-center"><span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-sm font-black text-amber-700">{n}</span><span className="ml-3 text-xs font-semibold text-stone-600">{l}</span></div>)}</div></div><div className="rounded-2xl border border-green-200 bg-green-50 p-5"><ShieldCheck className="h-6 w-6 text-green-700"/><h3 className="mt-3 font-bold text-green-950">Traçabilité préservée</h3><p className="mt-2 text-xs leading-5 text-green-800">Chaque information conserve sa source, sa date de découverte et son niveau de vérification.</p></div></aside></div>;
}

function PartnershipsView({ organizations }: { organizations: OrganizationRecord[] }) {
  const stages = ["Découvert","À qualifier","Qualifié","À contacter"] as const;
  return <div><Badge tone="green">CRM d’opportunités</Badge><h2 className="mt-2 font-display text-3xl font-bold">Pipeline partenariats</h2><p className="mt-1 text-sm text-stone-500">Suggestions issues d’indices explicites — toute prise de contact reste humaine.</p><div className="mt-6 grid gap-4 xl:grid-cols-4">{stages.map(stage=><section key={stage} className="rounded-2xl bg-stone-100/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><h3 className="text-xs font-extrabold text-stone-700">{stage}</h3><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500">{organizations.filter(o=>o.stage===stage).length}</span></div><div className="space-y-3">{organizations.filter(o=>o.stage===stage).map(o=><article key={o.id} className="card rounded-xl p-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#302009] text-[10px] font-bold text-amber-300">{o.initials}</div><div className="min-w-0"><p className="truncate text-xs font-extrabold">{o.name}</p><p className="text-[10px] text-stone-500">{o.sector}</p></div></div><div className="my-3 h-px bg-stone-100"/><p className="text-[10px] font-semibold text-stone-500">Rôle observé</p><p className="mt-0.5 text-xs text-stone-700">{o.role}</p><div className="mt-3 flex items-center justify-between"><Badge>{o.score}/100</Badge><span className="text-[10px] text-stone-400">{o.eventCount} événement{o.eventCount>1?"s":""}</span></div></article>)}</div></section>)}</div></div>;
}

const actionStatusLabel: Record<PeeaActionStatus, string> = {
  waiting: "En attente",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée",
};

function FollowUpView({ query, data }: { query: string; data: PeeaFollowUpData }) {
  const needle = query.trim().toLowerCase();
  const participations = data.participations.filter(item => `${item.eventName} ${item.venue ?? ""} ${item.representatives.join(" ")}`.toLowerCase().includes(needle));
  const contacts = data.contacts.filter(item => `${item.fullName} ${item.metAt ?? ""} ${item.organizationOrRole ?? ""} ${item.peeaReferrers.join(" ")}`.toLowerCase().includes(needle));
  const actions = data.actions.filter(item => `${item.title} ${item.contactName ?? ""} ${item.owners.join(" ")}`.toLowerCase().includes(needle));
  const openActions = data.actions.filter(item => item.status === "waiting" || item.status === "in_progress").length;
  const attended = data.participations.filter(item => item.attended === true).length;

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Badge tone="green">Pilotage opérationnel</Badge><h2 className="mt-2 font-display text-3xl font-bold">Des événements aux partenariats</h2><p className="mt-1 max-w-3xl text-sm text-stone-500">Suivez la participation du PEEA, les relations créées sur place et chaque action jusqu’à sa réalisation.</p></div>
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-bold text-green-800">Données du registre PEEA intégrées</div>
    </div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[[CalendarDays,String(data.participations.length),"Événements suivis","bg-amber-100 text-amber-800"],[CheckCircle2,String(attended),"Présences effectives","bg-green-100 text-green-800"],[UsersRound,String(data.contacts.length),"Relations enregistrées","bg-blue-100 text-blue-800"],[ListTodo,String(openActions),"Actions ouvertes","bg-rose-100 text-rose-800"]].map(([Icon,value,label,tone])=>{const I=Icon as typeof CalendarDays;return <article key={label as string} className="card rounded-2xl p-5"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><I className="h-5 w-5"/></div><p className="mt-4 text-3xl font-black text-[#302009]">{value as string}</p><p className="text-xs font-bold text-stone-600">{label as string}</p></article>})}
    </section>

    <section>
      <div className="mb-4"><h3 className="font-display text-xl font-bold">Participations du PEEA</h3><p className="mt-1 text-xs text-stone-500">Qui devait assister, validation du rendez-vous et retour de terrain.</p></div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{participations.map(item => {
        const appointment = item.appointmentStatus === "validated" ? "Rendez-vous validé" : item.appointmentStatus === "not_validated" ? "Non validé" : item.appointmentStatus === "in_progress" ? "Validation en cours" : "Validation non renseignée";
        return <article key={item.id} className="card rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">{item.occurredOn ? new Date(`${item.occurredOn}T12:00:00+01:00`).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : item.timeText ?? "Date non renseignée"}</p><h4 className="mt-1 font-bold leading-snug">{item.eventName}</h4></div><Badge tone={item.appointmentStatus === "validated" ? "green" : "gray"}>{appointment}</Badge></div>{item.occurredOn&&item.timeText&&<p className="mt-3 flex items-center gap-2 text-xs text-stone-600"><Clock3 className="h-4 w-4 text-amber-700"/>{item.timeText}</p>}{item.venue&&<p className="mt-2 flex items-start gap-2 text-xs leading-5 text-stone-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>{item.venue}</p>}<div className="mt-4 rounded-xl bg-stone-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Représentants PEEA</p><p className="mt-1 text-xs font-semibold text-stone-700">{item.representatives.length ? item.representatives.join(" · ") : "À désigner"}</p></div>{item.attended!==null&&<p className={`mt-3 text-xs font-bold ${item.attended?"text-green-700":"text-stone-500"}`}>{item.attended?"Présence effective confirmée":"Présence non confirmée"}</p>}{item.comments&&<p className="mt-3 text-xs leading-5 text-stone-600">{item.comments}</p>}</article>;
      })}</div>
    </section>

    <section>
      <div className="mb-4"><h3 className="font-display text-xl font-bold">Relations rencontrées</h3><p className="mt-1 text-xs text-stone-500">Coordonnées, contexte de rencontre et référent interne.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{contacts.map(contact => <article key={contact.id} className="card rounded-2xl p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#302009] text-xs font-black text-amber-300">{contact.fullName.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</div><div className="min-w-0"><h4 className="font-bold">{contact.fullName}</h4><p className="mt-0.5 text-xs text-stone-500">{contact.organizationOrRole ?? "Fonction non renseignée"}</p></div></div><div className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-600"><p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5"/>Rencontré à {contact.metAt ?? "un événement non renseigné"}</p></div><div className="mt-4 rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Référent PEEA</p><p className="mt-1 text-xs font-semibold">{contact.peeaReferrers.length ? contact.peeaReferrers.join(" · ") : "À attribuer"}</p></div>{contact.notes&&<p className="mt-3 text-xs leading-5 text-stone-600">{contact.notes}</p>}{contact.linkedinNote&&<p className="mt-2 text-[11px] font-semibold text-blue-700">{contact.linkedinNote}</p>}</article>)}</div>
    </section>

    <section>
      <div className="mb-4"><h3 className="font-display text-xl font-bold">Actions à mener</h3><p className="mt-1 text-xs text-stone-500">Attribuez les actions et faites progresser leur état.</p></div>
      <div className="space-y-3">{actions.map(action => <article key={action.id} className="card grid gap-4 rounded-2xl p-5 lg:grid-cols-[1fr_180px_150px]"><div><div className="flex flex-wrap items-center gap-2"><Badge>{actionStatusLabel[action.status]}</Badge>{action.contactName&&<span className="text-[10px] font-bold text-stone-500">{action.contactName}</span>}</div><h4 className="mt-3 text-sm font-bold leading-6">{action.title}</h4>{action.comments&&<p className="mt-1 text-xs leading-5 text-stone-500">{action.comments}</p>}</div><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Responsable</p><p className="mt-2 text-xs font-semibold text-stone-700">{action.owners.length ? action.owners.join(" · ") : "À attribuer"}</p><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Échéance</p><p className="mt-1 text-xs font-semibold text-stone-700">{action.dueDate ? new Date(`${action.dueDate}T12:00:00+01:00`).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : "À fixer"}</p></div><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">État</p><p className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs font-bold text-stone-700">{actionStatusLabel[action.status]}</p></div></article>)}</div>
    </section>
  </div>;
}

function SourcesView() {
  const [health, setHealth] = useState<CollectionHealth | null>(null);
  useEffect(() => { fetch("/api/v1/collection/status").then(response => response.json()).then(payload => setHealth(payload.data)).catch(() => setHealth(null)); }, []);
  const configured = (key: string) => health?.connectors?.[key] === "configured" || health?.connectors?.[key] === "ready";
  const sources = [
    { n: "OpenAgenda API v2", key: "openagenda", freq: "Toutes les 3 h", detail: "Agendas et événements publics" },
    { n: "Flux RSS", key: "rss", freq: "Toutes les 2 h", detail: `${health?.catalog?.rss ?? 8} flux validés` },
    { n: "Brave Search", key: "brave", freq: "Toutes les heures", detail: "32 requêtes prioritaires" },
    { n: "LinkedIn public indexé", key: "brave", freq: "Toutes les 3 h", detail: "Via l’index Brave uniquement" },
    { n: "Sites ciblés", key: "targeted_web", freq: "Selon priorité", detail: `${health?.catalog?.sources ?? 68} sources cataloguées` },
    { n: "Données sécurisées", key: "supabase", freq: "Temps réel", detail: "Persistance et accès" },
  ];
  return <div><div className="flex flex-wrap items-end justify-between gap-3"><div><Badge>{health?.catalog?.sources ?? 68} sources</Badge><h2 className="mt-2 font-display text-3xl font-bold">Santé des sources</h2><p className="mt-1 text-sm text-stone-500">État réel de la configuration des connecteurs.</p></div><span className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-500">Secrets conservés côté serveur</span></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sources.map(source => { const ready = configured(source.key); return <article key={source.n} className="card rounded-2xl p-5"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><DatabaseZap className="h-5 w-5"/></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ready ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600"}`}>{ready ? "Configuré" : "À configurer"}</span></div><h3 className="mt-4 font-bold">{source.n}</h3><p className="mt-1 text-[10px] text-stone-500">{source.freq}</p><div className="mt-5 border-t border-stone-100 pt-4"><p className="text-xs font-semibold text-stone-700">{source.detail}</p></div></article>; })}</div></div>;
}

function GenericView({ view }: { view: View }) { return <div><Badge>{view}</Badge><h2 className="mt-2 font-display text-3xl font-bold">{view}</h2><div className="card mt-6 rounded-2xl p-8"><div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">{view==="Notifications"?<Bell/>:<Settings2/>}</div><h3 className="mt-4 font-bold">Centre {view.toLowerCase()}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">Cette vue est reliée aux services de l’application. Les paramètres et données sont conservés de manière sécurisée.</p><div className="mt-6 grid gap-3 md:grid-cols-3">{["Brief quotidien à 08:00","Alertes prioritaires activées","Rapport hebdomadaire lundi"].map(x=><div key={x} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs font-semibold text-stone-700">{x}</div>)}</div></div></div>; }

function EventDrawer({ event, onClose }: { event: EventRecord; onClose: () => void }) {
  const exportCalendar = () => {
    const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const escape = (value: string) => value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const end = event.endDate ?? new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000).toISOString();
    const content = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//PEEA//Intelligence Hub//FR","BEGIN:VEVENT",`UID:${event.id}@peea.local`,`DTSTAMP:${stamp(new Date().toISOString())}`,`DTSTART:${stamp(event.date)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escape(event.title)}`,`DESCRIPTION:${escape(event.description)}`,`LOCATION:${escape(`${event.venue}, ${event.city}`)}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${event.id}.ics`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#1e1307]/45 backdrop-blur-sm" onClick={onClose}><aside className="h-full w-full max-w-xl overflow-y-auto bg-[#fbfaf5] shadow-2xl" onClick={e=>e.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#fbfaf5]/95 p-5 backdrop-blur"><Badge>Fiche événement</Badge><button onClick={onClose} className="rounded-full border border-stone-200 p-2" aria-label="Fermer"><X className="h-4 w-4"/></button></div><div className="p-6"><Status value={event.verification}/><h2 className="mt-4 font-display text-3xl font-bold leading-tight">{event.title}</h2><p className="mt-4 text-sm leading-6 text-stone-600">{event.description}</p><div className="my-6 grid grid-cols-2 gap-3">{[[CalendarDays,new Date(event.date).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Paris"})],[MapPin,`${event.venue}, ${event.city}`],[Building2,event.organizer],[Clock3,`Vérifié le ${new Date(event.updatedAt).toLocaleDateString("fr-FR")}`]].map(([Icon,text],i)=>{const I=Icon as typeof CalendarDays;return <div key={i} className="rounded-xl border border-stone-200 bg-white p-4"><I className="mb-2 h-4 w-4 text-amber-700"/><p className="text-xs font-semibold leading-5 text-stone-700">{text as string}</p></div>})}</div><div className="rounded-2xl bg-[#2d1e0a] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-amber-300">Score explicable</p><p className="mt-1 text-3xl font-black">{event.score}<span className="text-sm text-stone-400">/100</span></p></div><Gauge className="h-8 w-8 text-amber-400"/></div><div className="mt-4 space-y-2">{event.scoreReasons.map(r=><p key={r} className="flex items-center gap-2 text-[11px] text-stone-300"><span className="h-1.5 w-1.5 rounded-full bg-green-400"/>{r}</p>)}</div></div>{event.countries.length>0&&<div className="mt-6"><h3 className="font-display text-lg font-bold">Pays explicitement concernés</h3><div className="mt-3 flex flex-wrap gap-2">{event.countries.map(c=><Badge key={c} tone="green">{c}</Badge>)}</div></div>}<div className="mt-6 flex gap-3">{event.registrationUrl?<a href={event.registrationUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-amber-400 px-4 py-3 text-center text-xs font-extrabold text-[#2a1b07]">Voir la source / s’inscrire</a>:<span className="flex-1 rounded-xl border border-stone-200 bg-stone-100 px-4 py-3 text-center text-xs font-bold text-stone-500">Aucun lien d’inscription publié</span>}<button onClick={exportCalendar} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold">Exporter .ics</button></div><p className="mt-4 text-center text-[10px] text-stone-400">Informations issues de sources publiques ; vérifiez les modalités auprès de l’organisateur.</p></div></aside></div>;
}

export function IntelligenceHub() {
  const [view,setView] = useState<View>("Dashboard"); const [query,setQuery] = useState(""); const [mobile,setMobile] = useState(false); const [selected,setSelected] = useState<EventRecord|null>(null); const [health,setHealth] = useState<CollectionHealth|null>(null); const [events,setEvents] = useState<EventRecord[]>([]); const [publications,setPublications] = useState<PublicationRecord[]>([]); const [organizations,setOrganizations] = useState<OrganizationRecord[]>([]); const [followUp,setFollowUp] = useState<PeeaFollowUpData>({participations:[],contacts:[],actions:[]}); const [dataError,setDataError] = useState("");
  useEffect(()=>{const v=localStorage.getItem("peea-view") as View|null;if(v&&nav.some(n=>n.label===v))setView(v)},[]);
  useEffect(()=>{fetch("/api/v1/collection/status").then(response=>response.json()).then(payload=>setHealth(payload.data)).catch(()=>setHealth({connectors:{}}))},[]);
  useEffect(()=>{
    async function allPages<T>(path: string): Promise<T[]> {
      const rows: T[] = []; let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const response: Response = await fetch(path + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
        if (!response.ok) throw new Error("Une API de données est indisponible");
        const payload: { data?: T[]; meta?: { next_cursor?: string | null } } = await response.json(); rows.push(...(payload.data ?? []));
        cursor = payload.meta?.next_cursor ?? null;
        if (cursor && seen.has(cursor)) throw new Error("Pagination incohérente");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return rows;
    }
    Promise.all([allPages<EventRecord>("/api/v1/events"), allPages<PublicationRecord>("/api/v1/publications"), allPages<OrganizationRecord>("/api/v1/organizations"), fetch("/api/v1/peea-follow-up").then(async response=>{if(!response.ok)throw new Error("Le suivi PEEA est indisponible");const payload:{data:PeeaFollowUpData}=await response.json();return payload.data;})])
      .then(([events,publications,organizations,followUp])=>{
        setEvents(events.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
        setPublications(publications.sort((a,b)=>(b.publishedAt ?? b.discoveredAt ?? "").localeCompare(a.publishedAt ?? a.discoveredAt ?? "")));
        setOrganizations(organizations); setFollowUp(followUp); setDataError("");
      }).catch(error=>setDataError(error instanceof Error?error.message:"Chargement impossible"));
  },[]);
  const go=(v:View)=>{setView(v);localStorage.setItem("peea-view",v);setMobile(false)};
  const content=useMemo(()=> view==="Dashboard"?<Dashboard query={query} openEvent={setSelected} go={go} events={events} publications={publications} organizations={organizations} health={health} followUp={followUp}/>:view==="Agenda"?<AgendaView query={query} openEvent={setSelected} events={events}/>:view==="Intelligence"?<IntelligenceView query={query} publications={publications}/>:view==="Suivi PEEA"?<PeeaFollowUpView query={query} data={followUp} onDataChange={setFollowUp}/>:view==="Partenariats"?<PartnershipsView organizations={organizations}/>:view==="Sources"?<SourcesView/>:<GenericView view={view}/>,[view,query,events,publications,organizations,followUp,health]);
  return <div className="min-h-screen"><Sidebar view={view} setView={go} health={health}/>{mobile&&<div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={()=>setMobile(false)}><aside className="sidebar h-full w-72 p-5" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><Logo/><button onClick={()=>setMobile(false)} className="text-white"><X/></button></div><nav className="mt-7 space-y-1">{nav.map(({label,icon:Icon})=><button key={label} onClick={()=>go(label)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold ${view===label?"bg-amber-400 text-[#2b1e08]":"text-stone-300"}`}><Icon className="h-4 w-4"/>{label}</button>)}</nav></aside></div>}<main className="lg:pl-64"><Topbar view={view} onMenu={()=>setMobile(true)} query={query} setQuery={setQuery}/><div className="p-4 sm:p-6 lg:p-8">{dataError&&<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{dataError}</div>}{content}</div></main>{selected&&<EventDrawer event={selected} onClose={()=>setSelected(null)}/>}</div>;
}
