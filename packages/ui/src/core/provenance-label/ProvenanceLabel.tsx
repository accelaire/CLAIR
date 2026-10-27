"use client";

import { Calculator, Landmark, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigation } from "../../lib/navigation.tsx";
import { Badge, type BadgeTone } from "../badge/Badge.tsx";
import classes from "./ProvenanceLabel.module.css";

export type Provenance = "officielle" | "calculee" | "ia";

export type ProvenanceLabelProps = {
  /**
   * Nature de la donnée : `officielle` (source institutionnelle), `calculee` (calculée par
   * CLAIR) ou `ia` (générée par IA, à vérifier).
   */
  provenance: Provenance;
  /** Producteur de la donnée, ajouté au libellé (« Assemblée nationale »). */
  source?: string;
  /** Adresse de la méthodologie : le libellé devient un lien. */
  methodologyHref?: string;
  size?: "sm" | "md";
};

const definitions: Record<Provenance, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  officielle: { label: "Donnée officielle", tone: "info", icon: <Landmark /> },
  calculee: { label: "Calculée par CLAIR", tone: "neutre", icon: <Calculator /> },
  ia: { label: "Générée par IA, à vérifier", tone: "avertissement", icon: <Sparkles /> },
};

/**
 * Indique la nature d'une donnée : officielle, calculée par CLAIR ou générée par IA.
 * Règle centrale de CLAIR : ces trois natures sont toujours distinguées, par un libellé
 * (jamais par la seule couleur), avec un lien facultatif vers la méthodologie.
 */
export const ProvenanceLabel = ({
  provenance,
  source,
  methodologyHref,
  size = "sm",
}: ProvenanceLabelProps) => {
  const { Link: RouterLink } = useNavigation();
  const { label, tone, icon } = definitions[provenance];
  const text = source ? `${label} · ${source}` : label;
  return (
    <Badge tone={tone} size={size} icon={icon}>
      {methodologyHref ? (
        <RouterLink href={methodologyHref} className={classes.link}>
          {text}
          <span className="clair-visually-hidden"> (méthodologie)</span>
        </RouterLink>
      ) : (
        text
      )}
    </Badge>
  );
};
