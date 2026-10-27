"use client";

import { Timeline } from "@mantine/core";
import { Check } from "lucide-react";
import { type ReactNode, useId } from "react";
import type { BadgeTone } from "../../core/badge/Badge.tsx";
import { Badge } from "../../core/badge/Badge.tsx";
import { ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { EmptyState } from "../../core/query-states/QueryStates.tsx";
import { formatSur, jourParis, Quand } from "../../lib/dates.tsx";
import classes from "./LegislativeTimeline.module.css";

/** État d'une étape : franchie, en cours, à venir (valeurs de l'API). */
export type LegislativeStepStatus = "done" | "active" | "pending";

/** Issue officielle d'une étape (valeurs de l'API, apps/web lib/legislative-steps.ts). */
export type LegislativeStepOutcome =
  | "adopted"
  | "adopted_modified"
  | "adopted_conforme"
  | "rejected"
  | "adopted_49_3"
  | "adopted_definitive"
  | "cmp_accord"
  | "cmp_desaccord"
  | "cc_conforme"
  | "cc_partiel"
  | "cc_reserve";

export type LegislativeStep = {
  /** Code stable de l'étape (`AN1`, `SN1`, `CMP`…). */
  code: string;
  /** Libellé de l'étape (« 1re lecture »). */
  label: string;
  /** Chambre de l'étape ; `both` pour une étape commune (commission mixte paritaire). */
  chambre: "assemblee" | "senat" | "both" | null;
  status: LegislativeStepStatus;
  outcome?: LegislativeStepOutcome | null;
  /** Date ISO de l'étape. */
  date?: string | null;
  /** Précision officielle (« Texte adopté n° 42 »). */
  detail?: string | null;
};

export type LegislativeTimelineProps = {
  steps: LegislativeStep[];
  /** Titre du bloc. */
  title?: string;
  /** Niveau du titre dans la page. */
  headingLevel?: 2 | 3 | 4;
  /** Contenu ajouté sous la frise (détail des séances de chaque étape). */
  children?: ReactNode;
};

export const LEGISLATIVE_OUTCOMES: Record<
  LegislativeStepOutcome,
  { label: string; tone: BadgeTone }
> = {
  adopted: { label: "Adopté", tone: "succes" },
  adopted_modified: { label: "Adopté modifié", tone: "succes" },
  adopted_conforme: { label: "Adopté conforme", tone: "succes" },
  adopted_49_3: { label: "Adopté (49.3)", tone: "succes" },
  adopted_definitive: { label: "Adopté définitivement", tone: "succes" },
  rejected: { label: "Rejeté", tone: "erreur" },
  cmp_accord: { label: "Accord", tone: "succes" },
  cmp_desaccord: { label: "Désaccord", tone: "avertissement" },
  cc_conforme: { label: "Conforme", tone: "succes" },
  cc_partiel: { label: "Partiellement conforme", tone: "avertissement" },
  cc_reserve: { label: "Conforme avec réserve", tone: "avertissement" },
};

const STATUS_LABELS: Record<LegislativeStepStatus, string> = {
  done: "Étape franchie",
  active: "Étape en cours",
  pending: "Étape à venir",
};

const chambreDe = (chambre: LegislativeStep["chambre"]) => {
  if (chambre === "both") return <span className={classes.both}>Assemblée nationale et Sénat</span>;
  if (chambre === null) return null;
  return <ChambreBadge chambre={chambre} short size="sm" />;
};

/** Phrase qui annonce où en est la procédure, lue avant la frise. */
const summaryOf = (steps: LegislativeStep[]) => {
  const current = steps.find((step) => step.status === "active");
  if (current) {
    return `Étape en cours : ${current.label}${formatSur(jourParis, current.date) ? `, depuis le ${formatSur(jourParis, current.date)}` : ""}.`;
  }
  const done = steps.filter((step) => step.status === "done").length;
  if (done === steps.length) return "Toutes les étapes sont franchies.";
  if (done === 0) return "Aucune étape n'est encore franchie.";
  return `${done} étape${done > 1 ? "s" : ""} franchie${done > 1 ? "s" : ""} sur ${steps.length}.`;
};

/**
 * Frise du parcours d'un dossier législatif : étapes franchies, en cours et à venir, avec leur
 * chambre, leur date et leur issue officielle. L'étape courante est annoncée en texte (phrase de
 * résumé et mention de chaque étape), pas seulement par le style. Base : `Timeline` de Mantine.
 */
export const LegislativeTimeline = ({
  steps,
  title = "Parcours législatif",
  headingLevel = 2,
  children,
}: LegislativeTimelineProps) => {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  const lastReached = steps.reduce(
    (last, step, index) => (step.status === "pending" ? last : index),
    -1,
  );

  return (
    <section className={classes.root} aria-labelledby={titleId}>
      <Heading id={titleId} className={classes.title}>
        {title}
      </Heading>
      {steps.length === 0 ? (
        <EmptyState title="Aucune étape connue pour ce dossier" />
      ) : (
        <>
          <p className={classes.summary}>{summaryOf(steps)}</p>
          <Timeline
            active={lastReached}
            bulletSize={20}
            lineWidth={2}
            role="list"
            aria-labelledby={titleId}
            classNames={{
              root: classes.timeline,
              item: classes.item,
              itemBullet: classes.bullet,
              itemTitle: classes.itemTitle,
            }}
          >
            {steps.map((step, index) => {
              const outcome = step.outcome ? LEGISLATIVE_OUTCOMES[step.outcome] : null;
              const nextPending = steps[index + 1]?.status === "pending";
              return (
                <Timeline.Item
                  key={step.code}
                  role="listitem"
                  data-status={step.status}
                  aria-current={step.status === "active" ? "step" : undefined}
                  lineVariant={nextPending ? "dashed" : "solid"}
                  bullet={step.status === "done" ? <Check aria-hidden="true" /> : null}
                  title={
                    <>
                      <span className="clair-visually-hidden">{STATUS_LABELS[step.status]} : </span>
                      {step.label}
                    </>
                  }
                >
                  <div className={classes.meta}>
                    {step.status === "active" ? (
                      <Badge tone="info" size="sm">
                        En cours
                      </Badge>
                    ) : null}
                    {step.status === "pending" ? (
                      <span className={classes.pending}>À venir</span>
                    ) : null}
                    {chambreDe(step.chambre)}
                    {step.date ? <Quand className={classes.date} iso={step.date} /> : null}
                    {outcome ? (
                      <Badge tone={outcome.tone} size="sm">
                        {outcome.label}
                      </Badge>
                    ) : null}
                  </div>
                  {step.detail ? <p className={classes.detail}>{step.detail}</p> : null}
                </Timeline.Item>
              );
            })}
          </Timeline>
        </>
      )}
      {children}
    </section>
  );
};
