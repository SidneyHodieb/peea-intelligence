# Collecteurs

`workers/discovery/run.ts` fournit les connecteurs RSS, Brave Search et OpenAgenda API v2 avec délais réseau, User-Agent explicite, parsing, normalisation et qualification déterministe. Le catalogue `config/source-catalog.json` classe les sources par niveau et cadence. La taxonomie `config/discovery-taxonomy.json` couvre les signaux économiques, formats d’événements, exclusions, secteurs, régions, villes et les 54 pays africains.

OpenAgenda fonctionne en deux temps : découverte d’agendas pertinents par `/v2/agendas?search=…`, puis collecte des événements actuels/à venir de chaque agenda via `/v2/agendas/{uid}/events`. Brave utilise des requêtes prioritaires bornées, un ciblage France/français et une fraîcheur mensuelle. Les résultats de plateformes ou de médias doivent être corroborés avant de devenir « source officielle ».

À compléter pour la production : pagination par curseur, quotas persistés, liste blanche SSRF, cache HTTP, retry exponentiel et stockage idempotent dans Supabase.
