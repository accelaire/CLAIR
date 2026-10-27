"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageAmendements } from "@clair/data";
import { AmendementCard } from "@clair/ui";
import { Checkbox } from "@mantine/core";
import { scrutinHref } from "../shared/parlementaires/chambre.ts";
import { ListeOnglet } from "./ListeOnglet.tsx";
import { type OngletProps, PeriodeFiltre } from "./OngletCommun.tsx";
import { amendementsQueryOf } from "./params.ts";

/** Onglet « Amendements » : amendements déposés ou cosignés, du plus récent au plus ancien. */
export const OngletAmendements = ({
  chemin,
  slug,
  filtres,
  changer,
  pageHref,
  dateMin,
}: OngletProps) => {
  const query = useApiQuery<PageAmendements>(
    `${chemin}/${slug}/amendements`,
    amendementsQueryOf(filtres),
  );
  return (
    <ListeOnglet
      query={query}
      nom="amendements"
      vide="Aucun amendement trouvé pour ces critères."
      pageHref={pageHref}
      getKey={(amendement) => amendement.id}
      renderItem={(amendement) => (
        <AmendementCard
          amendement={amendement}
          scrutins={amendement.scrutins.map((scrutin) => ({
            numero: scrutin.numero,
            href: scrutinHref(scrutin),
          }))}
          dossier={
            amendement.dossier
              ? {
                  label: amendement.dossier.titreCourt ?? amendement.dossier.titre,
                  href: `/dossiers/${amendement.dossier.uid}`,
                }
              : null
          }
        />
      )}
      filtres={
        <>
          <PeriodeFiltre filtres={filtres} changer={changer} dateMin={dateMin} />
          <Checkbox
            label="Uniquement les amendements mis aux voix par scrutin public"
            checked={filtres.votesPublics}
            onChange={(event) => changer({ votesPublics: event.currentTarget.checked })}
          />
        </>
      }
    />
  );
};
