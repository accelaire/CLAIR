import { ShieldCheck, Users, Vote, MessageSquare, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';

// Statistiques d'une fiche, communes aux députés et aux sénateurs. L'API les
// calcule de la même façon pour les deux chambres, sur TOUTE la carrière
// parlementaire : un député élu sénateur garde ses votes de l'Assemblée. Les
// deux pages avaient chacune leur version, avec des infobulles différentes et
// fausses pour ces élus (« carrière au Sénat » sur des votes de l'Assemblée).

export interface StatsParlementaireData {
  presence: number;
  /** Null sans scrutin solennel sur la carrière : le Sénat n'en publie pas. */
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
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  suffix?: string;
  subtitle?: string;
  tooltip: string;
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
          {value !== null ? `${value.toLocaleString('fr-FR')}${suffix}` : 'N/A'}
        </span>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

export function StatsParlementaire({ stats, titre }: { stats: StatsParlementaireData; titre: string }) {
  const solennel = stats.presenceSolennel ?? null;
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{titre}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {solennel !== null ? (
          <StatCard
            label="Présence solennelle"
            value={solennel}
            suffix="%"
            subtitle={`${stats.presence}% tous scrutins`}
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
