'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Vote,
  MapPin,
  Loader2,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BarChart3,
  CheckCircle,
  XCircle,
  Users2,
  FileEdit,
  Radar as RadarIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { api } from '@/lib/api';
import { getGroupColor } from '@/lib/colors';

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

interface GroupeDetail {
  id: string;
  slug: string;
  chambre: 'assemblee' | 'senat';
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
  totauxAmendements: number;
  membres: Membre[];
  stats: {
    presenceMoyenne: number;
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
      <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold">
          {value}
          {suffix}
        </span>
        {subtitle && (
          <span className="text-xs sm:text-sm text-muted-foreground">{subtitle}</span>
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
        {membre.circonscription && (
          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {membre.circonscription.nom}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
        {membre.statsPresence !== null && (
          <span title="Taux de participation" className="flex items-center gap-1">
            <Vote className="h-3 w-3" />
            {membre.statsPresence}%
          </span>
        )}
        {membre.statsLoyaute !== null && (
          <span title="Loyauté au groupe" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {membre.statsLoyaute}%
          </span>
        )}
      </div>
    </Link>
  );
}

export default function GroupeDetailPage() {
  const params = useParams();
  const chambre = params.chambre as string;
  const slug = params.slug as string;

  const chambreRoute = chambre === 'assemblee' ? 'deputes' : 'senateurs';
  const chambreLabel = chambre === 'assemblee' ? "l'Assemblée nationale" : 'du Sénat';
  const membreLabel = chambre === 'assemblee' ? 'député' : 'sénateur';

  // Fetch groupe detail
  const { data, isLoading, error } = useQuery<{ data: GroupeDetail }>({
    queryKey: ['groupe', chambre, slug],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}`).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  // Fetch voting stats
  const { data: votingData, isLoading: votingLoading } = useQuery<{ data: VotingStats }>({
    queryKey: ['groupe-votes', chambre, slug],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/votes`).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  // Fetch alliances
  const { data: alliancesData, isLoading: alliancesLoading } = useQuery<{ data: AlliancesData }>({
    queryKey: ['groupe-alliances', chambre, slug],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/alliances`).then((res) => res.data),
    enabled: !!chambre && !!slug,
  });

  // Fetch thematiques
  const { data: thematiquesData, isLoading: thematiquesLoading } = useQuery<{ data: ThematiquesData }>({
    queryKey: ['groupe-thematiques', chambre, slug],
    queryFn: () => api.get(`/groupes/${chambre}/${slug}/thematiques`).then((res) => res.data),
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

  return (
    <div className="container mx-auto px-4 py-8 overflow-x-hidden">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/groupes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux groupes
        </Link>
      </div>

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
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}
              >
                {chambre === 'assemblee' ? 'AN' : 'Sénat'}
              </span>
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
              <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {groupe.membresActifsCount} {membreLabel}
                {groupe.membresActifsCount > 1 ? 's' : ''} actif
                {groupe.membresActifsCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Lien vers liste filtrée - full width on mobile */}
        <Link
          href={`/${chambreRoute}?groupe=${groupe.slug}`}
          className="inline-flex items-center justify-center sm:justify-start gap-2 rounded-lg border px-4 py-2.5 sm:py-2 text-sm font-medium hover:bg-accent transition-colors w-full sm:w-auto sm:self-start"
        >
          Voir tous les {membreLabel}s
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 sm:mb-8 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Membres actifs"
          value={groupe.membresActifsCount}
          subtitle={groupe.rang ? `${groupe.rang}${groupe.rang === 1 ? 'er' : 'e'} groupe` : undefined}
          icon={Users}
        />
        <StatCard
          label="Participation moyenne"
          value={groupe.stats.presenceMoyenne}
          suffix="%"
          icon={Vote}
        />
        <StatCard
          label="Loyauté moyenne"
          value={groupe.stats.loyauteMoyenne}
          suffix="%"
          icon={TrendingUp}
        />
        <StatCard
          label="Amendements déposés"
          value={groupe.totauxAmendements.toLocaleString()}
          icon={FileEdit}
        />
      </div>

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
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Répartition des votes</h3>
              <div className="h-40 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pour', value: votingStats.positions.pour, color: VOTE_COLORS.pour },
                        { name: 'Contre', value: votingStats.positions.contre, color: VOTE_COLORS.contre },
                        { name: 'Abstention', value: votingStats.positions.abstention, color: VOTE_COLORS.abstention },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {[
                        { color: VOTE_COLORS.pour },
                        { color: VOTE_COLORS.contre },
                        { color: VOTE_COLORS.abstention },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Votes']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VOTE_COLORS.pour }} />
                  <span className="text-xs text-muted-foreground">Pour</span>
                  <span className="text-xs font-medium">{votingStats.positions.pour.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VOTE_COLORS.contre }} />
                  <span className="text-xs text-muted-foreground">Contre</span>
                  <span className="text-xs font-medium">{votingStats.positions.contre.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VOTE_COLORS.abstention }} />
                  <span className="text-xs text-muted-foreground">Abst.</span>
                  <span className="text-xs font-medium">{votingStats.positions.abstention.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Stats clés */}
            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">Participation</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{votingStats.tauxParticipation}%</p>
                </div>
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">Cohésion</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{votingStats.cohesionMoyenne}%</p>
                </div>
              </div>

              {/* Derniers scrutins */}
              <div className="rounded-xl border bg-card p-3 sm:p-4">
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Derniers scrutins</h4>
                <div className="space-y-1.5 sm:space-y-2 max-h-52 sm:max-h-64 overflow-y-auto">
                  {votingStats.scrutinsRecents.slice(0, 5).map((scrutin) => (
                    <Link
                      key={scrutin.id}
                      href={`/scrutins/${scrutin.numero}`}
                      className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      {/* Position du groupe */}
                      <div
                        className={`shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          scrutin.positionMajoritaire === 'pour'
                            ? 'bg-green-100 text-green-600'
                            : scrutin.positionMajoritaire === 'contre'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-yellow-100 text-yellow-600'
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
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {new Date(scrutin.date).toLocaleDateString('fr-FR')} · {scrutin.cohesion}%
                        </p>
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

        {alliancesLoading ? (
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

      {/* Positions thématiques - Radar Chart */}
      <section className="mb-10 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <RadarIcon className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-xl font-semibold">Positions par thématique</h2>
        </div>

        {thematiquesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : thematiques && thematiques.thematiques.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Radar Chart */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Radar des positions</h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={thematiques.thematiques
                      .filter((t) => t.votesTotaux >= 5) // Au moins 5 votes pour être représentatif
                      .slice(0, 8) // Max 8 axes pour lisibilité
                      .map((t) => ({
                        subject: thematiqueLabels[t.thematique] || t.thematique,
                        // Normaliser la position de 0 à 100 (position va de -100 à +100)
                        position: Math.round((t.position + 100) / 2),
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
                      name="Position (Pour)"
                      dataKey="position"
                      stroke={color}
                      fill={color}
                      fillOpacity={0.4}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'Position (Pour)') {
                          const realValue = (value * 2) - 100;
                          return [
                            realValue > 0 ? `Pour (+${realValue})` : realValue < 0 ? `Contre (${realValue})` : 'Neutre',
                            'Position',
                          ];
                        }
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Plus la zone est étendue, plus le groupe vote "Pour" sur cette thématique
              </p>
            </div>

            {/* Liste des thématiques */}
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <h3 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Détail par thème</h3>
              <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                {thematiques.thematiques
                  .filter((t) => t.votesTotaux >= 3)
                  .sort((a, b) => b.votesTotaux - a.votesTotaux)
                  .map((t) => (
                    <div
                      key={t.thematique}
                      className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {thematiqueLabels[t.thematique] || t.thematique}
                        </p>
                        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                          <span>{t.votesTotaux} scrut.</span>
                          <span className="text-green-600">+{t.votesPour}</span>
                          <span className="text-red-600">-{t.votesContre}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs sm:text-sm font-bold ${
                            t.position > 20
                              ? 'text-green-600'
                              : t.position < -20
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}
                        >
                          {t.position > 0 ? '+' : ''}{Math.round(t.position)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t.cohesion}%</p>
                      </div>
                    </div>
                  ))}
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
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Membres du groupe ({groupe.membres.length})
          </h2>
        </div>

        {groupe.membres.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupe.membres.map((membre) => (
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
    </div>
  );
}
