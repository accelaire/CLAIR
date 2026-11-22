---
niveau: correctif
type: correction
public: [citoyens, reutilisateurs]
pr: [151]
---

Les amendements déposés en commission au Sénat sont de nouveau importés : aucun n'entrait depuis février 2026. Chaque amendement du Sénat n'a plus qu'une ligne : une version rectifiée (« 12 rect. ») s'ajoutait à la précédente au lieu de la remplacer, et l'ancien import doublonnait le nouveau. Ces doublons gonflaient le nombre d'amendements des sénateurs. L'identifiant `uid` d'un amendement du Sénat devient stable : `SENAT-AMD-S{session}-{texte}-{numéro}`, sans la rectification.
