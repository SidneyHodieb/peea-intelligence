# API d’intégration externe

## Déploiement et accès

1. Appliquer `supabase/migrations/20261026165637_external_atomic_writes.sql` sur la base de production **avant** de déployer ce code. Elle ajoute une transaction RPC et un compteur de débit ; elle ne supprime aucun événement ni publication.
2. Configurer `EXTERNAL_API_TOKEN` côté serveur et sur chaque collecteur. À défaut, `INTERNAL_API_TOKEN` est utilisé. Aucun secret ne doit être commité ni envoyé au frontend.
3. Tester les collecteurs avec `Authorization: Bearer <jeton>` puis déployer. Les anciennes requêtes anonymes seront refusées : ce changement exige une transition coordonnée.
4. Contrôler d’abord un dry run, puis une écriture autorisée et sa relecture. Aucun test fictif ne doit être ajouté à la production.

Sans jeton configuré : 503 `AUTH_NOT_CONFIGURED`. Jeton absent/invalide : 401. Plafond partagé en base : 120 enregistrements écrits par minute et par jeton (pas 120 lots). Les compteurs expirés sont purgés au passage suivant. Une requête est limitée à 2,1 Mo. Les RPC sont réservées au rôle serveur `service_role`.

## Importer des événements

`POST /api/v1/internal/external/events`

```json
{
  "dryRun": true,
  "records": [{
    "event": {
      "title": "Titre réellement vérifié",
      "description": "Résumé factuel sourcé",
      "startsAt": "2027-03-10T09:00:00+01:00",
      "city": "Paris",
      "organizer": "Organisateur vérifié",
      "registrationUrl": "https://organisateur.example/inscription"
    },
    "evidence": {
      "sourceName": "Site organisateur",
      "sourceUrl": "https://organisateur.example/forum",
      "content": "Éléments publics confirmant les informations",
      "official": true
    }
  }]
}
```

Ce JSON illustre le contrat ; ses données ne doivent pas être envoyées en production.

Maximum 50 records. Une URL HTTP(S) de preuve, un titre, une ville et un début horodaté avec fuseau sont requis. Les nouveaux événements doivent être futurs. `Z` et les décalages ISO explicites sont acceptés et normalisés en UTC. Sans horaire publié, utiliser une publication plutôt qu’inventer une heure. Une fin antérieure au début est refusée.

Chaque record est une transaction indépendante comprenant source, version, publication, événement, mention, historique et audit. Un échec annule entièrement **ce record**, sans annuler les autres records du lot. Aucun repli vers des écritures REST partielles n’est utilisé si la RPC n’est pas installée.

`dryRun:true` exécute la même transaction puis l’annule : validations de références, contraintes et existence des cibles sont vérifiées, sans enregistrement durable de données métier. Les séquences PostgreSQL peuvent avancer. Réponse 200 si tout est valide, 207 si certains records sont rejetés. En import réel : 201 si tout réussit, sinon 207. Lire systématiquement `results[].ok` ; 207 n’est pas un succès global.

```json
{"data":{"succeeded":1,"failed":0,"dry_run":false,"results":[{"index":0,"ok":true,"id":"uuid","created":true,"action":"created","event":{},"publicationId":"uuid","versionId":"uuid"}]}}
```

`action` vaut `created`, `updated` ou `duplicate`. Un reçu transactionnel par jeton, opération et charge canonique conserve les identifiants lors d’une répétition exacte, même après report de l’événement ; il ne recrée pas d’historique/audit métier et retourne l’état courant. L’identité combine titre normalisé, jour local en Europe/Paris, ville et organisateur ; un `externalId` fourni est limité au domaine de sa preuve. Les anciennes identités sans organisateur sont rapprochées uniquement si l’organisateur correspond. Les contraintes uniques et verrous transactionnels protègent les écritures concurrentes ; un conflit non résoluble est rejeté, jamais fusionné arbitrairement.

## Modifier un événement

`PATCH /api/v1/internal/external/events/:id`

```json
{
  "dryRun": true,
  "patch": {"venue":"Lieu vérifié","verification":"corroborated"},
  "evidence":{"sourceUrl":"https://organisateur.example/programme","sourceName":"Programme officiel","content":"Preuve du nouveau lieu"}
}
```

L’ID doit désigner la fiche exacte. Fusion sous verrou en base : les champs omis restent inchangés, y compris description, pays, score, organisateur et propriétés supplémentaires de `data`. `null` est refusé ; une chaîne vide explicite est admise uniquement pour les champs textuels facultatifs. Un PATCH vide est refusé. Le retour inclut la ligne effectivement enregistrée. Aucun identifiant transitoire n’est renvoyé en dry run.

Niveaux externes : `unverified`, `corroborated`, `contradictory`. `official` est refusé en entrée ; un niveau officiel existant est conservé si le PATCH ne demande pas de changement. `evidence.official` décrit la source et n’élève pas le statut de l’événement.

## Publications et réparation en place

`POST /api/v1/internal/external/publications`

```json
{
  "title":"Titre de publication",
  "content":"Résumé factuel",
  "eventId":"uuid-optionnel",
  "evidence":{"sourceUrl":"https://source.example/article","sourceName":"Source publique"},
  "dryRun":true
}
```

`title` et `content` au niveau racine font autorité pour la publication et son extrait ; il n’est pas nécessaire de les répéter dans `evidence`. `eventId` est vérifié avant les écritures. Une preuve déjà connue conserve l’identifiant de sa publication et crée une nouvelle version si son contenu évolue.

`PATCH /api/v1/internal/external/publications/:id` accepte le même corps et répare cette publication **en place**. Son URL de source doit correspondre à la source existante, sinon 409 `SOURCE_MISMATCH`. Utiliser cette route plutôt qu’un réimport pour réparer un extrait. Une publication peut être liée à plusieurs événements : la lecture expose `eventIds` et conserve `eventId` pour compatibilité.

La lecture utilise le contenu de la dernière version si un ancien `summary` est vide. Cela rétablit les extraits concernés sans changer leurs identifiants. Les auteurs inconnus s’affichent comme non renseignés ; `publishedAt` reste `null` si inconnu et `discoveredAt` est fourni séparément. Aucune date actuelle n’est inventée en remplacement.

## Lecture et pagination

`GET /api/v1/events?limit=100&cursor=...` et `GET /api/v1/publications?limit=100&cursor=...` exposent `meta.next_cursor`. Renvoyer le curseur opaque sans le modifier et conserver les mêmes filtres. Ordre stable par ID décroissant ; l’interface trie les résultats après avoir chargé toutes les pages. Pour les événements, `city` et `min_score` sont appliqués en base avant pagination. Limites invalides ou curseurs invalides : 422.

## Erreurs et exploitation

Les réponses n’exposent pas les messages SQL. Les erreurs serveur comportent un identifiant de requête, les détails de persistance étant journalisés côté serveur. Codes : `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_REFERENCE`, `IDENTITY_CONFLICT`, `SOURCE_MISMATCH`, `RATE_LIMITED`, `PERSISTENCE_ERROR`.

Avant activation en production, vérifier la conformité de la base à la migration initiale, appliquer la nouvelle migration, configurer le jeton, puis vérifier les logs. Les essais locaux ne certifient pas l’état d’une base distante ni un déploiement Netlify. En cas de timeout après commit, relire puis réessayer le même record : son identité et sa preuve empêchent une seconde création.

Retour arrière : conserver les données et la fonction en base ; revenir au code précédent seulement après évaluation du retour de ses défauts et de ses routes anonymes. Ne pas supprimer les tables métier pour annuler cette migration.
