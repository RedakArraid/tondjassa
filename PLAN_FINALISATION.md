# Plan complet de finalisation de MandeMarket

Statut : plan d'exécution

Branche de référence : dev

Objectif : transformer la démo actuelle en marketplace exploitable en production, avec commandes, paiements, commissions, retraits, livraison, sécurité, tests et exploitation fiables.

Ce document peut être suivi :

- par un agent unique, dans l'ordre des phases ;
- par l'Agent Manager, qui délègue aux agents Backend, Frontend et Infra ;
- par plusieurs agents en parallèle uniquement lorsque les dépendances indiquées sont terminées.

---

## 1. Rôles

| Rôle | Responsabilité |
|---|---|
| Agent Manager | Priorise, délègue, valide les contrats, ne code pas |
| Agent Backend | Prisma, Express, sécurité serveur, logique métier et intégrations |
| Agent Frontend | Next.js, parcours utilisateur, formulaires, états et accessibilité |
| Agent Infra | Docker, CI/CD, secrets, observabilité, sauvegardes et déploiement |

Pour un agent unique, conserver le même ordre de responsabilité : Backend, puis Frontend, puis Infra, puis validation transverse.

---

## 2. Règles d'exécution obligatoires

1. Lire AGENTS.md et le skill correspondant avant chaque lot.
2. Ne jamais lancer un reset, un seed destructif ou une suppression de volume sur une base non éphémère.
3. Créer une sauvegarde vérifiée avant toute correction de migration.
4. Ne jamais faire confiance aux prix, totaux, rôles, statuts ou commissions reçus du navigateur.
5. Toute mutation financière ou de stock doit être atomique et idempotente.
6. Tout nouvel endpoint doit avoir validation, authentification, autorisation, tests et documentation.
7. Toute page doit gérer chargement, succès, absence de données et erreur réelle sans afficher de faux succès.
8. Aucun secret, compte de test ou jeu de données de démonstration ne doit être exposé en production.
9. Ne pas avancer à la phase suivante tant que les critères de sortie de la phase courante ne passent pas.
10. Chaque livraison doit indiquer les fichiers modifiés, migrations créées, commandes exécutées et risques restants.

---

## 3. Décisions d'architecture à figer avant le développement

L'Agent Manager doit faire valider ces règles, puis les consigner dans docs/architecture.

### 3.1 Monnaie

- Tous les montants restent des entiers en centimes.
- Le backend est l'unique source de vérité des prix et totaux.
- Formule de commande :
  - sous-total = somme des prix serveur multipliés par les quantités ;
  - réduction = calcul serveur de la promotion ;
  - livraison = tarif serveur correspondant à une option autorisée ;
  - taxe = règle serveur ;
  - total = sous-total + livraison + taxe - réduction.
- La devise et le taux de conversion utilisés sont enregistrés sur la commande.
- Aucun Float pour un montant financier.

### 3.2 Inventaire

- Inventory.quantity représente le stock physique.
- Inventory.reserved représente le stock réservé.
- Le disponible est calculé : quantity moins reserved.
- Product.stock est déprécié puis supprimé, ou maintenu uniquement comme projection contrôlée pendant la migration.
- La réservation utilise une mise à jour atomique avec condition disponible supérieur ou égal à la quantité demandée.
- Paiement réussi : décrémenter quantity et reserved.
- Paiement échoué, expiré ou commande annulée : libérer reserved.
- Paiement à la livraison : conserver la réservation jusqu'à confirmation logistique, puis convertir la réservation en sortie de stock.

### 3.3 Commande

- Une commande conserve des snapshots immuables :
  - nom, SKU, image, prix et option du produit ;
  - nom, email et téléphone du client ;
  - adresse complète de facturation et de livraison ;
  - taux de commission et gain vendeur ;
  - devise, taux de conversion et ventilation des totaux.
- Une commande invitée ne modifie jamais silencieusement le profil d'un client existant.
- Les transitions de statut sont centralisées et validées.

### 3.4 Paiement

- Le retour navigateur n'est jamais une preuve de paiement.
- Seul un webhook signé et vérifié auprès du prestataire peut confirmer un paiement en ligne.
- Chaque événement externe possède une clé unique et ne peut être appliqué qu'une fois.
- Montant, devise, référence, passerelle et orderId sont contrôlés avant mutation.
- Les actions paiement, commande, stock et écritures vendeur sont regroupées dans une transaction.

### 3.5 Revenus vendeur

- Ajouter un registre SellerLedgerEntry plutôt que de dépendre uniquement de compteurs cumulés.
- Types minimaux : SALE_PENDING, SALE_AVAILABLE, COMMISSION, REFUND, PAYOUT_RESERVED, PAYOUT_COMPLETED, PAYOUT_RELEASED, ADJUSTMENT.
- Une vente devient retirable après livraison et expiration de la fenêtre de retour.
- Une demande de retrait réserve immédiatement le solde dans une transaction.
- Les totaux Seller sont des projections recalculables depuis le registre.

### 3.6 Authentification

