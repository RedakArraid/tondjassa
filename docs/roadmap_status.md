# Registre d'Exécution et Statut de la Release MandeMarket

Document de pilotage de l'Agent Manager selon la tâche `MM-MGR-001` de `PLAN_FINALISATION.md`.

Revue de preuve : 26 septembre 2026. `IMPLÉMENTÉ` signifie que le livrable est
présent dans le dépôt, pas qu'il a été accepté sur une infrastructure réelle.
`TERMINÉ` est réservé aux critères prouvés ; les gates externes restent explicites.

## Règles de Priorisation et Déblocage

- **P0** : Bloquants critiques (intégrité financière, sécurité, pertes de données, migrations).
- **P1** : Fonctionnalités marketplace majeures (espace vendeur, retraits, paiements).
- **P2** : Améliorations, notifications, polissage UX.
- **Règle absolue** : Aucun paiement live autorisé avant la validation intégrale de la Phase 4.

---

## Tableau de Suivi des Tâches

| ID | Phase | Titre | Agent | Priorité | Dépend de | Statut |
|---|---|---|---|---|---|---|
| **MM-MGR-001** | 0 | Établir le registre de travail & architecture | Manager | P0 | Aucune | **TERMINÉ** |
| **MM-INF-001** | 0 | Sauvegarder l'état courant & procédure de restore | Infra | P0 | Aucune | **TERMINÉ** |
| **MM-BE-001** | 0 | Neutraliser les scripts destructifs & réparer seed | Backend | P0 | Aucune | **TERMINÉ** |
| **MM-ALL-001** | 0 | Installer les garde-fous qualité (lint, test, CI) | Tous | P0 | MM-BE-001 | **TERMINÉ** |
| **MM-BE-010** | 1 | Décider la stratégie de baseline des migrations | Backend | P0 | Phase 0 | **TERMINÉ** |
| **MM-BE-011** | 1 | Créer la migration initiale reproductible (baseline) | Backend | P0 | MM-BE-010 | **TERMINÉ** |
| **MM-BE-012** | 1 | Éliminer les données dupliquées (stock, ledger) | Backend | P0 | MM-BE-011 | **TERMINÉ** |
| **MM-INF-010** | 1 | Rendre le démarrage Docker non destructif | Infra | P0 | MM-BE-011 | **TERMINÉ** |
| **MM-BE-013** | 1 | Tester les migrations sur base propre & rollback | Backend | P0 | MM-INF-010 | **TERMINÉ** |
| **MM-BE-020** | 2 | Centraliser et valider la configuration (Zod) | Backend | P0 | Phase 1 | **TERMINÉ** |
| **MM-BE-021** | 2 | Implémenter les sessions sécurisées & révocables | Backend | P0 | MM-BE-020 | **TERMINÉ** |
| **MM-BE-022** | 2 | Corriger le contrôle d'accès RBAC | Backend | P0 | MM-BE-021 | **TERMINÉ** |
| **MM-FE-020** | 2 | Refaire les gardes d'interface & supprimer test credentials | Frontend | P0 | MM-BE-022 | **TERMINÉ** |
| **MM-BE-023** | 2 | Sécuriser produits et médias (Cloudinary isolé) | Backend | P1 | MM-BE-022 | **TERMINÉ** |
| **MM-INF-020** | 2 | Secrets, Dockerignore et analyse vulnérabilités | Infra | P0 | MM-BE-020 | **IMPLÉMENTÉ — CI À EXÉCUTER** |
| **MM-BE-030** | 3 | Stabiliser le catalogue & unicité SKU | Backend | P1 | Phase 2 | **TERMINÉ** |
| **MM-BE-031** | 3 | Créer le service de tarification serveur (quote) | Backend | P0 | MM-BE-030 | **TERMINÉ** |
| **MM-BE-032** | 3 | Réécrire la création de commande atomique | Backend | P0 | MM-BE-031 | **TERMINÉ** |
| **MM-BE-033** | 3 | Implémenter les machines d'état (Order, Payment, Shipping) | Backend | P0 | MM-BE-032 | **TERMINÉ** |
| **MM-BE-034** | 3 | Annulation et expiration avec libération de stock | Backend | P0 | MM-BE-033 | **TERMINÉ** |
| **MM-FE-030** | 3 | Brancher le checkout sur le devis serveur | Frontend | P0 | MM-BE-031 | **TERMINÉ** |
| **MM-FE-031** | 3 | Corriger confirmation et suivi de commande | Frontend | P0 | MM-BE-032 | **TERMINÉ** |
| **MM-BE-040** | 4 | Créer la couche commune de paiement | Backend | P0 | Phase 3 | **TERMINÉ** |
| **MM-BE-042** | 4 | Corriger Paystack (signature + vérification API) | Backend | P0 | MM-BE-040 | **IMPLÉMENTÉ — SANDBOX À VALIDER** |
| **MM-BE-043** | 4 | Corriger Stripe (webhook vérifié + SEPA asynchrone) | Backend | P0 | MM-BE-040 | **IMPLÉMENTÉ — SANDBOX À VALIDER** |
| **MM-BE-044** | 4 | Finaliser le paiement à la livraison (COD avec lock stock) | Backend | P0 | MM-BE-040 | **TERMINÉ** |
| **MM-FE-040** | 4 | Refaire les pages paiement basées sur le statut serveur | Frontend | P0 | MM-BE-042, MM-BE-043 | **IMPLÉMENTÉ — SANDBOX À VALIDER** |
| **MM-INF-040** | 4 | Configurer Paystack Côte d'Ivoire et Stripe Europe (sandbox/live) | Infra | P0 | MM-BE-040 | **À FAIRE — PREUVES PSP EXTERNES** |
| **MM-BE-050** | 5 | Implémenter le ledger vendeur en partie double | Backend | P0 | Phase 4 | **TERMINÉ** |
| **MM-BE-051** | 5 | Sécuriser les retraits (réservation atomique de solde) | Backend | P0 | MM-BE-050 | **TERMINÉ** |
| **MM-BE-052** | 5 | APIs finances et retraits vendeur | Backend | P0 | MM-BE-051 | **TERMINÉ** |
| **MM-FE-050** | 5 | Brancher l'UI finances vendeur sur les 4 soldes réels | Frontend | P0 | MM-BE-052 | **TERMINÉ** |
| **MM-BE-060** | 6 | Gestion complète des produits vendeur (CRUD réel) | Backend | P1 | Phase 5 | **TERMINÉ** |
| **MM-FE-060** | 6 | UI produits vendeur sans données simulées | Frontend | P1 | MM-BE-060 | **TERMINÉ** |
| **MM-BE-061** | 6 | Commandes vendeur filtrées et actions logistiques | Backend | P1 | MM-BE-060 | **TERMINÉ** |
| **MM-BE-062** | 6 | Avis et support vendeur | Backend | P1 | MM-BE-061 | **TERMINÉ** |
| **MM-BE-063** | 6 | Promotions plateforme / vendeur | Backend | P1 | MM-BE-061 | **TERMINÉ** |
| **MM-BE-064** | 6 | Équipe boutique et permissions RBAC | Backend | P2 | MM-BE-061 | **IMPLÉMENTÉ — TEST D'INTÉGRATION LOCAL PASSÉ** |
| **MM-FE-061** | 6 | Éliminer notifySoon et brancher tous les modules vendeur | Frontend | P0 | MM-BE-060 | **IMPLÉMENTÉ — RECETTE NAVIGATEUR À VALIDER** |
| **MM-BE-070** | 7 | Gestion des utilisateurs admin (CRUD réel) | Backend | P1 | Phase 6 | **TERMINÉ** |
| **MM-FE-070** | 7 | Remplacer UsersManager fictif par l'API réelle | Frontend | P0 | MM-BE-070 | **TERMINÉ** |
| **MM-BE-071** | 7 | Avis fiables et vérifiés | Backend | P1 | MM-BE-070 | **TERMINÉ** |
| **MM-BE-072** | 7 | Retours, avoirs et remboursements | Backend | P0 | MM-BE-070 | **TERMINÉ** |
| **MM-BE-073** | 7 | Espace compte client complet | Backend | P1 | MM-BE-070 | **TERMINÉ** |
| **MM-FE-071** | 7 | Finaliser l'interface espace client | Frontend | P1 | MM-BE-073 | **TERMINÉ** |
| **MM-FE-072** | 7 | Administration opérationnelle (zéro mock) | Frontend | P0 | MM-BE-070 | **TERMINÉ** |
| **MM-BE-080** | 8 | Emails transactionnels fiables avec file d'attente | Backend | P1 | Phase 7 | **IMPLÉMENTÉ — SMTP RÉEL À VALIDER** |
| **MM-FE-080** | 8 | États d'envoi d'emails honnêtes dans l'UI | Frontend | P2 | MM-BE-080 | **TERMINÉ** |
| **MM-BE-081** | 8 | Expédition et suivi logistique réel | Backend | P1 | MM-BE-080 | **PARTIEL — SUIVI MANUEL, PAS DE RÉSERVATION TRANSPORTEUR** |
| **MM-FE-081** | 8 | UI expédition et suivi client/vendeur | Frontend | P1 | MM-BE-081 | **PARTIEL — SUIVI MANUEL** |
| **MM-BE-082** | 8 | Endpoints contact et newsletter validés | Backend | P2 | MM-BE-080 | **TERMINÉ** |
| **MM-FE-082** | 8 | Contenus publics, SEO et mentions légales | Frontend | P2 | MM-BE-082 | **TERMINÉ** |
| **MM-QA-090** | 9 | Tests backend automatisés (couverture critique) | Backend | P0 | Toutes | **PARTIEL — CIBLE DE COUVERTURE NON PROUVÉE** |
| **MM-QA-091** | 9 | Tests frontend automatisés (contextes, formulaires) | Frontend | P0 | Toutes | **PARTIEL — COUVERTURE CRITIQUE NON PROUVÉE** |
| **MM-QA-092** | 9 | Tests E2E et validation d'intégration | Tous | P0 | MM-QA-090 | **IMPLÉMENTÉ — CI ISOLÉE À EXÉCUTER** |
| **MM-INF-090** | 9 | Rationalisation Redis | Infra | P1 | MM-BE-080 | **TERMINÉ** |
| **MM-INF-091** | 9 | Observabilité et logs JSON structurés avec requestId | Infra | P0 | MM-BE-020 | **PARTIEL — COLLECTE/ALERTES À FAIRE** |
| **MM-INF-092** | 9 | Healthchecks Liveness / Readiness | Infra | P0 | MM-INF-091 | **IMPLÉMENTÉ — CI/PROD À VALIDER** |
| **MM-INF-093** | 9 | Sauvegardes automatisées & politique RPO/RTO | Infra | P0 | MM-INF-001 | **PARTIEL — HORS-SITE/DRILL À PROUVER** |
| **MM-INF-094** | 9 | Pipeline CI/CD complet | Infra | P0 | MM-ALL-001 | **PARTIEL — GATES CI, PAS DE DÉPLOIEMENT CD** |
| **MM-QA-093** | 9 | Vérifications non-fonctionnelles (sécurité, a11y, perf) | Tous | P1 | MM-QA-092 | **PARTIEL — SMOKES, PAS DE CERTIFICATION** |
| **MM-MGR-100** | 10 | Recette fonctionnelle Afrique & Europe | Manager | P0 | Phase 9 | **À FAIRE — RECETTE RÉELLE** |
| **MM-INF-100** | 10 | Répétition générale en environnement de staging | Infra | P0 | MM-MGR-100 | **À FAIRE — STAGING RÉEL** |
| **MM-MGR-101** | 10 | Comité Go / No-Go formel | Manager | P0 | MM-INF-100 | **BLOQUÉ — NO-GO ACTUEL** |
| **MM-INF-101** | 10 | Déploiement en production maîtrisé | Infra | P0 | MM-MGR-101 | **NON EXÉCUTÉ** |
| **MM-MGR-102** | 10 | Suivi post-release & réconciliation comptable | Manager | P0 | MM-INF-101 | **NON DÉMARRÉ** |
