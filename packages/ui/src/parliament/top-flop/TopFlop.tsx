"use client";

import { useId } from "react";
import { Link } from "../../core/link/Link.tsx";
import { type Provenance, ProvenanceLabel } from "../../core/provenance-label/ProvenanceLabel.tsx";
import { EmptyState } from "../../core/query-states/QueryStates.tsx";
import classes from "./TopFlop.module.css";

export type TopFlopItem = {
  id: string;
  /** Nom affiché (« Camille Exemple »). */
  name: string;
  /** Page de la personne ou de l'entité : le nom devient un lien. */
  href?: string;
  /** Valeur du critère ; `null` si elle n'est pas connue. */
  value: number | null;
  /** Rang dans le classement complet ; position dans la liste par défaut. */
  rank?: number;
  /** Précision sous le nom (groupe, chambre). */
  detail?: string;
};

export type TopFlopProps = {
  /** Critère du classement (« Présence aux scrutins »). */
  criterion: string;
  /** Les valeurs les plus élevées, de la plus haute à la plus basse. */
  top: TopFlopItem[];
  /** Les valeurs les moins élevées, de la plus basse à la plus haute. */
  flop: TopFlopItem[];
  /** Formatage de la valeur (« 98 % ») ; nombre à la française par défaut. */
  formatValue?: (value: number) => string;
  /** Titre de la liste haute ; « Les plus élevés » par défaut. */
  topTitle?: string;
  /** Titre de la liste basse ; « Les moins élevés » par défaut. */
  flopTitle?: string;
  /** Niveau des titres de liste. */
  headingLevel?: 2 | 3 | 4;
  /** Nature des valeurs : un classement est presque toujours calculé par CLAIR. */
  provenance?: Provenance;
  /** Lien vers la méthodologie du calcul. */
  methodologyHref?: string;
};

const numberFormat = new Intl.NumberFormat("fr-FR");

const RankList = ({
  title,
  items,
  criterion,
  formatValue,
  headingLevel,
}: {
  title: string;
  items: TopFlopItem[];
  criterion: string;
  formatValue: (value: number) => string;
  headingLevel: 2 | 3 | 4;
}) => {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={classes.column} aria-labelledby={titleId}>
      <Heading id={titleId} className={classes.title}>
        {title}
        <span className={classes.criterion}> — {criterion}</span>
      </Heading>
      {items.length === 0 ? (
        <EmptyState title="Aucun résultat" />
      ) : (
        <ol className={classes.list} aria-labelledby={titleId}>
          {items.map((item, index) => (
            <li key={item.id} className={classes.item}>
              <span className={classes.rank}>
                <span className="clair-visually-hidden">Rang </span>
                {item.rank ?? index + 1}
              </span>
              <span className={classes.identity}>
                <span className={classes.name}>
                  {item.href ? <Link href={item.href}>{item.name}</Link> : item.name}
                </span>
                {item.detail ? <span className={classes.detail}>{item.detail}</span> : null}
              </span>
              <span className={classes.value}>
                <span className="clair-visually-hidden">{criterion} : </span>
                {item.value === null ? "non disponible" : formatValue(item.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

/**
 * Deux listes « les plus » / « les moins » sur un critère (présence, amendements…) : rang,
 * nom (lien), valeur en texte. Présentation neutre : aucune couleur de jugement, la nature
 * calculée de la donnée est affichée. Remplace `TopFlopCards` de apps/web.
 */
export const TopFlop = ({
  criterion,
  top,
  flop,
  formatValue = (value) => numberFormat.format(value),
  topTitle = "Les plus élevés",
  flopTitle = "Les moins élevés",
  headingLevel = 3,
  provenance = "calculee",
  methodologyHref,
}: TopFlopProps) => (
  <div className={classes.topFlop}>
    <div className={classes.columns}>
      <RankList
        title={topTitle}
        items={top}
        criterion={criterion}
        formatValue={formatValue}
        headingLevel={headingLevel}
      />
      <RankList
        title={flopTitle}
        items={flop}
        criterion={criterion}
        formatValue={formatValue}
        headingLevel={headingLevel}
      />
    </div>
    <ProvenanceLabel provenance={provenance} methodologyHref={methodologyHref} />
  </div>
);
