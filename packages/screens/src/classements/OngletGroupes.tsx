"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, GroupeClasse } from "@clair/data";
import {
  Badge,
  ChambreBadge,
  ChambreSwitch,
  DataTable,
  type DataTableColumn,
  ErrorState,
  FilterBar,
  GroupeBadge,
  Link,
  LoadingState,
  ProvenanceLabel,
  SortSelect,
} from "@clair/ui";
import { formatNombre, formatPourcent, nomDuGroupe } from "../groupes-liste/format.ts";
import classes from "./ClassementsScreen.module.css";
import { METHODOLOGIE_INDICATEURS } from "./OngletParlementaires.tsx";
import type { ClassementsParams, CritereGroupe } from "./params.ts";

const OPTIONS: { value: CritereGroupe; label: string }[] = [
  { value: "presence", label: "Présence moyenne" },
  { value: "loyaute", label: "Loyauté moyenne" },
  { value: "cohesion", label: "Cohésion" },
  { value: "membres", label: "Nombre de membres" },
];

const valeur = (groupe: GroupeClasse, critere: CritereGroupe) => {
  switch (critere) {
    case "presence":
      return groupe.statsPresenceMoyenne;
    case "loyaute":
      return groupe.statsLoyauteMoyenne;
    case "cohesion":
      return groupe.statsCohesion;
    case "membres":
      return groupe.membresActifsCount;
  }
};

const pourcent = (nombre: number | null) => (nombre === null ? "—" : formatPourcent(nombre));

type OngletGroupesProps = {
  params: ClassementsParams;
  update: (patch: Partial<ClassementsParams>) => void;
};

/** Classement des groupes politiques (présence, loyauté, cohésion, effectif), trié dans l'URL. */
export const OngletGroupes = ({ params, update }: OngletGroupesProps) => {
  const query = useApiQuery<ApiData<GroupeClasse[]>>("/groupes", { chambre: params.chambre });
  const groupes = (query.data?.data ?? [])
    .filter((groupe) => groupe.membresActifsCount > 0)
    .sort((a, b) => (valeur(b, params.groupeSort) ?? -1) - (valeur(a, params.groupeSort) ?? -1));

  const colonnes: DataTableColumn<GroupeClasse>[] = [
    {
      key: "rang",
      header: "Rang",
      align: "end",
      cell: (groupe) => <span className="clair-chiffres">{groupes.indexOf(groupe) + 1}</span>,
    },
    {
      key: "groupe",
      header: "Groupe",
      rowHeader: true,
      cell: (groupe) => (
        <span className={classes.nom}>
          <GroupeBadge sigle={groupe.nom} couleur={groupe.couleur} size="sm" />
          <Link href={`/groupes/${groupe.chambre}/${groupe.slug}`}>{nomDuGroupe(groupe)}</Link>
          {groupe.slug === params.highlight ? <Badge size="sm">Mis en avant</Badge> : null}
        </span>
      ),
    },
    {
      key: "chambre",
      header: "Chambre",
      cell: (groupe) => <ChambreBadge chambre={groupe.chambre} short size="sm" />,
    },
    {
      key: "membres",
      header: "Membres",
      align: "end",
      cell: (groupe) => formatNombre(groupe.membresActifsCount),
    },
    {
      key: "presence",
      header: "Présence",
      align: "end",
      cell: (groupe) => pourcent(groupe.statsPresenceMoyenne),
    },
    {
      key: "loyaute",
      header: "Loyauté",
      align: "end",
      cell: (groupe) => pourcent(groupe.statsLoyauteMoyenne),
    },
    {
      key: "cohesion",
      header: "Cohésion",
      align: "end",
      cell: (groupe) => pourcent(groupe.statsCohesion),
    },
  ];

  return (
    <div className={classes.onglet}>
      <FilterBar label="Filtrer le classement des groupes">
        <ChambreSwitch value={params.chambre} onChange={(chambre) => update({ chambre })} />
        <SortSelect
          label="Critère"
          value={params.groupeSort}
          options={OPTIONS}
          onChange={(critere) => {
            const choisi = OPTIONS.find((option) => option.value === critere);
            if (choisi) update({ groupeSort: choisi.value });
          }}
        />
      </FilterBar>
      {query.isPending ? (
        <LoadingState label="Chargement du classement des groupes…" variant="skeleton" lines={6} />
      ) : query.isError ? (
        <ErrorState
          message="Le classement des groupes n'a pas pu être chargé."
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <DataTable
            caption={`Classement des groupes politiques par ${OPTIONS.find((option) => option.value === params.groupeSort)?.label.toLowerCase() ?? "critère"}`}
            columns={colonnes}
            rows={groupes}
            getRowKey={(groupe) => groupe.id}
            manualSort
            emptyLabel="Aucun groupe à classer pour cette chambre"
          />
          <p className={classes.provenance}>
            <ProvenanceLabel provenance="calculee" methodologyHref={METHODOLOGIE_INDICATEURS} />
          </p>
        </>
      )}
    </div>
  );
};