- Access token court et refresh token rotatif.
- Refresh tokens hachés et rattachés à une session révocable.
- Cookies HttpOnly, Secure et SameSite adaptés à l'architecture des sous-domaines.
- Protection CSRF pour les mutations authentifiées par cookie.
- Rôles vérifiés côté backend sur chaque endpoint sensible.
- Le frontend ne constitue jamais une barrière de sécurité.

---

## 4. Ordre global

| Phase | Résultat attendu | Dépend de |
|---|---|---|
| 0 | Référentiel sûr et qualité minimale | Rien |
| 1 | Base de données migrable sans perte | Phase 0 |
| 2 | Authentification et sécurité fiables | Phase 1 |
| 3 | Checkout, commande et stock fiables | Phases 1 et 2 |
| 4 | Paiements réellement vérifiés | Phase 3 |
| 5 | Commissions, ledger et retraits fiables | Phase 4 |
| 6 | Fonctions vendeur complètement branchées | Phases 3 à 5 |
| 7 | Administration et compte client complets | Phases 2 à 6 |
| 8 | Emails, livraison et contenus opérationnels | Phases 3 et 7 |
| 9 | Tests, observabilité et production | Toutes |
| 10 | Recette et mise en production | Phase 9 |

---

# Phase 0 — Sécuriser le chantier

## MM-MGR-001 — Établir le registre de travail

Agent : Manager

Actions :

- transformer chaque tâche de ce document en ticket ;
- ajouter priorité, propriétaire, dépendances et statut ;
- créer une matrice des endpoints et pages ;
- déclarer comme bloquants tous les éléments P0 de l'audit ;
- interdire les paiements live jusqu'à validation de la phase 4.

Critères d'acceptation :

- chaque tâche possède un propriétaire ;
- aucune tâche Frontend dépendant d'une API non définie ne démarre sans contrat ;
- le statut de la release est visible dans un seul document.

## MM-INF-001 — Sauvegarder l'état courant

Agent : Infra

Actions :

- exporter la base PostgreSQL courante ;
- enregistrer les versions Node, npm, Docker, PostgreSQL, Redis et Prisma ;
- exporter le résultat de docker compose config sans secrets ;
- documenter la procédure de restauration ;
- tester la restauration dans une base éphémère.

Critères d'acceptation :

- le dump se restaure ;
- les nombres d'enregistrements avant et après sont identiques ;
- aucun secret n'est ajouté à Git.

## MM-BE-001 — Neutraliser les scripts destructifs

Agent : Backend

Actions :

- renommer scripts/migrate.js en script explicitement réservé à la démonstration ;
- supprimer les commandes db:migrate et docker:migrate qui pointent vers ce script ;
- créer des commandes séparées pour migrate:deploy, seed:dev et reset:demo ;
- protéger reset:demo par une confirmation d'environnement non-production ;
- corriger les données seed incohérentes.

Critères d'acceptation :

- aucune commande contenant migrate ne supprime de données ;
- le seed est idempotent ;
- le seed refuse NODE_ENV=production ;
- les totaux des commandes seed correspondent à leurs lignes.

## MM-ALL-001 — Installer les garde-fous qualité

Agents : Backend, Frontend, Infra

Actions :

- ajouter les configurations ESLint frontend et backend ;
- ajouter les scripts build, lint, type-check et test manquants ;
- corriger le build racine ;
- installer une CI minimale sur chaque pull request ;
- empêcher le merge si build, lint ou tests échouent.

Critères d'acceptation :

- npm run build passe à la racine ;
- npm run lint passe ;
- npm run type-check passe ;
- npm test s'exécute sans erreur de configuration ;
- la CI exécute les mêmes commandes.

Sortie de phase 0 :

- sauvegarde restaurable ;
- scripts destructifs isolés ;
- pipeline qualité utilisable ;
- Git propre.

---

# Phase 1 — Refaire les migrations et consolider le modèle

## MM-BE-010 — Décider la stratégie de baseline

Agent : Backend

Étape de décision :

- s'il n'existe aucune base de production à conserver, remplacer l'historique cassé par une migration baseline complète ;
- s'il existe une base à conserver, produire un diff entre la base et schema.prisma, corriger les écarts, puis marquer la baseline comme appliquée uniquement après sauvegarde et validation.

Interdictions :

- ne jamais utiliser db push avec accept-data-loss en production ;
- ne jamais supprimer l'historique d'une base réelle sans plan de rapprochement.

## MM-BE-011 — Créer une migration initiale reproductible

Agent : Backend

Actions :

- générer une baseline depuis un schéma vide vers schema.prisma ;
- vérifier l'ordre de création des tables, index et clés étrangères ;
- ajouter les modèles nécessaires aux phases suivantes ;
- ajouter les index des recherches et tableaux de bord ;
- ajouter les contraintes d'unicité utiles, notamment SKU vendeur ;
- remplacer les statuts String structurants par des enums.

Modèles ou champs à prévoir :

