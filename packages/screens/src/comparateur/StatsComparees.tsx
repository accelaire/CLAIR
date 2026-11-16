"use client";

import {
  type Chambre,
  libellePresence,
  type ParlementaireCompare,
  PRESENCE_SENAT_EXPLICATION,
  pourcent,
  presenceDe,
  type StatsParlementaireDetail,
} from "@clair/data";
import { DataTable, type DataTableColumn, ProvenanceLabel, SectionHeader } from "@clair/ui";
import { formatNombre } from "../shared/parlementaires/chambre.ts";
import classes from "./ComparateurScreen.module.css";

type Ligne = {
  cle: string;
  libelle: string;
  valeur: (stats: StatsParlementaireDetail) => string | null;
};

const pourcentage = (valeur: number | null) => (valeur === null ? null : pourcent(valeur));

/** Une présence absente ne se mesure pas (président, membre du Gouvernement) : ce n'est pas 0 %. */
const presenceOuNonMesurable = (valeur: number | null) =>
  valeur === null ? "Non mesurable" : pourcent(valeur);

/**
 * Lignes de présence selon la chambre (#108). À l'Assemblée, la présence est le taux tous
 * scrutins, la présence aux solennels vient en second quand elle existe. Au Sénat, les scrutins
 * ordinaires se votent par groupe : la présence est celle des votes solennels, toujours affichée,
 * et le taux tous scrutins devient une participation.
 */
const lignesPresence = (chambre: Chambre, elus: ParlementaireCompare[]): Ligne[] =>
  chambre === "senat"
    ? [
        {
          cle: "presenceSolennel",
          libelle: libellePresence("senat"),
          valeur: (stats) => presenceOuNonMesurable(presenceDe("senat", stats)),
        },
        {
          cle: "presence",
          libelle: "Participation (tous scrutins, votés par groupe)",
          valeur: (stats) => pourcentage(stats.presence),
        },
      ]
    : [
        {
          cle: "presence",
          libelle: libellePresence("assemblee"),
          valeur: (stats) => presenceOuNonMesurable(presenceDe("assemblee", stats)),
        },
        ...(elus.some((elu) => elu.stats?.presenceSolennel != null)
          ? [
              {
                cle: "presenceSolennel",
                libelle: "Présence aux scrutins solennels",
                valeur: (stats: StatsParlementaireDetail) => pourcentage(stats.presenceSolennel),
              },
            ]
          : []),
      ];

const AUTRES_LIGNES: Ligne[] = [
  {
    cle: "loyaute",
    libelle: "Loyauté au groupe",
    valeur: (stats) => (stats.loyaute === null ? "Aucun vote à comparer" : pourcent(stats.loyaute)),
  },
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
export const StatsComparees = ({
  elus,
  chambre,
}: {
  elus: ParlementaireCompare[];
  chambre: Chambre;
}) => {
  const lignes = [...lignesPresence(chambre, elus), ...AUTRES_LIGNES];
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
        description={
          <>
            <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" /> Taux du mandat
            en cours.
            {chambre === "senat" ? ` ${PRESENCE_SENAT_EXPLICATION}` : null}
          </>
        }
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
