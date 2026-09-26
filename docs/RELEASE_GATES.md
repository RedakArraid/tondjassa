# Release gates

Le dépôt produit une preuve de candidat de release uniquement après succès des
quatre gates techniques du workflow CI :

1. `Repository secret scan` (historique Git complet, Gitleaks versionné) ;
2. `Lint, types, unit tests, build and runtime audit` (dont `npm audit`) ;
3. `PostgreSQL concurrency and security regressions` ;
4. `Production Docker images` (dont scan Trivy des images backend/frontend).

Le job `Release candidate evidence` dépend explicitement de ces quatre jobs. Son
artefact contient le SHA exact, le run GitHub, les versions et des SHA-256 des
lockfiles, du schéma Prisma, des Dockerfiles et du Compose production. Cet artefact
n'est pas une autorisation de déployer et ne contient aucun secret.

La recette `HTTPS browser journeys and SMTP delivery` est un gate distinct pour
les parcours utilisateur. Elle exécute les images de production dans un environnement
isolé, puis un petit smoke HTTP concurrent. Le smoke détecte les erreurs de connexion
ou 5xx sous quelques lectures parallèles ; il ne mesure pas la capacité de production
et n'impose pas de SLA de latence.

## Protection de main

La branche `main` doit être protégée dans les paramètres GitHub avec pull request
obligatoire et checks requis. Au minimum, exiger les cinq checks CI (les quatre
gates techniques et `Release candidate evidence`) ci-dessus et,
pour les changements applicatifs, la recette navigateur. Interdire les pushes directs
et les force-pushes.

Cette protection est un paramètre GitHub du dépôt : un fichier versionné ne peut pas
l'activer à lui seul. Vérifier la règle dans GitHub après chaque changement
d'administration.

## Gates externes avant ouverture clients

- DNS et certificat TLS publics ;
- chaîne réelle Traefik et `TRUST_PROXY` ;
- délivrabilité SMTP sur le domaine réel ;
- PSP contractés en sandbox : succès, échec, pending, doublons, remboursements ;
- Cloudinary réel si uploads activés ;
- sauvegarde chiffrée hors serveur, rétention, alerte et exercice de restauration ;
- alertes worker/paiement/refund et supervision ;
- pays, livraison, fiscalité, retours et mentions légales acceptés.

Ne pas activer de paiement réel pour remplacer un test sandbox.
