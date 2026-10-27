import { Button, Container, PageHeader } from "@clair/ui";
import { ArticleNav, neighboursOf } from "../shared/editorial/ArticleNav.tsx";
import editorial from "../shared/editorial/Editorial.module.css";
import { Steps } from "../shared/editorial/Steps.tsx";
import { GUIDE_ARTICLES, GUIDE_ORDER, type GuideSlug } from "./articles/index.ts";
import classes from "./GuideArticleScreen.module.css";

export type GuideArticleScreenProps = {
  /** Parcours à afficher : son contenu vit dans `articles/<slug>.ts`. */
  slug: GuideSlug;
};

const hrefOf = (slug: string) => `/guide/${slug}`;

/**
 * Parcours du guide pratique : fil d'Ariane, titre et chapeau, étapes numérotées (chaque étape
 * est un intertitre), lien pour commencer et navigation vers les parcours voisins.
 */
export const GuideArticleScreen = ({ slug }: GuideArticleScreenProps) => {
  const article = GUIDE_ARTICLES[slug];
  const Icon = article.icon;
  const { previous, next } = neighboursOf(GUIDE_ORDER, slug);
  return (
    <Container size="etroit" className={editorial.page}>
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Guide pratique", href: "/guide" },
          { label: article.title },
        ]}
        title={
          <>
            <span className={editorial.titleIcon} aria-hidden="true">
              <Icon />
            </span>
            {article.title}
          </>
        }
        description={article.intro}
      />

      <div className={classes.steps}>
        <Steps steps={article.steps} headingLevel={2} />
      </div>

      <div className={classes.start}>
        <Button href={article.start.href}>
          Commencer <span aria-hidden="true">→</span> {article.start.label}
        </Button>
      </div>

      <ArticleNav
        label="Autres parcours du guide"
        index={{ title: "Tous les parcours du guide", href: "/guide" }}
        previous={previous ? { title: previous.title, href: hrefOf(previous.slug) } : null}
        next={next ? { title: next.title, href: hrefOf(next.slug) } : null}
      />
    </Container>
  );
};
