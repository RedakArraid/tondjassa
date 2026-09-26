# Recette navigateur avant production

## Environnement automatise, sans argent reel

Le workflow `Browser acceptance (isolated preproduction)` execute la recette sur
les images Docker de production dans un environnement GitHub Actions temporaire.
Il ne deploie pas sur un VPS et ne publie aucun site accessible aux clients.
Il ne fusionne pas la PR. Les ports sont lies uniquement a 127.0.0.1.

La pile comprend PostgreSQL, Redis, backend, worker, frontend, proxy HTTPS et
Mailpit. Les emails sont effectivement transmis en SMTP avec authentification
et STARTTLS, puis lus via Mailpit. Aucun message n'est relaye vers une boite reelle.
La CA est ephemere et approuvee explicitement par Node pour SMTP. Le navigateur
accepte le certificat de test : ce test ne valide pas une chaine TLS publique.

Les cles de paiement sont vides. Les donnees sont fictives et le script de fixtures
refuse une base non vide ou dont le nom/hote ne correspond pas a la base ephemere.
Ne jamais reutiliser cette configuration ni ses identifiants pour la production.

## Parcours executes

- Inscription dans le navigateur, refus de connexion avant verification, lecture
  du lien effectivement recu par SMTP, choix du mot de passe et connexion.
- Cookie de renouvellement Secure/HttpOnly/SameSite, renouvellement apres un jeton
  inutilisable, deconnexion et refus de reutilisation du jeton revoque.
- Mot de passe oublie, reception du lien de recuperation, nouveau mot de passe,
  refus de l'ancien et nouvelle connexion.
- Ajout panier et commande invitee en affichage mobile, option Express, egalite
  entre montant du devis et commande enregistree, acces par lien email dedie.
- Changement vers un pays non active : ancien devis efface et confirmation bloquee.
- Reference inaccessible : aucun faux succes ni donnee client ne sont affiches.
- Connexions administrateur/vendeur et refus d'une route admin au vendeur.
- Catalogue, panier et persistance apres rechargement avec WebKit.

Les captures, traces et `result.json` sont conserves sept jours dans les artefacts
du workflow. Le JSON porte le SHA candidat, le SHA effectivement teste et le resultat.
Un workflow vert ne vaut que pour les parcours effectivement executes sur ce SHA.
Une trace peut contenir des jetons de test : elle est reservee a la recette isolee.

## Conditions de mise en ligne sur le serveur cible

Avant toute fusion/deploiement, identifier explicitement le serveur de preproduction,
les domaines, l'acces autorise et des bases/volumes distincts de la production.
Ne pas choisir un nouveau service payant et ne pas reutiliser les volumes de production.

La validation hebergeur reste distincte : routage, certificat public, adresses IP
vues derriere Traefik, delivrabilite SMTP reelle, comptes administrateur et vendeur,
et scenarios sandbox contractuels Stripe/Paystack/CinetPay doivent etre verifies.
Aucune transaction reelle ne doit etre creee pour cette recette.

Conserver les limitations du runbook : remboursements CinetPay/hors ligne avec
attestation d'une operation externe reelle, suivi transporteur manuel, rapprochement
des donnees historiques, sauvegarde chiffree hors serveur et alertes a valider.
La PR reste en brouillon tant que ces conditions ne sont pas satisfaites.


## Renforcement complémentaire

La recette vérifie aussi les en-têtes de sécurité du frontend (CSP, anti-framing,
HSTS sur HTTPS et nosniff), le refus d'accès anonyme aux métriques internes, puis
l'accès avec un jeton de monitoring éphémère. Les métriques sont volontairement
à faible cardinalité : méthode, classe de statut, durée, requêtes en vol et métriques
processus ; aucun email, identifiant de commande ou chemin dynamique n'est utilisé
comme label.