- Customer.userId optionnel et unique ;
- Session et PasswordResetToken ;
- Order snapshots, currency et exchangeRate ;
- OrderItem snapshots et selectedVariant ;
- PaymentEvent et idempotencyKey ;
- PromotionRedemption ;
- SellerLedgerEntry ;
- AuditLog ;
- éventuellement ProductVariant ;
- préférences de notification ;
- messages ou tickets si le périmètre produit les exige.

## MM-BE-012 — Éliminer les données dupliquées

Agent : Backend

Actions :

- établir Inventory comme source de vérité du stock ;
- établir le ledger comme source de vérité des gains ;
- conserver temporairement les anciens compteurs uniquement comme projections ;
- écrire une migration de données contrôlée ;
- ajouter une commande de vérification des divergences.

## MM-INF-010 — Rendre le démarrage non destructif

Agent : Infra

Actions :

- retirer le fallback db push du docker-entrypoint ;
- faire échouer le conteneur si migrate deploy échoue ;
- idéalement exécuter les migrations dans un job de release distinct ;
- garantir la présence de Prisma CLI dans ce job sans dépendre du réseau au démarrage ;
- démarrer l'application seulement après réussite de la migration.

## MM-BE-013 — Tester les migrations

Agent : Backend

Tests obligatoires :

- base vide vers dernière version ;
- ancienne base restaurée vers dernière version ;
- deuxième exécution sans modification ;
- rollback documenté ou migration corrective testée ;
- aucune perte de commandes, paiements, clients ou produits.

Sortie de phase 1 :

- prisma migrate deploy passe sur base vide ;
- prisma migrate status ne signale aucun échec ;
- aucun db push de production ;
- schéma et base sans drift ;
- restauration testée.

---

# Phase 2 — Authentification, autorisation et sécurité

## MM-BE-020 — Centraliser la configuration

Agent : Backend

Actions :

- valider les variables d'environnement au démarrage ;
- supprimer tous les secrets JWT de fallback ;
- refuser le démarrage en production si un secret ou fournisseur obligatoire manque ;
- harmoniser les noms de variables ;
- séparer les configurations dev, test et production.

## MM-BE-021 — Implémenter les sessions sécurisées

Agent : Backend

Endpoints minimaux :

- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- POST /api/auth/logout-all
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/verify-email
- GET /api/auth/me
- GET et DELETE /api/auth/sessions

Critères :

- refresh rotationnel ;
- révocation et expiration ;
- mot de passe fort ;
- limitation par IP et compte ;
- réponses ne révélant pas l'existence d'un email ;
- tests de rôle et de session.

## MM-BE-022 — Corriger le RBAC

Agent : Backend

Actions :

- définir les rôles autorisés par endpoint ;
- réserver la création de comptes admin et manager à un endpoint admin ;
- empêcher /signup d'accepter un rôle ;
- vérifier qu'un vendeur ne manipule que sa boutique et ses lignes de commande ;
- journaliser les actions administratives sensibles.

## MM-FE-020 — Refaire les gardes d'interface

Agent : Frontend

Actions :

- refuser l'admin aux rôles autres que admin et manager ;
- ne jamais autoriser l'interface lors d'une erreur réseau ;
- supprimer les identifiants de test affichés ;
- intégrer refresh, expiration, logout et reprise de session ;
- afficher des erreurs explicites.

## MM-BE-023 — Sécuriser produits et médias

Agent : Backend

Actions :

- authentifier l'upload ;
- limiter type, taille, dimensions et fréquence ;
- isoler les dossiers Cloudinary par vendeur ;
- rendre les brouillons inaccessibles publiquement ;
- contrôler la propriété sur création, modification et suppression ;
- supprimer proprement les médias orphelins.

## MM-INF-020 — Secrets et image Docker

Agent : Infra

Actions :

- ajouter un .dockerignore au frontend et au backend ;
- exclure environnements, node_modules, builds, logs, uploads et dumps ;
- rechercher les secrets dans l'historique Git ;
- faire tourner tout secret exposé ;
- utiliser une version Node LTS supportée ;
- scanner les images et dépendances ;
- corriger toutes les vulnérabilités critiques et élevées exploitables.

Sortie de phase 2 :

- matrice RBAC testée ;
- aucun compte ou secret de test dans l'UI de production ;
- upload protégé ;
- sessions révocables ;
- aucune vulnérabilité critique connue.

---

# Phase 3 — Catalogue, checkout, commande et stock

## MM-BE-030 — Stabiliser le catalogue

Agent : Backend

Actions :

- valider pagination, filtres et tris avec listes blanches ;
- n'exposer publiquement que produits et vendeurs actifs ;
- implémenter variantes si elles sont conservées dans le produit final ;
- rendre SKU unique par vendeur ;
- calculer note et nombre d'avis depuis les avis approuvés ;
- ajouter les index nécessaires.

## MM-BE-031 — Créer un service de tarification

Agent : Backend

Responsabilités :

