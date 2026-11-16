---
niveau: mineur
type: fonctionnalite
public: [citoyens, reutilisateurs]
pr: [140]
---

Sur les fiches, les votes et les amendements se lisent dossier par dossier : un bloc par texte avec le vote sur l'ensemble, la répartition des votes et les votes contre son groupe, ou ce qu'il est advenu des amendements. La liste chronologique reste à un clic. Sur mobile, les filtres passent dans un panneau et chaque séance des interventions annonce les textes discutés. L'API gagne `/:slug/votes/dossiers` et `/:slug/amendements/dossiers`, et un filtre `dossier` sur les listes. « Votes dissidents » ne compte plus les absences.
