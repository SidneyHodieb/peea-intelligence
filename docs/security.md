# Sécurité et RGPD

Secrets exclusivement côté serveur, validation Zod, token interne, RLS Supabase, journal d’audit et séparation collecte/données métier. Avant production, ajouter limitation de débit, validation stricte des URL (HTTP(S), DNS public, blocage réseaux privés et redirections), CSP, rotation des secrets et tests d’autorisation par rôle.

Les personnes ne doivent être enregistrées que si elles sont publiquement et explicitement associées à un événement. Aucun profilage d’origine ou de diaspora n’est permis. Prévoir les workflows de rectification, suppression, durée de conservation et registre de traitement.