- récupérer les prix depuis la base ;
- valider quantité, stock, vendeur et produit ;
- calculer promotions, livraison, taxes et total ;
- produire une ventilation déterministe ;
- gérer la devise et l'arrondi ;
- être utilisé à la fois par l'aperçu et la création de commande.

Endpoint :

- POST /api/checkout/quote

Entrée autorisée :

- productId, quantity et variantId ;
- pays et code de l'option de livraison ;
- code promotionnel ;
- aucune valeur de prix calculée par le client.

## MM-BE-032 — Réécrire la création de commande

Agent : Backend

Endpoint :

- POST /api/orders/checkout

Actions atomiques :

- valider ou créer le client sans écraser un compte existant non authentifié ;
- recalculer le devis ;
- réserver le stock ;
- réserver l'utilisation de la promotion ;
- créer snapshots, commande, lignes, paiement et livraison ;
- enregistrer une clé d'idempotence ;
- renvoyer une référence publique opaque.

## MM-BE-033 — Implémenter les machines d'état

Agent : Backend

Transitions minimales :

- Order : PENDING vers CONFIRMED, PROCESSING, SHIPPED, DELIVERED ;
- Order : PENDING ou CONFIRMED vers CANCELLED selon règles ;
- Order : état éligible vers REFUNDED ;
- Payment : PENDING vers PROCESSING, COMPLETED ou FAILED ;
- Payment : COMPLETED vers REFUNDED ;
- Shipping : PENDING vers PROCESSING, SHIPPED, DELIVERED ou RETURNED.

Toute transition interdite retourne 409 et produit un AuditLog.

## MM-BE-034 — Annulation et expiration

Agent : Backend

Actions :

- expirer les commandes non payées ;
- libérer stock et promotion ;
- empêcher double libération ;
- gérer l'annulation client et admin ;
- rendre les traitements idempotents.

## MM-FE-030 — Brancher le checkout sur le devis serveur

Agent : Frontend

Actions :

- ne plus envoyer unitPrice ou totalAmount comme vérité ;
- charger les options de livraison depuis l'API ;
- afficher la ventilation renvoyée par quote ;
- invalider le devis lorsque panier, pays, livraison ou promotion change ;
- afficher les erreurs de stock produit par produit ;
- transmettre une clé d'idempotence.

## MM-FE-031 — Corriger confirmation et suivi

Agent : Frontend

Actions :

- ne jamais afficher payé avant confirmation ;
- distinguer attente, traitement, succès, échec et paiement différé ;
- utiliser une référence publique ou l'authentification appropriée ;
- vider le panier uniquement après création certaine de la commande ;
- permettre de reprendre un paiement interrompu.

Tests obligatoires :

- prix navigateur falsifié ;
- produit inactif ;
- vendeur suspendu ;
- stock insuffisant ;
- deux achats concurrents sur le dernier article ;
- même clé d'idempotence envoyée deux fois ;
- promotion invalide, expirée et épuisée ;
- checkout invité avec email d'un compte existant ;
- total enregistré égal à la ventilation.

Sortie de phase 3 :

- aucun total client n'est accepté ;
- aucune vente en surstock ;
- commandes et snapshots cohérents ;
- confirmation UI fidèle au statut réel.

---

# Phase 4 — Paiements

## MM-BE-040 — Créer une couche commune de paiement

Agent : Backend

Interface attendue :

- initializePayment ;
- verifyPayment ;
- parseAndVerifyWebhook ;
- refundPayment ;
- normalizeStatus.

Chaque prestataire doit produire un résultat interne commun avec référence, montant, devise, statut et données brutes filtrées.

## MM-BE-042 — Corriger Paystack

Agent : Backend

Actions :

- utiliser les codes opérateur officiellement supportés ;
- retirer Moov du parcours Paystack si non supporté pour le compte CIV ;
- choisir correctement entre Redirect et Charge API ;
- vérifier signature, référence, montant et devise ;
- vérifier la transaction côté Paystack avant règlement interne ;
- gérer `charge.success`, les échecs, les remboursements et les litiges de façon idempotente.

## MM-BE-043 — Corriger Stripe

Agent : Backend

Actions :

- vérifier la signature ;
- contrôler montant_total, currency et metadata ;
- traiter les événements de paiement asynchrone pour SEPA ;
- ne confirmer que lorsque payment_status est réellement payé ;
- traiter échec, expiration, remboursement et chargeback ;
- conserver les identifiants Stripe nécessaires.

## MM-BE-044 — Finaliser le paiement à la livraison

Agent : Backend

Actions :

- distinguer méthode et passerelle ;
- définir qui confirme la commande ;
- réserver puis convertir le stock au bon moment ;
- enregistrer l'encaissement ou l'échec ;
- empêcher qu'une page cancel transforme implicitement le mode de paiement.

## MM-FE-040 — Refaire les pages paiement

Agent : Frontend

Actions :

- afficher le statut serveur ;
- gérer redirection, attente, reprise et échec ;
- ne jamais déduire le succès de l'URL ;
- retirer les opérateurs non disponibles ;
- rendre les textes compatibles avec les paiements différés.

