import type { RichText } from "../../shared/rich-text/rich-text.ts";
import type { ArticleCard } from "../types.ts";

/** Carte simple : un titre et un paragraphe. */
export const textCard = (title: string, text: RichText): ArticleCard => ({
  title,
  blocks: [{ type: "paragraph", text }],
});
