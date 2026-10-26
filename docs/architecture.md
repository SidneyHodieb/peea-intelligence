# Architecture

Application Next.js App Router modulaire : interface et Route Handlers dans `app/`, règles métier pures dans `lib/`, collecte dans `workers/`, schéma PostgreSQL dans `supabase/`. Le pipeline est : source → `source_items` immuable → qualification → événement/publication → historisation → notification. Les connecteurs sont isolés et relançables ; `native_id`, URL canonique et empreinte titre/date/ville assurent l’idempotence.

Une interface `ContentEnrichmentProvider` pourra être ajoutée plus tard, mais aucun fournisseur IA n’est initialisé en V1.
