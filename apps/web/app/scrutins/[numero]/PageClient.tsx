'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { FileText, MessageSquare, Vote, ArrowLeft, BookOpen, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  ScrutinSidebar,
  ScrutinVotesTab,
  ScrutinDebatsTab,
  ScrutinAmendementsTab,
} from './components';

// ── Types ──

interface VoteRecord {
  id: string;
  position: 'pour' | 'contre' | 'abstention' | 'absent';
  parlementaire: {
    id: string;
    slug: string;
    chambre: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    groupe: {
      slug: string;
      nom: string;
      couleur: string | null;
    } | null;
  };
}

interface DossierLegislatif {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  urlLegifrance: string | null;
  _count?: { scrutins: number; amendements: number };
}

interface AmendementDetail {
  id: string;
  uid: string;
  numero: string;
  articleVise: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
}

interface InterventionScrutin {
  id: string;
  type: string;
  contenu: string;
  hasMore?: boolean;
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
  orateurNom: string | null;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  parlementaire: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    groupe: {
      nom: string;
      couleur: string | null;
    } | null;
  } | null;
}

export interface ScrutinDetail {
  id: string;
  numero: number;
  chambre: string;
  session: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  nombreVotants: number;
  importance: number;
  tags: string[];
  texteNumero: string | null;
  texteTitre: string | null;
  objetLibelle: string | null;
  demandeurTexte: string | null;
  seanceRef: string | null;
  dossier: DossierLegislatif | null;
  amendements: AmendementDetail[];
  interventions: InterventionScrutin[];
  resumeIA: string | null;
  iaGeneratedAt: string | null;
  sourceUrl: string | null;
  votesByPosition: {
    pour: VoteRecord[];
    contre: VoteRecord[];
    abstention: VoteRecord[];
    absent: VoteRecord[];
  };
  votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }>;
  totalVotes: number;
  totalInterventions: number;
}

interface InterventionsResponse {
  data: InterventionScrutin[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
  };
}

// ── Helpers ──

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0096\u2013\u2014]/g, '-');
};