## MM-INF-040 — Configurer les environnements prestataires

Agent : Infra

Actions :

- créer des secrets sandbox puis live séparés ;
- déclarer les URLs de webhook publiques ;
- documenter la rotation des clés ;
- ajouter une alerte de webhook en échec ;
- ne passer en live qu'après recette sandbox signée.

Tests obligatoires par prestataire :

- succès ;
- refus ;
- abandon ;
- attente ;
- webhook invalide ;
- webhook dupliqué ;
- montant ou devise incorrect ;
- événement reçu avant retour navigateur ;
- événement reçu après expiration ;
- remboursement total.

Sortie de phase 4 :

- aucun faux paiement possible par simple POST ;
- états cohérents sous répétition et désordre ;
- sandbox validée pour chaque moyen affiché.

---

# Phase 5 — Marketplace, commissions et retraits

## MM-BE-050 — Implémenter le ledger vendeur

Agent : Backend

Actions :

- créer les écritures lors du paiement réussi ;
- rendre les gains disponibles après livraison et fenêtre de retour ;
- créer les écritures inverses lors des remboursements ;
- calculer pending, available, reserved et paid ;
- fournir une commande de reconstruction des projections.

## MM-BE-051 — Sécuriser les retraits

Agent : Backend

Actions :

- valider montant et méthode ;
- verrouiller ou sérialiser le calcul du solde ;
- réserver le montant à la création ;
- empêcher deux demandes dépassant le solde ;
- définir les transitions pending, processing, completed, failed et cancelled ;
- libérer la réserve en cas d'échec ;
- ajouter référence fournisseur et AuditLog.

## MM-BE-052 — APIs finances vendeur

Agent : Backend

Endpoints :

- GET /api/sellers/me/balance
- GET /api/sellers/me/ledger
- GET /api/sellers/me/payouts
- POST /api/sellers/me/payouts
- GET /api/admin/payouts
- POST /api/admin/payouts/:id/process
- POST /api/admin/payouts/:id/fail

## MM-FE-050 — Brancher paiements et revenus vendeur

Agent : Frontend

Actions :

- remplacer transactions et retraits fictifs ;
- afficher les quatre soldes ;
- expliquer les délais de disponibilité ;
- empêcher une demande supérieure au disponible ;
- afficher historique, statut et référence ;
- ajouter export CSV côté serveur.

Tests :

- deux retraits concurrents ;
- remboursement après crédit ;
- échec prestataire de payout ;
- recalcul ledger égal aux projections ;
- vendeur interdit d'accès au ledger d'un autre.

Sortie de phase 5 :

- chaque franc affiché est traçable par une écriture ;
- aucun double retrait ;
- commissions et remboursements réconciliables.

---

# Phase 6 — Terminer l'espace vendeur

Traiter chaque écran contenant notifySoon. Une action non prévue doit être retirée de l'interface, pas laissée en faux bouton.

## MM-BE-060 — Produits vendeur complets

Agent : Backend

Fonctions :

- créer, modifier, archiver, dupliquer ;
- activation et désactivation ;
- variantes et stock ;
- galerie d'images ;
- import/export contrôlé ;
- actions en masse ;
- statistiques produit.

## MM-FE-060 — UI produits vendeur

Agent : Frontend

Actions :

- créer une vraie page de modification ;
- brancher toutes les actions ;
- afficher validations et erreurs API ;
- gérer galerie, variantes, stock et brouillon ;
- confirmer les suppressions ou archivages.

## MM-BE-061 — Commandes vendeur

Agent : Backend

Fonctions :

- ne retourner que les lignes appartenant au vendeur ;
- actions autorisées sur préparation et expédition ;
- documents de préparation ;
- historique des transitions ;
- gestion des retours concernant ses articles.

## MM-BE-062 — Avis, communication et support

Agent : Backend

Fonctions :

- réponse vendeur aux avis ;
- modération ;
- tickets ou conversations ;
- notifications liées aux commandes ;
- pagination et contrôle d'accès.

## MM-BE-063 — Marketing vendeur

Agent : Backend

Décision produit :

- soit créer des promotions limitées à un vendeur avec règles et budget ;
- soit retirer ces écrans si seules les promotions plateforme sont autorisées.

Dans les deux cas, supprimer le stockage local de coupons.

## MM-BE-064 — Équipe et permissions

Agent : Backend

Fonctions :

- membres de boutique ;
- invitations ;
- rôles propriétaire, manager, catalogue, commandes et finance ;
- contrôle de permissions côté API ;
- journal d'audit.

## MM-FE-061 — Finir tous les modules vendeur

Agent : Frontend

Modules :

- tableau de bord ;
- produits ;
- commandes ;
- finances ;
- statistiques ;
- marketing ;
- avis et communication ;
- équipe ;
- apparence boutique ;
- paramètres, sécurité et notifications.

Critère :

- zéro appel notifySoon dans un parcours livré ;
- zéro transaction, message, avis, campagne ou retrait codé en dur ;
- chaque CTA visible réalise une action réelle.

