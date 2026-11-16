import { type GroupeDetail, PRESENCE_SENAT_EXPLICATION } from "@clair/data";
import { ProvenanceLabel, StatCard } from "@clair/ui";
import { formatPourcent } from "../groupes-liste/format.ts";
import classes from "./GroupeFicheScreen.module.css";

export const METHODOLOGIE_INDICATEURS = "/comprendre/parlementaire";

/**
 * Chiffres clés du groupe : effectif et rang, présence, loyauté moyenne et amendements.
 * Ce sont des moyennes calculées par CLAIR, signalées comme telles.
 */
export const ChiffresGroupe = ({ groupe }: { groupe: GroupeDetail }) => {
  const { stats } = groupe;
  const solennel = stats.presenceSolennelMoyenne;
  return (
    <section aria-labelledby="chiffres-cles" className={classes.section}>
      <h2 id="chiffres-cles" className="clair-visually-hidden">
        Chiffres clés
      </h2>
      <ul className={classes.chiffres}>
        <StatCard
          as="li"
          label="Membres actifs"
          value={groupe.membresActifsCount}
          detail={
            groupe.rang && groupe.totalGroupes
              ? `${groupe.rang}${groupe.rang === 1 ? "er" : "e"} groupe sur ${groupe.totalGroupes} par effectif`
              : undefined
          }
        />
        {groupe.chambre === "senat" ? (
          // Sénat : la présence ne se mesure qu'aux votes solennels ; le taux tous scrutins compte
          // des bulletins déposés par le groupe (#108).
          <StatCard
            as="li"
            label={solennel === null ? "Participation moyenne" : "Présence moyenne"}
            value={solennel ?? stats.presenceMoyenne}
            unit="%"
            detail={
              solennel === null
                ? "Pas de scrutin solennel"
                : `aux votes solennels ; ${formatPourcent(stats.presenceMoyenne)} tous scrutins`
            }
            help={PRESENCE_SENAT_EXPLICATION}
          />
        ) : (
          <StatCard
            as="li"
            label="Présence moyenne"
            value={solennel ?? stats.presenceMoyenne}
            unit="%"
            detail={
              solennel === null
                ? undefined
                : `aux scrutins solennels ; ${formatPourcent(stats.presenceMoyenne)} tous scrutins`
            }
          />
        )}
        <StatCard as="li" label="Loyauté moyenne" value={stats.loyauteMoyenne} unit="%" />
        <StatCard as="li" label="Amendements déposés" value={groupe.totauxAmendements} />
      </ul>
      <p className={classes.provenance}>
        <ProvenanceLabel provenance="calculee" methodologyHref={METHODOLOGIE_INDICATEURS} />
      </p>
    </section>
  );
};
