# Rapport de tests — 26 octobre 2026

- `npm run typecheck` : réussi.
- `npm test` : 7 tests réussis sur 7 (score, contenu culturel, normalisation, dédoublonnage, catalogue, couverture géographique et requêtes).
- `npm run build` : réussi ; 8 pages générées, 6 routes API dynamiques.
- `npm audit --audit-level=moderate` : 0 vulnérabilité connue.
- Contrôle navigateur : desktop et mobile 390 × 844 réussis ; navigation Agenda et fiche événement validées ; aucune erreur console.
- Contrôle HTTP : liste des événements `200`, ingestion sans jeton correctement refusée avec `401`.
- Connexions réelles : Brave Search `200` avec résultats ; OpenAgenda API v2 `200` avec découverte d’agendas. Catalogue validé : 68 sources, 8 flux RSS directs, 54 pays africains et 32 requêtes prioritaires.

Non vérifiés sans services : collecte réelle Brave/OpenAgenda, RLS sur projet Supabase, envoi email/Telegram, cron et sauvegardes. Les données visibles dans l’interface sont des démonstrations, jamais des découvertes réelles.