Sortie de phase 6 :

- le vendeur peut gérer une boutique de bout en bout sans intervention en base ;
- les données affichées proviennent toutes de l'API.

---

# Phase 7 — Administration et compte client

## MM-BE-070 — Gestion des utilisateurs

Agent : Backend

Endpoints admin :

- lister, rechercher et paginer ;
- créer un utilisateur privilégié ;
- modifier rôle et statut selon règles ;
- suspendre et réactiver ;
- révoquer les sessions ;
- consulter l'historique d'audit.

## MM-FE-070 — Remplacer UsersManager fictif

Agent : Frontend

Actions :

- charger les utilisateurs réels ;
- brancher création, rôle, suspension et révocation ;
- retirer SYSTEM_ACCOUNTS ;
- gérer pagination, erreurs et confirmation.

## MM-BE-071 — Avis fiables

Agent : Backend

Actions :

- lier un avis à customerId et éventuellement orderItemId ;
- calculer isVerified côté serveur ;
- limiter un avis par ligne achetée ;
- mettre les avis en attente selon politique ;
- empêcher le spam helpful ;
- recalculer les notes produit et vendeur.

## MM-BE-072 — Retours et remboursements

Agent : Backend

Fonctions :

- éligibilité selon date et état ;
- création client ;
- revue vendeur et admin ;
- réception du retour ;
- remboursement ;
- stock retourné ;
- inversion du ledger ;
- notifications et historique.

## MM-BE-073 — Compte client

Agent : Backend

Fonctions :

- profil ;
- plusieurs adresses ;
- changement de mot de passe ;
- préférences ;
- favoris persistants ;
- historique et détail de commande ;
- annulation éligible ;
- suppression ou anonymisation du compte.

## MM-FE-071 — Finaliser l'espace client

Agent : Frontend

Actions :

- brancher profil, adresses, sécurité et favoris ;
- afficher commandes et retours ;
- permettre annulation ou retour selon règles ;
- gérer session expirée et réauthentification.

## MM-FE-072 — Administration opérationnelle

Agent : Frontend

Actions :

- supprimer les fausses alertes ;
- brancher avis, retours, promotions, vendeurs, payouts et utilisateurs ;
- afficher les erreurs de réconciliation ;
- ajouter confirmations aux actions irréversibles ;
- afficher l'AuditLog pour les actions sensibles.

Sortie de phase 7 :

- aucun gestionnaire admin fictif ;
- client autonome sur son profil, ses commandes et ses retours ;
- avis vérifiés et modérés.

---

# Phase 8 — Services externes et contenus

## MM-BE-080 — Emails fiables

Agent : Backend

Actions :

- configurer SMTP ou fournisseur transactionnel ;
- supprimer rejectUnauthorized false ;
- échapper les valeurs dans les templates ;
- créer une file de tâches avec retry ;
- stocker statut et erreur d'envoi ;
- ajouter emails de vérification, réinitialisation, commande, paiement, expédition, retour et payout.

## MM-FE-080 — États email honnêtes

Agent : Frontend

Actions :

- n'afficher email envoyé qu'après acceptation du service ;
- permettre le renvoi ;
- afficher une alternative si le service est indisponible.

## MM-BE-081 — Livraison réelle

Agent : Backend

Actions :

- valider les options côté serveur ;
- intégrer réellement la création d'étiquette ;
- enregistrer coût, transporteur, service, tracking et document ;
- traiter les erreurs et retries ;
- synchroniser le suivi ;
- conserver un mode manuel explicite pour les transporteurs locaux.

## MM-FE-081 — Livraison

Agent : Frontend

Actions :

- afficher uniquement les options retournées par l'API ;
- présenter délais et tarifs réels ;
- permettre le suivi ;
- exposer l'étiquette et les actions autorisées aux vendeurs/admins.

## MM-BE-082 — Contact et newsletter

Agent : Backend

Actions :

- endpoints validés et limités ;
- anti-spam ;
- stockage ou routage vers le support ;
- consentement et désinscription newsletter ;
- statut d'envoi observable.

## MM-FE-082 — Contenus publics

Agent : Frontend

Actions :

- brancher contact et newsletter ;
- décider si blog et bons plans sont gérés par CMS/API ou statiques ;
- harmoniser MandeMarket et MandinMarket ;
- supprimer coordonnées fictives ;
- vérifier pages légales, SEO, sitemap et métadonnées.

Sortie de phase 8 :

- aucun service externe simulé dans un parcours annoncé comme réel ;
- erreurs externes visibles et rejouables ;
- contact et notifications fonctionnels.

---

# Phase 9 — Qualité, performance et exploitation

## MM-QA-090 — Tests backend

Agent : Backend

Couverture minimale :

- services de prix et promotions ;
- transitions d'état ;
- stock ;
- authentification et rôles ;
- webhooks ;
- ledger et payouts ;
- retours ;
- validation des entrées.

Cible :

- au moins 80 pour cent de couverture sur les services critiques ;
- 100 pour cent des transitions financières et de stock couvertes.

