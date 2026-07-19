'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  Vote,
  MapPin,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BarChart3,
  Users2,
  FileEdit,
  Radar as RadarIcon,
  Filter,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { api } from '@/lib/api';
import { scrutinHref } from '@/lib/scrutin-url';
import { getGroupColor } from '@/lib/colors';
import { legislatureLabel, sessionLabel } from '@/lib/periodes';
import { SortSelect, MEMBRE_SORT_OPTIONS } from '@/components/classements/SortSelect';
import { FicheCompareCallout } from '@/components/FicheCompareCallout';

interface Membre {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  circonscription: {
    departement: string;
    numero: number;
    nom: string;
  } | null;
  statsPresence: number | null;
  statsLoyaute: number | null;
}

export interface GroupeDetail {
  id: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
  /** Législature AN du groupe. Null au Sénat (pas de législature). */
  legislature: number | null;
  /** Sénat : session affichée (ex. "2020"). Null pour l'AN. */
  session: string | null;
  /** Sénat : la session affichée est-elle la session courante ? */
  sessionCourante: boolean;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  logoUrl: string | null;
  position: string | null;
  ordre: number;
  actif: boolean;
  membresCount: number;
  membresActifsCount: number;
  rang: number | null;
  totalGroupes: number | null;
  totauxAmendements: number;
  membres: Membre[];
  stats: {
    presenceMoyenne: number;
    presenceSolennelMoyenne: number | null;
    loyauteMoyenne: number;
    participationMoyenne: number;
  };
}

interface VotingStats {
  totalVotes: number;
  positions: {
    pour: number;
    contre: number;
    abstention: number;
    absent: number;
  };
  tauxParticipation: number;
  cohesionMoyenne: number;
  scrutinsRecents: {
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
    typeVote: string;
    session?: string;
    nombrePour: number;
    nombreContre: number;
    nombreAbstention: number;
    groupeVotes: {
      pour: number;
      contre: number;
      abstention: number;
      absent: number;
    };
    totalGroupeVotes: number;
    positionMajoritaire: string | null;
    cohesion: number;
  }[];
}

interface AllianceGroupe {
  id: string;
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  logoUrl: string | null;
}

interface AllianceEntry {
  groupe: AllianceGroupe;
  tauxAccord: number;
  votesCommuns: number;
  votesTotaux: number;
}

interface AlliancesData {
  groupeId: string;
  groupeNom: string;
  groupeCouleur: string | null;
  allies: AllianceEntry[];
  neutres: AllianceEntry[];
  opposes: AllianceEntry[];
  calculatedAt: string | null;
}

interface ThematiqueEntry {
  thematique: string;
  position: number;
  cohesion: number;
  votesTotaux: number;
  votesPour: number;
  votesContre: number;
  votesAbstention: number;
}

interface ThematiquesData {
  groupeId: string;
  groupeNom: string;
  groupeCouleur: string | null;
  thematiques: ThematiqueEntry[];
  calculatedAt: string | null;
}

const positionLabels: Record<string, string> = {
  extreme_gauche: 'Extrême gauche',
  gauche: 'Gauche',
  centre_gauche: 'Centre-gauche',
  centre: 'Centre',
  centre_droit: 'Centre-droit',
  droite: 'Droite',
  extreme_droite: 'Extrême droite',
};

const VOTE_COLORS = {
  pour: '#22c55e',
  contre: '#ef4444',
  abstention: '#eab308',
  absent: '#9ca3af',
};

