import { Button, Callout, Container, PageHeader, SectionHeader } from "@clair/ui";
import { ArrowRight } from "lucide-react";
import { ArticleNav, neighboursOf } from "../shared/editorial/ArticleNav.tsx";
import editorial from "../shared/editorial/Editorial.module.css";
import { ArticleBlocks } from "./ArticleBlocks.tsx";
import { COMPRENDRE_ARTICLES, COMPRENDRE_ORDER, type ComprendreSlug } from "./articles/index.ts";
import classes from "./ComprendreArticleScreen.module.css";

export type ComprendreArticleScreenProps = {
  /** Fiche à afficher : son contenu vit dans `articles/<slug>.ts`. */
  slug: ComprendreSlug;
};

const hrefOf = (slug: string) => `/comprendre/${slug}`;

/** Ancre d'une section : celle du contenu (citée ailleurs) ou sa position. */
const sectionId = (id: string | undefined, index: number) => id ?? `section-${index + 1}`;

/**
 * Fiche « Comprendre » : fil d'Ariane, titre, encart de données en direct éventuel, sections
 * (texte, cartes, étapes), liens d'exploration et navigation vers les fiches voisines.
 */
export const ComprendreArticleScreen = ({ slug }: ComprendreArticleScreenProps) => {
  const article = COMPRENDRE_ARTICLES[slug];
  const Icon = article.icon;
  const { previous, next } = neighboursOf(COMPRENDRE_ORDER, slug);
  const [primary, ...secondary] = article.actions;
  return (
    <Container size="etroit" className={editorial.page}>
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Comprendre", href: "/comprendre" },
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
      />

      {article.liveData ? (
        <Callout tone="mise-en-avant" title={article.liveData.title} titleAs="h2">
          <ul className={`${editorial.actions} ${classes.liveActions}`}>
            {article.liveData.actions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <li key={action.href}>
                  <Button
                    href={action.href}
                    size="sm"
                    variant={index === 0 ? "primaire" : "secondaire"}
                    icon={ActionIcon ? <ActionIcon /> : undefined}
                  >
                    {action.label}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Callout>
      ) : null}

      {article.sections.map((section, index) => {
        const id = sectionId(section.id, index);
        return (
          <section
            key={section.title}
            id={id}
            className={editorial.section}
            aria-labelledby={`${id}-titre`}
          >
            <SectionHeader id={`${id}-titre`} title={section.title} />
            <ArticleBlocks blocks={section.blocks} />
          </section>
        );
      })}

      {primary ? (
        <ul className={`${editorial.actions} ${classes.actions}`}>
          <li>
            <Button href={primary.href} icon={<ArrowRight />} iconPosition="end">
              {primary.label}
            </Button>
          </li>
          {secondary.map((action) => (
            <li key={action.href}>
              <Button href={action.href} variant="secondaire">
                {action.label}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <ArticleNav
        label="Autres fiches Comprendre"
        index={{ title: "Toutes les fiches Comprendre", href: "/comprendre" }}
        previous={previous ? { title: previous.title, href: hrefOf(previous.slug) } : null}
        next={next ? { title: next.title, href: hrefOf(next.slug) } : null}
      />
    </Container>
  );
};
