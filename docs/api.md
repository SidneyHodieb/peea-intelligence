# API v1

- `GET /api/v1/events?city=&min_score=&limit=` — liste paginable.
- `GET /api/v1/events/{id}` — fiche.
- `GET /api/v1/publications` — publications qualifiées.
- `GET /api/v1/organizations` — organisations.
- `GET /api/v1/collection/status` — santé des connecteurs.
- `POST /api/v1/internal/ingestion` — ingestion protégée par `Authorization: Bearer …`.

Les réponses utilisent `{ data, meta }`; les erreurs utilisent `{ error: { code, message } }`. La limite maximale est 100 objets par page.
