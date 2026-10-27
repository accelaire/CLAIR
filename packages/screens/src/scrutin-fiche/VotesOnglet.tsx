"use client";

import type { DecompteGroupe, PositionVote, ScrutinDetail, VoteParlementaire } from "@clair/data";
import {
  DataTable,
  type DataTableColumn,
  GroupeBadge,
  Link,
  ResultatVote,
  VotePosition,
  type VotePositionValue,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { parlementaireHref, pluriel } from "../shared/scrutins.ts";
import { POSITIONS, type ScrutinFicheParams } from "./params.ts";
import classes from "./ScrutinFicheScreen.module.css";

/** L'API écrit `absent` les membres qui n'ont pas pris part au vote. */
const POSITION_AFFICHEE: Record<PositionVote, VotePositionValue> = {
  pour: "pour",
  contre: "contre",
  abstention: "abstention",
  absent: "non_votant",
};

const LIBELLES: Record<PositionVote, string> = {
  pour: "Pour",
  contre: "Contre",
  abstention: "Abstention",
  absent: "Non-votants",
};

type GroupeInfo = { slug: string; couleur: string | null; chambre: string };

type LigneGroupe = DecompteGroupe & { sigle: string; total: number };

/** Groupes présents dans les votes, par sigle : adresse et couleur. */
const groupesDesVotes = (votes: Record<PositionVote, VoteParlementaire[]>) => {
  const groupes = new Map<string, GroupeInfo>();
  for (const vote of Object.values(votes).flat()) {
    const groupe = vote.parlementaire.groupe;
    if (groupe && !groupes.has(groupe.nom)) {
      groupes.set(groupe.nom, {
        slug: groupe.slug,
        couleur: groupe.couleur,
        chambre: vote.parlementaire.chambre,
      });
    }
  }
  return groupes;
};

/**
 * Page du groupe à la période du scrutin : sa composition telle qu'au moment du vote
 * (session au Sénat, législature à l'Assemblée).
 */
const groupeHref = (info: GroupeInfo, scrutin: ScrutinDetail) => {
  const periode =
    info.chambre === "senat"
      ? scrutin.session
        ? `?session=${encodeURIComponent(scrutin.session)}`
        : ""
      : scrutin.legislature != null
        ? `?legislature=${scrutin.legislature}`
        : "";
  return `/groupes/${info.chambre}/${info.slug}${periode}`;
};

type VotesOngletProps = {
  scrutin: ScrutinDetail;
  params: ScrutinFicheParams;
  update: (patch: Partial<ScrutinFicheParams>) => void;
};

/**
 * Onglet « Vote » : répartition des voix, décompte par groupe politique (tableau triable) et
 * position de chaque élu, filtrable par groupe et par position (filtres dans l'URL).
 */
export const VotesOnglet = ({ scrutin, params, update }: VotesOngletProps) => {
  const groupes = groupesDesVotes(scrutin.votesByPosition);
  const membres = scrutin.chambre === "senat" ? "sénateurs" : "députés";

  const lignes: LigneGroupe[] = Object.entries(scrutin.votesByGroupe).map(([sigle, decompte]) => ({
    sigle,
    ...decompte,
    total: decompte.pour + decompte.contre + decompte.abstention + decompte.absent,
  }));

  const nombre = (key: PositionVote): DataTableColumn<LigneGroupe> => ({
    key,
    header: LIBELLES[key],
    cell: (ligne) => <span className="clair-chiffres">{ligne[key]}</span>,
    sortValue: (ligne) => ligne[key],
    firstDirection: "descending",
    align: "end",
  });

  const colonnes: DataTableColumn<LigneGroupe>[] = [
    {
      key: "groupe",
      header: "Groupe",
      rowHeader: true,
      sortValue: (ligne) => ligne.sigle,
      cell: (ligne) => {
        const info = groupes.get(ligne.sigle);
        const badge = <GroupeBadge sigle={ligne.sigle} couleur={info?.couleur} size="sm" />;
        return info ? (
          <Link href={groupeHref(info, scrutin)}>
            {badge}
            <span className="clair-visually-hidden"> : composition du groupe</span>
          </Link>
        ) : (
          badge
        );
      },
    },
    ...POSITIONS.map(nombre),
    {
      key: "total",
      header: "Total",
      cell: (ligne) => <span className="clair-chiffres">{ligne.total}</span>,
      sortValue: (ligne) => ligne.total,
      firstDirection: "descending",
      align: "end",
    },
  ];

  const sigles = [...new Set(lignes.map((ligne) => ligne.sigle))].sort();
  const filtres = (position: PositionVote) =>
    (scrutin.votesByPosition[position] ?? []).filter(
      (vote) => !params.groupe || vote.parlementaire.groupe?.nom === params.groupe,
    );
  const positionsAffichees = (params.position ? [params.position] : POSITIONS).filter(
    (position) => filtres(position).length > 0,
  );

  return (
    <div className={classes.onglet}>
      <ResultatVote
        pour={scrutin.nombrePour}
        contre={scrutin.nombreContre}
        abstention={scrutin.nombreAbstention}
        label={`Résultat du scrutin n° ${scrutin.numero}`}
      />
      <p className={classes.mention}>
        {pluriel(scrutin.nombreVotants, "votant")} ·{" "}
        {pluriel(scrutin.votesByPosition.absent?.length ?? 0, "non-votant")} · Donnée officielle
      </p>

      <section aria-labelledby="votes-par-groupe" className={classes.sousSection}>
        <h3 id="votes-par-groupe" className={classes.h3}>
          Par groupe politique
        </h3>
        <DataTable
          caption="Positions de vote par groupe politique"
          hideCaption
          columns={colonnes}
          rows={lignes}
          getRowKey={(ligne) => ligne.sigle}
          defaultSort={{ key: "total", direction: "descending" }}
          emptyLabel="Aucun décompte par groupe"
        />
      </section>

      <section aria-labelledby="votes-par-elu" className={classes.sousSection}>
        <h3 id="votes-par-elu" className={classes.h3}>
          Par élu ({pluriel(scrutin.totalVotes, membres.slice(0, -1), membres)})
        </h3>
        <div className={classes.filtres}>
          <NativeSelect
            label="Groupe"
            value={params.groupe}
            onChange={(event) => update({ groupe: event.currentTarget.value })}
            data={[
              { value: "", label: "Tous les groupes" },
              ...sigles.map((sigle) => ({ value: sigle, label: sigle })),
            ]}
          />
          <NativeSelect
            label="Position"
            value={params.position}
            onChange={(event) => {
              const valeur = event.currentTarget.value;
              update({ position: POSITIONS.find((position) => position === valeur) ?? "" });
            }}
            data={[
              { value: "", label: "Toutes les positions" },
              ...POSITIONS.map((position) => ({
                value: position,
                label: `${LIBELLES[position]} (${filtres(position).length})`,
              })),
            ]}
          />
        </div>
        {positionsAffichees.length === 0 ? (
          <p className={classes.mention}>Aucun vote pour ces critères.</p>
        ) : (
          positionsAffichees.map((position) => (
            <section
              key={position}
              aria-labelledby={`position-${position}`}
              className={classes.position}
            >
              <h4 id={`position-${position}`} className={classes.h4}>
                {LIBELLES[position]}{" "}
                <span className="clair-chiffres">({filtres(position).length})</span>
              </h4>
              <ul className={classes.elus}>
                {filtres(position).map((vote) => (
                  <li key={vote.id} className={classes.elu}>
                    <Link
                      href={parlementaireHref(vote.parlementaire.chambre, vote.parlementaire.slug)}
                    >
                      {vote.parlementaire.prenom} {vote.parlementaire.nom}
                    </Link>
                    <span className={classes.eluMeta}>
                      {vote.parlementaire.groupe ? (
                        <GroupeBadge
                          sigle={vote.parlementaire.groupe.nom}
                          couleur={vote.parlementaire.groupe.couleur}
                          size="sm"
                        />
                      ) : null}
                      <VotePosition position={POSITION_AFFICHEE[position]} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
};
