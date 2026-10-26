# Déploiement Netlify

Cette archive contient le code source prêt à être construit par Netlify. Le fichier `netlify.toml` configure automatiquement la commande `npm run build`, le répertoire de publication `.next` et Node.js 22.

## Déployer

1. Décompressez l'archive. Vous obtenez un dossier `peea-intelligence-hub-netlify`.
2. Connectez-vous à Netlify, puis ouvrez **Add new project > Deploy manually**.
3. Glissez le dossier `peea-intelligence-hub-netlify` dans la zone de dépôt. Ne glissez pas le fichier ZIP lui-même.
4. Netlify détecte Next.js et lit `netlify.toml` : ne modifiez pas la commande de build ni le dossier de publication.
5. Dans **Project configuration > Environment variables**, créez les variables listées ci-dessous, puis lancez le déploiement.

L'application utilise le rendu serveur Next.js et ses routes API. Netlify les prend en charge automatiquement lors de la construction du projet. Pour les mises à jour ultérieures, l'import d'un dépôt Git privé est toutefois recommandé.

## Variables requises

Copiez les valeurs correspondantes de votre environnement local dans les variables Netlify suivantes :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `BRAVE_SEARCH_API_KEY`
- `OPENAGENDA_API_KEY`
- `INTERNAL_API_TOKEN`
- `DISCOVERY_USER_AGENT`

Les variables de notification sont facultatives :

- `NOTIFY_WEBHOOK_URL`
- `NOTIFY_EMAIL_FROM`

Les secrets ne doivent jamais être ajoutés au dépôt ni à cette archive. Le fichier `.env.example` sert uniquement de modèle.

## Analyse de secrets (Secrets Scanning)

Le fichier `netlify.toml` configure `SECRETS_SCAN_OMIT_KEYS` et `SECRETS_SCAN_OMIT_PATHS` afin d'éviter les faux positifs lors de l'analyse automatique des secrets par Netlify (notamment pour les variables `DB_SSLMODE` et `DB_NAME` dont les valeurs standards coïncident avec des chaînes présentes dans `package-lock.json` ou les bundles générés).

## Collecte planifiée

Le site Netlify sert l'interface, les routes API et les données déjà stockées. Pour renouveler la veille, programmez ailleurs la commande suivante avec les mêmes variables d'environnement :

```bash
npm run worker:ingest
```

Un planificateur GitHub Actions, un serveur ou un service de tâches planifiées convient. Ne lancez pas cette commande pendant le build Netlify.
