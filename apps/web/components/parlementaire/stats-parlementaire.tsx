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
  /** Null au Sénat sans aucun scrutin où il pouvait voter (président du Sénat). */
  presence: number | null;
  /**
   * Null sans scrutin solennel sur la période. Au Sénat, c'est la seule mesure
   * de la présence : les scrutins ordinaires y sont votés par groupe (#108).
   */
  presenceSolennel?: number | null;
  loyaute: number;
  participation: number;
  interventions: number;
  questions: number;
}

const CARRIERE = 'Calculé sur l’ensemble de la carrière parlementaire, Assemblée et Sénat, tous mandats confondus.';
const COMPRENDRE = '/comprendre/parlementaire';

function StatCard({
  label,
  value,
  icon: Icon,
  suffix = '',
  subtitle,
  tooltip,
  texteSiVide = 'N/A',
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  suffix?: string;
  subtitle?: string;
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
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

export function StatsParlementaire({
  stats,
  titre,
  chambre = 'assemblee',
}: {
  stats: StatsParlementaireData;
  titre: string;
  chambre?: 'assemblee' | 'senat';
}) {
  const solennel = stats.presenceSolennel ?? null;
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{titre}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {chambre === 'senat' ? (
          // Sénat : le taux tous scrutins compte des bulletins déposés par le
          // groupe ; il est présenté comme une participation, jamais comme une
          // présence.
          stats.presence === null ? (
            <StatCard
              label="Présence"
              value={null}
              texteSiVide="Ne vote pas"
              icon={ShieldCheck}
              tooltip="Aucun scrutin où ce sénateur pouvait voter sur la période : le président du Sénat ne prend pas part aux votes, par usage."
            />
          ) : solennel !== null ? (
            <StatCard
              label="Présence aux votes solennels"
              value={solennel}
              suffix="%"
              subtitle={`${stats.presence}% de participation aux scrutins`}
              icon={ShieldCheck}
              tooltip={`Pourcentage de scrutins solennels auxquels ce sénateur a voté en personne. Le second chiffre porte sur tous les scrutins publics. ${PRESENCE_SENAT_EXPLICATION}`}
            />
          ) : (
            <StatCard
              label="Participation aux scrutins"
              value={stats.presence}
              suffix="%"
              icon={ShieldCheck}
              tooltip={`Pourcentage de scrutins publics où un bulletin a été déposé pour ce sénateur. ${PRESENCE_SENAT_EXPLICATION} ${PRESENCE_SENAT_NON_MESURABLE}`}
            />
          )
        ) : solennel !== null ? (
          <StatCard
            label="Présence solennelle"
            value={solennel}
            suffix="%"
            subtitle={stats.presence !== null ? `${stats.presence}% tous scrutins` : undefined}
            icon={ShieldCheck}
            tooltip={`Pourcentage de scrutins solennels auxquels ce parlementaire a participé (voté pour, contre ou abstention). Le second chiffre porte sur tous les scrutins publics. ${CARRIERE}`}
          />
        ) : (
          <StatCard
            label="Présence"
            value={stats.presence}
            suffix="%"
            icon={ShieldCheck}
            tooltip={`Pourcentage de scrutins publics auxquels ce parlementaire a participé (voté pour, contre ou abstention). ${CARRIERE}`}
          />
        )}
        <StatCard
          label="Loyauté au groupe"
          value={stats.loyaute}
          suffix="%"
          icon={Users}
          tooltip={`Pourcentage de votes alignés avec la position majoritaire de son groupe politique au moment du vote. ${CARRIERE}`}
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
