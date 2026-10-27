"use client";

import { Button } from "@clair/ui";
import { ArrowRight, Heart } from "lucide-react";
import classes from "./Cartes.module.css";

/**
 * L'appel au don en pied des pages de circonscription, repris de `SoutenirCallout` de apps/web :
 * sobre, et un seul argument, factuel (la déduction fiscale de 66 %).
 */
export const EncartSoutien = () => (
  <aside className={classes.soutien}>
    <Heart className={classes.soutienIcone} aria-hidden="true" />
    <p className={classes.soutienTexte}>
      <strong className={classes.fort}>
        Cette page est gratuite, sans publicité et sans financement politique.
      </strong>{" "}
      CLAIR est une association d'intérêt général : un don de 10&nbsp;€ vous revient à 3,40&nbsp;€
      après déduction fiscale.
    </p>
    <Button href="/soutenir" icon={<ArrowRight />} iconPosition="end">
      Soutenir CLAIR
    </Button>
  </aside>
);
