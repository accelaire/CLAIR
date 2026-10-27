import type { StatsParlementaireDetail } from "@clair/data";
import { ProvenanceLabel, SectionHeader, StatCard } from "@clair/ui";
import { FileText, Megaphone, MessageCircleQuestion, UserCheck, Users, Vote } from "lucide-react";
import { formatDate, formatNombre } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

type FicheStatistiquesProps = {
  stats: StatsParlementaireDetail;
  /** « Statistiques » pour un mandat en cours, « Bilan de son mandat » sinon. */
  titre: string;
  /** Date du dernier calcul. */
  calculeLe: string | null;
};

/**
 * Chiffres clés d'un parlementaire. Ce sont des données calculées par CLAIR à partir des scrutins
 * et des comptes rendus : elles sont signalées comme telles, avec un lien vers la méthode.
 */
export const FicheStatistiques = ({ stats, titre, calculeLe }: FicheStatistiquesProps) => (
  <section className={classes.section} aria-labelledby="statistiques">
    <SectionHeader
      id="statistiques"
      title={titre}
      description={
        <span className={classes.provenance}>
          <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />
          {calculeLe ? <span>Calcul du {formatDate(calculeLe)}</span> : null}
        </span>
      }
    />
    <ul className={classes.stats}>
      <StatCard
        as="li"
        label="Présence"
        value={stats.presence}
        unit="%"
        icon={<UserCheck />}
        detail={
          stats.presenceSolennel === null
            ? undefined
            : `${stats.presenceSolennel} % aux scrutins solennels`
        }
        help="Part des scrutins publics auxquels l'élu a pris part."
      />
      <StatCard
        as="li"
        label="Loyauté au groupe"
        value={stats.loyaute}
        unit="%"
        icon={<Users />}
        help="Part des votes conformes à la position majoritaire de son groupe."
      />
      <StatCard as="li" label="Votes" value={stats.participation} icon={<Vote />} />
      <StatCard as="li" label="Interventions" value={stats.interventions} icon={<Megaphone />} />
      <StatCard
        as="li"
        label="Amendements déposés"
        value={stats.amendements.proposes}
        icon={<FileText />}
        detail={`${formatNombre(stats.amendements.adoptes)} adopté${stats.amendements.adoptes > 1 ? "s" : ""}`}
      />
      <StatCard
        as="li"
        label="Questions posées"
        value={stats.questions}
        icon={<MessageCircleQuestion />}
      />
    </ul>
  </section>
);
