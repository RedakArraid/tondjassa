## Objet

Décrire le changement et le risque utilisateur/financier éventuel.

## Vérifications

- [ ] Lint, types, tests unitaires, build et audit runtime
- [ ] Tests PostgreSQL de concurrence/sécurité et migrations répétables
- [ ] Images Docker de production + démarrage + backup/restauration
- [ ] Recette navigateur isolée quand le changement touche un parcours utilisateur
- [ ] Aucun secret, donnée client ou jeton réel dans les fixtures/logs
- [ ] Migration additive/rollback opérationnel documentés si le schéma change
- [ ] Impacts comptes/paiements/stock/ledger explicitement revus
- [ ] Limitations connues documentées sans faux succès

## Avant production

La fusion ne constitue pas un déploiement. La recette hébergée (DNS/TLS/proxy),
SMTP externe, PSP sandbox, sauvegarde hors serveur et supervision restent des gates
séparés lorsqu’ils sont concernés.