## MM-QA-091 — Tests frontend

Agent : Frontend

Couverture :

- contextes auth, panier et région ;
- erreurs API ;
- checkout ;
- confirmation paiement ;
- gardes admin et vendeur ;
- formulaires critiques.

## MM-QA-092 — E2E

Agents : Frontend et Backend

Scénarios :

- inscription et connexion client ;
- inscription puis approbation vendeur ;
- création produit ;
- achat invité et authentifié ;
- paiement sandbox par chaque méthode affichée ;
- préparation et expédition ;
- retour et remboursement ;
- commission puis retrait ;
- suspension d'un vendeur ;
- contrôle des accès croisés.

## MM-INF-090 — Redis utile ou supprimé

Agent : Infra avec Backend

Choix :

- utiliser Redis pour rate limiting distribué, files de tâches, verrous et éventuellement sessions ;
- ou supprimer Redis du déploiement si aucune fonction ne le justifie.

Le service ne doit pas rester déployé sans usage.

## MM-INF-091 — Observabilité

Agent : Infra

Actions :

- logs JSON avec requestId, userId filtré, orderId et paymentId ;
- collecte centralisée ;
- suivi des exceptions ;
- métriques HTTP, base, files, paiements et webhooks ;
- alertes sur erreurs, latence, migration, paiement et sauvegarde ;
- tableau de bord opérationnel ;
- politique de rétention sans données sensibles.

## MM-INF-092 — Healthchecks

Agent : Infra avec Backend

Endpoints :

- liveness : processus uniquement ;
- readiness : PostgreSQL, Redis et dépendances indispensables ;
- statut séparé des fournisseurs externes sans exposer de secret.

## MM-INF-093 — Sauvegardes et reprise

Agent : Infra

Actions :

- sauvegardes PostgreSQL automatiques ;
- chiffrement et stockage externe ;
- politique de rétention ;
- restauration périodiquement testée ;
- objectifs RPO et RTO documentés ;
- procédure d'incident.

## MM-INF-094 — CI/CD

Agent : Infra

Pipeline :

1. installation reproductible ;
2. lint ;
3. type-check ;
4. tests unitaires et intégration avec PostgreSQL et Redis ;
5. migration sur base éphémère ;
6. build frontend et image backend ;
7. scan dépendances, secrets et images ;
8. tests E2E sur environnement de recette ;
9. migration de release ;
10. déploiement progressif ;
11. smoke tests ;
12. rollback automatique si échec.

## MM-QA-093 — Non-fonctionnel

Agents : Frontend, Backend, Infra

Vérifications :

- accessibilité clavier et lecteur d'écran ;
- responsive mobile ;
- performance Core Web Vitals ;
- charge et concurrence ;
- sécurité OWASP ;
- limitation des abus ;
- SEO ;
- politique de confidentialité, consentement, conservation et suppression ;
- compatibilité navigateurs supportés.

Sortie de phase 9 :

- CI verte ;
- zéro vulnérabilité critique ;
- aucune vulnérabilité élevée non acceptée et documentée ;
- sauvegarde restaurée ;
- alertes testées ;
- E2E critiques verts.

---

# Phase 10 — Recette et mise en production

## MM-MGR-100 — Recette fonctionnelle

Agent : Manager

La recette doit utiliser une matrice Afrique et Europe comprenant :

- invité, client, vendeur, manager et admin ;
- mobile et desktop ;
- paiement réussi, refusé, différé et remboursé ;
- commande mono-vendeur et multi-vendeur ;
- stock limite ;
- promotion ;
- livraison locale et Europe ;
- retour ;
- commission et payout.

## MM-INF-100 — Répétition générale

Agent : Infra

Actions :

- restaurer une copie anonymisée dans l'environnement de recette ;
- exécuter migrate deploy ;
- lancer tous les smoke tests ;
- vérifier DNS, TLS, CORS, webhooks et emails ;
- vérifier les volumes externes et le réseau Traefik ;
- tester rollback applicatif et restauration base.

## MM-MGR-101 — Go ou No-Go

Agent : Manager

Go uniquement si :

- aucun P0 ou P1 ouvert ;
- tous les critères de sortie précédents sont prouvés ;
- clés live stockées dans le gestionnaire de secrets ;
- comptes et données de test absents ;
- monitoring et astreinte définis ;
- sauvegarde récente disponible ;
- plan de rollback validé ;
- responsables métier valident prix, commissions, retours et conditions de vente.

## MM-INF-101 — Mise en production

Agent : Infra

Ordre :

1. sauvegarde ;
2. migration de release ;
3. backend ;
4. workers ;
5. frontend ;
6. smoke tests ;
7. activation progressive des paiements ;
8. surveillance renforcée ;
9. validation métier.

## MM-MGR-102 — Suivi post-release

Agent : Manager

Pendant la période de surveillance :

- suivre erreurs, paiements, commandes, webhooks, emails et stocks ;
- rapprocher commandes, encaissements et ledger ;
- vérifier les premières livraisons et demandes de retrait ;
- documenter tout incident ;
- clôturer la release uniquement après réconciliation.

