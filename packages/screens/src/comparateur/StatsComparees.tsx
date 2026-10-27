"use client";

import type { ParlementaireCompare, StatsParlementaireDetail } from "@clair/data";
import { DataTable, type DataTableColumn, ProvenanceLabel, SectionHeader } from "@clair/ui";
import { formatNombre } from "../shared/parlementaires/chambre.ts";
import classes from "./ComparateurScreen.module.css";

type Ligne = {
  cle: string;
  libelle: string;
  valeur: (stats: StatsParlementaireDetail) => string | null;
};

const pourcentage = (valeur: number | null) => (valeur === null ? null : `${valeur} %`);

const LIGNES: Ligne[] = [
  { cle: "presence", libelle: "Présence", valeur: (stats) => pourcentage(stats.presence) },
  {
    cle: "presenceSolennel",
    libelle: "Présence aux scrutins solennels",
    valeur: (stats) => pourcentage(stats.presenceSolennel),
  },
  { cle: "loyaute", libelle: "Loyauté au groupe", valeur: (stats) => pourcentage(stats.loyaute) },
  { cle: "participation", libelle: "Votes", valeur: (stats) => formatNombre(stats.participation) },
  {
    cle: "interventions",
    libelle: "Interventions",
    valeur: (stats) => formatNombre(stats.interventions),
  },
  {
    cle: "amendements",
    libelle: "Amendements déposés (adoptés)",
    valeur: (stats) =>
      `${formatNombre(stats.amendements.proposes)} (${formatNombre(stats.amendements.adoptes)})`,
  },
  {
    cle: "questions",
    libelle: "Questions posées",
    valeur: (stats) => formatNombre(stats.questions),
  },
];

/**
 * Statistiques côte à côte, une colonne par élu. Données calculées par CLAIR, présentées sans
 * mise en valeur du « meilleur » : un chiffre ne dit pas à lui seul la qualité d'un mandat.
 */
export const StatsComparees = ({ elus }: { elus: ParlementaireCompare[] }) => {
  // La présence aux scrutins solennels n'existe qu'à l'Assemblée.
  const lignes = LIGNES.filter(
    (ligne) =>
      ligne.cle !== "presenceSolennel" || elus.some((elu) => elu.stats?.presenceSolennel != null),
  );
  const colonnes: DataTableColumn<Ligne>[] = [
    { key: "indicateur", header: "Indicateur", rowHeader: true, cell: (ligne) => ligne.libelle },
    ...elus.map(
      (elu): DataTableColumn<Ligne> => ({
        key: elu.slug,
        header: `${elu.prenom} ${elu.nom}`,
        align: "end",
        cell: (ligne) => (elu.stats ? ligne.valeur(elu.stats) : null) ?? "Non disponible",
      }),
    ),
  ];
  return (
    <section className={classes.section} aria-labelledby="statistiques-comparees">
      <SectionHeader
        id="statistiques-comparees"
        title="Statistiques"
        description={<ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />}
      />
      <DataTable
        caption="Statistiques comparées"
        hideCaption
        columns={colonnes}
        rows={lignes}
        getRowKey={(ligne) => ligne.cle}
      />
    </section>
  );
};
