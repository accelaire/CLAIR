"use client";

import { useApiQuery } from "@clair/api-client";
import type { DebatDeReunionPage, ScrutinDeSeance } from "@clair/data";
import { ErrorState, Link, LoadingState, Pagination } from "@clair/ui";
import { useEffect } from "react";
import { pluriel } from "../shared/reunions/reunions.ts";
import { grouperParSujet, votesApres } from "./debat.ts";
import { PriseDeParole } from "./PriseDeParole.tsx";
import { ancreDuRang, PRISES_PAR_PAGE } from "./params.ts";
import { ResultatDuVote } from "./ResultatDuVote.tsx";
import classes from "./ReunionScreen.module.css";

/**
 * Débat d'une réunion, page par page (200 prises de parole), découpé en passages de même sujet ;
 * chaque vote apparaît à l'endroit où il est tombé. Avec `rangCible`, la page défile jusqu'à
 * la prise de ce rang une fois chargée.
 */
export const DebatDeReunion = ({
  uid,
  total,
  scrutins,
  page,
  hrefFor,
  voteSuivi,
  rangCible,
}: {
  uid: string;
  total: number;
  scrutins: ScrutinDeSeance[];
  page: number;
  hrefFor: (page: number) => string;
  voteSuivi: string | null;
  rangCible: number | null;
}) => {
  const query = useApiQuery<DebatDeReunionPage>(
    `/agenda/${encodeURIComponent(uid)}/debat`,
    { page, limit: PRISES_PAR_PAGE },
    { enabled: total > 0 },
  );
  const prises = query.data?.data ?? [];

  // Arrivé depuis un vote : défiler jusqu'à son débat, une fois la page chargée.
  useEffect(() => {
    if (rangCible === null || prises.length === 0) return;
    const cible = prises.find((prise) => prise.ordre !== null && prise.ordre >= rangCible);
    if (cible?.ordre != null) {
      document.getElementById(ancreDuRang(cible.ordre))?.scrollIntoView({ block: "start" });
    }
  }, [rangCible, prises]);

  if (total === 0) return null;
  const passages = grouperParSujet(prises);
  const apres = votesApres(prises, scrutins);
  const totalPages = Math.ceil(total / PRISES_PAR_PAGE);

  return (
    <section className={classes.section} aria-labelledby="debat">
      <h2 id="debat" className={classes.titreSection}>
        Débat : {pluriel(total, "prise de parole", "prises de parole")}
      </h2>
      {query.isPending ? (
        <LoadingState label="Chargement du débat…" variant="skeleton" lines={6} />
      ) : query.isError ? (
        <ErrorState message="Le débat n'a pas pu être chargé." onRetry={() => query.refetch()} />
      ) : (
        <>
          <div className={classes.debat}>
            {passages.map((passage) => (
              <div key={passage.cle} className={classes.passage}>
                {passage.texte || passage.sousTitre ? (
                  <p className={classes.intertitre}>
                    {passage.texte ? (
                      passage.texte.uid ? (
                        <Link href={`/dossiers/${encodeURIComponent(passage.texte.uid)}`}>
                          {passage.texte.titre}
                        </Link>
                      ) : (
                        passage.texte.titre
                      )
                    ) : null}
                    {passage.texte && passage.sousTitre ? " · " : null}
                    {passage.sousTitre}
                  </p>
                ) : null}
                {passage.prises.map((prise) => (
                  <div
                    key={prise.id}
                    className={classes.priseCadre}
                    data-suivi={(voteSuivi && prise.scrutinIds.includes(voteSuivi)) || undefined}
                  >
                    <PriseDeParole prise={prise} />
                    {(apres.get(prise.id) ?? []).map((scrutin) => (
                      <ResultatDuVote
                        key={scrutin.id}
                        scrutin={scrutin}
                        suivi={scrutin.id === voteSuivi}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Pagination page={page} total={totalPages} hrefFor={hrefFor} label="Pages du débat" />
        </>
      )}
    </section>
  );
};