// Fallback mapping for group detection in demandeur text.
// Ordered longest-first to avoid partial matches. groupesMap (from actual DB data) is preferred.
const groupeFullNameToSlug: [string, { slug: string; chambre: 'assemblee' | 'senat' }][] = [
  ['la france insoumise - nouveau front populaire', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['france insoumise - nouveau front populaire', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['socialistes et apparentes - nouveau front populaire', { slug: 'soc', chambre: 'assemblee' }],
  ['ecologiste et social - nouveau front populaire', { slug: 'ecos', chambre: 'assemblee' }],
  ['gauche democrate et republicaine - nouveau front populaire', { slug: 'gdr', chambre: 'assemblee' }],
  ['libertes, independants, outre-mer et territoires', { slug: 'liot', chambre: 'assemblee' }],
  ['union des droites pour la republique', { slug: 'uddplr', chambre: 'assemblee' }],
  ['gauche democrate et republicaine', { slug: 'gdr', chambre: 'assemblee' }],
  ['horizons & independants', { slug: 'hor', chambre: 'assemblee' }],
  ['horizons et independants', { slug: 'hor', chambre: 'assemblee' }],
  ['ensemble pour la republique', { slug: 'epr', chambre: 'assemblee' }],
  ['socialistes et apparentes', { slug: 'soc', chambre: 'assemblee' }],
  ['rassemblement national', { slug: 'rn', chambre: 'assemblee' }],
  ['la france insoumise', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['ecologiste et social', { slug: 'ecos', chambre: 'assemblee' }],
  ['france insoumise', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['droite republicaine', { slug: 'dr', chambre: 'assemblee' }],
  ['les republicains', { slug: 'lr', chambre: 'assemblee' }],
  ['republicains', { slug: 'lr', chambre: 'assemblee' }],
  ['les democrates', { slug: 'dem', chambre: 'assemblee' }],
  ['socialistes', { slug: 'soc', chambre: 'assemblee' }],
  ['horizons', { slug: 'hor', chambre: 'assemblee' }],
  ['democrate', { slug: 'dem', chambre: 'assemblee' }],
  ['communiste republicain citoyen et ecologiste - kanaky', { slug: 'crc', chambre: 'senat' }],
  ['rassemblement des democrates, progressistes et independants', { slug: 'lrem', chambre: 'senat' }],
  ['rassemblement democratique et social europeen', { slug: 'rdse', chambre: 'senat' }],
  ['les independants - republique et territoires', { slug: 'rtli', chambre: 'senat' }],
  ['communiste republicain citoyen et ecologiste', { slug: 'crc', chambre: 'senat' }],
  ['socialiste, ecologiste et republicain', { slug: 'soc', chambre: 'senat' }],
  ['ecologiste - solidarite et territoires', { slug: 'gest', chambre: 'senat' }],
  ['rassemblement des democrates', { slug: 'lrem', chambre: 'senat' }],
  ['les republicains', { slug: 'ump', chambre: 'senat' }],
  ['union centriste', { slug: 'uc', chambre: 'senat' }],
  ['socialiste', { slug: 'soc', chambre: 'senat' }],
];

type TabType = 'amendements' | 'debats' | 'vote';

// ── Component ──

export default function PageClient({ initialData }: { initialData?: { data: ScrutinDetail } }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const numero = params.numero as string;
  const chambre = searchParams.get('chambre') || 'assemblee';
  const session = searchParams.get('session') || undefined;

  const [interventionsSortAsc, setInterventionsSortAsc] = useState(true);
  const [interventionsSearch, setInterventionsSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search — 300ms delay to avoid hammering the API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(interventionsSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [interventionsSearch]);

  const { data, isLoading, error } = useQuery<{ data: ScrutinDetail }>({
    queryKey: ['scrutin', numero, chambre, session],
    queryFn: () => api.get(`/scrutins/${numero}`, { params: { chambre, session } }).then((res) => res.data),
    initialData,
  });

  // Determine default tab based on available data
  const defaultTab: TabType = data?.data.amendements && data.data.amendements.length > 0
    ? 'amendements'
    : 'vote';
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const currentTab = activeTab ?? defaultTab;

  // Paginated interventions query
  const {
    data: interventionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<InterventionsResponse>({
    queryKey: ['scrutin-interventions', numero, chambre, session, interventionsSortAsc ? 'asc' : 'desc', debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/scrutins/${numero}/interventions`, {
        params: {
          chambre,
          session,
          page: pageParam,
          limit: 10,
          sort: interventionsSortAsc ? 'asc' : 'desc',
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!data,
  });

  const { loadMoreRef: interventionsLoadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const allInterventions = interventionsData?.pages.flatMap((page) => page.data) ?? [];
  const totalInterventions = data?.data.totalInterventions ?? 0;

  // Groupes map for link resolution
  const groupesMap = useMemo(() => {
    const groups = new Map<string, { slug: string; nom: string; chambre: string }>();
    if (data?.data.votesByPosition) {
      Object.values(data.data.votesByPosition).flat().forEach(vote => {
        if (vote.parlementaire.groupe) {
          groups.set(vote.parlementaire.groupe.nom.toLowerCase(), {
            slug: vote.parlementaire.groupe.slug,
            nom: vote.parlementaire.groupe.nom,
            chambre: vote.parlementaire.chambre,
          });
        }
      });
    }
    return groups;
  }, [data?.data.votesByPosition]);

  // Parlementaires map for link resolution
  const parlementairesMap = useMemo(() => {
    const parlementaires = new Map<string, { slug: string; prenom: string; nom: string; chambre: string }>();
    if (data?.data.votesByPosition) {
      Object.values(data.data.votesByPosition).flat().forEach(vote => {
        const p = vote.parlementaire;
        parlementaires.set(normalizeString(`${p.prenom} ${p.nom}`), {
          slug: p.slug, prenom: p.prenom, nom: p.nom, chambre: p.chambre,
        });
      });
    }
    const interventionsToCheck = [...(data?.data.interventions || []), ...allInterventions];
    interventionsToCheck.forEach(intervention => {
      const p = intervention.parlementaire;
      if (!p) return; // Non-parlementaire (ministre, etc.) — pas de page profil
      const key = normalizeString(`${p.prenom} ${p.nom}`);
      if (!parlementaires.has(key)) {
        parlementaires.set(key, {
          slug: p.slug, prenom: p.prenom, nom: p.nom, chambre: data?.data.chambre || 'assemblee',
        });
      }
    });
    return parlementaires;
  }, [data?.data.votesByPosition, data?.data.interventions, data?.data.chambre, allInterventions]);

  // Link detection in demandeur text
  const isWordBoundary = (text: string, start: number, end: number): boolean => {
    const boundaryChars = /[\s,.:;!?()[\]"'«»-]/;
    const charBefore = start === 0 ? ' ' : text[start - 1];
    const charAfter = end >= text.length ? ' ' : text[end];
    return (start === 0 || boundaryChars.test(charBefore)) && (end >= text.length || boundaryChars.test(charAfter));
  };

  type TextMatch = {
    type: 'groupe' | 'parlementaire';
    slug: string;
    chambre: string;
    start: number;
    end: number;
  };

  const findAllMatchesInText = (text: string): TextMatch[] => {
    const normalizedText = normalizeString(text);
    const matches: TextMatch[] = [];
    const usedRanges: [number, number][] = [];

    const overlaps = (start: number, end: number) =>
      usedRanges.some(([s, e]) => start < e && end > s);

    // 1. Search groupesMap first (actual DB slugs — most reliable)
    // Sort by name length descending to prefer longer matches
    const groupesEntries = [...groupesMap.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [nomLower, groupe] of groupesEntries) {
      const normalizedNom = normalizeString(nomLower);
      let searchFrom = 0;
      while (searchFrom < normalizedText.length) {
        const idx = normalizedText.indexOf(normalizedNom, searchFrom);
        if (idx === -1) break;
        if (!overlaps(idx, idx + normalizedNom.length) && isWordBoundary(normalizedText, idx, idx + normalizedNom.length)) {
          matches.push({ type: 'groupe', slug: groupe.slug, chambre: groupe.chambre, start: idx, end: idx + normalizedNom.length });
          usedRanges.push([idx, idx + normalizedNom.length]);
        }
        searchFrom = idx + 1;
      }
    }

    // 2. Fallback to hardcoded mapping (for groups not in the votes of this scrutin)
    for (const [fullName, info] of groupeFullNameToSlug) {
      let searchFrom = 0;
      while (searchFrom < normalizedText.length) {
        const idx = normalizedText.indexOf(fullName, searchFrom);
        if (idx === -1) break;
        if (!overlaps(idx, idx + fullName.length) && isWordBoundary(normalizedText, idx, idx + fullName.length)) {
          matches.push({ type: 'groupe', slug: info.slug, chambre: info.chambre, start: idx, end: idx + fullName.length });
          usedRanges.push([idx, idx + fullName.length]);
        }
        searchFrom = idx + 1;
      }
    }

    // 3. Search parlementaires (skip short names, avoid overlaps with groups)
    for (const [normalizedName, parlementaire] of parlementairesMap.entries()) {
      if (normalizedName.length < 5) continue;
      let searchFrom = 0;
      while (searchFrom < normalizedText.length) {
        const idx = normalizedText.indexOf(normalizedName, searchFrom);
        if (idx === -1) break;
        if (!overlaps(idx, idx + normalizedName.length) && isWordBoundary(normalizedText, idx, idx + normalizedName.length)) {
          matches.push({ type: 'parlementaire', slug: parlementaire.slug, chambre: parlementaire.chambre, start: idx, end: idx + normalizedName.length });
          usedRanges.push([idx, idx + normalizedName.length]);
        }
        searchFrom = idx + 1;
      }
    }

    return matches.sort((a, b) => a.start - b.start);
  };

  const renderTextWithLinks = (text: string): React.ReactNode => {
    const matches = findAllMatchesInText(text);
    if (matches.length === 0) return text;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.start > lastIndex) {
        result.push(text.slice(lastIndex, match.start));
      }
      const matchText = text.slice(match.start, match.end);
      const chambreRoute = match.chambre === 'senat' ? 'senat' : 'assemblee';

      if (match.type === 'groupe') {
        result.push(
          <Link key={`g-${match.start}`} href={`/groupes/${chambreRoute}/${match.slug}`} className="text-primary hover:underline font-medium">
            {matchText}
          </Link>
        );
      } else {
        result.push(
          <Link key={`p-${match.start}`} href={`/${chambreRoute === 'senat' ? 'senateurs' : 'deputes'}/${match.slug}`} className="text-primary hover:underline font-medium">
            {matchText}
          </Link>
        );
      }
      lastIndex = match.end;
    }

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return <>{result}</>;
  };

  const formatDemandeurs = (demandeurTexte: string): React.ReactNode => {
    // Split multiple demandeurs (e.g. "Président du groupe X Présidente du groupe Y")
    const parts = demandeurTexte
      .split(/\s+(?=Pr[eé]sident(?:e)?\s|Le\s+Gouvernement|La\s+[Cc]onf[eé]rence)/i)
      .map(d => d.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      return renderTextWithLinks(demandeurTexte);
    }

    return (
      <div className="space-y-1.5">
        {parts.map((part, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-muted-foreground mt-0.5">•</span>
            <span>{renderTextWithLinks(part)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Loading / Error states ──

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="grid gap-6 lg:grid-cols-[300px_1fr] mt-8">
            <div className="h-96 rounded-lg bg-muted" />
            <div className="h-96 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Scrutin non trouvé.
        </div>
      </div>
    );
  }

  const scrutin = data.data;

  // Tab counts
  const amendementsCount = scrutin.amendements?.length ?? 0;
  const tabConfig: { key: TabType; label: string; icon: typeof FileText; count: number }[] = [
    ...(amendementsCount > 0
      ? [{ key: 'amendements' as const, label: 'Amendements', icon: FileText, count: amendementsCount }]
      : []),
    ...(totalInterventions > 0
      ? [{ key: 'debats' as const, label: 'Débats de la séance', icon: MessageSquare, count: totalInterventions }]
      : []),
    { key: 'vote' as const, label: 'Vote', icon: Vote, count: scrutin.totalVotes },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Back + Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 min-w-0">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/scrutins" className="hover:text-foreground transition-colors flex-shrink-0">Scrutins</Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-foreground font-medium truncate">Scrutin n°{scrutin.numero}</span>
      </nav>

      {/* Title */}
      <h1 className="text-xl md:text-2xl font-bold mb-8 leading-tight">{scrutin.titre}</h1>

      {/* En clair — IA summary */}
      {scrutin.resumeIA && (
        <div className="rounded-lg border bg-card p-5 mb-8">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4" />
            En clair
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {scrutin.resumeIA}
          </p>
          <Link
            href="/methodologie#enrichissement-ia"
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:underline"
          >
            <Info className="h-3 w-3" />
            Résumé généré par IA
          </Link>
        </div>
      )}

      {/* Two-column layout: sidebar + content */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5">
            <ScrutinSidebar
              chambre={scrutin.chambre}
              date={scrutin.date}
              typeVote={scrutin.typeVote}
              sort={scrutin.sort}
              tags={scrutin.tags}
              demandeurTexte={scrutin.demandeurTexte}
              dossier={scrutin.dossier}
              sourceUrl={scrutin.sourceUrl}
              importance={scrutin.importance}
              formatDemandeurs={formatDemandeurs}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0">
          {/* Tab bar */}
          <div className="border-b mb-6 overflow-x-auto">
            <div className="flex gap-0">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          {currentTab === 'amendements' && scrutin.amendements && scrutin.amendements.length > 0 && (
            <ScrutinAmendementsTab amendements={scrutin.amendements} />
          )}

          {currentTab === 'debats' && totalInterventions > 0 && (
            <ScrutinDebatsTab
              interventions={allInterventions}
              chambre={chambre}
              interventionsSortAsc={interventionsSortAsc}
              onToggleSort={() => setInterventionsSortAsc(!interventionsSortAsc)}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              loadMoreRef={interventionsLoadMoreRef}
              searchQuery={interventionsSearch}
              onSearchChange={setInterventionsSearch}
            />
          )}

          {currentTab === 'vote' && (
            <ScrutinVotesTab
              nombrePour={scrutin.nombrePour}
              nombreContre={scrutin.nombreContre}
              nombreAbstention={scrutin.nombreAbstention}
              votesByPosition={scrutin.votesByPosition}
              votesByGroupe={scrutin.votesByGroupe}
              totalVotes={scrutin.totalVotes}
              chambre={chambre}
            />
          )}
        </div>
      </div>
    </div>
  );
}
