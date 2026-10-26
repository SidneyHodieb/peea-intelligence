import type { EventRecord, OrganizationRecord, PublicationRecord } from "./types";

export const events: EventRecord[] = [
  {
    id: "evt-1", title: "Forum Investir en Afrique — Paris", date: "2026-11-14T09:00:00+01:00",
    city: "Paris", region: "Île-de-France", venue: "Maison de la Chimie", organizer: "Africa Business Network",
    category: "Investissement", score: 92, verification: "Corroboré", countries: ["Sénégal", "Côte d’Ivoire", "Bénin"],
    description: "Rencontre économique consacrée au financement de projets et aux passerelles entre investisseurs, entrepreneurs et diasporas.",
    sourceCount: 4, registrationUrl: "https://example.org/demo", updatedAt: "2026-10-26T06:14:00Z",
    scoreReasons: ["Diaspora africaine (+25)", "Investissement explicite (+25)", "Dimension entrepreneuriale (+15)", "France (+10)", "Date future (+10)", "Sources documentées (+5)", "Organisations économiques (+10)"],
  },
  {
    id: "evt-2", title: "Rencontres économiques Afrique–Europe", date: "2026-11-22T10:00:00+01:00",
    city: "Lyon", region: "Auvergne-Rhône-Alpes", venue: "Hôtel de Région", organizer: "Club Afrique Auvergne-Rhône-Alpes",
    category: "Forum économique", score: 84, verification: "Source officielle", countries: ["Cameroun", "Maroc"],
    description: "Tables rondes et rendez-vous d’affaires autour des échanges Afrique–Europe.", sourceCount: 2,
    updatedAt: "2026-10-26T05:40:00Z", scoreReasons: ["Lien Afrique–Europe (+25)", "Dimension économique (+15)", "Organisations économiques (+10)", "France (+10)", "Date future (+10)", "Source officielle (+5)"],
  },
  {
    id: "evt-3", title: "Diaspora & Impact : financer l’entrepreneuriat", date: "2026-12-04T18:30:00+01:00",
    city: "Bordeaux", region: "Nouvelle-Aquitaine", venue: "Darwin Écosystème", organizer: "Impact Diaspora Lab",
    category: "Entrepreneuriat", score: 78, verification: "À vérifier", countries: ["Mali", "Guinée"],
    description: "Soirée de rencontres entre porteurs de projets, financeurs solidaires et réseaux diasporiques.", sourceCount: 1,
    updatedAt: "2026-10-25T22:10:00Z", scoreReasons: ["Diaspora africaine (+25)", "Financement (+25)", "Entrepreneuriat (+15)", "France (+10)", "Date future (+10)"],
  },
  {
    id: "evt-4", title: "Sommet des industries créatives africaines", date: "2027-01-16T09:30:00+01:00",
    city: "Marseille", region: "Provence-Alpes-Côte d’Azur", venue: "Palais du Pharo", organizer: "Méditerranée Créative",
    category: "Industries créatives", score: 66, verification: "Contradictoire", countries: ["Nigeria", "Ghana"],
    description: "Conférences professionnelles, exposition et rencontres avec des investisseurs des industries créatives.", sourceCount: 3,
    updatedAt: "2026-10-25T16:25:00Z", scoreReasons: ["Afrique explicite (+25)", "Investisseurs présents (+10)", "Dimension économique (+15)", "France (+10)", "Date future (+10)"],
  },
];

export const publications: PublicationRecord[] = [
  { id: "pub-1", source: "LinkedIn indexé", author: "Aïcha Morel", organization: "Africa Business Network", publishedAt: "2026-10-26T06:14:00Z", title: "Les inscriptions au Forum Investir en Afrique sont ouvertes", excerpt: "Une nouvelle édition réunira entrepreneurs, institutions et financeurs à Paris…", eventId: "evt-1", quality: "Corroboré" },
  { id: "pub-2", source: "OpenAgenda", author: "Agenda Métropole de Lyon", organization: "Région Auvergne-Rhône-Alpes", publishedAt: "2026-10-26T05:40:00Z", title: "Rencontres économiques Afrique–Europe", excerpt: "Une journée de rendez-vous et de partage d’expériences à l’Hôtel de Région…", eventId: "evt-2", quality: "Source officielle" },
  { id: "pub-3", source: "Flux RSS", author: "Impact Diaspora Lab", organization: "Impact Diaspora Lab", publishedAt: "2026-10-25T22:10:00Z", title: "Financer les entrepreneurs de la diaspora", excerpt: "Le programme prévisionnel annonce trois tables rondes et un temps de networking…", eventId: "evt-3", quality: "À vérifier" },
];

export const organizations: OrganizationRecord[] = [
  { id: "org-1", name: "Africa Business Network", role: "Organisateur", sector: "Réseau d’affaires", eventCount: 3, score: 91, stage: "À contacter", initials: "AB" },
  { id: "org-2", name: "Région Auvergne-Rhône-Alpes", role: "Partenaire institutionnel", sector: "Institution", eventCount: 2, score: 82, stage: "Qualifié", initials: "AR" },
  { id: "org-3", name: "Impact Diaspora Lab", role: "Organisateur", sector: "Entrepreneuriat social", eventCount: 1, score: 76, stage: "À qualifier", initials: "ID" },
  { id: "org-4", name: "Banque Horizon Afrique", role: "Sponsor annoncé", sector: "Finance", eventCount: 2, score: 88, stage: "Découvert", initials: "BH" },
];
