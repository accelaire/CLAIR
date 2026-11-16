import { type Chambre, type GroupeMembre, presenceDe } from "@clair/data";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  EmptyState,
  Link,
  ParlementaireAvatar,
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

/** Présence d'un membre : aux votes solennels au Sénat, où les scrutins ordinaires se votent par groupe (#108). */
const presenceMembre = (chambre: Chambre, membre: GroupeMembre) =>
  presenceDe(chambre, {
    presence: membre.statsPresence,
    presenceSolennel: membre.statsPresenceSolennel,
  });

/** Clés de tri reconnues dans l'URL. */
export const estTriMembres = (key: string): key is TriMembres =>
  key === "nom" || key === "presence" || key === "loyaute";

/**
 * Membres actifs du groupe en tableau triable (photo et nom, présence, loyauté) ; le tri vit dans
 * l'URL.
 * Les statistiques sont calculées par CLAIR.
 */
export const MembresGroupe = ({ chambre, membres, sort, onSortChange }: MembresGroupeProps) => {
  const columns: DataTableColumn<GroupeMembre>[] = [
    {
      key: "nom",
      header: "Nom",
      rowHeader: true,
      cell: (membre) => (
        <span className={classes.membre}>
          <ParlementaireAvatar
            nom={`${membre.prenom} ${membre.nom}`}
            photoUrl={membre.photoUrl}
            size="sm"
            decorative
          />
          <Link href={`${ELUS[chambre]}/${membre.slug}`}>
            {membre.prenom} {membre.nom}
          </Link>
        </span>
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
      header: chambre === "senat" ? "Présence (votes solennels)" : "Présence",
      align: "end",
      firstDirection: "descending",
      cell: (membre) => pourcent(presenceMembre(chambre, membre)),
      sortValue: (membre) => presenceMembre(chambre, membre),
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
          caption={
            chambre === "senat"
              ? "Membres actifs du groupe, présence aux votes solennels et loyauté calculées par CLAIR"
              : "Membres actifs du groupe, présence et loyauté calculées par CLAIR"
          }
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
