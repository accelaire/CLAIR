---
niveau: mineur
type: fonctionnalite
public: [citoyens, reutilisateurs]
pr: [152]
---

L'accueil met en avant les gouvernements et les pétitions : leurs compteurs rejoignent le bandeau juste après les parlementaires, marqués « Nouveau » comme dans le menu, et une section montre les dernières pétitions à franchir une étape au Parlement. Le marqueur du menu s'efface une fois la section ouverte. La liste des pétitions s'ouvre sur ces mêmes dernières étapes. Dans l'API, `/api/v1/petitions/dernieres-etapes` les donne, et `/homepage` gagne `stats.gouvernements` et `petitionsAuParlement`.
