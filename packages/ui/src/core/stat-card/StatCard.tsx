import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../card/Card.tsx";
import classes from "./StatCard.module.css";

export type StatCardVariation = {
  /** Écart signé (3.2 pour une hausse, -4 pour une baisse, 0 si stable). */
  value: number;
  /** Unité de l'écart (« % », « points »). */
  unit?: string;
  /** Période de comparaison (« sur un an », « depuis 2024 »). */
  period?: string;
};

export type StatCardProps = {
  /** Libellé du chiffre (terme de la liste de définitions). */
  label: ReactNode;
  /** Chiffre clé ; `null` quand la donnée n'est pas disponible. */
  value: number | string | null;
  /** Unité accolée au chiffre (« % », « votes »). */
  unit?: string;
  /** Icône décorative placée avant le libellé (masquée aux lecteurs d'écran). */
  icon?: ReactNode;
  /** Précision affichée sous le chiffre (« 52 % tous scrutins »). */
  detail?: ReactNode;
  /** Variation : toujours dite en texte (« Hausse de 3,2 % »), jamais par la couleur seule. */
  variation?: StatCardVariation;
  /** Aide : définition ou mode de calcul du chiffre. */
  help?: ReactNode;
  /** Élément racine (`li` dans une liste de chiffres). */
  as?: "div" | "li";
};

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Unité accolée au nombre : espace fine insécable avant « % », insécable sinon. */
const withUnit = (formatted: string, unit?: string) =>
  unit ? `${formatted}${unit === "%" ? " " : " "}${unit}` : formatted;

const formatValue = (value: number | string, unit?: string) =>
  withUnit(typeof value === "number" ? numberFormat.format(value) : value, unit);

const variationText = ({ value, unit, period }: StatCardVariation) => {
  const amount = withUnit(numberFormat.format(Math.abs(value)), unit);
  const text = value > 0 ? `Hausse de ${amount}` : value < 0 ? `Baisse de ${amount}` : "Stable";
  return period ? `${text} ${period}` : text;
};

const variationIcon = (value: number) =>
  value > 0 ? <TrendingUp /> : value < 0 ? <TrendingDown /> : <Minus />;

/**
 * Chiffre clé et son libellé, dans une liste de définitions (`dl`), avec variation et aide
 * facultatives. La variation est toujours écrite en toutes lettres et reste de ton neutre :
 * une hausse n'est ni bonne ni mauvaise en soi. Fusionne les deux `StatCard` de apps/web.
 */
export const StatCard = ({
  label,
  value,
  unit,
  icon,
  detail,
  variation,
  help,
  as = "div",
}: StatCardProps) => (
  <Card as={as} className={classes.statCard}>
    <dl className={classes.list}>
      <dt className={classes.label}>
        {icon ? (
          <span className={classes.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {label}
      </dt>
      <dd className={classes.value}>
        {value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="clair-visually-hidden">Non disponible</span>
          </>
        ) : (
          formatValue(value, unit)
        )}
      </dd>
      {detail !== undefined ? <dd className={classes.detail}>{detail}</dd> : null}
      {variation ? (
        <dd
          className={classes.variation}
          data-direction={
            variation.value > 0 ? "hausse" : variation.value < 0 ? "baisse" : "stable"
          }
        >
          <span className={classes.icon} aria-hidden="true">
            {variationIcon(variation.value)}
          </span>
          {variationText(variation)}
        </dd>
      ) : null}
    </dl>
    {help !== undefined ? <p className={classes.help}>{help}</p> : null}
  </Card>
);
