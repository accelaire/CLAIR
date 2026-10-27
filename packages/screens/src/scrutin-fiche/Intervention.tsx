import type { InterventionScrutin } from "@clair/data";
import { Badge, ExpandableText, GroupeBadge, Link } from "@clair/ui";
import { parlementaireHref } from "../shared/scrutins.ts";
import classes from "./ScrutinFicheScreen.module.css";

/** Nom de l'orateur : le parlementaire relié, sinon le nom écrit au compte rendu. */
export const nomOrateur = (intervention: InterventionScrutin) => {
  const p = intervention.parlementaire;
  return p
    ? `${p.prenom} ${p.nom}`
    : [intervention.orateurPrenom, intervention.orateurNom].filter(Boolean).join(" ") ||
        "Orateur non identifié";
};

/** Texte d'un extrait de compte rendu : balises retirées, espaces normalisés. */
const texte = (contenu: string) =>
  contenu
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

type InterventionProps = {
  intervention: InterventionScrutin;
  chambre: string;
  /** Numéro de l'amendement que cette prise de parole défend, s'il y en a un. */
  defend?: string;
};

/**
 * Prise de parole en séance : orateur (lien vers sa fiche), groupe ou qualité, extrait repliable
 * et lien vers le compte rendu officiel quand l'extrait est tronqué.
 */
export const Intervention = ({ intervention, chambre, defend }: InterventionProps) => {
  const p = intervention.parlementaire;
  return (
    <article className={classes.intervention} data-defense={defend ? "" : undefined}>
      <p className={classes.orateur}>
        {p ? (
          <Link href={parlementaireHref(chambre, p.slug)}>{nomOrateur(intervention)}</Link>
        ) : (
          <span>{nomOrateur(intervention)}</span>
        )}
        {p?.groupe ? (
          <GroupeBadge sigle={p.groupe.nom} couleur={p.groupe.couleur} size="sm" />
        ) : intervention.orateurQualite ? (
          <Badge tone="neutre" size="sm">
            {intervention.orateurQualite}
          </Badge>
        ) : null}
        {defend ? (
          <Badge tone="info" size="sm">
            Défense de l'amendement n° {defend}
          </Badge>
        ) : null}
      </p>
      <ExpandableText maxLength={400}>{texte(intervention.contenu)}</ExpandableText>
      {intervention.hasMore && intervention.sourceUrl ? (
        <p className={classes.mention}>
          <Link href={intervention.sourceUrl} external>
            Lire l'intervention entière au compte rendu
          </Link>
        </p>
      ) : null}
    </article>
  );
};
