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
