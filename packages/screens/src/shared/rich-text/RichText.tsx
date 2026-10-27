import { Link } from "@clair/ui";
import classes from "./RichText.module.css";
import type { Block, Inline, RichText as RichTextValue } from "./rich-text.ts";

const InlinePart = ({ part }: { part: Inline }) => {
  if (typeof part === "string") return <>{part}</>;
  if ("strong" in part) return <strong className={classes.strong}>{part.strong}</strong>;
  if ("em" in part) return <em>{part.em}</em>;
  if ("code" in part) return <code className={classes.code}>{part.code}</code>;
  if ("br" in part) return <br />;
  return (
    <Link href={part.link.href} external={part.link.external}>
      {part.link.text}
    </Link>
  );
};

/** Texte enrichi d'une ligne (gras, code, liens) ; à placer dans un `p`, un `li` ou un titre. */
export const RichText = ({ text }: { text: RichTextValue }) =>
  typeof text === "string"
    ? text
    : text.map((part, index) => <InlinePart key={index} part={part} />);

/** Suite de blocs (paragraphes, listes, sous-parties) d'une section de contenu. */
export const Blocks = ({ blocks }: { blocks: readonly Block[] }) => (
  <div className={classes.blocks}>
    {blocks.map((block, index) => (
      <BlockView key={index} block={block} />
    ))}
  </div>
);

const BlockView = ({ block }: { block: Block }) => {
  switch (block.type) {
    case "paragraph":
      return (
        <p className={classes.paragraph} data-tone={block.tone}>
          <RichText text={block.text} />
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className={classes.list}>
          {block.items.map((item, index) => (
            <li key={index}>
              <RichText text={item} />
            </li>
          ))}
        </List>
      );
    }
    case "labelled":
      return (
        <div className={classes.labelled}>
          <p className={classes.label}>{block.label}</p>
          <Blocks blocks={block.blocks} />
        </div>
      );
  }
};
