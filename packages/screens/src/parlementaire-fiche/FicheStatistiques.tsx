import {
  type Chambre,
  type FonctionPresidence,
  PERIODE_FICHE,
  PRESENCE_HORS_CALCUL,
  PRESENCE_SENAT_EXPLICATION,
  PRESENCE_SENAT_NON_MESURABLE,
  presideUneAssemblee,
  SEUIL_SCRUTINS_CLASSEMENT,
  type StatsParlementaireDetail,
} from "@clair/data";
import { Link, ProvenanceLabel, SectionHeader, StatCard } from "@clair/ui";
import { FileText, Megaphone, MessageCircleQuestion, UserCheck, Users, Vote } from "lucide-react";
import { formatDate, formatNombre } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

type FicheStatistiquesProps = {
  stats: StatsParlementaireDetail;
  /** « Statistiques » pour un mandat en cours, « Bilan de son mandat » sinon. */
  titre: string;
  /** Date du dernier calcul. */
  calculeLe: string | null;
  chambre: Chambre;
  /** Fonctions de l'élu : un président d'assemblée en exercice ne vote pas, par usage. */
  fonctions?: readonly FonctionPresidence[];
};

const taux = (valeur: number) => `${formatNombre(valeur)}\u202f% tous scrutins`;

type CartePresenceProps = Pick<FicheStatistiquesProps, "stats" | "chambre"> & {
  /** Préside son assemblée en ce moment. */
  preside?: boolean;
};

/**
 * Carte de présence, la même structure dans les deux chambres (#108, portée de
 * `apps/web/components/parlementaire/stats-parlementaire.tsx`) : la présence aux votes solennels en
 * tête, le taux sur tous les scrutins en second. Au Sénat, ce second taux est une participation :
 * les scrutins ordinaires y sont votés par groupe.
 */
const CartePresence = ({ stats, chambre, preside = false }: CartePresenceProps) => {
  const solennel = stats.presenceSolennel ?? null;
  const senat = chambre === "senat";
  const commun = { as: "li" as const, icon: <UserCheck /> };

  // Président d'assemblée en exercice : il ne vote pas. Sa présence de carrière aux votes
  // solennels, présidences exclues, reste lisible en second.
  if (preside) {
    const president = senat ? "le président du Sénat" : "le président de l'Assemblée";
    return (
      <StatCard
        {...commun}
        label="Présence"
        value="Ne vote pas"
        detail={solennel === null ? undefined : `${formatNombre(solennel)}\u202f% hors présidence`}
        help={
          `Par usage, ${president} ne prend pas part aux votes : sa présence ne se mesure pas pendant sa présidence.` +
          (solennel === null
            ? ""
            : " Le second chiffre est sa présence aux scrutins solennels sur le reste de sa carrière parlementaire, présidences exclues.")
        }
      />
    );
  }
  // Aucun scrutin où il pouvait voter sur toute la carrière : ce n'est pas 0 %.
  if (stats.presence === null) {
    return (
      <StatCard
        {...commun}
        label="Présence"
        value="Non mesurable"
        help={`Aucun scrutin où cet élu pouvait voter sur la période. ${PRESENCE_HORS_CALCUL}`}
      />
    );
  }
  if (solennel !== null) {
    return (
      <StatCard
        {...commun}
        label="Présence"
        value={solennel}
        unit="%"
        detail={taux(stats.presence)}
        help={
          senat
            ? "Présence aux scrutins solennels : part de ceux où ce sénateur a voté en personne. Le second chiffre est sa participation à tous les scrutins publics, expliquée sous les chiffres."
            : `Présence aux scrutins solennels : part de ceux où ce député a voté (pour, contre ou abstention). Le second chiffre porte sur tous les scrutins publics. ${PRESENCE_HORS_CALCUL} ${PERIODE_FICHE}`
        }
      />
    );
  }
  // Un taux sur 28 scrutins se lit autrement qu'un taux sur 8 000 : on le dit.
  const scrutins = stats.scrutins ?? null;
  const peuDeScrutins =
    !senat && scrutins !== null && scrutins < SEUIL_SCRUTINS_CLASSEMENT
      ? `sur ${formatNombre(scrutins)} scrutin${scrutins > 1 ? "s" : ""} seulement`
      : undefined;
  return (
    <StatCard
      {...commun}
      label={senat ? "Participation" : "Présence"}
      value={stats.presence}
      unit="%"
      detail={peuDeScrutins}
      help={
        senat
          ? `Part des scrutins publics où un bulletin a été déposé pour ce sénateur, expliquée sous les chiffres. ${PRESENCE_SENAT_NON_MESURABLE}`
          : `Part des scrutins publics auxquels ce député a participé (pour, contre ou abstention). ${PRESENCE_HORS_CALCUL} Sur moins de ${SEUIL_SCRUTINS_CLASSEMENT} scrutins, il n'entre pas dans le classement. ${PERIODE_FICHE}`
      }
    />
  );
};

/**
 * Chiffres clés d'un parlementaire, sur toute sa carrière. Ce sont des données calculées par CLAIR
 * à partir des scrutins et des comptes rendus : elles sont signalées comme telles, avec un lien
 * vers la méthode, et leur période est dite.
 */
export const FicheStatistiques = ({
  stats,
  titre,
  calculeLe,
  chambre,
  fonctions = [],
}: FicheStatistiquesProps) => {
  const preside = presideUneAssemblee(fonctions);
  // Au Sénat, l'explication du vote par groupe est trop longue pour la carte : elle passe sous la
  // grille, en corps lisible.
  const explicationSenat = chambre === "senat" && !preside && stats.presence !== null;
  return (
    <section className={classes.section} aria-labelledby="statistiques">
      <SectionHeader
        id="statistiques"
        title={titre}
        description={
          <span className={classes.provenance}>
            <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />
            {calculeLe ? <span>Calcul du {formatDate(calculeLe)}</span> : null}
            <span>
              Sur toute la carrière parlementaire ; les classements comparent le mandat en cours.{" "}
              <Link href="/comprendre/parlementaire">Comprendre ces chiffres</Link>
            </span>
          </span>
        }
      />
      <ul className={classes.stats}>
        <CartePresence stats={stats} chambre={chambre} preside={preside} />
        <StatCard
          as="li"
          label="Loyauté au groupe"
          value={stats.loyaute === null ? "—" : stats.loyaute}
          unit={stats.loyaute === null ? undefined : "%"}
          icon={<Users />}
          detail={stats.loyaute === null ? "aucun vote à comparer" : undefined}
          help={`Part des votes conformes à la position majoritaire de son groupe au moment du vote. ${PERIODE_FICHE}`}
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
      {explicationSenat ? (
        <p className={classes.note}>
          {PRESENCE_SENAT_EXPLICATION} {PERIODE_FICHE}
        </p>
      ) : null}
    </section>
  );
};
