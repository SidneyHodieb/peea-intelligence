export type VerificationStatus = "Source officielle" | "Corroboré" | "À vérifier" | "Contradictoire";
export type Priority = "Élevée" | "Pertinent" | "À examiner" | "Faible";

export type EventRecord = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  city: string;
  region: string;
  venue: string;
  organizer: string;
  category: string;
  score: number;
  verification: VerificationStatus;
  countries: string[];
  description: string;
  sourceCount: number;
  registrationUrl?: string;
  updatedAt: string;
  scoreReasons: string[];
};

export type PublicationRecord = {
  id: string;
  source: string;
  author: string;
  organization: string;
  publishedAt: string;
  title: string;
  excerpt: string;
  eventId: string;
  quality: VerificationStatus;
  sourceUrl?: string;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  role: string;
  sector: string;
  eventCount: number;
  score: number;
  stage: "Découvert" | "À qualifier" | "Qualifié" | "À contacter" | "Contacté" | "En discussion" | "Partenaire";
  initials: string;
};
