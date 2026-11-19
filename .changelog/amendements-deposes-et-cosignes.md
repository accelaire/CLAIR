---
niveau: mineur
type: fonctionnalite
public: [citoyens, reutilisateurs]
pr: [143]
---

Sur les fiches, l'onglet Amendements s'ouvre sur les amendements que l'élu a déposés ; ceux qu'il a seulement cosignés sont à un clic. Mêlés, les milliers d'amendements de groupe qu'un député cosigne noyaient les siens, et l'onglet mettait plusieurs secondes à s'afficher. L'API gagne un paramètre `role` (`depose`, `cosigne`, `tous` par défaut) sur `/:slug/amendements` et `/:slug/amendements/dossiers`, et la fiche donne `listes.amendementsDeposes`.
