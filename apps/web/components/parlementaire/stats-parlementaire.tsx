import { ShieldCheck, Users, Vote, MessageSquare, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';
import { PRESENCE_SENAT_EXPLICATION, PRESENCE_SENAT_NON_MESURABLE } from '@/lib/presence';

// Statistiques d'une fiche, communes aux députés et aux sénateurs. L'API les
// calcule de la même façon pour les deux chambres, sur TOUTE la carrière
// parlementaire : un député élu sénateur garde ses votes de l'Assemblée. Les
// deux pages avaient chacune leur version, avec des infobulles différentes et
// fausses pour ces élus (« carrière au Sénat » sur des votes de l'Assemblée).

export interface StatsParlementaireData {
  /**
   * Null sans aucun scrutin où il pouvait voter : président de l'assemblée,
   * mandats passés au Gouvernement. Ce n'est pas 0 %.
   */
  presence: number | null;
  /**
   * Null sans scrutin solennel sur la période. Au Sénat, c'est la seule mesure
   * de la présence : les scrutins ordinaires y sont votés par groupe (#108).
   */
  presenceSolennel?: number | null;
  /** Null sans vote exprimé au sein d'un groupe. */
  loyaute: number | null;
  participation: number;
  interventions: number;
  questions: number;
  /** Scrutins sur lesquels porte la présence (carrière). */
  scrutins?: number | null;
}

/**
 * En dessous, un député ne figure pas dans le classement de présence, et aucun
 * élu dans celui de loyauté (SEUIL_SCRUTINS_CLASSEMENT, ingestion). La présence
 * des sénateurs, mesurée sur les scrutins solennels, n'a pas de seuil.
 */
const SEUIL_SCRUTINS_CLASSEMENT = 50;

const CARRIERE = 'Calculé sur l’ensemble de la carrière parlementaire, Assemblée et Sénat, tous mandats confondus.';
const COMPRENDRE = '/comprendre/parlementaire';
/** Les classements comparent par défaut le mandat en cours : le chiffre peut y différer de celui de la fiche. */
const CARRIERE_TAUX = `${CARRIERE} Les classements comparent par défaut le mandat en cours, d’où un chiffre parfois différent.`;

function StatCard({
  label,
  value,
  icon: Icon,
  suffix = '',
  subtitle,
  vide,
  tooltip,
  texteSiVide = 'N/A',
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  suffix?: string;
  subtitle?: string;
  /** Ce qu'on dit quand la valeur n'existe pas, à la place d'un 0 qui mentirait. */
  vide?: string;
  tooltip: string;
  /** Texte affiché sans valeur. */
  texteSiVide?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
        <DidacticielTooltip content={tooltip} learnMoreHref={COMPRENDRE} />
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold">
          {value !== null ? `${value.toLocaleString('fr-FR')}${suffix}` : texteSiVide}
        </span>
        {value === null && vide && <span className="text-sm text-muted-foreground">{vide}</span>}
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

/**
 * Carte de présence, la même structure dans les deux chambres (#108) : la
 * présence aux votes solennels en tête, le taux sur tous les scrutins en second.
 * Seul le sens du second chiffre change : au Sénat, les scrutins ordinaires sont
 * votés par groupe, c'est une participation, pas une présence.
 */
function CartePresence({
  stats,
  chambre,
  preside,
}: {
  stats: StatsParlementaireData;
  chambre: 'assemblee' | 'senat';
  preside: boolean;
}) {
  const solennel = stats.presenceSolennel ?? null;
  const senat = chambre === 'senat';
  // Libellés courts : une case qui passe sur deux lignes désaligne les autres.
  // Les précisions (votes solennels, vote par groupe au Sénat) sont dans
  // l'infobulle.
  const tousScrutins = (v: number) => `${v}% tous scrutins`;
  const assemblee = senat ? 'le président du Sénat' : 'le président de l’Assemblée';
  const horsCalcul =
    'Les scrutins où l’élu ne pouvait pas voter (présidence de l’assemblée ou de la séance, membre du gouvernement) sont hors calcul.';
  // Un taux sur 28 scrutins se lit autrement qu'un taux sur 8 000 : on le dit.
  const peuDeScrutins =
    !senat && stats.scrutins != null && stats.scrutins < SEUIL_SCRUTINS_CLASSEMENT
      ? `sur ${stats.scrutins} scrutin${stats.scrutins > 1 ? 's' : ''} seulement`
      : undefined;

  // Président d'assemblée en exercice : il ne vote pas. Sa présence de carrière
  // aux votes solennels, hors présidences, reste lisible en second : Yaël
  // Braun-Pivet a voté sous la XVe avant de présider l'Assemblée.
  if (preside) {
    return (
      <StatCard
        label="Présence"
        value={null}
        texteSiVide="Ne vote pas"
        subtitle={solennel !== null ? `${solennel}% hors présidence` : undefined}
        icon={ShieldCheck}
        tooltip={
          `Par usage, ${assemblee} ne prend pas part aux votes : sa présence ne se mesure pas pendant sa présidence.` +
          (solennel !== null
            ? ` Le second chiffre est sa présence aux scrutins solennels sur le reste de sa carrière parlementaire, présidences exclues.`
            : '')
        }
      />
    );
  }
  // Aucun scrutin où il pouvait voter sur toute la carrière.
  if (stats.presence === null) {
    return (
      <StatCard
        label="Présence"
        value={null}
        texteSiVide="Non mesurable"
        icon={ShieldCheck}
        tooltip={`Aucun scrutin où cet élu pouvait voter sur la période. ${horsCalcul}`}
      />
    );
  }
  if (solennel !== null) {
    return (
      <StatCard
        label="Présence"
        value={solennel}
        suffix="%"
        subtitle={tousScrutins(stats.presence)}
        icon={ShieldCheck}
        tooltip={
          senat
            ? `Présence aux scrutins solennels : part de ceux où ce sénateur a voté en personne. Le second chiffre est sa participation à tous les scrutins publics. ${PRESENCE_SENAT_EXPLICATION} ${CARRIERE_TAUX}`
            : `Présence aux scrutins solennels : part de ceux où ce député a voté (pour, contre ou abstention). Le second chiffre porte sur tous les scrutins publics. ${horsCalcul} ${CARRIERE_TAUX}`
        }
      />
    );
  }
  return (
    <StatCard
      label={senat ? 'Participation' : 'Présence'}
      value={stats.presence}
      suffix="%"
      subtitle={peuDeScrutins}
      icon={ShieldCheck}
      tooltip={
        senat
          ? `Pourcentage de scrutins publics où un bulletin a été déposé pour ce sénateur. ${PRESENCE_SENAT_EXPLICATION} ${PRESENCE_SENAT_NON_MESURABLE}`
          : `Pourcentage de scrutins publics auxquels ce député a participé (voté pour, contre ou abstention). ${horsCalcul} Sur moins de ${SEUIL_SCRUTINS_CLASSEMENT} scrutins, il n’entre pas dans le classement. ${CARRIERE_TAUX}`
      }
    />
  );
}

export function StatsParlementaire({
  stats,
  titre,
  chambre = 'assemblee',
  preside = false,
}: {
  stats: StatsParlementaireData;
  titre: string;
  chambre?: 'assemblee' | 'senat';
  /** Préside son assemblée : ne vote pas, par usage. */
  preside?: boolean;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{titre}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CartePresence stats={stats} chambre={chambre} preside={preside} />
        <StatCard
          label="Loyauté au groupe"
          value={stats.loyaute}
          suffix="%"
          texteSiVide="—"
          vide="aucun vote à comparer"
          icon={Users}
          tooltip={`Pourcentage de votes alignés avec la position majoritaire de son groupe politique au moment du vote. ${CARRIERE_TAUX}`}
        />
        <StatCard
          label="Votes"
          value={stats.participation}
          icon={Vote}
          tooltip={`Nombre de scrutins publics auxquels ce parlementaire a pris part. ${CARRIERE}`}
        />
        <StatCard
          label="Interventions"
          value={stats.interventions}
          icon={MessageSquare}
          tooltip={`Nombre de prises de parole en séance publique, hors interruptions et présidence de séance. ${CARRIERE}`}
        />
        <StatCard
          label="Questions posées"
          value={stats.questions}
          icon={HelpCircle}
          tooltip={`Questions au Gouvernement posées en séance publique. Les réponses d’un membre du Gouvernement n’y comptent pas, même lorsqu’il est aussi parlementaire. ${CARRIERE}`}
        />
      </div>
    </div>
  );
}
