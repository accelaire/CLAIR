"use client";

import { useApiQuery } from "@clair/api-client";
import { type CommissionDossiersPage, pageOf } from "@clair/data";
import {
  type ActiveFilter,
  Badge,
  Button,
  DateRangePicker,
  DossierCard,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  Pagination,
  STATUTS,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { jourCourt, pluriel } from "../shared/reunions/reunions.ts";
import classes from "./CommissionFicheScreen.module.css";
import { type CommissionFicheParams, ETATS_DOSSIER } from "./params.ts";

const ROLES = {
  fond: { label: "Saisie au fond", aide: "Commission principale qui examine le texte" },
  avis: { label: "Saisie pour avis", aide: "Commission qui rend un avis consultatif" },
} as const;

/**
 * Textes dont la commission a été saisie (au fond ou pour avis), filtrables par rôle, état et
 * période de dépôt ; filtres et page dans l'URL.
 */
export const DossiersCommission = ({
  slug,
  params,
  update,
  hrefFor,
}: {
  slug: string;
  params: CommissionFicheParams;
  /** Change un filtre (retour en page 1). */
  update: (patch: Partial<CommissionFicheParams>) => void;
  hrefFor: (page: number) => string;
}) => {
  const query = useApiQuery<CommissionDossiersPage>(
    `/commissions/${encodeURIComponent(slug)}/dossiers`,
    {
      role: params.role,
      etat: params.etat,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      limit: 20,
    },
  );

  const actifs: ActiveFilter[] = [
    params.role
      ? {
          id: `role=${params.role}`,
          label: `Rôle : ${ROLES[params.role].label}`,
          onRemove: () => update({ role: "" }),
        }
      : null,
    params.etat
      ? {
          id: `etat=${params.etat}`,
          label: `État : ${STATUTS[params.etat].label}`,
          onRemove: () => update({ etat: "" }),
        }
      : null,
    params.dateFrom || params.dateTo
      ? {
          id: "periode",
          label: `Déposés${params.dateFrom ? ` depuis le ${jourCourt(`${params.dateFrom}T12:00:00Z`)}` : ""}${params.dateTo ? ` jusqu'au ${jourCourt(`${params.dateTo}T12:00:00Z`)}` : ""}`,
          onRemove: () => update({ dateFrom: "", dateTo: "" }),
        }
      : null,
  ].filter((filtre): filtre is ActiveFilter => filtre !== null);
  const effacer = () => update({ role: "", etat: "", dateFrom: "", dateTo: "" });
  const resultat = query.data ? pageOf(query.data) : null;

  return (
    <div className={classes.pile}>
      <FilterBar label="Filtrer les textes" activeFilters={actifs} onReset={effacer}>
        <NativeSelect
          label="Rôle de la commission"
          value={params.role}
          onChange={(event) => {
            const role = event.currentTarget.value;
            update({ role: role === "fond" || role === "avis" ? role : "" });
          }}
          data={[
            { value: "", label: "Tous les rôles" },
            { value: "fond", label: ROLES.fond.label },
            { value: "avis", label: ROLES.avis.label },
          ]}
        />
        <NativeSelect
          label="État du texte"
          value={params.etat}
          onChange={(event) => {
            const etat = event.currentTarget.value;
            update({ etat: ETATS_DOSSIER.find((valeur) => valeur === etat) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les états" },
            ...ETATS_DOSSIER.map((etat) => ({ value: etat, label: STATUTS[etat].label })),
          ]}
        />
        <DateRangePicker
          label="Date de dépôt"
          value={{ from: params.dateFrom || null, to: params.dateTo || null }}
          onChange={({ from, to }) => update({ dateFrom: from ?? "", dateTo: to ?? "" })}
        />
      </FilterBar>

      {query.isPending ? (
        <LoadingState label="Chargement des textes…" variant="skeleton" lines={5} />
      ) : query.isError || !resultat ? (
        <ErrorState
          message="Les textes de la commission n'ont pas pu être chargés."
          onRetry={() => query.refetch()}
        />
      ) : resultat.items.length === 0 ? (
        <EmptyState
          title="Aucun texte trouvé"
          description={
            actifs.length > 0
              ? "Aucun texte ne correspond à ces critères."
              : "Aucun texte enregistré pour cette commission."
          }
          action={
            actifs.length > 0 ? (
              <Button variant="secondaire" onClick={effacer}>
                Effacer les filtres
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className={classes.mention} aria-live="polite">
            {pluriel(resultat.total, "texte")}
          </p>
          <ul className={classes.liste}>
            {resultat.items.map((dossier) => (
              <DossierCard
                key={`${dossier.uid}-${dossier.role}`}
                as="li"
                titleAs="h3"
                href={`/dossiers/${encodeURIComponent(dossier.uid)}`}
                contexte={
                  <Badge size="sm" tone="info">
                    {ROLES[dossier.role].label}
                    <span className="clair-visually-hidden"> : {ROLES[dossier.role].aide}</span>
                  </Badge>
                }
                dossier={{
                  titre: dossier.titre,
                  procedureLibelle: dossier.procedureLibelle,
                  etat: dossier.etat,
                  dateDepot: dossier.dateDepot,
                  nbScrutins: dossier.nbScrutins,
                  nbAmendements: dossier.nbAmendements,
                  loiNumero: dossier.loiNumero,
                }}
              />
            ))}
          </ul>
          <Pagination
            page={resultat.page}
            total={resultat.totalPages}
            hrefFor={hrefFor}
            label="Pages des textes"
          />
        </>
      )}
    </div>
  );
};
