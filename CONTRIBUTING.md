# Contribuer à CLAIR

Merci de ton intérêt pour CLAIR ! Ce projet est open source et les contributions sont les bienvenues.

**Le guide complet est dans la documentation : [docs.clair.vote, Contribution & Normes](https://docs.clair.vote/guide/guide-developpeur/contribution).** Installation locale, conventions, vérifications avant une pull request, migrations de base et contrôles de la donnée y sont tenus à jour. Ce fichier n'en garde que l'essentiel.

## Code de conduite

Ce projet est un outil citoyen et apartisan. Les contributions doivent rester factuelles et objectives. Aucune opinion politique ne doit transparaître dans le code, les données ou la documentation.

## En bref

- **Un bug** : vérifie qu'il n'est pas déjà dans les [issues](https://github.com/accelaire/CLAIR/issues), puis ouvre-en une avec les étapes pour le reproduire, le comportement attendu et observé, et ton environnement.
- **Une fonctionnalité** : ouvre une issue qui la décrit et attends une validation avant de commencer.
- **Du code** : fork, branche depuis `master` (`feat/…`, `fix/…`, `docs/…`), puis une pull request vers `master`, après :

  ```bash
  pnpm check                                  # Biome (nouveau front et outillage)
  pnpm lint                                   # ESLint (code existant)
  pnpm --filter <workspace touché> type-check
  pnpm test
  ```

  Les messages de commit suivent Conventional Commits, en français (`type(portée): sujet`), vérifiés par commitlint. Une pull request notable ajoute un fragment `.changelog/<sujet>.md` ; sinon, sa description contient la ligne `Journal : aucun`.

  Si tu touches à l'ingestion, à un rattachement ou à l'IA, lance aussi les contrôles de la donnée ; si tu changes le schéma Prisma, joins sa migration. Le détail est dans le [guide](https://docs.clair.vote/guide/guide-developpeur/contribution).

## Questions

Pour toute question, ouvre une issue, ou écris à [contact@clair.vote](mailto:contact@clair.vote).

---

Merci pour ta contribution !
