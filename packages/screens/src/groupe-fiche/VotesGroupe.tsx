"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, GroupeVotes } from "@clair/data";
import {
  BarChart,
  Button,
  ChartFrame,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  SectionHeader,
  StatCard,
  VotePosition,
} from "@clair/ui";
import { formatNombre } from "../groupes-liste/format.ts";
import { formatDate, positionDeVote, scrutinHref } from "../shared/parlementaires/chambre.ts";
import { METHODOLOGIE_INDICATEURS } from "./ChiffresGroupe.tsx";
import classes from "./GroupeFicheScreen.module.css";

type VotesGroupeProps = {
  chambre: Chambre;
  slug: string;
  periode: { legislature: string; session: string };
  /** Seulement les scrutins demandés par le groupe (dans l'URL). */
  initie: boolean;
  onInitieChange: (initie: boolean) => void;
};

const POSITIONS = [
  { key: "pour", label: "Pour", color: "var(--clair-graphique-vote-pour)" },
  { key: "contre", label: "Contre", color: "var(--clair-graphique-vote-contre)" },
  { key: "abstention", label: "Abstention", color: "var(--clair-graphique-vote-abstention)" },
] as const;

const part = (valeur: number, total: number) =>
  total > 0 ? Math.round((valeur / total) * 100) : 0;

/**
 * Votes du groupe : répartition des voix exprimées (barre empilée avec son tableau), taux de
 * participation, cohésion et derniers scrutins. Le filtre « scrutins demandés par le groupe »
 * vit dans l'URL. Remplace le camembert Recharts de apps/web.
 */
export const VotesGroupe = ({
  chambre,
  slug,
  periode,
  initie,
  onInitieChange,
}: VotesGroupeProps) => {
  const query = useApiQuery<ApiData<GroupeVotes>>(
    `/groupes/${chambre}/${encodeURIComponent(slug)}/votes`,
    {
      ...periode,
      groupeInitie: initie,
    },
  );
  const votes = query.data?.data;
  const exprimes = votes
    ? votes.positions.pour + votes.positions.contre + votes.positions.abstention
    : 0;

  return (
    <section aria-labelledby="votes" className={classes.section}>
      <SectionHeader id="votes" title="Statistiques de votes" />
      <div className={classes.filtre}>
        <Button
          variant={initie ? "primaire" : "secondaire"}
          size="sm"
          aria-pressed={initie}
          onClick={() => onInitieChange(!initie)}
        >
          Seulement les scrutins demandés par le groupe
        </Button>
      </div>
      {query.isPending ? (
        <LoadingState label="Chargement des votes du groupe…" />
      ) : query.isError ? (
        <ErrorState
          message="Les votes du groupe n'ont pas pu être chargés."
          onRetry={() => query.refetch()}
        />
      ) : votes && votes.totalVotes > 0 ? (
        <div className={classes.deuxColonnes}>
          <ChartFrame
            title="Répartition des votes exprimés"
            subtitle={`${formatNombre(exprimes)} votes exprimés par les membres du groupe${initie ? ", scrutins demandés par le groupe" : ""}`}
            headingLevel={3}
            provenance="calculee"
            methodologyHref={METHODOLOGIE_INDICATEURS}
            table={{
              caption: "Votes exprimés par les membres du groupe, par position",
              columns: [
                { key: "position", label: "Position" },
                { key: "votes", label: "Votes" },
                { key: "part", label: "Part (%)" },
              ],
              rows: POSITIONS.map(({ key, label }) => ({
                position: label,
                votes: votes.positions[key],
                part: part(votes.positions[key], exprimes),
              })),
            }}
          >
            <BarChart
              data={[
                {
                  categorie: "Votes exprimés",
                  pour: votes.positions.pour,
                  contre: votes.positions.contre,
                  abstention: votes.positions.abstention,
                },
              ]}
              categoryKey="categorie"
              series={POSITIONS.map(({ key, label, color }) => ({ key, label, color }))}
              type="percent"
              horizontal
              height={120}
              legendLabel="Légende : répartition des votes exprimés"
            />
            <ul className={classes.repartition}>
              {POSITIONS.map(({ key, label }) => (
                <li key={key}>
                  <strong className="clair-chiffres">
                    {part(votes.positions[key], exprimes)}&nbsp;%
                  </strong>{" "}
                  {label} ({formatNombre(votes.positions[key])})
                </li>
              ))}
            </ul>
          </ChartFrame>

          <div className={classes.colonne}>
            <ul className={classes.chiffresDeux}>
              <StatCard
                as="li"
                label="Participation aux scrutins"
                value={votes.tauxParticipation}
                unit="%"
              />
              <StatCard
                as="li"
                label="Cohésion"
                value={votes.cohesionMoyenne}
                unit="%"
                help="Part moyenne des membres votants alignés sur la position majoritaire du groupe."
              />
            </ul>
            <h3 className={classes.sousTitre}>
              Derniers scrutins ({formatNombre(votes.scrutinsRecents.length)})
            </h3>
            <ul className={classes.scrutins}>
              {votes.scrutinsRecents.map((scrutin) => {
                const position = positionDeVote(scrutin.positionMajoritaire);
                return (
                  <li key={scrutin.id} className={classes.scrutin}>
                    <Link
                      href={scrutinHref({
                        numero: scrutin.numero,
                        chambre,
                        session: scrutin.session,
                      })}
                    >
                      {scrutin.titre}
                    </Link>
                    <span className={classes.scrutinMeta}>
                      <time dateTime={scrutin.date}>{formatDate(scrutin.date)}</time>
                      {position ? (
                        <span>
                          Position majoritaire : <VotePosition position={position} size="sm" />
                        </span>
                      ) : (
                        <span>Pas de position majoritaire</span>
                      )}
                      <span>
                        {scrutin.groupeVotes.pour} pour, {scrutin.groupeVotes.contre} contre,{" "}
                        {scrutin.groupeVotes.abstention} abstention
                        {scrutin.groupeVotes.abstention > 1 ? "s" : ""}
                      </span>
                      <span>Cohésion {scrutin.cohesion}&nbsp;%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <EmptyState title="Aucune donnée de vote disponible" />
      )}
    </section>
  );
};
