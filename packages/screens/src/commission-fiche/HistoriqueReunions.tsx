"use client";

import { useApiQuery } from "@clair/api-client";
import { type CommissionReunionsPage, pageOf } from "@clair/data";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@clair/ui";
import { pluriel } from "../shared/reunions/reunions.ts";
import classes from "./CommissionFicheScreen.module.css";
import { ReunionCommission } from "./ReunionCommission.tsx";

/** Réunions passées, les plus récentes d'abord, 20 par page (pagination en liens). */
export const HistoriqueReunions = ({
  slug,
  page,
  hrefFor,
  maintenant,
  seances,
}: {
  slug: string;
  page: number;
  hrefFor: (page: number) => string;
  maintenant: Date;
  /** Hémicycle : on parle de séances. */
  seances: boolean;
}) => {
  const query = useApiQuery<CommissionReunionsPage>(
    `/commissions/${encodeURIComponent(slug)}/reunions`,
    { passees: "true", page, limit: 20 },
  );
  const nom = seances ? "séance" : "réunion";

  if (query.isPending) {
    return <LoadingState label={`Chargement des ${nom}s passées…`} variant="skeleton" lines={5} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        message={`Les ${nom}s passées n'ont pas pu être chargées.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  const resultat = pageOf(query.data);
  if (resultat.items.length === 0) {
    return <EmptyState title={`Aucune ${nom} passée enregistrée`} />;
  }
  return (
    <div className={classes.pile}>
      <p className={classes.mention} aria-live="polite">
        {pluriel(resultat.total, `${nom} enregistrée`, `${nom}s enregistrées`)}
      </p>
      <ul className={classes.liste}>
        {resultat.items.map((reunion) => (
          <ReunionCommission key={reunion.id} reunion={reunion} maintenant={maintenant} />
        ))}
      </ul>
      <Pagination
        page={resultat.page}
        total={resultat.totalPages}
        hrefFor={hrefFor}
        label={`Pages des ${nom}s passées`}
      />
    </div>
  );
};
