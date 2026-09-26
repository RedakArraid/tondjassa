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
