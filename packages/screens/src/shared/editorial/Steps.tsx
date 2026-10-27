import { RichText } from "../rich-text/RichText.tsx";
import type { RichText as RichTextValue } from "../rich-text/rich-text.ts";
import classes from "./Steps.module.css";

export type Step = { title: string; description: RichTextValue };

/**
 * Étapes numérotées (parcours du guide, navette parlementaire, cycle d'une loi) : liste
 * ordonnée, le numéro est visible et lu par la liste elle-même. Le niveau de titre suit la
 * hiérarchie de la page.
 */
export const Steps = ({
  steps,
  headingLevel = 3,
}: {
  steps: readonly Step[];
  headingLevel?: 2 | 3;
}) => {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ol className={classes.steps}>
      {steps.map((step, index) => (
        <li key={step.title} className={classes.step}>
          <span className={classes.number} aria-hidden="true">
            {index + 1}
          </span>
          <div className={classes.content}>
            <Heading className={classes.title}>{step.title}</Heading>
            <p className={classes.description}>
              <RichText text={step.description} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};
