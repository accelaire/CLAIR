import { Container, Link, PageHeader } from "@clair/ui";
import editorial from "../shared/editorial/Editorial.module.css";
import { Blocks } from "../shared/rich-text/RichText.tsx";
import { cgu } from "./cgu.ts";
import { confidentialite } from "./confidentialite.ts";
import { mentionsLegales } from "./mentions-legales.ts";
import classes from "./PageLegaleScreen.module.css";
import type { LegalPage } from "./types.ts";

export const LEGAL_PAGES = {
  cgu,
  confidentialite,
  "mentions-legales": mentionsLegales,
} as const satisfies Record<string, LegalPage>;

export type LegalPageSlug = keyof typeof LEGAL_PAGES;

export type PageLegaleScreenProps = {
  /** Page à afficher : son contenu vit dans `<slug>.ts`. */
  page: LegalPageSlug;
};

/**
 * Page légale (CGU, confidentialité, mentions légales) : titre, date de mise à jour, sommaire
 * des sections (ancres) puis sections titrées en colonne de lecture.
 */
export const PageLegaleScreen = ({ page }: PageLegaleScreenProps) => {
  const content = LEGAL_PAGES[page];
  return (
    <Container size="etroit" className={editorial.page}>
      <PageHeader
        title={content.title}
        description={<p className={classes.updated}>Dernière mise à jour : {content.updatedAt}</p>}
      />

      <nav aria-labelledby="sommaire" className={classes.toc}>
        <h2 id="sommaire" className={classes.tocTitle}>
          Sommaire
        </h2>
        <ol className={classes.tocList}>
          {content.sections.map((section) => (
            <li key={section.id}>
              <Link href={`#${section.id}`}>{section.title}</Link>
            </li>
          ))}
        </ol>
      </nav>

      {content.sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={`${editorial.section} ${classes.section}`}
          aria-labelledby={`${section.id}-titre`}
        >
          <h2 id={`${section.id}-titre`} className={classes.title}>
            {section.title}
          </h2>
          <div className={classes.body}>
            <Blocks blocks={section.blocks} />
          </div>
        </section>
      ))}
    </Container>
  );
};
