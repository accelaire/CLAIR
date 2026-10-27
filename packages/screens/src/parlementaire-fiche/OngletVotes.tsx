"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageVotes, VoteDuParlementaire } from "@clair/data";
import { Badge, Card, parseStatut, StatutBadge, VotePosition } from "@clair/ui";
import { Checkbox } from "@mantine/core";
import {
  formatDate,
  libellePosition,
  libelleSort,
  majuscule,
  positionDeVote,
  scrutinHref,
} from "../shared/parlementaires/chambre.ts";
import { ListeOnglet } from "./ListeOnglet.tsx";
import { type OngletProps, PeriodeFiltre } from "./OngletCommun.tsx";
import classes from "./ParlementaireFicheScreen.module.css";
import { votesQueryOf } from "./params.ts";

const VoteItem = ({ vote }: { vote: VoteDuParlementaire }) => {
  const position = positionDeVote(vote.position);
  const statut = parseStatut(vote.scrutin.sort);
  const different =
    vote.groupePosition !== null &&
    vote.position !== "absent" &&
    vote.position !== vote.groupePosition;
  return (
    <Card
      as="article"
      href={scrutinHref(vote.scrutin)}
      title={majuscule(vote.scrutin.titre)}
      eyebrow={
        position ? <VotePosition position={position} size="sm" /> : <Badge>{vote.position}</Badge>
      }
      footer={
        <p className={classes.meta}>
          <time dateTime={vote.scrutin.date}>{formatDate(vote.scrutin.date)}</time>
          <span>Scrutin n° {vote.scrutin.numero}</span>
          {statut ? (
            <StatutBadge statut={statut} size="sm" />
          ) : (
            <span>{libelleSort(vote.scrutin.sort)}</span>
          )}
        </p>
      }
    >
      {different && vote.groupePosition ? (
        <p className={classes.texte}>
          Vote différent de la position majoritaire du groupe (
          {libellePosition(vote.groupePosition)}
          ).
        </p>
      ) : null}
    </Card>
  );
};

/** Onglet « Votes » : votes de l'élu, du plus récent au plus ancien. */
export const OngletVotes = ({
  chemin,
  slug,
  filtres,
  changer,
  pageHref,
  dateMin,
  initialData,
}: OngletProps & { initialData?: PageVotes }) => {
  const query = useApiQuery<PageVotes>(
    `${chemin}/${encodeURIComponent(slug)}/votes`,
    votesQueryOf(filtres),
    {
      initialData,
    },
  );
  return (
    <ListeOnglet
      query={query}
      nom="votes"
      vide="Aucun vote trouvé pour ces critères."
      pageHref={pageHref}
      getKey={(vote) => vote.id}
      renderItem={(vote) => <VoteItem vote={vote} />}
      filtres={
        <>
          <PeriodeFiltre filtres={filtres} changer={changer} dateMin={dateMin} />
          <Checkbox
            label="Uniquement les votes différents de la position du groupe"
            checked={filtres.dissidents}
            onChange={(event) => changer({ dissidents: event.currentTarget.checked })}
          />
        </>
      }
    />
  );
};
