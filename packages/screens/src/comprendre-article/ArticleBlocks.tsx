import { Badge, Card, StatutBadge, VotePosition } from "@clair/ui";
import { Fragment } from "react";
import editorial from "../shared/editorial/Editorial.module.css";
import { Steps } from "../shared/editorial/Steps.tsx";
import { Blocks } from "../shared/rich-text/RichText.tsx";
import { CollapsibleList } from "./CollapsibleList.tsx";
import classes from "./ComprendreArticleScreen.module.css";
import type { ArticleBadge, ArticleBlock, ArticleCard } from "./types.ts";

const BadgeView = ({ badge }: { badge: ArticleBadge }) => {
  switch (badge.kind) {
    case "vote":
      return <VotePosition position={badge.position} />;
    case "statut":
      return <StatutBadge statut={badge.statut} />;
    case "libelle":
      return <Badge tone={badge.tone}>{badge.label}</Badge>;
  }
};

const CardView = ({ card }: { card: ArticleCard }) => {
  const Icon = card.icon;
  const title =
    card.title !== undefined && Icon ? (
      <span className={classes.cardTitle}>
        <Icon aria-hidden="true" className={classes.cardTitleIcon} />
        {card.title}
      </span>
    ) : (
      card.title
    );
  return (
    <Card as="li" title={title} eyebrow={card.badge ? <BadgeView badge={card.badge} /> : undefined}>
      <div className={classes.cardBody}>
        <Blocks blocks={card.blocks} />
      </div>
    </Card>
  );
};

/** Blocs d'une section de fiche : texte, grilles de cartes (repliables) et étapes. */
export const ArticleBlocks = ({ blocks }: { blocks: readonly ArticleBlock[] }) => (
  <div className={classes.blocks}>
    {blocks.map((block, index) => {
      const key = `${block.type}-${index}`;
      if (block.type === "steps") return <Steps key={key} steps={block.steps} />;
      if (block.type === "cards") {
        const cards = block.cards.map((card, cardIndex) => (
          <CardView key={card.title ?? `carte-${cardIndex}`} card={card} />
        ));
        return block.collapsible ? (
          <CollapsibleList
            key={key}
            className={editorial.grid}
            columns={block.columns}
            visible={block.collapsible.visible}
            moreLabel={block.collapsible.moreLabel}
          >
            {cards}
          </CollapsibleList>
        ) : (
          <ul key={key} className={editorial.grid} data-columns={block.columns}>
            {cards}
          </ul>
        );
      }
      return (
        <Fragment key={key}>
          <Blocks blocks={[block]} />
        </Fragment>
      );
    })}
  </div>
);
