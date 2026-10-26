# Corrections et validation de l’intégration externe

## Causes établies dans le code

- `eventCandidateSchema.partial()` enveloppait des champs munis de `.default()` ; Zod 4 matérialisait `description: ""` et `countries: []` dans un PATCH qui ne les contenait pas.
- `importPublication` enrichissait la preuve pour `persistEvidence`, mais passait la preuve initiale à `ensurePublication`. Le résumé était donc vide lorsque seul `content` racine était fourni. Une publication existante n’était jamais actualisée.
- Les imports enchaînaient des écritures REST sans transaction. Une erreur sur une mention, un historique ou un audit pouvait arriver après la persistance de l’événement et de la publication. Les journaux de production ont ensuite confirmé `null value in column "id" of relation "audit_logs" violates not-null constraint` : audit_logs.id est un UUID sans valeur par défaut sur la base déployée, alors que le dépôt le déclare en bigint identity. Les anciennes réponses masquaient les objets d’erreur Supabase. La migration complète uniquement les valeurs par défaut UUID manquantes, sans changer les types ni les identifiants existants.
- `z.iso.datetime()` rejetait les décalages explicites pourtant présents dans l’exemple documenté.
- La lecture inventait « Rédaction » et la date courante en remplacement de métadonnées inconnues ; les listes étaient tronquées à 100 éléments.

## Contrôles automatisés

`npm test` exécute les tests de schéma/routes et une migration complète dans PostgreSQL embarqué (PGlite + pgcrypto), en reproduisant les écarts observés en production : UUID sans défaut et index uniques de sources/URL absents. Les tests injectent une panne au dernier audit et vérifient l’absence de persistance partielle, rejouent les imports, vérifient les PATCH, la réparation des publications, les identités et les dates, les contrôles d’accès et la pagination.

PGlite possède une seule connexion : ces tests vérifient le SQL réel, les contraintes et les transactions, mais ne constituent pas un test de charge avec plusieurs connexions PostgreSQL distantes. Le code utilise également des verrous de lignes/advisory et des contraintes uniques pour la concurrence.

Aucune donnée fictive n’a été écrite en production. L’accès Supabase est désormais disponible via le connecteur ; les secrets Netlify restent indisponibles. La migration distante `20261026165637_external_atomic_writes` a été appliquée via le connecteur Supabase au projet PEEA AGENDA. Les quatre publications concernées ont été réparées en place après dry run ; leurs identifiants et le total de 85 publications sont conservés. Les contrôles confirment le défaut UUID d’audit corrigé et l’exécution de la RPC interdite à anon.

Le build local rencontre `ENOENT: uv_resident_set_memory` dans cet environnement, avec Turbopack et webpack. Un workflow GitHub Actions vérifie également les tests, TypeScript et le build sur Ubuntu/Node 22 ; son résultat doit être contrôlé avant fusion.
