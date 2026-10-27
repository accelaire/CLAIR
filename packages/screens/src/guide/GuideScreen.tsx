import { Card, Container, Link, PageHeader } from "@clair/ui";
import { GUIDE_ORDER } from "../guide-article/articles/index.ts";
import editorial from "../shared/editorial/Editorial.module.css";
import classes from "./GuideScreen.module.css";

/** Accueil du guide pratique : une carte par parcours, lien vers les fiches « Comprendre ». */
export const GuideScreen = () => (
  <Container size="etroit" className={editorial.page}>
    <PageHeader
      title="Guide pratique"
      description="Parcours guidés pour tirer le maximum de CLAIR. Choisissez un parcours et laissez-vous guider étape par étape."
    />
    <ul className={`${editorial.grid} ${classes.tracks}`} data-columns="3">
      {GUIDE_ORDER.map((article) => {
        const Icon = article.cardIcon ?? article.icon;
        return (
          <Card
            key={article.slug}
            as="li"
            title={article.title}
            titleAs="h2"
            href={`/guide/${article.slug}`}
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
      Vous souhaitez comprendre les institutions ?{" "}
      <Link href="/comprendre">Consultez nos pages pédagogiques</Link>
    </p>
  </Container>
);
