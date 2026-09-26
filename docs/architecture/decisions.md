# Décisions d'Architecture MandeMarket

Ce document consigne les règles d'architecture fondamentales et non négociables de MandeMarket, conformément à la section 3 de `PLAN_FINALISATION.md`.

---

## 1. Monnaie et Calculs Financiers

- **Entiers en centimes** : Tous les montants sans exception sont stockés sous forme d'entiers (`Int`) représentant des centimes en base de données.
- **Source unique de vérité** : Le backend est l'unique autorité de calcul des prix et des totaux. Aucune valeur monétaire reçue du frontend n'est considérée comme digne de confiance.
- **Formule stricte du total de commande** :
  - $\text{sous-total} = \sum (\text{prix\_serveur} \times \text{quantité})$
  - $\text{réduction} = \text{calcul\_serveur}(\text{code\_promo}, \text{sous-total})$
  - $\text{livraison} = \text{tarif\_serveur}(\text{option\_livraison}, \text{destination})$
  - $\text{taxe} = \text{règle\_serveur}(\text{sous-total})$
  - $\text{total} = \text{sous-total} + \text{livraison} + \text{taxe} - \text{réduction}$
- **Traçabilité de devise** : La devise de facturation (ex. `XOF`) et le taux de conversion appliqué sont enregistrés de façon immuable sur la commande.
- **Interdiction formelle des Float** : Aucun type `Float` ne doit être utilisé pour des montants financiers.

---

## 2. Inventaire et Réservation de Stock

- **Modèle de données** :
  - `Inventory.quantity` : stock physique réel en magasin/entrepôt.
  - `Inventory.reserved` : stock alloué à des commandes en cours de finalisation/paiement.
  - $\text{Stock disponible} = \text{quantity} - \text{reserved}$.
- **Dépréciation de Product.stock** : `Product.stock` est déprécié au profit d'`Inventory`, ou synchronisé via une projection contrôlée.
- **Réservation atomique** :
  - La réservation est opérée via une mise à jour atomique conditionnelle : `quantity - reserved >= quantité_demandée`.
- **Cycle de vie du stock** :
  - **Paiement réussi** : Décrémentation atomique conjointe de `quantity` et `reserved`.
  - **Paiement échoué / Annulation / Expiration panier** : Libération atomique de `reserved`.
  - **Paiement à la livraison (COD)** : Maintien de la réservation jusqu'à la confirmation logistique de réception et encaissement.

---

## 3. Immuabilité et Snapshots de Commande

- **Snapshots obligatoires** : Toute commande conserve à sa création un instantané immuable (`JSON`) de :
  - Données produit : nom, SKU, image principale, options/variantes choisies, prix unitaire au moment de l'achat.
  - Coordonnées client : nom complet, email, téléphone au moment de la commande.
  - Adresses : adresse complète de facturation et de livraison.
  - Données financières vendeur : taux de commission plateforme appliqué, gain net vendeur calculé.
  - Ventilation financière complète : sous-total, frais de port, remise promo, taxe, devise, taux de change.
- **Isolation des comptes clients** : Une commande passée en mode invité ne doit jamais altérer ou écraser silencieusement un profil client existant sans authentification préalable.
- **Transitions d'état strictes** : Toute mutation de statut de commande est validée par une machine d'états formelle et consignée dans `AuditLog`.

---

## 4. Intégrité des Paiements

- **Inviolabilité** : Une notification ou redirection navigateur n'est JAMAIS une preuve de paiement.
- **Validation serveur obligatoire** : Seul un webhook cryptographiquement signé et/ou vérifié directement par appel API serveur-à-serveur auprès du PSP (Paystack en Côte d'Ivoire, Stripe en Europe) peut confirmer un paiement en ligne.
- **Idempotence** : Chaque événement de paiement (`PaymentEvent`) possède une clé d'idempotence unique pour interdire formellement les doubles crédits ou doubles validations sous concurrence.
- **Atomicité transactionnelle** : La confirmation de paiement, la mise à jour de la commande, la sortie d'inventaire et la génération des écritures comptables vendeur sont exécutées au sein d'une seule et même transaction PostgreSQL (`$transaction`).

---

## 5. Revenus et Ledger Vendeur

- **Registre comptable en partie double (`SellerLedgerEntry`)** : Les gains et retraits vendeurs ne reposent pas sur de simples compteurs incrémentés, mais sur un registre d'écritures immuables.
- **Types d'écritures** :
  - `SALE_PENDING` : vente confirmée mais fonds en attente de livraison.
  - `SALE_AVAILABLE` : fonds devenus retirables après livraison et fin de période de rétractation.
  - `COMMISSION` : prélèvement de la commission marketplace.
  - `REFUND` : reprise de fonds sur retour/remboursement.
  - `PAYOUT_RESERVED` : blocage du solde lors d'une demande de virement.
  - `PAYOUT_COMPLETED` : déduction définitive suite au virement réussi.
  - `PAYOUT_RELEASED` : restitution de la réserve en cas de rejet/échec du virement.
  - `ADJUSTMENT` : régularisation manuelle ou administrative.
- **Protection contre le double retrait** : Toute demande de virement (`payout`) réserve instantanément le solde au sein d'une transaction verrouillée (`SELECT FOR UPDATE`).

---

## 6. Authentification, Sessions et RBAC

- **Gestion des sessions** :
  - Access tokens JWT à durée de vie courte.
  - Refresh tokens rotatifs hachés en base, associés à une `Session` révocable (appareil, IP, date d'expiration).
  - Cookies `HttpOnly`, `Secure` et `SameSite=Lax/Strict`.
- **Protection CSRF** : Requis sur toutes les mutations d'API authentifiées par cookie.
- **Contrôle d'accès RBAC au niveau de chaque route** :
  - Chaque endpoint backend valide explicitement les rôles autorisés (`admin`, `manager`, `seller`, `customer`).
  - L'interface frontend n'est qu'une couche de présentation et ne constitue en aucun cas une barrière de sécurité.
- **Isolation vendeur** : Un vendeur ne peut accéder qu'à sa propre boutique, ses produits et ses lignes de commande (`sellerId`).