Le parcours vendeur couvre désormais la duplication d'un produit et la mise à jour
du stock, puis vérifie la projection serveur. Le parcours administrateur vérifie la
visibilité de la boutique et l'accès au journal d'audit. Une panne API ne déclenche
plus l'affichage de faux produits ou de catégories de démonstration côté frontend.


## Cohérence des fonctions vendeur

Les codes promo vendeur sont maintenant liés à leur boutique, ne réduisent que ses
articles et recalculent commission/revenu sur le montant remisé. Les promotions
globales restent administratives. L'interface vendeur n'expose que pourcentage et
montant fixe, les deux modes réellement supportés avec cette comptabilité.

La messagerie vendeur transmet réellement l'email via le SMTP configuré et refuse
une adresse qui n'appartient pas à un acheteur de la boutique. Les invitations de
collaborateurs sont explicitement indisponibles tant qu'un vrai modèle de membres
et permissions n'existe pas : aucun faux email d'invitation n'est annoncé.


## Avis vérifiés

Un avis public non authentifié peut être soumis à modération, mais l'email déclaré
ne suffit jamais à obtenir le badge « Achat vérifié ». Pour ce badge, l'API utilise
le `customerId` de la session client, remplace le nom/email du formulaire par
l'identité du compte, puis vérifie une commande de ce même client en état SHIPPED
ou DELIVERED. Une contrainte unique empêche un même compte client de publier deux
avis sur le même produit. La réponse vendeur est stockée séparément du commentaire
original afin de préserver l'intégrité du contenu client.


## Cohérence support, vendeurs et newsletter

La recette couvre maintenant l'inscription vendeur complète : email réellement reçu,
choix du mot de passe après preuve de possession, refus des API vendeur tant que la
boutique est en attente, approbation administrateur, email d'approbation et accès au
dashboard après validation.

Le formulaire de contact n'annonce plus un succès si SMTP échoue. Son audit ne
conserve plus le corps du message, le téléphone ou l'adresse email en clair.
La newsletter est persistée dans PostgreSQL avec état actif/désinscrit et la route
utilisée par le frontend est testée. Les tickets support vendeur sont enregistrés
durablement dans le journal d'audit et réellement annoncés au support par SMTP ;
un échec de livraison est exposé comme tel au vendeur.

Les notifications de traitement des versements vendeur utilisent désormais la
fonction email réellement exportée, au lieu d'un appel vers un nom inexistant.


## Visibilité catalogue, RBAC et retours

Les brouillons et archives produits ne sont plus énumérables via le catalogue
public, même avec un paramètre `status`. Un produit privé renvoie 404 par ID au
public ; seul son vendeur approuvé ou un compte de gestion peut le consulter.
Les produits d'une catégorie inactive ou d'une boutique suspendue sont également
exclus du catalogue et des listes de souhaits publiques.

La taxonomie publique masque les catégories inactives. Les mutations admin refusent
les cycles indirects et une catégorie active ne peut pas dépendre d'une catégorie
inactive. L'admin ne peut plus fabriquer artificiellement un compte client/vendeur
sans le profil métier associé : ces rôles passent par leurs parcours d'inscription.

Un changement de rôle révoque immédiatement toutes les sessions existantes. Les
managers peuvent consulter les comptes mais la création de comptes de gestion, le
changement de rôle et la révocation de sessions restent réservés à l'administrateur.

La recette couvre un retour intégral fictif de bout en bout : commande livrée et
payée, demande client, approbation, refus d'une transition contradictoire, création
du remboursement manuel à attester, confirmation exacte montant/devise/référence,
répétition idempotente, remise en stock, statut REFUNDED et inversion des projections
financières vendeur/client. Aucun PSP réel n'est appelé.

Le même workflow exécute aussi `e2e/http_concurrency_smoke.py` : 90 lectures
concurrentes modestes sur frontend, catalogue et readiness. Ce smoke détecte les
5xx et erreurs de connexion évidents ; ce n'est ni un benchmark de capacité ni
un engagement de latence.