---

## 5. Contrats API à documenter

Chaque endpoint doit préciser :

- méthode et URL ;
- rôle ou accès public ;
- schéma d'entrée ;
- schéma de réponse ;
- statuts HTTP ;
- règles métier ;
- idempotence ;
- pagination ;
- erreurs ;
- événements ou effets secondaires.

Groupes obligatoires :

- auth et sessions ;
- catalogue et médias ;
- devis et checkout ;
- commandes et transitions ;
- paiements et webhooks ;
- livraison ;
- promotions ;
- vendeurs et produits ;
- ledger et payouts ;
- avis ;
- retours ;
- clients et favoris ;
- utilisateurs admin ;
- notifications, contact et newsletter.

Le frontend doit consommer un client typé généré ou des types partagés afin d'éviter les divergences.

---

## 6. Matrice de tests minimale

| Domaine | Unitaires | Intégration | E2E | Concurrence |
|---|---:|---:|---:|---:|
| Auth et rôles | Oui | Oui | Oui | Sessions |
| Tarification | Oui | Oui | Oui | Promotions |
| Stock | Oui | Oui | Oui | Obligatoire |
| Commandes | Oui | Oui | Oui | Idempotence |
| Paiements | Oui | Oui | Oui | Webhooks |
| Ledger | Oui | Oui | Oui | Obligatoire |
| Payouts | Oui | Oui | Oui | Obligatoire |
| Retours | Oui | Oui | Oui | Double remboursement |
| Livraison | Oui | Oui | Oui | Retry |
| Emails | Oui | Oui | Parcours | Retry |

---

## 7. Définition de terminé pour une tâche

Une tâche n'est terminée que si :

- le comportement demandé est implémenté ;
- les données et migrations sont compatibles ;
- les permissions sont vérifiées côté serveur ;
- les entrées sont validées ;
- les erreurs sont gérées sans faux succès ;
- les tests appropriés sont ajoutés et passent ;
- lint, type-check et build passent ;
- la documentation est à jour ;
- aucun secret ou log sensible n'est introduit ;
- les dépendances en aval ont été informées ;
- l'Agent Manager a validé les critères d'acceptation.

---

## 8. Définition globale de MandeMarket terminé

Le projet est considéré complet lorsque :

1. Une installation neuve fonctionne uniquement avec migrate deploy.
2. Une mise à jour d'une base existante conserve toutes les données.
3. Tous les prix, stocks, réductions et commissions sont calculés côté serveur.
4. Les paiements ne peuvent être confirmés que par vérification authentique.
5. Les événements dupliqués ou désordonnés n'altèrent pas les comptes.
6. Les stocks ne peuvent pas devenir négatifs sous concurrence.
7. Les revenus et retraits vendeurs sont réconciliables par ledger.
8. Chaque bouton visible des espaces client, vendeur et admin fonctionne réellement.
9. Aucun fallback de démonstration ne masque une panne en production.
10. Email, livraison, contact, retours et remboursements fonctionnent.
11. Tous les rôles et accès croisés sont testés.
12. Build, lint, types, tests, migrations, scans et E2E passent en CI.
13. Les sauvegardes, restaurations, alertes et rollbacks ont été testés.
14. Aucun secret ou identifiant de test n'est livré.
15. La documentation d'exploitation permet à une autre personne de déployer et diagnostiquer la plateforme.

---

## 9. Format de mission à donner à un agent

Copier ce modèle pour chaque tâche :

> Tu es l'Agent [Backend, Frontend ou Infra] de MandeMarket.
>
> Exécute uniquement la tâche [ID et titre] du PLAN_FINALISATION.md.
>
> Lis AGENTS.md et ton SKILL.md avant toute action.
>
> Respecte les décisions d'architecture et les dépendances de la tâche.
>
> Commence par inspecter les fichiers concernés et l'état Git. Préserve les modifications utilisateur.
>
> Implémente le livrable complet, ajoute les tests, puis exécute les commandes de validation pertinentes.
>
> Ne lance aucune opération destructive sur une base non éphémère.
>
> À la fin, rends : résumé, fichiers modifiés, migrations, tests exécutés, résultats, risques et tâches débloquées.

---

## 10. Première séquence à lancer

L'Agent Manager doit lancer dans cet ordre :

1. MM-INF-001 — sauvegarde et restauration ;
2. MM-BE-001 — neutralisation des scripts destructifs ;
3. MM-ALL-001 — garde-fous qualité ;
4. MM-BE-010 à MM-BE-013 — baseline et migrations ;
5. MM-INF-010 — démarrage non destructif ;
6. revue de sortie de phase 1 ;
7. seulement ensuite, démarrage de la phase 2.

Les phases 3 à 5 constituent le chemin critique métier. Les modules vendeur, admin et contenus ne doivent pas détourner l'effort de ce chemin tant que commande, paiement, stock et ledger ne sont pas fiables.
