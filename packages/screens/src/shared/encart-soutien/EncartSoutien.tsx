import { Button } from "@clair/ui";
import { ArrowRight, Heart } from "lucide-react";
import classes from "./EncartSoutien.module.css";

type EncartSoutienProps = {
  /** Marge haute ; `false` quand la section précédente pose déjà la sienne. */
  espace?: boolean;
};

/**
 * L'appel au don en pied des fiches député, sénateur et scrutin, repris de `SoutenirCallout` de
 * apps/web. Il existe parce que presque tout le trafic arrive sur une fiche, par une recherche,
 * sans jamais voir l'accueil (6 visiteurs sur 1 100 atteignaient `/soutenir` en septembre 2026).
 * Volontairement sobre, avec un seul argument, factuel : la déduction fiscale de 66 %.
 */
export const EncartSoutien = ({ espace = true }: EncartSoutienProps) => (
  <aside
    aria-label="Soutenir CLAIR"
    className={espace ? `${classes.encart} ${classes.espace}` : classes.encart}
  >
    <Heart className={classes.icone} aria-hidden="true" />
    <p className={classes.texte}>
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
