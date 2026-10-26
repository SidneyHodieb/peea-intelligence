# PEEA Intelligence Hub

Socle fonctionnel de l’observatoire automatisé des événements économiques Afrique–Diaspora. La qualification native reste déterministe : règles explicables, extraction structurée et rapprochement contrôlable. Une intégration externe facultative peut importer ou enrichir des données sourcées, sans dépendance pour l’interface ni les collecteurs.

## Démarrage

```bash
cp .env.example .env.local
npm install
npm run dev
```

Ouvrir `http://localhost:3000`. Sans configuration Supabase, l’interface et l’API utilisent un jeu de démonstration clairement signalé.

## Vérification

```bash
npm run typecheck
npm test
npm run build
```

## Configuration réelle

1. Créer un projet Supabase et appliquer `supabase/migrations/202610260001_initial_schema.sql`.
2. Renseigner les trois variables Supabase dans `.env.local`.
3. Ajouter les clés Brave Search et OpenAgenda (aucune dépense n’est déclenchée par l’application).
4. Définir `INTERNAL_API_TOKEN` pour la route d’ingestion interne.
5. Planifier `npm run worker:discovery` via Supabase Cron ou l’ordonnanceur du serveur.

Le catalogue initial contient plus de 60 sources classées par priorité dans `config/source-catalog.json`. La taxonomie exhaustive (signaux, exclusions, régions, villes, 54 pays africains et modèles de requêtes) se trouve dans `config/discovery-taxonomy.json`.

Voir les documents de `docs/` pour l’architecture, la sécurité, les opérations et l’état des tests.
