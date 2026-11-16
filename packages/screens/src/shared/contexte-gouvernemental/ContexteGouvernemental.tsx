import type {
  ContexteGouvernemental,
  MotionCensure,
  MotionDuScrutin,
  PersonneGouvernement,
  RepereGouvernement,
  StadeProjet,
} from "@clair/data";
import { Badge, type BadgeTone, Link } from "@clair/ui";
import { Gavel, Landmark } from "lucide-react";
import {
  dateLongue,
  LIBELLES_STADE,
  libellePoste,
  lienFiche,
  nomPersonne,
} from "../gouvernements/gouvernements.ts";
import { scrutinHref } from "../scrutins.ts";
import classes from "./ContexteGouvernemental.module.css";

/** Lien vers la page d'un gouvernement (même adresse que apps/web : `/gouvernements/<slug>`). */
const LienGouvernement = ({ g, ancre }: { g: RepereGouvernement | null; ancre: string }) =>
  g ? (
    <Link href={`/gouvernements/${encodeURIComponent(g.slug)}#${ancre}`}>gouvernement {g.nom}</Link>
  ) : (
    <>Gouvernement</>
  );

/** Nom d'une personne, lié à sa fiche quand elle en a une. */
const Nom = ({ p }: { p: PersonneGouvernement }) => {
  const fiche = lienFiche(p);
  return fiche ? <Link href={fiche}>{nomPersonne(p)}</Link> : <span>{nomPersonne(p)}</span>;
};

const TON_STADE: Record<StadeProjet, BadgeTone> = {
  promulgue: "succes",
  adopte: "info",
  examine: "avertissement",
  depose: "neutre",
};

type Signataire = ContexteGouvernemental["projets"][number]["signataires"][number];

const NomEtPoste = ({ s }: { s: Signataire }) => (
  <>
    <Nom p={s.membre} />
    <span className={classes.mention}>
      {" "}
      ({libellePoste(s.qualite, s.intituleCourt, s.intitule).toLowerCase()})
    </span>
  </>
);

/** « Porté par X (ministre · intérieur), avec Y et Z, au nom du Premier ministre W. » */
const Signataires = ({ signataires }: { signataires: Signataire[] }) => {
  const pm = signataires.find((s) => s.role === "premier_ministre");
  const chef = signataires.find((s) => s.role === "chef_de_file");
  const cos = signataires.filter((s) => s.role === "cosignataire");
  if (!chef && pm) {
    return (
      <p className={classes.texte}>
        Signé du Premier ministre seul : <Nom p={pm.membre} />.
      </p>
    );
  }
  if (!chef) return null;
  return (
    <p className={classes.texte}>
      Porté par <NomEtPoste s={chef} />
      {cos.length > 0 ? (
        <>
          , avec{" "}
          {cos.map((c, i) => (
            <span key={c.membre.slug}>
              {i > 0 ? (i === cos.length - 1 ? " et " : ", ") : null}
              <NomEtPoste s={c} />
            </span>
          ))}
        </>
      ) : null}
      {pm ? (
        <>
          , au nom du Premier ministre <Nom p={pm.membre} />
        </>
      ) : null}
      .
    </p>
  );
};

/** Une motion de censure liée à un 49.3 : voix, majorité requise, résultat, lien vers le scrutin. */
const Motion = ({ m }: { m: MotionCensure }) => (
  <li className={classes.motion} data-adoptee={m.adoptee || undefined}>
    <span className={classes.fort}>
      {m.premierSignataire ? `Motion de ${m.premierSignataire}` : "Motion de censure"}
    </span>
    {" : "}
    {m.pour.toLocaleString("fr-FR")} voix pour
    {m.majoriteRequise !== null ? (
      <>, {m.majoriteRequise.toLocaleString("fr-FR")} requises</>
    ) : null}
    , {m.adoptee ? <strong>adoptée, le gouvernement est renversé</strong> : "rejetée"}
    {" · "}
    <Link href={scrutinHref(m.scrutin)}>scrutin du {dateLongue(m.date)}</Link>
  </li>
);

const SANS_PREFIXE = /^Engagement de la responsabilité du Gouvernement sur /i;

export type ContexteGouvernementalBandeauProps = {
  contexte: ContexteGouvernemental | null | undefined;
  /** Sur la page d'un dossier d'engagement, le texte visé est nommé plutôt que « ce texte ». */
  dossierUid?: string;
};

/**
 * « Le Gouvernement et ce texte » : le projet de loi qu'il a déposé et ses signataires, ses
 * recours au 49.3 et les motions de censure qu'ils ont suscitées. Bandeau des fiches dossier et
 * sujet (reprise de `ContexteGouvernementalBandeau` de apps/web). Rien sans contexte.
 */
