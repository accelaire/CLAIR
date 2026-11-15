import type { ReactNode } from 'react';
import { ShieldCheck, Users, Vote, MessageSquare, HelpCircle, FileText, Mic, Gavel, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';
import { PRESENCE_SENAT_EXPLICATION, PRESENCE_SENAT_NON_MESURABLE } from '@/lib/presence';
import { cumulerBilans, nombre, type BilanPoste, type FonctionGouvernementale } from '@/lib/gouvernements';

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
  /** Prises de parole comme parlementaire, hors banc du Gouvernement. */
  interventions: number;
  /** Prises de parole au banc du Gouvernement ; absent d'une réponse ancienne. */
  interventionsGouvernement?: number;
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

/**
 * Les cartes de l'activité parlementaire. Sur la fiche d'un membre du
 * Gouvernement (`masquerVides`), les indicateurs vides n'apparaissent pas :
 * un ministre ne vote pas, une présence « non mesurable » ou « 0 vote » à côté
 * de son bilan au Gouvernement ne dit rien de lui (#129). Les autres fiches
 * gardent toutes leurs cartes : un député sans question posée, c'est une
 * information.
 */
function cartesParlement({
  stats,
  chambre,
  preside,
  masquerVides,
}: {
  stats: StatsParlementaireData;
  chambre: 'assemblee' | 'senat';
  preside: boolean;
  masquerVides: boolean;
}): ReactNode[] {
  const gouvernement = stats.interventionsGouvernement ?? 0;
  const cartes: ReactNode[] = [];
  const presenceVide = !preside && stats.presence === null;
  if (!(masquerVides && presenceVide)) {
    cartes.push(<CartePresence key="presence" stats={stats} chambre={chambre} preside={preside} />);
  }
  if (!(masquerVides && stats.loyaute === null)) {
    cartes.push(
      <StatCard
        key="loyaute"
        label="Loyauté au groupe"
        value={stats.loyaute}
        suffix="%"
        texteSiVide="—"
        vide="aucun vote à comparer"
        icon={Users}
        tooltip={`Pourcentage de votes alignés avec la position majoritaire de son groupe politique au moment du vote. ${CARRIERE_TAUX}`}
      />,
    );
  }
  if (!(masquerVides && stats.participation === 0)) {
    cartes.push(
      <StatCard
        key="votes"
        label="Votes"
        value={stats.participation}
        icon={Vote}
        tooltip={`Nombre de scrutins publics auxquels ce parlementaire a pris part. ${CARRIERE}`}
      />,
    );
  }
  // La part au banc du Gouvernement à côté, entre parenthèses : les deux
  // chiffres font la liste des interventions de la fiche.
  if (!(masquerVides && stats.interventions === 0 && gouvernement === 0)) {
    cartes.push(
      <StatCard
        key="interventions"
        label="Interventions"
        value={stats.interventions}
        subtitle={gouvernement > 0 ? `(+ ${gouvernement.toLocaleString('fr-FR')} au Gouvernement)` : undefined}
        icon={MessageSquare}
        tooltip={
          `Nombre de prises de parole en séance publique, hors interruptions et présidence de séance. ${CARRIERE}` +
          (gouvernement > 0
            ? ' Entre parenthèses, celles faites comme membre du Gouvernement (réponses, défense de ses textes) : elles ne comptent pas dans l’activité parlementaire ni dans les classements.'
            : '')
        }
      />,
    );
  }
  if (!(masquerVides && stats.questions === 0)) {
    cartes.push(
      <StatCard
        key="questions"
        label="Questions posées"
        value={stats.questions}
        icon={HelpCircle}
        tooltip={`Questions au Gouvernement posées en séance publique. Les réponses d’un membre du Gouvernement n’y comptent pas, même lorsqu’il est aussi parlementaire. ${CARRIERE}`}
      />,
    );
  }
  return cartes;
}

const DEPUIS_2017 = 'Données depuis juin 2017 : rien avant la XVe législature.';

/**
 * Les cartes du bilan au Gouvernement, sommé sur tous les postes. Comme côté
 * Parlement, un compte à zéro n'a pas de carte : sept semaines de ministre
 * déléguée ne font ni texte porté ni réponse. Sauf pour un Premier ministre,
 * dont « 0 recours au 49.3 » est une information.
 */
function cartesGouvernement(bilan: BilanPoste): ReactNode[] {
  const cartes: ReactNode[] = [];
  const reponses = bilan.reponses.assemblee + bilan.reponses.senat;
  if (bilan.textes && bilan.textes.chefDeFile.portes > 0) {
    const c = bilan.textes.chefDeFile;
    cartes.push(
      <StatCard
        key="textes"
        label="Textes portés"
        value={c.portes}
        subtitle={`dont ${nombre(c.parStadePortes.promulgue, 'promulgué')}`}
        icon={FileText}
        tooltip={`Projets de loi déposés comme ministre chef de file, hors ratifications d’ordonnances et conventions internationales. ${DEPUIS_2017}`}
      />,
    );
  }
  if (reponses > 0) {
    cartes.push(
      <StatCard
        key="reponses"
        label="Réponses en séance"
        value={reponses}
        icon={Mic}
        tooltip={`Réponses aux questions des parlementaires en séance publique, à l’Assemblée et au Sénat. ${DEPUIS_2017}`}
      />,
    );
  }
  if (bilan.premierMinistre) {
    const pm = bilan.premierMinistre;
    cartes.push(
      <StatCard
        key="49-3"
        label="Recours au 49.3"
        value={pm.engagements}
        icon={Gavel}
        tooltip="Engagements de la responsabilité du Gouvernement sur un texte (article 49, alinéa 3, de la Constitution) comme Premier ministre : le texte est adopté sans vote, sauf motion de censure."
      />,
      <StatCard
        key="motions"
        label="Motions de censure"
        value={pm.motions}
        subtitle={pm.motionsAdoptees > 0 ? `dont ${nombre(pm.motionsAdoptees, 'adoptée')}` : undefined}
        icon={ShieldAlert}
        tooltip="Motions de censure votées à l’Assemblée contre son gouvernement pendant qu’il était Premier ministre."
      />,
    );
  }
  return cartes;
}

/** Colonnes en grand écran : la rangée occupe toute la largeur, quel que soit son nombre de cartes. */
const COLONNES_LG = ['lg:grid-cols-2', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5'];

function Grille({ cartes }: { cartes: ReactNode[] }) {
  const colonnes = COLONNES_LG[Math.min(cartes.length, COLONNES_LG.length) - 1] ?? 'lg:grid-cols-5';
  return <div className={`grid gap-4 sm:grid-cols-2 ${colonnes}`}>{cartes}</div>;
}

/**
 * Les statistiques d'une fiche. Un membre du Gouvernement, en poste ou
 * ancien, a deux rangées : son bilan au Gouvernement et son activité au
 * Parlement, la fonction en cours d'abord. Les autres fiches n'en ont qu'une.
 */
export function StatsParlementaire({
  stats,
  titre,
  chambre = 'assemblee',
  preside = false,
  fonctionsGouvernementales = [],
  gouvernementEnCours = false,
}: {
  stats: StatsParlementaireData;
  titre: string;
  chambre?: 'assemblee' | 'senat';
  /** Préside son assemblée : ne vote pas, par usage. */
  preside?: boolean;
  fonctionsGouvernementales?: readonly FonctionGouvernementale[];
  /** Exerce aujourd'hui une fonction au Gouvernement : sa rangée passe en tête. */
  gouvernementEnCours?: boolean;
}) {
  const postes = fonctionsGouvernementales.filter((f) => f.type === 'poste_ministeriel');
  const bilan = cumulerBilans(postes.map((f) => f.bilan));
  const parlement = cartesParlement({ stats, chambre, preside, masquerVides: postes.length > 0 });
  const gouvernement = bilan ? cartesGouvernement(bilan) : [];
  if (parlement.length === 0 && gouvernement.length === 0) return null;

  const rangees = [
    { cle: 'gouvernement', titre: 'Au gouvernement', cartes: gouvernement },
    { cle: 'parlement', titre: 'Au Parlement', cartes: parlement },
  ].filter((r) => r.cartes.length > 0);
  if (!gouvernementEnCours) rangees.reverse();

  // Une seule rangée, celle du Gouvernement : le titre de la fiche (« Bilan de
  // son mandat ») parlerait d'un mandat dont rien n'est montré.
  const seulGouvernement = rangees.length === 1 && rangees[0]!.cle === 'gouvernement';
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{seulGouvernement ? 'Bilan au Gouvernement' : titre}</h2>
      {rangees.length === 1 ? (
        <Grille cartes={rangees[0]!.cartes} />
      ) : (
        <div className="space-y-5">
          {rangees.map((r) => (
            <section key={r.cle}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{r.titre}</h3>
              <Grille cartes={r.cartes} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
