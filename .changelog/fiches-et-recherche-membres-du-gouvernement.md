---
niveau: mineur
type: fonctionnalite
public: [citoyens, reutilisateurs]
pr: [135]
---

Les membres du Gouvernement sans fiche de député ou de sénateur ont leur page, avec leurs postes et leur bilan (`/gouvernements/membres`, `/gouvernements/membres/:slug`) ; chaque nom, président compris, mène à sa page. Sur les fiches, les postes reconduits d'un gouvernement à l'autre forment une seule entrée et les onglets vides disparaissent. La recherche donne un résultat par personne, filtrable par rôle, avec les gouvernements et leurs membres (`/search`, `type=personnes`, `role`).
