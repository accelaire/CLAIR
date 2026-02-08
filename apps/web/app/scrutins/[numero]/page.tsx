'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, CheckCircle, XCircle, MinusCircle, Users,
  Tag, ExternalLink, FileText, Info, MessageSquare,
  ArrowUp, ArrowDown, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface Vote {
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
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
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
  };
}

interface ScrutinDetail {
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
  // Enrichissement contexte
  objetLibelle: string | null;
  demandeurTexte: string | null;
  seanceRef: string | null;
  // Dossier législatif lié
  dossier: DossierLegislatif | null;
  // Amendements votés (un scrutin peut porter sur plusieurs amendements)
  amendements: AmendementDetail[];
  // Interventions liées (débats, explications de vote)
  interventions: InterventionScrutin[];
  sourceUrl: string | null;
  votesByPosition: {
    pour: Vote[];
    contre: Vote[];
    abstention: Vote[];
    absent: Vote[];
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

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const typeVoteLabels: Record<string, string> = {
  solennel: 'Vote solennel',
  ordinaire: 'Vote ordinaire',
  motion: 'Motion',
};

// Normaliser une chaîne pour la comparaison (minuscules + sans accents + tirets uniformisés)
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .replace(/[\u0096\u2013\u2014]/g, '-'); // Normaliser les différents tirets
};

// Mapping des noms complets de groupes vers leurs abréviations/slugs
// Utilisé pour matcher les demandeurs de vote avec les groupes
// Les clés sont normalisées (sans accents, minuscules)
// Les entrées sont triées par longueur décroissante pour matcher les noms les plus spécifiques d'abord
const groupeFullNameToSlug: [string, { slug: string; chambre: 'assemblee' | 'senat' }][] = [
  // Assemblée nationale - noms longs d'abord
  ['la france insoumise - nouveau front populaire', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['france insoumise - nouveau front populaire', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['socialistes et apparentes - nouveau front populaire', { slug: 'soc', chambre: 'assemblee' }],
  ['ecologiste et social - nouveau front populaire', { slug: 'ges', chambre: 'assemblee' }],
  ['gauche democrate et republicaine - nouveau front populaire', { slug: 'gdr', chambre: 'assemblee' }],
  ['libertes, independants, outre-mer et territoires', { slug: 'liot', chambre: 'assemblee' }],
  ['union des droites pour la republique', { slug: 'udr', chambre: 'assemblee' }],
  ['gauche democrate et republicaine', { slug: 'gdr', chambre: 'assemblee' }],
  ['ensemble pour la republique', { slug: 'epr', chambre: 'assemblee' }],
  ['rassemblement national', { slug: 'rn', chambre: 'assemblee' }],
  ['la france insoumise', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['france insoumise', { slug: 'lfi-nfp', chambre: 'assemblee' }],
  ['droite republicaine', { slug: 'dr', chambre: 'assemblee' }],
  ['les republicains', { slug: 'lr', chambre: 'assemblee' }],
  ['ecologiste et social', { slug: 'ges', chambre: 'assemblee' }],
  ['republicains', { slug: 'lr', chambre: 'assemblee' }],
  ['socialistes', { slug: 'soc', chambre: 'assemblee' }],
  ['horizons', { slug: 'hor', chambre: 'assemblee' }],
  ['democrate', { slug: 'dem', chambre: 'assemblee' }],
  // Sénat - noms longs d'abord
  ['communiste republicain citoyen et ecologiste - kanaky', { slug: 'crce-k', chambre: 'senat' }],
  ['rassemblement des democrates, progressistes et independants', { slug: 'rdpi', chambre: 'senat' }],
  ['communiste republicain citoyen et ecologiste', { slug: 'crce-k', chambre: 'senat' }],
  ['ecologiste - solidarite et territoires', { slug: 'gest', chambre: 'senat' }],
  ['rassemblement des democrates', { slug: 'rdpi', chambre: 'senat' }],
  ['union centriste', { slug: 'uc', chambre: 'senat' }],
  ['socialiste', { slug: 'soc', chambre: 'senat' }],
];

// Composant pour texte extensible avec détection d'overflow
function ExpandableText({ text, className = '' }: { text: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight);
      }
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [text]);

  return (
    <div>
      <p
        ref={textRef}
        className={`text-sm text-gray-700 ${isExpanded ? '' : 'line-clamp-5'} ${className}`}
      >
        {text}
      </p>
      {(isTruncated || isExpanded) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:underline mt-1"
        >
          {isExpanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  );
}

export default function ScrutinDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const numero = params.numero as string;
  const chambre = searchParams.get('chambre') || 'assemblee';
  const session = searchParams.get('session') || undefined;

  const [expandedPosition, setExpandedPosition] = useState<string | null>('pour');
  const [groupeFilter, setGroupeFilter] = useState<string | null>(null);
  const [interventionsSortAsc, setInterventionsSortAsc] = useState(true); // true = chronologique, false = inverse

  const { data, isLoading, error } = useQuery<{ data: ScrutinDetail }>({
    queryKey: ['scrutin', numero, chambre, session],
    queryFn: () => api.get(`/scrutins/${numero}`, { params: { chambre, session } }).then((res) => res.data),
  });

  // Query paginée pour les interventions
  const {
    data: interventionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<InterventionsResponse>({
    queryKey: ['scrutin-interventions', numero, chambre, session, interventionsSortAsc ? 'asc' : 'desc'],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/scrutins/${numero}/interventions`, {
        params: {
          chambre,
          session,
          page: pageParam,
          limit: 10,
          sort: interventionsSortAsc ? 'asc' : 'desc',
        },
      }).then((res) => res.data),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!data, // N'exécuter qu'après avoir les données du scrutin
  });

  // Hook pour le scroll infini des interventions
  const { loadMoreRef: interventionsLoadMoreRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Toutes les interventions chargées
  const allInterventions = interventionsData?.pages.flatMap((page) => page.data) ?? [];
  const totalInterventions = data?.data.totalInterventions ?? 0;

  // Extraire les groupes depuis les votes (avec slug et chambre pour les liens)
  // Doit être avant les returns conditionnels pour respecter les règles des hooks
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

  // Extraire les parlementaires depuis les votes ET les interventions (avec slug et chambre pour les liens)
  const parlementairesMap = useMemo(() => {
    const parlementaires = new Map<string, { slug: string; prenom: string; nom: string; chambre: string }>();

    // Depuis les votes
    if (data?.data.votesByPosition) {
      Object.values(data.data.votesByPosition).flat().forEach(vote => {
        const p = vote.parlementaire;
        const fullName = `${p.prenom} ${p.nom}`;
        parlementaires.set(normalizeString(fullName), {
          slug: p.slug,
          prenom: p.prenom,
          nom: p.nom,
          chambre: p.chambre,
        });
      });
    }

    // Depuis les interventions (pour les parlementaires qui n'ont pas voté mais sont intervenus)
    // On utilise à la fois les interventions initiales et celles chargées via infinite scroll
    const interventionsToCheck = [
      ...(data?.data.interventions || []),
      ...allInterventions,
    ];
    interventionsToCheck.forEach(intervention => {
      const p = intervention.parlementaire;
      const fullName = `${p.prenom} ${p.nom}`;
      const key = normalizeString(fullName);
      if (!parlementaires.has(key)) {
        parlementaires.set(key, {
          slug: p.slug,
          prenom: p.prenom,
          nom: p.nom,
          chambre: data?.data.chambre || 'assemblee',
        });
      }
    });

    return parlementaires;
  }, [data?.data.votesByPosition, data?.data.interventions, data?.data.chambre, allInterventions]);

  const getParlementaireRoute = (parlementaire: Vote['parlementaire']) => {
    return parlementaire.chambre === 'senat'
      ? `/senateurs/${parlementaire.slug}`
      : `/deputes/${parlementaire.slug}`;
  };

  const parlementaireLabel = chambre === 'senat' ? 'sénateurs' : 'députés';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Scrutin non trouvé.
        </div>
      </div>
    );
  }

  const scrutin = data.data;
  const totalExprime = scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention;
  const pourPct = totalExprime > 0 ? (scrutin.nombrePour / totalExprime) * 100 : 0;
  const contrePct = totalExprime > 0 ? (scrutin.nombreContre / totalExprime) * 100 : 0;
  const abstPct = totalExprime > 0 ? (scrutin.nombreAbstention / totalExprime) * 100 : 0;
  const isAdopted = scrutin.sort === 'adopte';

  // Type pour les matches trouvés dans le texte
  type TextMatch = {
    type: 'groupe' | 'parlementaire';
    slug: string;
    chambre: string;
    start: number;
    end: number;
  };

  // Vérifier si un match est sur des limites de mots (pas au milieu d'un mot)
  const isWordBoundary = (text: string, start: number, end: number): boolean => {
    // Caractères qui délimitent les mots
    const boundaryChars = /[\s,.:;!?()[\]"'«»-]/;

    // Vérifier le caractère avant le match (ou début de chaîne)
    const charBefore = start === 0 ? ' ' : text[start - 1];
    const validStart = start === 0 || boundaryChars.test(charBefore);

    // Vérifier le caractère après le match (ou fin de chaîne)
    const charAfter = end >= text.length ? ' ' : text[end];
    const validEnd = end >= text.length || boundaryChars.test(charAfter);

    return validStart && validEnd;
  };

  // Chercher tous les groupes et parlementaires dans le texte
  const findAllMatchesInText = (text: string): TextMatch[] => {
    const normalizedText = normalizeString(text);
    const matches: TextMatch[] = [];

    // 1. Chercher les groupes dans le mapping (noms complets, triés par longueur)
    for (const [fullName, info] of groupeFullNameToSlug) {
      const idx = normalizedText.indexOf(fullName);
      if (idx !== -1 && isWordBoundary(normalizedText, idx, idx + fullName.length)) {
        matches.push({
          type: 'groupe',
          slug: info.slug,
          chambre: info.chambre,
          start: idx,
          end: idx + fullName.length,
        });
        break; // Un seul groupe par texte
      }
    }

    // 2. Chercher les groupes extraits des votes (noms abrégés)
    if (matches.length === 0) {
      for (const [nomLower, groupe] of groupesMap.entries()) {
        const normalizedNom = normalizeString(nomLower);
        const idx = normalizedText.indexOf(normalizedNom);
        if (idx !== -1 && isWordBoundary(normalizedText, idx, idx + normalizedNom.length)) {
          matches.push({
            type: 'groupe',
            slug: groupe.slug,
            chambre: groupe.chambre,
            start: idx,
            end: idx + normalizedNom.length,
          });
          break;
        }
      }
    }

    // 3. Chercher les parlementaires
    for (const [normalizedName, parlementaire] of parlementairesMap.entries()) {
      // Ignorer les noms trop courts (< 5 chars) pour éviter les faux positifs
      if (normalizedName.length < 5) continue;

      // Chercher "Prénom Nom" dans le texte normalisé
      const idx = normalizedText.indexOf(normalizedName);
      if (idx !== -1 && isWordBoundary(normalizedText, idx, idx + normalizedName.length)) {
        // Vérifier que ce n'est pas à l'intérieur d'un match groupe existant
        const isInsideGroupe = matches.some(m => idx >= m.start && idx < m.end);
        if (!isInsideGroupe) {
          matches.push({
            type: 'parlementaire',
            slug: parlementaire.slug,
            chambre: parlementaire.chambre,
            start: idx,
            end: idx + normalizedName.length,
          });
          break; // Un seul parlementaire principal par texte
        }
      }
    }

    // Trier par position dans le texte
    return matches.sort((a, b) => a.start - b.start);
  };

  // Formater les demandeurs avec liens vers les groupes et parlementaires
  const formatDemandeurs = (demandeurTexte: string) => {
    const matches = findAllMatchesInText(demandeurTexte);

    if (matches.length === 0) {
      return demandeurTexte;
    }

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      // Texte avant le match
      if (match.start > lastIndex) {
        result.push(demandeurTexte.slice(lastIndex, match.start));
      }

      // Le match avec lien
      const matchText = demandeurTexte.slice(match.start, match.end);
      const chambreRoute = match.chambre === 'senat' ? 'senat' : 'assemblee';

      if (match.type === 'groupe') {
        result.push(
          <Link
            key={`groupe-${match.start}`}
            href={`/groupes/${chambreRoute}/${match.slug}`}
            className="text-purple-700 hover:text-purple-900 hover:underline font-medium"
          >
            {matchText}
          </Link>
        );
      } else {
        result.push(
          <Link
            key={`parlementaire-${match.start}`}
            href={`/${chambreRoute === 'senat' ? 'senateurs' : 'deputes'}/${match.slug}`}
            className="text-purple-700 hover:text-purple-900 hover:underline font-medium"
          >
            {matchText}
          </Link>
        );
      }

      lastIndex = match.end;
    }

    // Texte après le dernier match
    if (lastIndex < demandeurTexte.length) {
      result.push(demandeurTexte.slice(lastIndex));
    }

    return <>{result}</>;
  };

  // Filter votes by groupe if selected
  const getFilteredVotes = (position: keyof typeof scrutin.votesByPosition) => {
    const votes = scrutin.votesByPosition[position] || [];
    if (!groupeFilter) return votes;
    return votes.filter(v => v.parlementaire.groupe?.nom === groupeFilter);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      {/* Compact Header Card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            Scrutin n°{scrutin.numero}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {chambreLabels[scrutin.chambre]}
          </span>
          <span className="px-2 py-1 text-xs bg-muted rounded">
            {typeVoteLabels[scrutin.typeVote] || scrutin.typeVote}
          </span>
          {scrutin.importance >= 4 && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
              ★ Important
            </span>
          )}
          <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
            isAdopted ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {isAdopted ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {isAdopted ? 'Adopté' : 'Rejeté'}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold mb-3 leading-tight">{scrutin.titre}</h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(scrutin.date)}
          </span>
          {scrutin.tags && scrutin.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              {scrutin.tags.slice(0, 3).map((t) => (
                <Link
                  key={t}
                  href={`/scrutins?tag=${encodeURIComponent(t)}`}
                  className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20"
                >
                  {t}
                </Link>
              ))}
              {scrutin.tags.length > 3 && (
                <span className="text-xs">+{scrutin.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Contexte du vote - affiche les infos enrichies si disponibles */}
        {(scrutin.objetLibelle || scrutin.demandeurTexte || scrutin.texteTitre) && (
          <div className="space-y-2 mb-4">
            {/* Objet du vote (si différent du titre) */}
            {scrutin.objetLibelle && scrutin.objetLibelle !== scrutin.titre && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                <div>
                  <span className="text-blue-700 font-medium">Objet du vote : </span>
                  <span className="text-blue-900">{scrutin.objetLibelle}</span>
                </div>
              </div>
            )}

            {/* Demandeur du vote */}
            {scrutin.demandeurTexte && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 text-sm">
                <Users className="h-4 w-4 mt-0.5 text-purple-600 flex-shrink-0" />
                <div>
                  <span className="text-purple-700 font-medium">Vote demandé par : </span>
                  <span className="text-purple-900">{formatDemandeurs(scrutin.demandeurTexte)}</span>
                </div>
              </div>
            )}

            {/* Texte de loi context if available */}
            {scrutin.texteTitre && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">Texte concerné : </span>
                  <span className="font-medium">{scrutin.texteTitre}</span>
                  {scrutin.texteNumero && (
                    <span className="text-muted-foreground"> (n°{scrutin.texteNumero})</span>
                  )}
                </div>
              </div>
            )}

            {/* Dossier législatif lié */}
            {scrutin.dossier && (
              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                        Dossier législatif
                      </span>
                      {scrutin.dossier.etat && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          scrutin.dossier.etat === 'promulgue' ? 'bg-green-100 text-green-700' :
                          scrutin.dossier.etat === 'adopte' ? 'bg-blue-100 text-blue-700' :
                          scrutin.dossier.etat === 'rejete' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {scrutin.dossier.etat === 'promulgue' ? 'Promulgué' :
                           scrutin.dossier.etat === 'adopte' ? 'Adopté' :
                           scrutin.dossier.etat === 'rejete' ? 'Rejeté' : 'En cours'}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{scrutin.dossier.titre}</h3>
                    {scrutin.dossier.procedureLibelle && (
                      <p className="text-sm text-gray-600 mb-2">{scrutin.dossier.procedureLibelle}</p>
                    )}
                    {scrutin.dossier.loiNumero && (
                      <p className="text-sm text-green-700 font-medium mb-2">
                        Loi n°{scrutin.dossier.loiNumero}
                        {scrutin.dossier.loiTitre && ` - ${scrutin.dossier.loiTitre}`}
                      </p>
                    )}
                    {scrutin.dossier.loiNumero && scrutin.dossier.urlLegifrance && (
                      <div className="mt-2">
                        <a
                          href={scrutin.dossier.urlLegifrance}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 hover:underline bg-green-100 px-2.5 py-1 rounded-md"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Consulter le texte de loi sur Légifrance
                        </a>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Link
                        href={`/dossiers/${scrutin.dossier.uid}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-indigo-100 px-2.5 py-1 rounded-md hover:bg-indigo-200 transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        Voir le dossier complet
                        {(() => {
                          const parts = [];
                          if ((scrutin.dossier._count?.scrutins ?? 0) > 1) parts.push(`${scrutin.dossier._count!.scrutins} scrutins`);
                          if ((scrutin.dossier._count?.amendements ?? 0) > 0) parts.push(`${scrutin.dossier._count!.amendements} amendements`);
                          return parts.length > 0 ? ` (${parts.join(', ')})` : '';
                        })()}
                      </Link>
                      {scrutin.dossier.urlAN && (
                        <a
                          href={scrutin.dossier.urlAN}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Voir sur AN
                        </a>
                      )}
                      {scrutin.dossier.urlSenat && (
                        <a
                          href={scrutin.dossier.urlSenat}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Voir sur Sénat
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amendements votés - affiche le contenu des amendements si disponibles */}
        {scrutin.amendements && scrutin.amendements.length > 0 && (
          <div className="space-y-3 mb-4">
            {scrutin.amendements.length > 1 && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {scrutin.amendements.length} amendements votés
                </span>
              </div>
            )}
            {scrutin.amendements.map((amendement) => (
              <div key={amendement.id} className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                        Amendement n°{amendement.numero}
                      </span>
                      {amendement.articleVise && (
                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          {amendement.articleVise}
                        </span>
                      )}
                      {amendement.auteurLibelle && (
                        <span className="text-xs text-amber-600">
                          par {amendement.auteurLibelle}
                        </span>
                      )}
                    </div>

                    {/* Dispositif (texte de l'amendement) */}
                    {amendement.dispositif && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-amber-800 mb-1">Texte de l&apos;amendement :</h4>
                        <div className="text-sm text-gray-800 bg-white/60 rounded p-3 border border-amber-200">
                          <div dangerouslySetInnerHTML={{ __html: amendement.dispositif.replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    )}

                    {/* Exposé sommaire */}
                    {amendement.exposeSommaire && (
                      <div>
                        <h4 className="text-xs font-semibold text-amber-800 mb-1">Exposé des motifs :</h4>
                        <div className="text-sm text-gray-700 bg-white/40 rounded p-3 border border-amber-100">
                          <div dangerouslySetInnerHTML={{ __html: amendement.exposeSommaire.replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Interventions / Débats liés */}
        {totalInterventions > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Débats et explications de vote</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {totalInterventions}
              </span>
              {/* Bouton de tri */}
              <button
                onClick={() => setInterventionsSortAsc(!interventionsSortAsc)}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                title={interventionsSortAsc ? 'Plus anciens d\'abord' : 'Plus récents d\'abord'}
              >
                {interventionsSortAsc ? (
                  <>
                    <ArrowUp className="h-3.5 w-3.5" />
                    Plus anciens d&apos;abord
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3.5 w-3.5" />
                    Plus récents d&apos;abord
                  </>
                )}
              </button>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {allInterventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="p-4 rounded-lg border bg-amber-50/50 border-amber-200"
                >
                  <div className="flex items-start gap-3">
                    {/* Numéro d'ordre */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold">
                      {intervention.ordre}
                    </div>
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      {intervention.parlementaire.photoUrl ? (
                        <Image
                          src={intervention.parlementaire.photoUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link
                          href={chambre === 'senat' ? `/senateurs/${intervention.parlementaire.slug}` : `/deputes/${intervention.parlementaire.slug}`}
                          className="font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {intervention.parlementaire.prenom} {intervention.parlementaire.nom}
                        </Link>
                        {intervention.parlementaire.groupe && (
                          <span
                            className="px-2 py-0.5 text-xs rounded-full text-white"
                            style={{ backgroundColor: intervention.parlementaire.groupe.couleur || '#888' }}
                          >
                            {intervention.parlementaire.groupe.nom}
                          </span>
                        )}
                        {intervention.type === 'explication_vote' && (
                          <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                            Explication de vote
                          </span>
                        )}
                      </div>
                      <ExpandableText text={intervention.contenu} />
                    </div>
                  </div>
                </div>
              ))}

              {/* Infinite scroll trigger - inside scrollable container */}
              <div ref={interventionsLoadMoreRef} className="flex justify-center py-2">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Chargement...</span>
                  </div>
                )}
                {!hasNextPage && allInterventions.length > 0 && allInterventions.length >= 10 && (
                  <p className="text-xs text-muted-foreground">
                    Toutes les interventions ont été chargées
                  </p>
                )}
              </div>
            </div>

            {/* Lien vers la source des interventions */}
            {allInterventions.some(i => i.sourceUrl) && (
              <div className="mt-3 pt-3 border-t border-amber-200 flex justify-end">
                <a
                  href={allInterventions.find(i => i.sourceUrl)?.sourceUrl || ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Voir le compte-rendu intégral
                </a>
              </div>
            )}
          </div>
        )}

        {/* Vote Summary - Compact visual */}
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200 flex">
            <div
              className="bg-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${pourPct}%` }}
              title={`Pour: ${scrutin.nombrePour} (${pourPct.toFixed(1)}%)`}
            >
              {pourPct > 10 && `${scrutin.nombrePour}`}
            </div>
            <div
              className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${abstPct}%` }}
              title={`Abstention: ${scrutin.nombreAbstention} (${abstPct.toFixed(1)}%)`}
            >
              {abstPct > 10 && `${scrutin.nombreAbstention}`}
            </div>
            <div
              className="bg-red-500 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${contrePct}%` }}
              title={`Contre: ${scrutin.nombreContre} (${contrePct.toFixed(1)}%)`}
            >
              {contrePct > 10 && `${scrutin.nombreContre}`}
            </div>
          </div>

          {/* Legend with clickable counts */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => setExpandedPosition('pour')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'pour' ? 'bg-green-100' : 'hover:bg-muted'
              }`}
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">{scrutin.nombrePour}</span>
              <span className="text-muted-foreground">pour</span>
              <span className="text-xs text-muted-foreground">({pourPct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setExpandedPosition('abstention')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'abstention' ? 'bg-amber-100' : 'hover:bg-muted'
              }`}
            >
              <MinusCircle className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-amber-600">{scrutin.nombreAbstention}</span>
              <span className="text-muted-foreground">abstention</span>
            </button>
            <button
              onClick={() => setExpandedPosition('contre')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'contre' ? 'bg-red-100' : 'hover:bg-muted'
              }`}
            >
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-600">{scrutin.nombreContre}</span>
              <span className="text-muted-foreground">contre</span>
              <span className="text-xs text-muted-foreground">({contrePct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setExpandedPosition('absent')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'absent' ? 'bg-gray-200' : 'hover:bg-muted'
              }`}
            >
              <Users className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-500">{scrutin.votesByPosition.absent?.length || 0}</span>
              <span className="text-muted-foreground">non-votants</span>
            </button>
          </div>
        </div>

        {/* External link - only show if sourceUrl exists */}
        {scrutin.sourceUrl && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <a
              href={scrutin.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Voir le scrutin sur {scrutin.chambre === 'senat' ? 'senat.fr' : 'assemblee-nationale.fr'}
            </a>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Votes by groupe */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Par groupe politique</h2>
              {groupeFilter && (
                <button
                  onClick={() => setGroupeFilter(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Voir tous
                </button>
              )}
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {Object.entries(scrutin.votesByGroupe)
                .sort(([, a], [, b]) => (b.pour + b.contre + b.abstention) - (a.pour + a.contre + a.abstention))
                .map(([groupeNom, votes]) => {
                  const total = votes.pour + votes.contre + votes.abstention;
                  const isSelected = groupeFilter === groupeNom;

                  return (
                    <button
                      key={groupeNom}
                      onClick={() => setGroupeFilter(isSelected ? null : groupeNom)}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-sm truncate pr-2">{groupeNom}</span>
                        <span className="text-xs text-muted-foreground">{total} votes</span>
                      </div>
                      {/* Mini bar chart */}
                      <div className="h-2 rounded-full overflow-hidden bg-gray-100 flex">
                        {total > 0 && (
                          <>
                            <div
                              className="bg-green-500"
                              style={{ width: `${(votes.pour / total) * 100}%` }}
                              title={`Pour: ${votes.pour}`}
                            />
                            <div
                              className="bg-amber-400"
                              style={{ width: `${(votes.abstention / total) * 100}%` }}
                              title={`Abstention: ${votes.abstention}`}
                            />
                            <div
                              className="bg-red-500"
                              style={{ width: `${(votes.contre / total) * 100}%` }}
                              title={`Contre: ${votes.contre}`}
                            />
                          </>
                        )}
                      </div>
                      {/* Numbers */}
                      <div className="flex gap-3 mt-1.5 text-xs">
                        <span className="text-green-600">{votes.pour} pour</span>
                        <span className="text-amber-600">{votes.abstention} abst.</span>
                        <span className="text-red-600">{votes.contre} contre</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right: Vote lists */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Détail des votes
                  {groupeFilter && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — {groupeFilter}
                    </span>
                  )}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {scrutin.totalVotes} {parlementaireLabel}
                </span>
              </div>
            </div>

            {/* Position tabs */}
            <div className="border-b">
              {(['pour', 'contre', 'abstention', 'absent'] as const).map((position) => {
                const config = {
                  pour: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Pour' },
                  contre: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Contre' },
                  abstention: { icon: MinusCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Abstention' },
                  absent: { icon: Users, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Non-votant' },
                }[position];
                const Icon = config.icon;
                const count = getFilteredVotes(position).length;
                const isExpanded = expandedPosition === position;

                return (
                  <button
                    key={position}
                    onClick={() => setExpandedPosition(isExpanded ? null : position)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isExpanded
                        ? `${config.color} border-current`
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    {config.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${isExpanded ? config.bg : 'bg-muted'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Vote list */}
            <div className="max-h-[400px] overflow-y-auto p-2">
              {expandedPosition && (
                <>
                  {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length === 0 ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      {groupeFilter ? `Aucun vote "${expandedPosition}" pour ce groupe` : 'Aucun vote'}
                    </p>
                  ) : (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition)
                        .slice(0, 100)
                        .map((vote) => (
                          <Link
                            key={vote.id}
                            href={getParlementaireRoute(vote.parlementaire)}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                          >
                            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                              {vote.parlementaire.photoUrl ? (
                                <Image
                                  src={vote.parlementaire.photoUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate group-hover:text-primary">
                                {vote.parlementaire.prenom} {vote.parlementaire.nom}
                              </p>
                              {vote.parlementaire.groupe && (
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  <span
                                    className="h-2 w-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: vote.parlementaire.groupe.couleur || '#888' }}
                                  />
                                  {vote.parlementaire.groupe.nom}
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                    </div>
                  )}
                  {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length > 100 && (
                    <p className="text-sm text-muted-foreground text-center py-3 border-t mt-2">
                      +{getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length - 100} autres {parlementaireLabel}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