function StatCard({
  label,
  value,
  suffix = '',
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
        <span className="text-xs sm:text-sm truncate">{label}</span>
      </div>
      <div className="mt-1.5 sm:mt-2 sm:flex sm:items-baseline sm:gap-2 sm:flex-wrap">
        <span className="text-xl sm:text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          {suffix}
        </span>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-0">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

const thematiqueLabels: Record<string, string> = {
  budget: 'Budget',
  fiscalité: 'Fiscalité',
  social: 'Social',
  travail: 'Travail',
  santé: 'Santé',
  éducation: 'Éducation',
  sécurité: 'Sécurité',
  justice: 'Justice',
  environnement: 'Environnement',
  europe: 'Europe',
  international: 'International',
  immigration: 'Immigration',
  institutions: 'Institutions',
  agriculture: 'Agriculture',
  économie: 'Économie',
  culture: 'Culture',
};

function AllianceCard({ alliance, chambre }: { alliance: AllianceEntry; chambre: string }) {
  const color = getGroupColor(alliance.groupe.nom, alliance.groupe.couleur, alliance.groupe.position);
  const isAlly = alliance.tauxAccord >= 60;
  const isOpposed = alliance.tauxAccord < 40;

  return (
    <Link
      href={`/groupes/${chambre}/${alliance.groupe.slug}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Logo groupe */}
      {alliance.groupe.logoUrl ? (
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-white p-1 shrink-0 border">
          <img
            src={alliance.groupe.logoUrl}
            alt={alliance.groupe.nom}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: color }}
        >
          {alliance.groupe.nom.slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{alliance.groupe.nom}</p>
        <p className="text-xs text-muted-foreground">
          {alliance.votesCommuns} / {alliance.votesTotaux} votes communs
        </p>
      </div>

      {/* Taux d'accord */}
      <div
        className={`text-lg font-bold ${
          isAlly ? 'text-green-600' : isOpposed ? 'text-red-600' : 'text-yellow-600'
        }`}
      >
        {alliance.tauxAccord}%
      </div>
    </Link>
  );
}

function MembreCard({ membre, chambre }: { membre: Membre; chambre: string }) {
  const route = chambre === 'assemblee' ? 'deputes' : 'senateurs';

  return (
    <Link
      href={`/${route}/${membre.slug}`}
      className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Photo */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
        {membre.photoUrl ? (
          <Image
            src={membre.photoUrl}
            alt={`${membre.prenom} ${membre.nom}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
            {membre.prenom[0]}
            {membre.nom[0]}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate group-hover:text-primary transition-colors">
          {membre.prenom} {membre.nom}
        </p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {/* Circonscription */}
          {membre.circonscription ? (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{membre.circonscription.departement} - {membre.circonscription.numero}</span>
            </p>
          ) : (
            <span />
          )}
          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            {membre.statsPresence !== null && (
              <span title="Participation" className="flex items-center gap-0.5">
                <Vote className="h-3 w-3" />
                {membre.statsPresence}%
              </span>
            )}
            {membre.statsLoyaute !== null && (
              <span title="Loyauté" className="flex items-center gap-0.5">
                <ShieldCheck className="h-3 w-3" />
                {membre.statsLoyaute}%
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function MembresList({ membres, chambre }: { membres: Membre[]; chambre: string }) {
  const [triMembres, setTriMembres] = useState('nom');

  const sortedMembres = useMemo(() => {
    const sorted = [...membres];
    switch (triMembres) {
      case 'presence':
        return sorted.sort((a, b) => (b.statsPresence ?? -1) - (a.statsPresence ?? -1));
      case 'loyaute':
        return sorted.sort((a, b) => (b.statsLoyaute ?? -1) - (a.statsLoyaute ?? -1));
      case 'nom':
      default:
        return sorted.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    }
  }, [membres, triMembres]);

  return (
    <section id="membres">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Membres du groupe ({membres.length.toLocaleString('fr-FR')})
        </h2>
        <SortSelect
          value={triMembres}
          onChange={setTriMembres}
          options={MEMBRE_SORT_OPTIONS}
        />
      </div>

      {sortedMembres.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedMembres.map((membre) => (
            <MembreCard key={membre.id} membre={membre} chambre={chambre} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Aucun membre actif dans ce groupe.</p>
        </div>
      )}
    </section>
  );
}

export default function PageClient({ initialData }: { initialData?: { data: GroupeDetail } }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chambre = params.chambre as string;
  const slug = params.slug as string;
  // Un sigle désigne un groupe différent selon la législature : sans la propager,
  // le fetch client écraserait au bout de quelques secondes les données SSR de la
  // période demandée par celles de la législature la plus récente.
  const legislature = searchParams.get('legislature') ?? undefined;
  // Sénat : la session (ex. "2020") sélectionne la composition d'époque. Même raison
  // que la législature — sans la propager, le fetch client écraserait le SSR.
  const session = searchParams.get('session') ?? undefined;

  const membreLabel = chambre === 'assemblee' ? 'député' : 'sénateur';

  // State pour filtrer les votes initiés par le groupe
  const [groupeInitie, setGroupeInitie] = useState(false);

  // Fetch groupe detail
  const { data, isLoading, error } = useQuery<{ data: GroupeDetail }>({
    queryKey: ['groupe', chambre, slug, legislature, session],
    queryFn: () =>
      api
        .get(`/groupes/${chambre}/${slug}`, { params: { legislature, session } })
        .then((res) => res.data),
    enabled: !!chambre && !!slug,
    initialData,
  });

  // Fetch voting stats (avec filtre groupeInitie). legislature/session propagées :
  // sans elles, ce widget afficherait toujours les votes de la période la plus
  // récente, même sur une page en vue historique (cf. getGroupeVotingStats).
  const { data: votingData, isLoading: votingLoading } = useQuery<{ data: VotingStats }>({
    queryKey: ['groupe-votes', chambre, slug, groupeInitie, legislature, session],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/votes`, {
      params: { ...(groupeInitie ? { groupeInitie: true } : undefined), legislature, session },
    }).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  // Fetch alliances. legislature propagée (AN uniquement, pré-calculée par
  // législature) : le Sénat n'a pas de recalcul par session, la vue historique
  // masque ce bloc côté rendu (cf. plus bas).
  const { data: alliancesData, isLoading: alliancesLoading } = useQuery<{ data: AlliancesData }>({
    queryKey: ['groupe-alliances', chambre, slug, legislature],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/alliances`, { params: { legislature } }).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  // Fetch thematiques. Même raison que les alliances.
  const { data: thematiquesData, isLoading: thematiquesLoading } = useQuery<{ data: ThematiquesData }>({
    queryKey: ['groupe-thematiques', chambre, slug, legislature],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/thematiques`, { params: { legislature } }).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  const groupe = data?.data;
  const votingStats = votingData?.data;
  const alliances = alliancesData?.data;
  const thematiques = thematiquesData?.data;
  const color = groupe ? getGroupColor(groupe.nom, groupe.couleur, groupe.position) : '#6B7280';

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !groupe) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
          <p className="text-destructive font-medium">Groupe non trouvé</p>
          <Link href="/groupes" className="text-sm text-primary hover:underline mt-2 inline-block">
            Retour aux groupes
          </Link>
        </div>
      </div>
    );
  }

  // Sénat, session PASSÉE : les alliances et thématiques ne sont pré-calculées que
  // pour la session courante (pas de recalcul à la volée raisonnable), donc les
  // blocs seraient trompeurs (données de la session courante affichées sous une
  // page de session passée). On les masque et on l'explique. Les votes restent
  // affichés : ils sont désormais bornés à la session par l'API.
  const senatHistorique = groupe.session != null && !groupe.sessionCourante;

  return (
    <div className="container mx-auto px-4 py-8 overflow-x-hidden">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 min-w-0">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/groupes" className="hover:text-foreground transition-colors flex-shrink-0">Groupes</Link>
        <span className="flex-shrink-0">/</span>
        <Link href={`/groupes?chambre=${groupe.chambre}`} className="hover:text-foreground transition-colors flex-shrink-0">
          {groupe.chambre === 'senat' ? 'Sénat' : 'AN'}
        </Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-foreground font-medium truncate">{groupe.nomComplet || groupe.nom}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:gap-6">
        <div className="flex items-start gap-4 sm:gap-6">
          {/* Logo groupe */}
          {groupe.logoUrl ? (
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl flex items-center justify-center bg-white p-1.5 sm:p-2 shrink-0 border">
              <img
                src={groupe.logoUrl}
                alt={groupe.nom}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl shrink-0"
              style={{ backgroundColor: color }}
            >
              {groupe.nom.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{groupe.nom}</h1>
              <span
                className={`text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shrink-0 ${
                  chambre === 'assemblee'
                    ? 'badge-assemblee'
                    : 'badge-senat'
                }`}
              >
                {chambre === 'assemblee' ? 'AN' : 'Sénat'}
              </span>
              {/* Période : un même sigle désigne un groupe différent d'une
                  législature à l'autre. Sans elle, impossible de savoir quelle
                  composition on regarde. */}
              {groupe.legislature != null && (
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted text-muted-foreground shrink-0">
                  {legislatureLabel(groupe.legislature)}
                </span>
              )}
              {/* Sénat : la composition change de session en session. Le badge indique
                  laquelle on regarde ; en vue historique, il le signale clairement pour
                  ne pas laisser croire que c'est la composition actuelle. */}
              {groupe.session != null && (
                <span
                  className={`text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shrink-0 ${
                    groupe.sessionCourante
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {sessionLabel(groupe.session)}
                  {!groupe.sessionCourante && ' · composition d’époque'}
                </span>
              )}
            </div>

            {groupe.nomComplet && groupe.nomComplet !== groupe.nom && (
              <p className="mt-1 text-sm sm:text-lg text-muted-foreground line-clamp-2">{groupe.nomComplet}</p>
            )}

            <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-4 flex-wrap">
              {groupe.position && (
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted text-muted-foreground">
                  {positionLabels[groupe.position] || groupe.position}
                </span>
              )}
              <a
                href="#membres"
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {groupe.membresActifsCount.toLocaleString('fr-FR')} {membreLabel}
                {groupe.membresActifsCount > 1 ? 's' : ''} actif
                {groupe.membresActifsCount > 1 ? 's' : ''}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 sm:mb-8 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Membres actifs"
          value={groupe.membresActifsCount}
          subtitle={groupe.rang ? `${groupe.rang}${groupe.rang === 1 ? 'er' : 'e'} groupe sur ${groupe.totalGroupes}` : undefined}
          icon={Users}
        />
        <StatCard
          label="Présence solennelle"
          value={groupe.stats.presenceSolennelMoyenne ?? groupe.stats.presenceMoyenne}
          suffix="%"
          subtitle={`${groupe.stats.presenceMoyenne}% tous scrutins`}
          icon={Vote}
        />
        <StatCard
          label="Loyauté moyenne"
          value={groupe.stats.loyauteMoyenne}
          suffix="%"
          icon={ShieldCheck}
        />
        <StatCard
          label="Amendements déposés"
          value={groupe.totauxAmendements.toLocaleString('fr-FR')}
          icon={FileEdit}
        />
      </div>

      <FicheCompareCallout variant="groupe" chambre={chambre as 'assemblee' | 'senat'} slug={slug} />

      {/* Statistiques de votes */}
      <section className="mb-10 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-xl font-semibold">Statistiques de votes</h2>
        </div>

        {votingLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : votingStats ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Graphique de répartition des votes */}
            <div className="rounded-xl border bg-card p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm sm:text-base">Répartition des votes</h3>
                <button
                  onClick={() => setGroupeInitie(!groupeInitie)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-colors ${
                    groupeInitie
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title="Filtrer uniquement les scrutins demandés par ce groupe"
                >
                  <Filter className="h-3 w-3" />
                  <span className="hidden sm:inline">Initiés par le groupe</span>
                  <span className="sm:hidden">Initiés</span>
                </button>
              </div>

              {/* Donut amélioré avec stats au centre */}
              {(() => {
                const total = votingStats.positions.pour + votingStats.positions.contre + votingStats.positions.abstention;
                const pourPct = total > 0 ? Math.round((votingStats.positions.pour / total) * 100) : 0;
                const contrePct = total > 0 ? Math.round((votingStats.positions.contre / total) * 100) : 0;
                const abstPct = total > 0 ? 100 - pourPct - contrePct : 0;

                return (
                  <>
                    <div className="relative h-44 sm:h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Pour', value: votingStats.positions.pour },
                              { name: 'Contre', value: votingStats.positions.contre },
                              { name: 'Abstention', value: votingStats.positions.abstention },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            <Cell fill={VOTE_COLORS.pour} />
                            <Cell fill={VOTE_COLORS.contre} />
                            <Cell fill={VOTE_COLORS.abstention} />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Label central */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl sm:text-3xl font-bold">{total.toLocaleString('fr-FR')}</span>
                        <span className="text-xs text-muted-foreground">votes exprimés</span>
                      </div>
                    </div>

                    {/* Légende avec pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <ThumbsUp className="h-3 w-3" />
                        <span className="text-xs font-semibold">{pourPct}%</span>
                        <span className="text-xs opacity-75">Pour</span>
                        <span className="text-[10px] opacity-60">({votingStats.positions.pour.toLocaleString()})</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <ThumbsDown className="h-3 w-3" />
                        <span className="text-xs font-semibold">{contrePct}%</span>
                        <span className="text-xs opacity-75">Contre</span>
                        <span className="text-[10px] opacity-60">({votingStats.positions.contre.toLocaleString()})</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                        <Minus className="h-3 w-3" />
                        <span className="text-xs font-semibold">{abstPct}%</span>
                        <span className="text-xs opacity-75">Abst.</span>
                        <span className="text-[10px] opacity-60">({votingStats.positions.abstention.toLocaleString()})</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Stats clés */}
            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">Participation aux scrutins</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{votingStats.tauxParticipation}%</p>
                </div>
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">Cohésion</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{votingStats.cohesionMoyenne}%</p>
                </div>
              </div>

              {/* Derniers scrutins */}
              <div className="rounded-xl border bg-card p-3 sm:p-4">
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">
                  Derniers scrutins ({votingStats.scrutinsRecents.length})
                </h4>
                <div className="space-y-1.5 sm:space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                  {votingStats.scrutinsRecents.map((scrutin) => (
                    <Link
                      key={scrutin.id}
                      href={scrutinHref({ numero: scrutin.numero, chambre, session: scrutin.session })}
                      className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      {/* Position du groupe */}
                      <div
                        className={`shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          scrutin.positionMajoritaire === 'pour'
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : scrutin.positionMajoritaire === 'contre'
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {scrutin.positionMajoritaire === 'pour' ? (
                          <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : scrutin.positionMajoritaire === 'contre' ? (
                          <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{scrutin.titre}</p>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          <span>{new Date(scrutin.date).toLocaleDateString('fr-FR')}</span>
                          <span className="hidden xs:inline">·</span>
                          <span className="text-green-600">{scrutin.groupeVotes.pour}+</span>
                          <span className="text-red-600">{scrutin.groupeVotes.contre}-</span>
                          <span className="text-yellow-600">{scrutin.groupeVotes.abstention}○</span>
                          <span className="hidden xs:inline">·</span>
                          <span className="font-medium text-blue-600">{scrutin.cohesion}% coh.</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée de vote disponible.</p>
          </div>
        )}
      </section>

      {/* Alliances et oppositions */}
      <section className="mb-10 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <Users2 className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-xl font-semibold">Alliances et oppositions</h2>
        </div>

        {senatHistorique ? (
          <p className="text-sm text-muted-foreground py-4">
            Données disponibles uniquement pour la session en cours.
          </p>
        ) : alliancesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : alliances && (alliances.allies.length > 0 || alliances.opposes.length > 0) ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Alliés */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <ThumbsUp className="h-4 w-4 text-green-600 shrink-0" />
                <h3 className="font-medium text-green-600 text-sm sm:text-base">Alliés ({'>'}60%)</h3>
              </div>
              {alliances.allies.length > 0 ? (
                <div className="space-y-2">
                  {alliances.allies.map((alliance) => (
                    <AllianceCard key={alliance.groupe.id} alliance={alliance} chambre={chambre} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun groupe allié identifié</p>
              )}
            </div>

            {/* Opposés */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <ThumbsDown className="h-4 w-4 text-red-600 shrink-0" />
                <h3 className="font-medium text-red-600 text-sm sm:text-base">Opposés ({'<'}40%)</h3>
              </div>
              {alliances.opposes.length > 0 ? (
                <div className="space-y-2">
                  {alliances.opposes.map((alliance) => (
                    <AllianceCard key={alliance.groupe.id} alliance={alliance} chambre={chambre} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun groupe opposé identifié</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <Users2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée d'alliance disponible.</p>
          </div>
        )}
      </section>

      {/* Cohésion par thématique - Radar Chart */}
      <section className="mb-10 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <RadarIcon className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-xl font-semibold">Cohésion par thématique</h2>
        </div>

        {senatHistorique ? (
          <p className="text-sm text-muted-foreground py-4">
            Données disponibles uniquement pour la session en cours.
          </p>
        ) : thematiquesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : thematiques && thematiques.thematiques.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Radar Chart - Cohésion */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Radar de cohésion</h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={thematiques.thematiques
                      .filter((t) => t.votesTotaux >= 5)
                      .slice(0, 8)
                      .map((t) => ({
                        subject: thematiqueLabels[t.thematique] || t.thematique,
                        cohesion: t.cohesion,
                      }))}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Cohésion"
                      dataKey="cohesion"
                      stroke={color}
                      fill={color}
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Plus la zone est étendue, plus le groupe vote de façon unanime sur ce thème
              </p>
            </div>

            {/* Liste des thématiques - triée par cohésion */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Détail par thème</h3>
              <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                {thematiques.thematiques
                  .filter((t) => t.votesTotaux >= 3)
                  .sort((a, b) => b.cohesion - a.cohesion)
                  .map((t) => {
                    const isUnited = t.cohesion >= 90;
                    const isDivided = t.cohesion < 75;
                    return (
                      <div
                        key={t.thematique}
                        className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">
                            {thematiqueLabels[t.thematique] || t.thematique}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {t.votesTotaux} scrutins
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 sm:w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isUnited ? 'bg-green-500' : isDivided ? 'bg-red-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${t.cohesion}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs sm:text-sm font-bold w-10 text-right ${
                              isUnited ? 'text-green-600' : isDivided ? 'text-red-600' : 'text-orange-600'
                            }`}
                          >
                            {t.cohesion}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <RadarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée thématique disponible.</p>
          </div>
        )}
      </section>

      {/* Liste des membres */}
      <MembresList membres={groupe.membres} chambre={chambre} />
    </div>
  );
}
