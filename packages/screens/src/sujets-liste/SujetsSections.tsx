"use client";

import type { SujetListItem } from "@clair/data";
import { SectionHeader } from "@clair/ui";
import { useMaintenant } from "../shared/maintenant.ts";
import { SectionRepliable } from "./SectionRepliable.tsx";
import { SujetCard } from "./SujetCard.tsx";
import classes from "./SujetsListeScreen.module.css";
import { sectionsDe } from "./sections.ts";

/** Sujets répartis en sections : à la une, récemment promulgués, puis par issue. */
export const SujetsSections = ({
  sujets,
  recherche,
  maintenant: initial,
}: {
  sujets: SujetListItem[];
  recherche: boolean;
  /** Instant du rendu serveur (ms), pour que « à la une » soit le même des deux côtés. */
  maintenant?: number;
}) => {
  const maintenant = useMaintenant(initial);
  const { aLaUne, recemmentPromulgues, enDiscussion, promulgues, rejetes, autres } = sectionsDe(
    sujets,
    { recherche, maintenant },
  );

  return (
    <div className={classes.sections}>
      {aLaUne ? (
        <section aria-label="À la une">
          <ul className={classes.list}>
            <SujetCard sujet={aLaUne} aLaUne titleAs="h2" />
          </ul>
          <p className={classes.note}>
            Choisi automatiquement chaque jour parmi les sujets en discussion votés récemment.
          </p>
        </section>
      ) : null}

      {recemmentPromulgues.length > 0 ? (
        <section className={classes.section} aria-labelledby="recemment-promulgues">
          <SectionHeader id="recemment-promulgues" title="Récemment promulgués" />
          <ul className={classes.grid}>
            {recemmentPromulgues.map((sujet) => (
              <SujetCard key={sujet.id} sujet={sujet} />
            ))}
          </ul>
        </section>
      ) : null}

      {enDiscussion.length > 0 ? (
        <SectionRepliable titre="En cours de discussion" sujets={enDiscussion} />
      ) : null}
      {promulgues.length > 0 ? (
        <SectionRepliable titre="Promulgués" sujets={promulgues} ouverteParDefaut={false} />
      ) : null}
      {rejetes.length > 0 ? (
        <SectionRepliable titre="Rejetés" sujets={rejetes} ouverteParDefaut={false} />
      ) : null}
      {autres.length > 0 ? (
        <SectionRepliable titre="Caducs et retirés" sujets={autres} ouverteParDefaut={false} />
      ) : null}
    </div>
  );
};
