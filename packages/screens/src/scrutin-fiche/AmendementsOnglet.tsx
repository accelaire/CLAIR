import type { ScrutinDetail } from "@clair/data";
import { AmendementCard, Link } from "@clair/ui";
import { Landmark, MessageSquare } from "lucide-react";
import { Intervention } from "./Intervention.tsx";
import classes from "./ScrutinFicheScreen.module.css";
import { seanceHref } from "./ScrutinInfos.tsx";

/** `/dossiers/:uid?tab=amendements&amendement=:uid` : l'amendement parmi ceux de son texte. */
export const amendementHref = (dossierUid: string, amendementUid: string) =>
  `/dossiers/${encodeURIComponent(dossierUid)}?${new URLSearchParams({
    tab: "amendements",
    amendement: amendementUid,
  }).toString()}`;

/**
 * Onglet « Amendements » : les amendements mis aux voix par ce scrutin, avec leur défense en
 * séance quand elle est connue (c'est la parole de l'auteur sur ce qu'il demande), et les liens
 * « Lire le débat de ce vote » (onglet des débats) et « Voir dans la séance » (comme apps/web).
 */
export const AmendementsOnglet = ({
  scrutin,
  debatHref,
}: {
  scrutin: ScrutinDetail;
  /** Onglet des débats de ce scrutin, s'il en a. */
  debatHref?: string | null;
}) => {
  const seance = seanceHref(scrutin);
  return (
    <ul className={classes.amendements}>
      {scrutin.amendements.map((amendement) => {
        const dossierUid = amendement.dossier?.uid ?? scrutin.dossier?.uid;
        return (
          <li key={amendement.id} className={classes.amendement}>
            <AmendementCard
              as="div"
              titleAs="h3"
              amendement={amendement}
              parentHref={
                amendement.amendementParent && dossierUid
                  ? amendementHref(dossierUid, amendement.amendementParent.uid)
                  : undefined
              }
              dossier={
                dossierUid
                  ? {
                      label: "Voir l'amendement dans son dossier",
                      href: amendementHref(dossierUid, amendement.uid),
                    }
                  : null
              }
            />
            {amendement.defense ? (
              <section
                className={classes.defense}
                aria-label={`Défense de l'amendement n° ${amendement.numero} en séance`}
              >
                <p className={classes.defenseTitre}>Défendu en séance</p>
                <Intervention intervention={amendement.defense} chambre={scrutin.chambre} />
                {debatHref || seance ? (
                  <p className={classes.defenseLiens}>
                    {debatHref ? (
                      <Link href={debatHref}>
                        <MessageSquare className={classes.defenseIcone} aria-hidden="true" />
                        Lire le débat de ce vote
                      </Link>
                    ) : null}
                    {seance ? (
                      <Link href={seance}>
                        <Landmark className={classes.defenseIcone} aria-hidden="true" />
                        Voir dans la séance
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </section>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
