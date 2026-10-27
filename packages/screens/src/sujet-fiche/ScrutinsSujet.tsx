"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageMeta, SujetScrutin } from "@clair/data";
import {
  ChambreSwitch,
  type ChambreSwitchValue,
  EmptyState,
  ErrorState,
  LoadingState,
  MultiSelectFilter,
  Pagination,
  ScrutinCard,
} from "@clair/ui";
import { NATURES_VOTE, periodeScrutin, scrutinHref } from "../shared/scrutins.ts";
import classes from "./SujetFicheScreen.module.css";

const PAR_PAGE = 20;

const NATURES = Object.entries(NATURES_VOTE).map(([value, label]) => ({ value, label }));

type ScrutinsSujetProps = {
  slug: string;
  totalSujet: number;
  chambre: ChambreSwitchValue;
  nature: string;
  page: number;
  /** Adresse de la fiche pour d'autres filtres de scrutins (la page repart à 1). */
  hrefFor: (filtres: { chambre: ChambreSwitchValue; nature: string; page: number }) => string;
  navigate: (href: string) => void;
};

/**
 * Scrutins du sujet, filtrés côté serveur par chambre et objet du vote, paginés par liens
 * (apps/web chargeait en défilement infini).
 */
export const ScrutinsSujet = ({
  slug,
  totalSujet,
  chambre,
  nature,
  page,
  hrefFor,
  navigate,
}: ScrutinsSujetProps) => {
  const { data, isPending, isError, refetch } = useApiQuery<PageMeta<SujetScrutin>>(
    `/sujets/${encodeURIComponent(slug)}/scrutins`,
    { page, limit: PAR_PAGE, chambre: chambre || undefined, nature: nature || undefined },
  );
  const filtre = chambre !== "" || nature !== "";
  const total = data?.meta.total ?? null;

  return (
    <section className={classes.panel} aria-labelledby="scrutins-sujet">
      <h2 id="scrutins-sujet" className={classes.panelTitle}>
        Scrutins{" "}
        <span className={`${classes.count} clair-chiffres`}>
          ({filtre && total !== null ? `${total} sur ${totalSujet}` : totalSujet})
        </span>
      </h2>
      <div className={classes.filters}>
        <ChambreSwitch
          value={chambre}
          compact
          onChange={(valeur) => navigate(hrefFor({ chambre: valeur, nature, page: 1 }))}
        />
        <MultiSelectFilter
          label="Objet du vote"
          placeholder="Tous les votes"
          options={NATURES}
          value={nature ? [nature] : []}
          countLabel={(n) => (n === 0 ? "Tous les objets de vote" : "1 objet de vote choisi")}
          onChange={(valeurs) =>
            navigate(hrefFor({ chambre, nature: valeurs.at(-1) ?? "", page: 1 }))
          }
        />
      </div>

      {isPending ? <LoadingState label="Chargement des scrutins…" variant="skeleton" /> : null}
      {isError ? (
        <ErrorState
          message="Les scrutins de ce sujet n'ont pas pu être chargés."
          onRetry={() => void refetch()}
        />
      ) : null}
      {data && data.data.length === 0 ? (
        <EmptyState
          title="Aucun scrutin"
          description={filtre ? "Aucun scrutin ne correspond à ces filtres." : undefined}
        />
      ) : null}
      {data && data.data.length > 0 ? (
        <>
          <ul className={classes.list}>
            {data.data.map((scrutin) => (
              <ScrutinCard
                key={scrutin.id}
                as="li"
                scrutin={scrutin}
                href={scrutinHref(scrutin)}
                periode={periodeScrutin(scrutin)}
              />
            ))}
          </ul>
          <Pagination
            label="Pages des scrutins"
            page={data.meta.page}
            total={data.meta.totalPages}
            hrefFor={(cible) => hrefFor({ chambre, nature, page: cible })}
          />
        </>
      ) : null}
    </section>
  );
};
