import type { BadgeTone, Statut, VotePositionValue } from "@clair/ui";
import type { LucideIcon } from "lucide-react";
import type { Step } from "../shared/editorial/Steps.tsx";
import type { Block } from "../shared/rich-text/rich-text.ts";

/** Étiquette d'une carte : position de vote, statut législatif ou libellé libre. */
export type ArticleBadge =
  | { kind: "vote"; position: VotePositionValue }
  | { kind: "statut"; statut: Statut }
  | { kind: "libelle"; label: string; tone: BadgeTone };

export type ArticleCard = {
  title?: string;
  /** Icône décorative placée avant le titre. */
  icon?: LucideIcon;
  badge?: ArticleBadge;
  blocks: readonly Block[];
};

export type ArticleBlock =
  | Block
  | {
      type: "cards";
      columns: 1 | 2 | 3;
      cards: readonly ArticleCard[];
      /** Liste longue : seules les `visible` premières cartes sont affichées d'abord. */
      collapsible?: { visible: number; moreLabel: string };
    }
  | { type: "steps"; steps: readonly Step[] };

export type ArticleSection = {
  /** Ancre citée par d'autres pages (`#saisine`, `#amendements-sort`). */
  id?: string;
  title: string;
  blocks: readonly ArticleBlock[];
};

export type ArticleAction = { label: string; href: string; icon?: LucideIcon };

/** Fiche « Comprendre » : un thème institutionnel expliqué simplement. */
export type ComprendreArticle = {
  slug: string;
  title: string;
  /** Titre court de la carte sur la page d'accueil de la rubrique. */
  shortTitle: string;
  icon: LucideIcon;
  /** Résumé affiché sur la page d'accueil de la rubrique. */
  summary: string;
  /** Encart « Explorez les données en temps réel sur CLAIR ». */
  liveData?: { title: string; actions: readonly ArticleAction[] };
  sections: readonly ArticleSection[];
  /** Liens d'exploration en fin de fiche (le premier est l'action principale). */
  actions: readonly ArticleAction[];
};
