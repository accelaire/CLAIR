import classes from "./ChambreBadge.module.css";

export type Chambre = "assemblee" | "senat";

export type ChambreBadgeProps = {
  chambre: Chambre;
  /** Libellé court (« AN », « Sénat ») ; le nom complet reste lu par les lecteurs d'écran. */
  short?: boolean;
  size?: "sm" | "md";
};

export const CHAMBRES: Record<Chambre, { label: string; short: string }> = {
  assemblee: { label: "Assemblée nationale", short: "AN" },
  senat: { label: "Sénat", short: "Sénat" },
};

/**
 * Chambre du Parlement (Assemblée nationale ou Sénat), avec la couleur propre à chaque
 * chambre, toujours doublée de son nom. En version courte, le nom complet est donné en
 * infobulle et aux lecteurs d'écran. Remplace `.badge-assemblee` et `.badge-senat` de apps/web.
 */
export const ChambreBadge = ({ chambre, short = false, size = "md" }: ChambreBadgeProps) => {
  const { label, short: shortLabel } = CHAMBRES[chambre];
  const abbreviated = short && shortLabel !== label;
  return (
    <span
      className={classes.badge}
      data-chambre={chambre}
      data-size={size}
      title={abbreviated ? label : undefined}
    >
      {abbreviated ? (
        <>
          <span aria-hidden="true">{shortLabel}</span>
          <span className="clair-visually-hidden">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  );
};
