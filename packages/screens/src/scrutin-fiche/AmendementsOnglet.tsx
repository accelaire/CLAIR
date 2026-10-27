import type { ScrutinDetail } from "@clair/data";
import { AmendementCard } from "@clair/ui";
import { Intervention } from "./Intervention.tsx";
import classes from "./ScrutinFicheScreen.module.css";

/** `/dossiers/:uid?tab=amendements&amendement=:uid` : l'amendement parmi ceux de son texte. */
export const amendementHref = (dossierUid: string, amendementUid: string) =>
  `/dossiers/${encodeURIComponent(dossierUid)}?${new URLSearchParams({
    tab: "amendements",
    amendement: amendementUid,
  }).toString()}`;

/**
 * Onglet « Amendements » : les amendements mis aux voix par ce scrutin, avec leur défense en
 * séance quand elle est connue (c'est la parole de l'auteur sur ce qu'il demande).
 */
export const AmendementsOnglet = ({ scrutin }: { scrutin: ScrutinDetail }) => (
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
            </section>
          ) : null}
        </li>
      );
    })}
  </ul>
);
