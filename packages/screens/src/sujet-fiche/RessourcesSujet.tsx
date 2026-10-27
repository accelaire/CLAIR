"use client";

import { useApiQuery } from "@clair/api-client";
import type { SujetArticlePresse, SujetDetail, SujetLien } from "@clair/data";
import { Button, Card, Link, LoadingState } from "@clair/ui";
import { type ReactNode, useState } from "react";
import { formatDate } from "../sujets-liste/format.ts";
import classes from "./SujetFicheScreen.module.css";

const LIENS_VISIBLES = 5;
const ARTICLES_VISIBLES = 4;

/** Liste repliable de liens sortants (« Voir les n autres »). */
const ListeRepliable = <T,>({
  items,
  visibles,
  rendu,
}: {
  items: T[];
  visibles: number;
  rendu: (item: T) => ReactNode;
}) => {
  const [deplie, setDeplie] = useState(false);
  const caches = items.length - visibles;
  return (
    <>
      <ul className={classes.links}>{(deplie ? items : items.slice(0, visibles)).map(rendu)}</ul>
      {caches > 0 ? (
        <Button variant="tertiaire" size="sm" onClick={() => setDeplie((v) => !v)}>
          {deplie ? "Voir moins" : `Voir les ${caches} autres`}
        </Button>
      ) : null}
    </>
  );
};

const LienSortant = (lien: SujetLien) => (
  <li key={lien.id}>
    <Link href={lien.url} external>
      {lien.titre}
    </Link>
    {lien.sourceLabel ? <span className={classes.source}> · {lien.sourceLabel}</span> : null}
  </li>
);

/** Articles de presse récupérés à la demande (Google Actualités, liens seulement). */
const Presse = ({ slug }: { slug: string }) => {
  const { data, isPending, isError } = useApiQuery<{ data: SujetArticlePresse[] }>(
    `/sujets/${encodeURIComponent(slug)}/presse`,
  );
  if (isPending) return <LoadingState label="Chargement des articles…" variant="skeleton" />;
  const articles = data?.data ?? [];
  if (isError || articles.length === 0) {
    return <p className={classes.mention}>Aucun article récent.</p>;
  }
  return (
    <>
      <ListeRepliable
        items={articles}
        visibles={ARTICLES_VISIBLES}
        rendu={(article) => (
          <li key={article.url}>
            <Link href={article.url} external>
              {article.titre}
            </Link>
            {article.media || article.date ? (
              <span className={classes.source}>
                {" "}
                ·{" "}
                {[article.media, article.date ? formatDate(article.date) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </li>
        )}
      />
      <p className={classes.mention}>Source : Google Actualités</p>
    </>
  );
};

/**
 * Ressources externes du sujet : documents officiels, ressources de contexte et articles de
 * presse. Une carte par famille (apps/web les mettait en onglets sur mobile).
 */
export const RessourcesSujet = ({ slug, liens }: { slug: string; liens: SujetDetail["liens"] }) => {
  const construction = liens?.construction ?? [];
  const contexte = liens?.contexte ?? [];
  return (
    <section aria-labelledby="ressources-sujet" className={classes.block}>
      <h2 id="ressources-sujet" className="clair-visually-hidden">
        Ressources
      </h2>
      <ul className={classes.columns}>
        {construction.length > 0 ? (
          <Card as="li" titleAs="h3" title={`Documents officiels (${construction.length})`}>
            <p className={classes.mention}>
              Les textes, études d'impact et rapports déposés au Parlement.
            </p>
            <ListeRepliable items={construction} visibles={LIENS_VISIBLES} rendu={LienSortant} />
          </Card>
        ) : null}
        {contexte.length > 0 ? (
          <Card as="li" titleAs="h3" title={`Pour aller plus loin (${contexte.length})`}>
            <p className={classes.mention}>Ressources de référence neutres pour situer le texte.</p>
            <ListeRepliable items={contexte} visibles={LIENS_VISIBLES} rendu={LienSortant} />
          </Card>
        ) : null}
        <Card as="li" titleAs="h3" title="Dans les médias">
          <p className={classes.mention}>Articles de presse sur le sujet.</p>
          <Presse slug={slug} />
        </Card>
      </ul>
    </section>
  );
};
