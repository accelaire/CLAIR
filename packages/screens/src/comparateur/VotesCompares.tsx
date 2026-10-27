"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageVotes, ParlementaireCompare, ScrutinDuVote } from "@clair/data";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  SectionHeader,
  VotePosition,
} from "@clair/ui";
import { Checkbox } from "@mantine/core";
import {
  formatDate,
  formatNombre,
  libelleSort,
  majuscule,
  positionDeVote,
  scrutinHref,
} from "../shared/parlementaires/chambre.ts";
import classes from "./ComparateurScreen.module.css";
import { VOTES_COMPARES } from "./params.ts";

/** Scrutin voté par au moins deux des élus comparés. */
export type ScrutinCompare = {
  scrutin: ScrutinDuVote;
  /** Position de chaque élu, par slug. */
  positions: Record<string, string>;
  divergent: boolean;
};

/** Lignes affichées au plus. */
const LIGNES_MAX = 50;

/**
 * Scrutins communs : ceux où au moins deux élus ont une position, du plus récent au plus ancien.
 * Un scrutin est « divergent » quand les positions exprimées diffèrent.
 */
export const scrutinsCommuns = (
  votes: Array<{ slug: string; page: PageVotes | undefined }>,
): ScrutinCompare[] => {
  const parScrutin = new Map<string, ScrutinCompare>();
  for (const { slug, page } of votes) {
    for (const vote of page?.data ?? []) {
      const ligne = parScrutin.get(vote.scrutin.id) ?? {
        scrutin: vote.scrutin,
        positions: {},
        divergent: false,
      };
      ligne.positions[slug] = vote.position;
      parScrutin.set(vote.scrutin.id, ligne);
    }
  }
  return [...parScrutin.values()]
    .filter((ligne) => Object.keys(ligne.positions).length >= 2)
    .map((ligne) => ({ ...ligne, divergent: new Set(Object.values(ligne.positions)).size > 1 }))
    .sort((a, b) => b.scrutin.date.localeCompare(a.scrutin.date));
};

type VotesComparesProps = {
  chemin: string;
  elus: ParlementaireCompare[];
  divergents: boolean;
  onDivergentsChange: (divergents: boolean) => void;
};

/** Votes des élus comparés, scrutin par scrutin (les 100 derniers votes de chacun). */
export const VotesCompares = ({
  chemin,
  elus,
  divergents,
  onDivergentsChange,
}: VotesComparesProps) => {
  // Quatre requêtes fixes (au plus quatre élus) : le nombre de hooks ne varie pas.
  const [a, b, c, d] = elus.map((elu) => elu.slug);
  const query = { page: "1", limit: String(VOTES_COMPARES) };
  const requetes = [
    useApiQuery<PageVotes>(`${chemin}/${encodeURIComponent(a ?? "")}/votes`, query, {
      enabled: a !== undefined,
    }),
    useApiQuery<PageVotes>(`${chemin}/${encodeURIComponent(b ?? "")}/votes`, query, {
      enabled: b !== undefined,
    }),
    useApiQuery<PageVotes>(`${chemin}/${encodeURIComponent(c ?? "")}/votes`, query, {
      enabled: c !== undefined,
    }),
    useApiQuery<PageVotes>(`${chemin}/${encodeURIComponent(d ?? "")}/votes`, query, {
      enabled: d !== undefined,
    }),
  ].slice(0, elus.length);

  const enCours = requetes.some((requete) => requete.isPending);
  const enErreur = requetes.some((requete) => requete.isError);
  const communs = scrutinsCommuns(
    elus.map((elu, index) => ({ slug: elu.slug, page: requetes[index]?.data })),
  );
  const lignes = divergents ? communs.filter((ligne) => ligne.divergent) : communs;

  const colonnes: DataTableColumn<ScrutinCompare>[] = [
    {
      key: "scrutin",
      header: "Scrutin",
      rowHeader: true,
      cell: ({ scrutin }) => (
        <span className={classes.scrutin}>
          <Link href={scrutinHref(scrutin)}>{majuscule(scrutin.titre)}</Link>
          <span className={classes.meta}>
            <time dateTime={scrutin.date}>{formatDate(scrutin.date)}</time> ·{" "}
            {libelleSort(scrutin.sort)}
          </span>
        </span>
      ),
    },
    ...elus.map(
      (elu): DataTableColumn<ScrutinCompare> => ({
        key: elu.slug,
        header: `${elu.prenom.charAt(0)}. ${elu.nom}`,
        cell: (ligne) => {
          const brute = ligne.positions[elu.slug];
          if (brute === undefined) return "—";
          const position = positionDeVote(brute);
          return position ? <VotePosition position={position} size="sm" /> : brute;
        },
      }),
    ),
  ];

  return (
    <section className={classes.section} aria-labelledby="votes-compares">
      <SectionHeader
        id="votes-compares"
        title="Votes comparés"
        description={`Scrutins votés par au moins deux des élus, parmi les ${VOTES_COMPARES} derniers votes de chacun.`}
      />
      <Checkbox
        label="Uniquement les scrutins où les positions diffèrent"
        checked={divergents}
        onChange={(event) => onDivergentsChange(event.currentTarget.checked)}
      />
      {enCours ? (
        <LoadingState label="Chargement des votes…" variant="skeleton" lines={6} />
      ) : enErreur ? (
        <ErrorState
          message="Les votes n'ont pas pu être chargés."
          onRetry={() => {
            for (const requete of requetes) requete.refetch();
          }}
        />
      ) : lignes.length === 0 ? (
        <EmptyState
          title={divergents ? "Aucun scrutin où les positions diffèrent" : "Aucun scrutin commun"}
        />
      ) : (
        <>
          <p className={classes.meta} role="status">
            {formatNombre(lignes.length)} scrutin{lignes.length > 1 ? "s" : ""}
            {lignes.length > LIGNES_MAX ? `, les ${LIGNES_MAX} plus récents affichés` : null}
          </p>
          <DataTable
            caption="Positions de vote par scrutin"
            hideCaption
            columns={colonnes}
            rows={lignes.slice(0, LIGNES_MAX)}
            getRowKey={(ligne) => ligne.scrutin.id}
          />
        </>
      )}
    </section>
  );
};