export const ContexteGouvernementalBandeau = ({
  contexte,
  dossierUid,
}: ContexteGouvernementalBandeauProps) => {
  if (!contexte || (contexte.projets.length === 0 && contexte.engagements.length === 0)) {
    return null;
  }
  const nbEngagements = contexte.engagements.length;

  return (
    <section className={classes.bandeau} aria-labelledby="gouvernement-et-texte">
      <h2 id="gouvernement-et-texte" className="clair-visually-hidden">
        Le Gouvernement et ce texte
      </h2>
      {contexte.projets.map((p) => (
        <div key={p.dossier.uid} className={classes.bloc}>
          <Landmark className={classes.icone} aria-hidden="true" />
          <div className={classes.corps}>
            <h3 className={classes.surtitre}>Projet de loi du Gouvernement</h3>
            <p className={classes.texte}>
              Déposé {p.chambreDepot === "senat" ? "au Sénat" : "à l’Assemblée"} le{" "}
              {dateLongue(p.dateDepot)} par le{" "}
              <LienGouvernement g={p.gouvernement} ancre="textes" />.{" "}
              <Badge tone={TON_STADE[p.stade]} size="sm">
                {LIBELLES_STADE[p.stade]}
              </Badge>
            </p>
            <Signataires signataires={p.signataires} />
          </div>
        </div>
      ))}

      {nbEngagements > 0 ? (
        <div className={classes.bloc}>
          <Gavel className={classes.icone} aria-hidden="true" />
          <div className={classes.corps}>
            <h3 className={classes.surtitre}>
              {nbEngagements > 1
                ? `${nbEngagements} recours à l’article 49, alinéa 3`
                : "Recours à l’article 49, alinéa 3"}
            </h3>
            <ol className={classes.liste}>
              {contexte.engagements.map((e) => {
                const surCeDossier = dossierUid === e.dossier.uid;
                return (
                  <li key={e.dossier.uid} className={classes.texte}>
                    <p className={classes.texte}>
                      <span className={classes.fort}>{dateLongue(e.date)}</span> :{" "}
                      {nomPersonne(e.premierMinistre)} engage la responsabilité du{" "}
                      <LienGouvernement g={e.gouvernement} ancre="censure" />{" "}
                      {surCeDossier && e.texte ? (
                        <>
                          sur{" "}
                          <Link href={`/dossiers/${encodeURIComponent(e.texte.uid)}`}>
                            {e.texte.titre}
                          </Link>
                        </>
                      ) : (
                        <>
                          (
                          <Link href={`/dossiers/${encodeURIComponent(e.dossier.uid)}`}>
                            {e.dossier.titre.replace(SANS_PREFIXE, "")}
                          </Link>
                          )
                        </>
                      )}
                      .
                    </p>
                    {e.motions.length > 0 ? (
                      <ul className={classes.motions}>
                        {e.motions.map((m) => (
                          <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
                        ))}
                      </ul>
                    ) : (
                      <p className={classes.mention}>
                        Aucune motion de censure rattachée à cet engagement.
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
};

/**
 * Bandeau du scrutin d'une motion de censure : le gouvernement visé (celui en fonction le jour du
 * vote), le 49.3 auquel elle répond, la majorité requise et le résultat (reprise de
 * `MotionCensureBandeau` de apps/web). Une motion adoptée renverse le gouvernement : elle est
 * mise en avant par la bordure et le texte, pas par la seule couleur.
 */
export const MotionCensureBandeau = ({
  motion,
}: {
  motion: MotionDuScrutin | null | undefined;
}) => {
  if (!motion) return null;
  const { adoptee } = motion;
  return (
    <section
      className={classes.bandeau}
      data-adoptee={adoptee || undefined}
      aria-labelledby="motion-de-censure"
    >
      <div className={classes.bloc}>
        <Gavel className={classes.icone} aria-hidden="true" />
        <div className={classes.corps}>
          <h2 id="motion-de-censure" className={classes.surtitre}>
            Motion de censure · article 49, alinéa {motion.alinea}
            {motion.alinea === 2 ? " (motion spontanée)" : " (en réponse à un 49.3)"}
          </h2>
          <p className={classes.texte}>
            Contre le <LienGouvernement g={motion.gouvernement} ancre="censure" />
            {motion.engagement ? (
              <>
                , en réponse au 49.3 du {dateLongue(motion.engagement.date)}
                {motion.engagement.texte ? (
                  <>
                    {" "}
                    sur{" "}
                    <Link href={`/dossiers/${encodeURIComponent(motion.engagement.texte.uid)}`}>
                      {motion.engagement.texte.titre}
                    </Link>
                  </>
                ) : null}
              </>
            ) : null}
            {motion.alinea === 3 && !motion.engagement
              ? ", en réponse à un 49.3 que la source ne précise pas"
              : null}
            .
          </p>
          <p className={classes.texte}>
            {motion.premierSignataire ? <>Déposée par {motion.premierSignataire}. </> : null}
            {motion.pour.toLocaleString("fr-FR")} voix pour
            {motion.majoriteRequise !== null ? (
              <>
                , {motion.majoriteRequise.toLocaleString("fr-FR")} requises (majorité absolue des
                membres de l'Assemblée)
              </>
            ) : null}{" "}
            :{" "}
            {adoptee ? (
              <strong>adoptée, le gouvernement est renversé</strong>
            ) : (
              "rejetée, le gouvernement reste en place"
            )}
            .
          </p>
        </div>
      </div>
    </section>
  );
};
