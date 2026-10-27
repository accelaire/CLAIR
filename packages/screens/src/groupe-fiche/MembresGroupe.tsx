import type { Chambre, GroupeMembre } from "@clair/data";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  EmptyState,
  Link,
  SectionHeader,
} from "@clair/ui";
import { formatNombre, formatPourcent } from "../groupes-liste/format.ts";
import classes from "./GroupeFicheScreen.module.css";
import type { TriMembres } from "./params.ts";

type MembresGroupeProps = {
  chambre: Chambre;
  membres: GroupeMembre[];
  sort: DataTableSort;
  onSortChange: (sort: DataTableSort) => void;
};

const ELUS = { assemblee: "/deputes", senat: "/senateurs" } as const;

const circonscription = (chambre: Chambre, membre: GroupeMembre) => {
  const lieu = membre.circonscription;
  if (!lieu) return "—";
  return chambre === "assemblee" ? `${lieu.departement}, ${lieu.numero}e circ.` : lieu.nom;
};

const pourcent = (valeur: number | null) => (valeur === null ? "—" : formatPourcent(valeur));

/** Clés de tri reconnues dans l'URL. */
export const estTriMembres = (key: string): key is TriMembres =>
  key === "nom" || key === "presence" || key === "loyaute";

/**
 * Membres actifs du groupe en tableau triable (nom, présence, loyauté) ; le tri vit dans l'URL.
 * Les statistiques sont calculées par CLAIR.
 */
export const MembresGroupe = ({ chambre, membres, sort, onSortChange }: MembresGroupeProps) => {
  const columns: DataTableColumn<GroupeMembre>[] = [
    {
      key: "nom",
      header: "Nom",
      rowHeader: true,
      cell: (membre) => (
        <Link href={`${ELUS[chambre]}/${membre.slug}`}>
          {membre.prenom} {membre.nom}
        </Link>
      ),
      sortValue: (membre) => `${membre.nom} ${membre.prenom}`,
    },
    {
      key: "circonscription",
      header: chambre === "assemblee" ? "Circonscription" : "Département",
      cell: (membre) => circonscription(chambre, membre),
    },
    {
      key: "presence",
      header: "Présence",
      align: "end",
      firstDirection: "descending",
      cell: (membre) => pourcent(membre.statsPresence),
      sortValue: (membre) => membre.statsPresence,
    },
    {
      key: "loyaute",
      header: "Loyauté",
      align: "end",
      firstDirection: "descending",
      cell: (membre) => pourcent(membre.statsLoyaute),
      sortValue: (membre) => membre.statsLoyaute,
    },
  ];
  return (
    <section aria-labelledby="membres" className={classes.section}>
      <SectionHeader id="membres" title={`Membres du groupe (${formatNombre(membres.length)})`} />
      {membres.length > 0 ? (
        <DataTable
          caption="Membres actifs du groupe, présence et loyauté calculées par CLAIR"
          columns={columns}
          rows={membres}
          getRowKey={(membre) => membre.id}
          sort={sort}
          onSortChange={onSortChange}
        />
      ) : (
        <EmptyState title="Aucun membre actif dans ce groupe" />
      )}
    </section>
  );
};
