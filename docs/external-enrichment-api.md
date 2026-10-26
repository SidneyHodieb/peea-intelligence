# API d’intégration externe

Ces routes sont serveur à serveur. Elles ne sont utilisées par aucune vue de l’interface et n’empêchent jamais la collecte native.

## Accès

Les routes sont ouvertes et ne demandent aucun en-tête d’authentification. Chaque donnée doit inclure une preuve publique (`evidence.sourceUrl`). Les écritures conservent une version de source, une publication liée, une mention d’événement et un audit.

## Importer des événements

`POST /api/v1/internal/external/events`

```json
{
  "dryRun": false,
  "records": [{
    "event": {
      "title": "Forum Afrique–France",
      "description": "Rencontres B2B et financement.",
      "startsAt": "2027-03-10T09:00:00+01:00",
      "city": "Paris",
      "organizer": "Organisation exemple",
      "registrationUrl": "https://organisateur.example/inscription"
    },
    "evidence": {
      "sourceName": "Site de l’organisateur",
      "sourceUrl": "https://organisateur.example/forum",
      "title": "Forum Afrique–France",
      "content": "Annonce publique de l’événement.",
      "official": true
    }
  }]
}
```

Maximum : 50 enregistrements par requête. `dryRun: true` valide la charge sans écrire.

## Enrichir un événement

`PATCH /api/v1/internal/external/events/:id`

```json
{
  "patch": { "venue": "Palais des Congrès", "verification": "corroborated" },
  "evidence": {
    "sourceUrl": "https://organisateur.example/programme",
    "sourceName": "Programme officiel",
    "content": "Le programme confirme le lieu."
  }
}
```

Les valeurs admises pour `verification` sont `unverified`, `corroborated` et `contradictory`. L’intégration externe ne peut pas attribuer seule le niveau `official`.

## Importer une publication

`POST /api/v1/internal/external/publications`

```json
{
  "title": "Publication source",
  "content": "Résumé factuel de la publication.",
  "eventId": "uuid-optionnel",
  "evidence": { "sourceUrl": "https://source.example/article", "sourceName": "Source publique" }
}
```
