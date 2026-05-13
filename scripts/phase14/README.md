# Phase 14 — Données de démonstration contrôlées (PartageCo)

**Périmètre :** sandbox / preview / préproduction uniquement.
**Interdit en production.**

## Garde-fous (refus d'exécution si manqué)

- `APP_ENV ∈ { sandbox, preview, preproduction }` — sinon arrêt immédiat.
- Toutes les données créées sont préfixées `demo_partageco_`.
- Emails sur `@example.test` exclusivement.
- `platform_fee_amount`, `net_amount`, `provider_name`, `provider_reference` restent `NULL`.
- Aucun appel à un prestataire de paiement réel.
- Aucun logo ni marque tierce.

## Exécution

```bash
APP_ENV=sandbox \
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
bun scripts/phase14/seed-demo.ts
```

## Nettoyage

```bash
APP_ENV=sandbox bun scripts/phase14/cleanup-demo.ts
```

Le nettoyage supprime uniquement les lignes préfixées `demo_partageco_`
dans l'ordre des dépendances (messages → conversations → payments →
co_subscriptions → offers → users + admin_users + consents + auth users
→ services + categories démo).

## Inventaire généré

| Entité | Quantité |
|---|---|
| Vendeurs demo | 5 |
| Acheteurs demo | 8 |
| Admins demo (super/support/moderation) | 3 |
| Offres `active`/`public`/slots>0 | 6 |
| Offres `draft` | 2 |
| Offres `pending_review` | 2 |
| Offres `paused` | 2 |
| Offres `rejected` | 1 |
| Offres `archived` | 1 |
| Offres `active`/`public`/slots=0 | 1 |
| Participations (par statut) | 3 / 3 / 3 / 2 / 2 / 2 |
| Payments `pending` / `simulated` / `cancelled` / `failed` | 3 / 3 / 2 / 1 |
| Conversations participation + dispute | 8 + 5 |
| Litiges (5 statuts) | 5 |
| Notifications | ≥ 11 |

## Hors-périmètre (NON créé)

Avis, badges, classements, panier, boutique, paiement réel, IBAN, wallet,
remboursement, scraping, marques tierces (Netflix, Spotify, etc.),
recommandations, sponsorisé.

## Post-exécution

Vérifier dans la marketplace publique que :
- seules les 6 offres `active/public/available_slots > 0` apparaissent ;
- l'offre `actif_public_complet` (slots = 0) est exclue ;
- les états vides production ne sont pas pollués par les données demo
  (le préfixe permet de les masquer côté UI si besoin).
