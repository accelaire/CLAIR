"use client";

import { GitCompareArrows, UserRound, X } from "lucide-react";
import { useId } from "react";
import { Button } from "../../core/button/Button.tsx";
import classes from "./ComparisonBar.module.css";

/** Élu sélectionné pour la comparaison. */
export type ComparisonItem = {
  /** Identifiant stable (slug de l'élu). */
  id: string;
  /** Nom affiché (« Camille Exemple »). */
  name: string;
  /** Précision en texte (groupe, circonscription) : jamais une couleur seule. */
  detail?: string;
  /** Photo ; décorative, le nom est écrit à côté. */
  photoUrl?: string;
};

export type ComparisonBarProps = {
  /** Élus sélectionnés (contrôlés : l'écran tient la sélection, dans l'URL ou en mémoire). */
  items: ComparisonItem[];
  /** Retire un élu de la sélection. */
  onRemove: (id: string) => void;
  /** Vide la sélection ; sans lui, pas de bouton « Tout retirer ». */
  onClear?: () => void;
  /** Adresse de la page de comparaison, active à partir de deux élus. */
  compareHref: string;
  /** Nombre maximal d'élus comparables (l'écran refuse d'en ajouter au-delà). */
  max?: number;
  /** Nom des éléments, au singulier puis au pluriel (« député », « députés »). */
  noun?: [singular: string, plural: string];
  /** Barre fixée en bas de l'écran (désactiver pour l'afficher dans le flux, en documentation). */
  fixed?: boolean;
};

/** Nombre minimal d'élus pour comparer. */
const MIN = 2;

/**
 * Barre de comparaison : liste les élus sélectionnés (chacun retirable), annonce leur nombre
 * et mène à la comparaison dès deux élus. Fixée en bas de l'écran ; masquée sans sélection.
 * Remplace `comparison/ComparisonSelectionBar.tsx` de apps/web.
 */
export const ComparisonBar = ({
  items,
  onRemove,
  onClear,
  compareHref,
  max = 4,
  noun = ["élu", "élus"],
  fixed = true,
}: ComparisonBarProps) => {
  const hintId = useId();
  if (items.length === 0) return null;

  const [singular, plural] = noun;
  const count = items.length;
  const canCompare = count >= MIN;
  const summary = `${count} ${count > 1 ? plural : singular} sélectionné${count > 1 ? "s" : ""} sur ${max}`;

  return (
    <section className={classes.root} data-fixed={fixed || undefined} aria-label="Comparaison">
      <div className={classes.inner}>
        <p className={classes.summary} role="status">
          {summary}
        </p>
        <ul
          className={classes.list}
          aria-label={`${plural.charAt(0).toUpperCase()}${plural.slice(1)} sélectionnés`}
        >
          {items.map((item) => (
            <li key={item.id} className={classes.item}>
              {item.photoUrl ? (
                <img className={classes.avatar} src={item.photoUrl} alt="" />
              ) : (
                <span className={classes.avatar} aria-hidden="true">
                  <UserRound />
                </span>
              )}
              <span className={classes.name}>
                {item.name}
                {item.detail ? <span className={classes.detail}> ({item.detail})</span> : null}
              </span>
              <Button
                variant="tertiaire"
                size="sm"
                icon={<X />}
                aria-label={`Retirer ${item.name} de la comparaison`}
                className={classes.remove}
                onClick={() => onRemove(item.id)}
              />
            </li>
          ))}
        </ul>
        <div className={classes.actions}>
          {onClear ? (
            <Button variant="tertiaire" onClick={onClear}>
              Tout retirer
            </Button>
          ) : null}
          {canCompare ? (
            <Button href={compareHref} icon={<GitCompareArrows />}>
              Comparer
            </Button>
          ) : (
            <Button icon={<GitCompareArrows />} disabled aria-describedby={hintId}>
              Comparer
            </Button>
          )}
        </div>
        {canCompare ? null : (
          <p id={hintId} className={classes.hint}>
            Sélectionnez au moins {MIN} {plural} pour les comparer.
          </p>
        )}
        {count >= max ? (
          <p className={classes.hint}>
            Maximum atteint : {max} {plural}.
          </p>
        ) : null}
      </div>
    </section>
  );
};
