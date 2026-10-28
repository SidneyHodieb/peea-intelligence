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
  publishedAt: string | null;
  discoveredAt?: string | null;
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

export type PeeaParticipationRecord = {
  id: string;
  eventId?: string;
  eventName: string;
  occurredOn: string | null;
  endsOn: string | null;
  timeText: string | null;
  venue: string | null;
  sourceUrl: string | null;
  representatives: string[];
  appointmentStatus: "validated" | "not_validated" | "in_progress" | "unknown";
  attended: boolean | null;
  comments: string | null;
  nextStep: string | null;
};

export type PeeaContactRecord = {
  id: string;
  participationId: string | null;
  fullName: string;
  metAt: string | null;
  organizationOrRole: string | null;
  peeaReferrers: string[];
  notes: string | null;
  linkedinNote: string | null;
};

export type PeeaActionStatus = "waiting" | "in_progress" | "done" | "cancelled";

export type PeeaActionRecord = {
  id: string;
  contactId: string | null;
  contactName: string | null;
  title: string;
  dueDate: string | null;
  status: PeeaActionStatus;
  owners: string[];
  comments: string | null;
  updatedAt: string;
};

export type PeeaFollowUpData = {
  participations: PeeaParticipationRecord[];
  contacts: PeeaContactRecord[];
  actions: PeeaActionRecord[];
};
