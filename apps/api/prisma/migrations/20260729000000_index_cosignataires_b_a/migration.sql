-- Index couvrant pour « les amendements cosignés par X ».
--
-- La table de jointure implicite n'avait qu'un index sur "B" : lire les ~18 000
-- cosignatures d'un député très actif imposait autant d'accès aléatoires au tas
-- (16 555 blocs mesurés). Ajouter "A" à l'index rend le parcours index-only.
--
-- Mesuré sur 3 M de cosignatures : comptage 63 ms -> 8 ms, page 161 ms -> 101 ms.
--
-- NB : la table est gérée implicitement par Prisma (relation
-- @relation("AmendementCosignataires")), son schéma ne peut donc pas déclarer
-- cet index. Un futur `prisma migrate dev` peut vouloir le supprimer comme un
-- écart de schéma : le conserver si la question se pose.
CREATE INDEX IF NOT EXISTS "_AmendementCosignataires_B_A_idx"
  ON "_AmendementCosignataires" ("B", "A");
