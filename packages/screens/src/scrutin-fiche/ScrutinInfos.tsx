"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, GroupeClasse, ScrutinDetail } from "@clair/data";
import { Badge, ChambreBadge, Link, parseStatut, StatutBadge } from "@clair/ui";
import { NATURES_VOTE, parlementaireHref, periodeScrutin, TYPES_VOTE } from "../shared/scrutins.ts";
import { type CibleDemandeur, nomsDuGroupe, segmenterDemandeur } from "./liens-demandeurs.ts";
import classes from "./ScrutinFicheScreen.module.css";

const formatDateLongue = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

/**
 * Demandeurs du scrutin public, un par ligne : la source les sépare par des retours à la ligne,
 * ou les enchaîne (« Président du groupe X Présidente du groupe Y », parfois sans espace après
 * le guillemet fermant).
 */
export const demandeurs = (texte: string) =>
  texte
    .split(
      /[\r\n]+|(?:\s+|(?<="))(?=Pr[eé]sident(?:e)?\s|Le\s+Gouvernement|La\s+[Cc]onf[eé]rence)/u,
    )
    .map((part) => part.trim())
    .filter(Boolean);

/** Adresse de la séance du vote, quand elle a une page sur le site. */
export const seanceHref = (scrutin: Pick<ScrutinDetail, "seance" | "id">) => {
  if (!scrutin.seance) return null;
  const params = new URLSearchParams({ vote: scrutin.id });
  if (scrutin.seance.rang !== null) params.set("rang", String(scrutin.seance.rang));
  return `/reunions/${encodeURIComponent(scrutin.seance.uid)}?${params.toString()}`;
};

/** Période du scrutin, pour les groupes de cette période (session au Sénat, législature sinon). */
const periodeQuery = (scrutin: ScrutinDetail): Record<string, string> =>
  scrutin.chambre === "senat"
    ? scrutin.session
      ? { session: scrutin.session }
      : {}
    : scrutin.legislature != null
      ? { legislature: String(scrutin.legislature) }
      : {};

/**
 * Noms reconnus dans « Vote demandé par » : les groupes de la période (fiche à cette période,
 * comme le récapitulatif des votes) et les votants du scrutin.
 */
const ciblesDemandeurs = (
  scrutin: ScrutinDetail,
  groupes: readonly GroupeClasse[],
): CibleDemandeur[] => {
  const periode = new URLSearchParams(periodeQuery(scrutin)).toString();
  const ciblesGroupes = groupes.flatMap((groupe) =>
    nomsDuGroupe(groupe).map((nom) => ({
      nom,
      href: `/groupes/${groupe.chambre}/${groupe.slug}${periode ? `?${periode}` : ""}`,
    })),
  );
  const votants = Object.values(scrutin.votesByPosition ?? {}).flat();
  const ciblesVotants = votants.map(({ parlementaire }) => ({
    nom: `${parlementaire.prenom} ${parlementaire.nom}`,
    href: parlementaireHref(parlementaire.chambre, parlementaire.slug),
  }));
  return [...ciblesGroupes, ...ciblesVotants];
};

/** Un demandeur, ses groupes et parlementaires cités liés à leur fiche. */
const Demandeur = ({ texte, cibles }: { texte: string; cibles: readonly CibleDemandeur[] }) => (
  <>
    {segmenterDemandeur(texte, cibles).map((segment, index) =>
      segment.href ? (
        <Link key={index} href={segment.href}>
          {segment.texte}
        </Link>
      ) : (
        segment.texte
      ),
    )}
  </>
);

/**
 * Fiche signalétique d'un scrutin : date (et lien vers la séance), chambre et période, demandeurs,
 * mode et objet du vote, résultat officiel, thématiques et source officielle.
 */
export const ScrutinInfos = ({ scrutin }: { scrutin: ScrutinDetail }) => {
  const statut = parseStatut(scrutin.sort);
  const seance = seanceHref(scrutin);
  const periode = periodeScrutin(scrutin);
  const typeVote = scrutin.typeVote ? (TYPES_VOTE[scrutin.typeVote] ?? scrutin.typeVote) : null;
  const nature = scrutin.natureVote ? (NATURES_VOTE[scrutin.natureVote] ?? null) : null;
  const liste = scrutin.demandeurTexte ? demandeurs(scrutin.demandeurTexte) : [];
  // Groupes de la période, pour lier ceux que cite le demandeur ; sans réponse, le texte reste seul.
  const groupes = useApiQuery<ApiData<GroupeClasse[]>>(
    "/groupes",
    { chambre: scrutin.chambre, ...periodeQuery(scrutin) },
    { enabled: liste.length > 0 },
  );
  const cibles = liste.length > 0 ? ciblesDemandeurs(scrutin, groupes.data?.data ?? []) : [];

  return (
    <section className={classes.infos} aria-labelledby="infos-scrutin">
      <h2 id="infos-scrutin" className={classes.infosTitle}>
        Informations
      </h2>
      <dl className={classes.dl}>
        <div>
          <dt>{seance ? "Séance publique" : "Date du scrutin"}</dt>
          <dd>
            {seance ? (
              <Link href={seance}>
                <time dateTime={scrutin.date}>{formatDateLongue(scrutin.date)}</time>
                <span className="clair-visually-hidden"> : voir ce vote dans la séance</span>
              </Link>
            ) : (
              <time dateTime={scrutin.date}>{formatDateLongue(scrutin.date)}</time>
            )}
          </dd>
        </div>
        <div>
          <dt>Chambre</dt>
          <dd className={classes.inline}>
            <ChambreBadge chambre={scrutin.chambre} size="sm" />
            {periode ? (
              <Badge tone="neutre" size="sm">
                {periode}
              </Badge>
            ) : null}
          </dd>
        </div>
        {liste.length > 0 ? (
          <div className={classes.large}>
            <dt>Vote demandé par</dt>
            <dd>
              {liste.length > 1 ? (
                <ul className={classes.demandeurs}>
                  {liste.map((demandeur) => (
                    <li key={demandeur}>
                      <Demandeur texte={demandeur} cibles={cibles} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Demandeur texte={liste[0] ?? ""} cibles={cibles} />
              )}
            </dd>
          </div>
        ) : null}
        {typeVote ? (
          <div>
            <dt>Mode de scrutin</dt>
            <dd className={classes.inline}>
              {typeVote}
              {(scrutin.importance ?? 0) >= 4 ? (
                <Badge tone="avertissement" size="sm">
                  Important · calculé par CLAIR
                </Badge>
              ) : null}
            </dd>
          </div>
        ) : null}
        {nature ? (
          <div>
            <dt>Objet du vote</dt>
            <dd>{nature}</dd>
          </div>
        ) : null}
        <div>
          <dt>Résultat du vote</dt>
          <dd>
            {statut ? <StatutBadge statut={statut} /> : <Badge tone="neutre">{scrutin.sort}</Badge>}
          </dd>
        </div>
        {scrutin.tags.length > 0 ? (
          <div className={classes.large}>
            <dt>Thématiques</dt>
            <dd>
              <ul className={classes.tags}>
                {scrutin.tags.map((tag) => (
                  <li key={tag}>
                    <Link href={`/scrutins?tag=${encodeURIComponent(tag)}`}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
      <p className={classes.mention}>
        Comprendre : <Link href="/comprendre/scrutin">comment se lit un scrutin public</Link>
      </p>
      {scrutin.sourceUrl ? (
        <p className={classes.mention}>
          <Link href={scrutin.sourceUrl} external>
            Voir sur {scrutin.chambre === "senat" ? "senat.fr" : "assemblee-nationale.fr"}
          </Link>
        </p>
      ) : null}
    </section>
  );
};
