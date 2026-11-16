"use client";

import { useApiQuery } from "@clair/api-client";
import type { SujetDossier, SujetStatsGroupe, SujetStatsResponse } from "@clair/data";
import {
  Button,
  ChambreBadge,
  ChambreSwitch,
  type ChambreSwitchValue,
  EmptyState,
  ErrorState,
  GroupeBadge,
  Link,
  LoadingState,
  ProvenanceLabel,
  SortSelect,
} from "@clair/ui";
import { useId, useState } from "react";
import type { TriGroupes } from "./params.ts";
import classes from "./SujetFicheScreen.module.css";

const TRIS: { value: TriGroupes; label: string }[] = [
  { value: "amendements", label: "Par amendements" },
  { value: "votes", label: "Par votes" },
  { value: "chambre", label: "Par chambre" },
];

/** Groupes montrés d'abord ; les autres derrière « Afficher » (apps/web : cadre de 600 px). */
const GROUPES_VISIBLES = 6;

const totalVotes = ({ votes }: SujetStatsGroupe) =>
  votes.pour + votes.contre + votes.abstention + votes.absent;

const trier = (groupes: SujetStatsGroupe[], tri: TriGroupes) =>
  [...groupes].sort((a, b) => {
    if (tri === "votes") return totalVotes(b) - totalVotes(a);
    if (tri === "chambre") return a.chambre.localeCompare(b.chambre) || a.nom.localeCompare(b.nom);
    return b.amendements - a.amendements;
  });

type StatsGroupesProps = {
  slug: string;
  dossiers: SujetDossier[];
  chambre: ChambreSwitchValue;
  tri: TriGroupes;
  onChange: (choix: { groupes: ChambreSwitchValue; tri: TriGroupes }) => void;
};

/**
 * Groupes politiques du sujet : amendements déposés (comptés par CLAIR) et, quand elle existe,
 * la position du groupe rédigée par IA. Chaque groupe mène à ses amendements dans le dossier
 * de sa chambre.
 */
export const StatsGroupes = ({ slug, dossiers, chambre, tri, onChange }: StatsGroupesProps) => {
  const [tous, setTous] = useState(false);
  const listeId = useId();
  const { data, isPending, isError, refetch } = useApiQuery<SujetStatsResponse>(
    `/sujets/${encodeURIComponent(slug)}/stats`,
  );
  const descriptions = data?.groupeAmendementDescriptions ?? {};
  const groupes = trier(
    (data?.data ?? []).filter((g) => chambre === "" || g.chambre === chambre),
    tri,
  );

  const visibles = tous ? groupes : groupes.slice(0, GROUPES_VISIBLES);
  const caches = groupes.length - GROUPES_VISIBLES;

  return (
    <section className={classes.panel} aria-labelledby="groupes-sujet">
      <h2 id="groupes-sujet" className={classes.panelTitle}>
        Groupes politiques
      </h2>
      <div className={classes.provenance}>
        <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />
      </div>
      <div className={classes.filters}>
        <ChambreSwitch
          value={chambre}
          compact
          legend="Chambre des groupes"
          onChange={(valeur) => onChange({ groupes: valeur, tri })}
        />
        <SortSelect
          label="Trier les groupes"
          value={tri}
          options={TRIS}
          onChange={(valeur) =>
            onChange({ groupes: chambre, tri: TRIS.find((t) => t.value === valeur)?.value ?? tri })
          }
        />
      </div>

      {isPending ? <LoadingState label="Chargement des groupes…" variant="skeleton" /> : null}
      {isError ? (
        <ErrorState
          message="Les statistiques par groupe n'ont pas pu être chargées."
          onRetry={() => void refetch()}
        />
      ) : null}
      {data && groupes.length === 0 ? <EmptyState title="Aucune statistique disponible" /> : null}
      {groupes.length > 0 ? (
        <ul id={listeId} className={classes.rows}>
          {visibles.map((groupe) => {
            const cle = `${groupe.slug}-${groupe.chambre}`;
            const dossier =
              groupe.amendements > 0
                ? (dossiers.find((d) => d.chambre === groupe.chambre) ?? dossiers[0])
                : undefined;
            const description = descriptions[cle];
            return (
              <li key={cle} className={classes.row}>
                <div className={classes.rowHead}>
                  <GroupeBadge sigle={groupe.nom} couleur={groupe.couleur} size="sm" />
                  <ChambreBadge chambre={groupe.chambre} short size="sm" />
                  {groupe.amendements > 0 ? (
                    dossier ? (
                      <Link
                        href={`/dossiers/${dossier.uid}?groupe=${encodeURIComponent(groupe.slug)}&tab=amendements`}
                      >
                        {groupe.amendements} amendement{groupe.amendements > 1 ? "s" : ""}
                        <span className="clair-visually-hidden"> du groupe {groupe.nom}</span>
                      </Link>
                    ) : (
                      <span>
                        {groupe.amendements} amendement{groupe.amendements > 1 ? "s" : ""}
                      </span>
                    )
                  ) : null}
                </div>
                {description ? <p className={classes.rowText}>{description}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {caches > 0 ? (
        <div className={classes.more}>
          <Button
            variant="secondaire"
            aria-expanded={tous}
            aria-controls={listeId}
            onClick={() => setTous((valeur) => !valeur)}
          >
            {tous
              ? "Réduire la liste des groupes"
              : caches > 1
                ? `Afficher les ${caches} autres groupes`
                : "Afficher l'autre groupe"}
          </Button>
        </div>
      ) : null}
      {Object.keys(descriptions).length > 0 ? (
        <p className={classes.mention}>
          Positions des groupes :{" "}
          <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#enrichissement-ia" />
        </p>
      ) : null}
    </section>
  );
};
