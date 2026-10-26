# Déploiement

Construire avec `docker compose up --build`. Le conteneur Next.js utilise le mode standalone et un utilisateur non privilégié. En production : HTTPS en frontal, secrets fournis par l’hébergeur, sauvegardes Supabase, healthcheck, logs structurés et ordonnanceur distinct.
