import { Card, Container, Link, PageHeader } from "@clair/ui";
import { COMPRENDRE_ORDER } from "../comprendre-article/articles/index.ts";
import editorial from "../shared/editorial/Editorial.module.css";
import classes from "./ComprendreScreen.module.css";

/** Accueil de la rubrique « Comprendre » : une carte par fiche, lien vers le guide pratique. */
export const ComprendreScreen = () => (
  <Container size="etroit" className={editorial.page}>
    <PageHeader
      title="Comprendre la politique française"
      description="Comment fonctionne le Parlement ? Qu'est-ce qu'un scrutin public ? Cette section vous aide à comprendre les institutions démocratiques françaises, simplement et sans jargon."
    />
    <ul className={`${editorial.grid} ${classes.topics}`} data-columns="3">
      {COMPRENDRE_ORDER.map((article) => {
        const Icon = article.icon;
        return (
          <Card
            key={article.slug}
            as="li"
            title={article.shortTitle}
            titleAs="h2"
            href={`/comprendre/${article.slug}`}
            padding="lg"
            eyebrow={
              <span className={editorial.cardIcon} aria-hidden="true">
                <Icon />
              </span>
            }
          >
            <p className={editorial.cardText}>{article.summary}</p>
          </Card>
        );
      })}
    </ul>
    <p className={`${editorial.center} ${classes.more}`}>
      Vous cherchez un parcours guidé pour utiliser CLAIR ?{" "}
      <Link href="/guide">Découvrir le guide pratique</Link>
    </p>
  </Container>
);
