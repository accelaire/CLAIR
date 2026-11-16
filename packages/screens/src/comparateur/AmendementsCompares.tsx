"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageAmendements, ParlementaireCompare } from "@clair/data";
import {
  AmendementCard,
  Button,
  ErrorState,
  LoadingState,
  ProvenanceLabel,
  SectionHeader,
} from "@clair/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { formatNombre, scrutinHref } from "../shared/parlementaires/chambre.ts";
import classes from "./ComparateurScreen.module.css";

/** Amendements chargés à chaque « Voir plus » (comme apps/web). */
export const AMENDEMENTS_PAR_PAGE = 10;

/** Taux d'adoption en pourcentage entier ; `null` sans amendement déposé (pas 0 %). */
export const tauxAdoption = (proposes: number, adoptes: number) =>
  proposes > 0 ? Math.round((adoptes / proposes) * 100) : null;

type PageProps = {
  chemin: string;
  slug: string;
  page: number;
  derniere: boolean;
  onSuivante: () => void;
};

/** Une page des derniers amendements d'un élu ; la dernière affichée porte « Voir plus ». */
const PageAmendementsElu = ({ chemin, slug, page, derniere, onSuivante }: PageProps) => {
  const query = useApiQuery<PageAmendements>(`${chemin}/${encodeURIComponent(slug)}/amendements`, {
    page: String(page),
    limit: String(AMENDEMENTS_PAR_PAGE),
  });
  if (query.isPending) {
    return (
      <li className={classes.amendementsEtat}>
        <LoadingState label="Chargement des amendements…" variant="skeleton" lines={3} />
      </li>
    );
  }
  if (query.isError) {
    return (
      <li className={classes.amendementsEtat}>
        <ErrorState
          message="Les amendements n'ont pas pu être chargés."
          onRetry={() => query.refetch()}
        />
      </li>
    );
  }
  const { data, meta } = query.data;
  if (page === 1 && data.length === 0) {
    return <li className={classes.meta}>Aucun amendement trouvé.</li>;
  }
  return (
    <>
      {data.map((amendement) => (
        // AmendementCard enveloppe sa carte dans un <div> : `as="li"` laisserait un <div> dans la
        // liste. L'élément de liste porte donc la carte.
        <li key={amendement.id} className={classes.amendementsEtat}>
          <AmendementCard
            titleAs="h4"
            amendement={amendement}
            showAuteur={false}
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
        </li>
      ))}
      {derniere && (meta.hasNext ?? meta.page < meta.totalPages) ? (
        <li className={classes.amendementsEtat}>
          <Button variant="secondaire" onClick={onSuivante}>
            Voir plus
          </Button>
        </li>
      ) : null}
    </>
  );
};

/** Bloc d'un élu : déposés, adoptés, taux d'adoption, puis ses derniers amendements à la demande. */
const AmendementsElu = ({ chemin, elu }: { chemin: string; elu: ParlementaireCompare }) => {
  const [pages, setPages] = useState(0);
  const listeId = useId();
  const ouvert = pages > 0;
  const nom = `${elu.prenom} ${elu.nom}`;
  const { proposes, adoptes } = elu.stats?.amendements ?? { proposes: 0, adoptes: 0 };
  const taux = tauxAdoption(proposes, adoptes);

  return (
    <li className={classes.amendementsElu}>
      <h3 className={classes.amendementsNom}>{nom}</h3>
      {elu.stats ? (
        <>
          <p className={classes.amendementsChiffres}>
            <span>
              {formatNombre(proposes)} déposé{proposes > 1 ? "s" : ""}
            </span>
            <span>
              {formatNombre(adoptes)} adopté{adoptes > 1 ? "s" : ""}
            </span>
            <span>
              {taux === null ? "Aucun amendement déposé" : `${formatNombre(taux)} % d'adoption`}
            </span>
          </p>
          {/* Barre décorative : le taux est écrit juste au-dessus. */}
          <div className={classes.amendementsBarre} aria-hidden="true">
            <div className={classes.amendementsTaux} style={{ inlineSize: `${taux ?? 0}%` }} />
          </div>
        </>
      ) : (
        <p className={classes.meta}>Statistiques non disponibles.</p>
      )}
      <div>
        <Button
          variant="tertiaire"
          size="sm"
          aria-label={`${ouvert ? "Masquer les amendements" : "Voir les derniers amendements"} de ${nom}`}
          aria-expanded={ouvert}
          aria-controls={ouvert ? listeId : undefined}
          icon={ouvert ? <ChevronUp /> : <ChevronDown />}
          onClick={() => setPages(ouvert ? 0 : 1)}
        >
          {ouvert ? "Masquer les amendements" : "Voir les derniers amendements"}
        </Button>
      </div>
      {ouvert ? (
        <ul id={listeId} className={classes.amendementsListe} aria-label={`Amendements de ${nom}`}>
          {Array.from({ length: pages }, (_, index) => (
            <PageAmendementsElu
              key={index}
              chemin={chemin}
              slug={elu.slug}
              page={index + 1}
              derniere={index + 1 === pages}
              onSuivante={() => setPages(pages + 1)}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

/**
 * Amendements des élus comparés (bloc `ComparisonAmendements` de apps/web) : déposés, adoptés et
 * taux d'adoption de chacun, puis ses derniers amendements (déposés ou cosignés), dix par dix.
 */
export const AmendementsCompares = ({
  chemin,
  elus,
}: {
  chemin: string;
  elus: ParlementaireCompare[];
}) => (
  <section className={classes.section} aria-labelledby="amendements-compares">
    <SectionHeader
      id="amendements-compares"
      title="Amendements"
      description={
        <>
          Amendements déposés et adoptés de chaque élu, puis ses derniers amendements, déposés ou
          cosignés. Taux d'adoption :{" "}
          <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />.
        </>
      }
    />
    <ul className={classes.amendements}>
      {elus.map((elu) => (
        <AmendementsElu key={elu.slug} chemin={chemin} elu={elu} />
      ))}
    </ul>
  </section>
);
