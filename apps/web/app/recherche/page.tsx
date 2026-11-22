'use client';

import { useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Search, Users, Vote, Building2, FileText, Loader2, X,
  Landmark, BookOpen, Tag, ChevronRight, Flag, Star, PenLine,
} from 'lucide-react';
import { api } from '@/lib/api';
import { scrutinHref } from '@/lib/scrutin-url';
import { formatDossierTitre, getDossierEtat } from '@/lib/dossiers';
import { useDebouncedCallback } from 'use-debounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { legislatureLabel, mandatureLabel } from '@/lib/periodes';
import { creditPhoto, libellePoste, moisAnnee, photoDe, type PersonneGouvernement, type PhotoCommons } from '@/lib/gouvernements';
import { COULEUR_ETAPE, LIBELLE_CHAMBRE, cheminPetition, dateLongue, libelleEtape, signaturesEnClair, type ChambrePetition, type TypeEtapePetition } from '@/lib/petitions';

// La recherche présente des personnes, pas des tables : un parlementaire et
// le membre du Gouvernement qu'il a été font un seul résultat, anciens compris
// et classés après les personnes en fonction (#129). Toutes les cartes ont la
// même forme : vignette, titre et badges, une ligne de contexte, une ligne de
// détail.

// =============================================================================
// Types (réponse de /search)
// =============================================================================

type RolePersonne = 'deputes' | 'senateurs' | 'gouvernement';

interface Personne {
  _type: 'personne';
  cle: string;
  prenom: string;
  nom: string;
  sexe: string | null;
  photoUrl: string | null;
  /** Photo de Wikimedia Commons (membre du Gouvernement sans fiche) : son crédit. Absent d'une réponse ancienne. */
  photoCredit?: Omit<PhotoCommons, 'url'> | null;
  enFonction: boolean;
  parlementaire: {
    slug: string;
    chambre: string;
    actif: boolean;
    groupe: { nom: string; couleur: string | null } | null;
    circonscription: { nom: string; departement: string } | null;
    dernierMandat: { chambre: string; legislature: number | null; mandature: number | null; dateFin: string | null } | null;
  } | null;
  gouvernement: {
    membreSlug: string;
    civilite: string | null;
    dernierPoste: {
      qualite: string;
      intitule: string;
      intituleCourt: string | null;
      dateDebut: string;
      dateFin: string | null;
      gouvernement: { slug: string; nom: string } | null;
    } | null;
  } | null;
  roles: RolePersonne[];
}

interface Gouvernement {
  _type: 'gouvernement';
  slug: string;
  nom: string;
  dateDebut: string;
  dateFin: string | null;
  enCours: boolean;
  premierMinistre: PersonneGouvernement | null;
}

interface Groupe {
  _type: 'groupe';
  id: string;
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  chambre: string;
  statsMembresActifs: number | null;
}

interface Commission {
  _type: 'commission';
  id: string;
  slug: string;
  nom: string;
  nomCourt: string | null;
  chambre: string;
  type: string | null;
  actif: boolean;
}

interface Scrutin {
  _type: 'scrutin';
  id: string;
  numero: number;
  chambre: 'assemblee' | 'senat';
  session: string | null;
  date: string;
  titre: string;
  sort: string;
}

interface Sujet {
  _type: 'sujet';
  id: string;
  slug: string;
  label: string;
  category: string | null;
  dossierCount: number | null;
  scrutinCount: number | null;
}

interface Lobbyiste {
  _type: 'lobbyiste';
  id: string;
  nom: string;
  type: string | null;
  secteur: string | null;
}

interface Dossier {
  _type: 'dossier';
  id: string;
  uid: string;
  titre: string;
  etat: string | null;
  procedureLibelle: string | null;
  loiNumero: string | null;
}

interface Petition {
  _type: 'petition';
  id: string;
  chambre: ChambrePetition;
  numero: number;
  titre: string;
  signatures: number | null;
  collecte: 'ouverte' | 'close';
  etape: TypeEtapePetition | null;
  etapeDate: string | null;
}

type Resultat = Personne | Gouvernement | Groupe | Commission | Scrutin | Sujet | Lobbyiste | Dossier | Petition;

const CATEGORIES = ['personnes', 'gouvernements', 'groupes', 'commissions', 'scrutins', 'sujets', 'lobbyistes', 'dossiers', 'petitions'] as const;
type Categorie = (typeof CATEGORIES)[number];
type Filtre = 'all' | Categorie;

interface Meta {
  query: string;
  counts: Record<Categorie, number> & { total: number; personnesParRole: Record<RolePersonne, number> };
  /** Aucune correspondance exacte : ce sont des noms approchants. */
  approximatif: boolean;
  meilleurResultat: { categorie: 'personnes' | 'gouvernements'; cle: string } | null;
}

interface ReponseTout {
  sections: Record<Categorie, Resultat[]>;
  meta: Meta;
}

interface ReponseFiltree {
  data: Resultat[];
  meta: Meta & { hasNext: boolean; page: number };
}

const PAGE_SIZE = 30;

const LIBELLES: Record<Categorie, { pluriel: string; icone: LucideIcon; teinte: string }> = {
  personnes:     { pluriel: 'Personnes',     icone: Users,     teinte: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  gouvernements: { pluriel: 'Gouvernements', icone: Flag,      teinte: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300' },
  groupes:       { pluriel: 'Groupes',       icone: Landmark,  teinte: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  commissions:   { pluriel: 'Commissions',   icone: BookOpen,  teinte: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  scrutins:      { pluriel: 'Scrutins',      icone: Vote,      teinte: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  sujets:        { pluriel: 'Sujets',        icone: Tag,       teinte: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  lobbyistes:    { pluriel: 'Lobbyistes',    icone: Building2, teinte: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  dossiers:      { pluriel: 'Dossiers',      icone: FileText,  teinte: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  petitions:     { pluriel: 'Pétitions',     icone: PenLine,   teinte: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const CATEGORIE_DU_TYPE: Record<Resultat['_type'], Categorie> = {
  personne: 'personnes',
  gouvernement: 'gouvernements',
  groupe: 'groupes',
  commission: 'commissions',
  scrutin: 'scrutins',
  sujet: 'sujets',
  lobbyiste: 'lobbyistes',
  dossier: 'dossiers',
  petition: 'petitions',
};

const ROLES: { valeur: RolePersonne | null; libelle: string }[] = [
  { valeur: null, libelle: 'Toutes' },
  { valeur: 'deputes', libelle: 'Députés' },
  { valeur: 'senateurs', libelle: 'Sénateurs' },
  { valeur: 'gouvernement', libelle: 'Gouvernement' },
];

const chambreLibelle = (c: string) => (c === 'senat' ? 'Sénat' : 'Assemblée nationale');

// =============================================================================
// Une carte, quel que soit le type
// =============================================================================

interface Badge {
  texte: string;
  classe: string;
}

interface Carte {
  href: string;
  titre: string;
  /** Titres longs (scrutins, dossiers) : coupés à deux lignes. */
  titreLong?: boolean;
  badges: Badge[];
  contexte?: string;
  /** Pastille de couleur devant le contexte (groupe politique). */
  pastille?: string | null;
  detail?: string;
  photo?: string | null;
  /** Crédit de la photo, en infobulle, quand elle vient de Wikimedia Commons */
  credit?: string;
  icone: LucideIcon;
  teinte: string;
}

const BADGE_NEUTRE = 'bg-muted text-muted-foreground';

/** « Ancien député · XVIe législature », « Sénatrice », « Ancienne sénatrice · jusqu'en 2020 ». */
function ligneParlement(p: Personne): { texte: string; pastille: string | null } | null {
  const f = p.parlementaire;
  if (!f) return null;
  const senat = f.chambre === 'senat';
  const femme = p.sexe === 'F';
  const fonction = senat ? (femme ? 'sénatrice' : 'sénateur') : femme ? 'députée' : 'député';
  const morceaux: string[] = [];
  if (f.actif) {
    morceaux.push(fonction.charAt(0).toUpperCase() + fonction.slice(1));
  } else {
    const titre = `${femme ? 'Ancienne' : 'Ancien'} ${fonction}`;
    const m = f.dernierMandat;
    const periode =
      m?.legislature != null
        ? legislatureLabel(m.legislature)
        : m?.mandature != null
          ? mandatureLabel(m.mandature)
          : m?.dateFin
            ? `jusqu’en ${new Date(m.dateFin).getUTCFullYear()}`
            : null;
    morceaux.push(periode ? `${titre} · ${periode}` : titre);
  }
  if (f.groupe) morceaux.push(f.groupe.nom);
  if (f.circonscription) morceaux.push(f.circonscription.nom);
  return { texte: morceaux.join(' · '), pastille: f.groupe?.couleur ?? null };
}

/** « Premier ministre · Gouvernement Lecornu II », « Ministre · Culture · Gouvernement Lecornu II, jusqu'en févr. 2026 ». */
function ligneGouvernement(p: Personne): string | null {
  const poste = p.gouvernement?.dernierPoste;
  if (!poste) return null;
  const morceaux = [libellePoste(poste.qualite, poste.intituleCourt, poste.intitule)];
  if (poste.gouvernement) morceaux.push(`Gouvernement ${poste.gouvernement.nom}`);
  const texte = morceaux.join(' · ');
  return poste.dateFin === null ? texte : `${texte}, jusqu’en ${moisAnnee(poste.dateFin)}`;
}

function cartePersonne(p: Personne): Carte {
  const parlement = ligneParlement(p);
  const gouvernement = ligneGouvernement(p);
  // La fonction en cours d'abord ; à défaut, la plus récente.
  const gouvernementEnPremier =
    !!gouvernement &&
    (p.gouvernement?.dernierPoste?.dateFin === null ||
      (!p.parlementaire?.actif &&
        (p.gouvernement?.dernierPoste?.dateFin ?? '') >= (p.parlementaire?.dernierMandat?.dateFin ?? '').slice(0, 10)));
  const f = p.parlementaire;
  return {
    // Sa fiche s'il en a une, sinon sa page de membre du Gouvernement.
    href: f
      ? `/${f.chambre === 'senat' ? 'senateurs' : 'deputes'}/${f.slug}`
      : p.gouvernement
        ? `/gouvernements/membres/${p.gouvernement.membreSlug}`
        : '/gouvernements',
    titre: `${p.prenom} ${p.nom}`,
    badges: [],
    contexte: (gouvernementEnPremier ? gouvernement : parlement?.texte) ?? undefined,
    pastille: gouvernementEnPremier ? null : (parlement?.pastille ?? null),
    detail: (gouvernementEnPremier ? parlement?.texte : gouvernement) ?? undefined,
    photo: p.photoUrl,
    credit: p.photoCredit && p.photoUrl ? creditPhoto({ ...p.photoCredit, url: p.photoUrl }) : undefined,
    icone: Users,
    teinte: LIBELLES.personnes.teinte,
  };
}

function carteDe(r: Resultat): Carte {
  const { icone, teinte } = LIBELLES[CATEGORIE_DU_TYPE[r._type]];
  switch (r._type) {
    case 'personne':
      return cartePersonne(r);
    case 'gouvernement':
      return {
        href: `/gouvernements/${r.slug}`,
        titre: `Gouvernement ${r.nom}`,
        badges: r.enCours ? [{ texte: 'En cours', classe: 'badge-en-cours' }] : [],
        contexte: r.premierMinistre ? `Premier ministre : ${r.premierMinistre.prenom} ${r.premierMinistre.nom}` : undefined,
        detail: `${moisAnnee(r.dateDebut)} → ${r.dateFin ? moisAnnee(r.dateFin) : 'en cours'}`,
        photo: r.premierMinistre ? photoDe(r.premierMinistre) : null,
        credit:
          r.premierMinistre && !r.premierMinistre.parlementaire?.photoUrl && r.premierMinistre.photo
            ? creditPhoto(r.premierMinistre.photo)
            : undefined,
        icone,
        teinte,
      };
    case 'groupe':
      return {
        href: `/groupes/${r.chambre || 'assemblee'}/${r.slug}`,
        titre: r.nom,
        badges: [],
        contexte: r.nomComplet && r.nomComplet !== r.nom ? r.nomComplet : undefined,
        pastille: r.couleur,
        detail: [chambreLibelle(r.chambre), r.statsMembresActifs ? `${r.statsMembresActifs} membres` : null].filter(Boolean).join(' · '),
        icone,
        teinte,
      };
    case 'commission':
      return {
        href: `/commissions/${r.slug}`,
        titre: r.nomCourt || r.nom,
        badges: r.actif ? [] : [{ texte: 'Dissoute', classe: BADGE_NEUTRE }],
        contexte: r.nomCourt && r.nomCourt !== r.nom ? r.nom : undefined,
        detail: [chambreLibelle(r.chambre), r.type ? r.type.replace(/_/g, ' ') : null].filter(Boolean).join(' · '),
        icone,
        teinte,
      };
    case 'scrutin':
      return {
        href: scrutinHref({ numero: r.numero, chambre: r.chambre, session: r.session ?? undefined }),
        titre: r.titre,
        titreLong: true,
        badges: [r.sort === 'adopte' ? { texte: 'Adopté', classe: 'badge-adopte' } : { texte: 'Rejeté', classe: 'badge-rejete' }],
        detail: [
          `Scrutin n° ${r.numero}`,
          new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          chambreLibelle(r.chambre),
        ].join(' · '),
        icone,
        teinte,
      };
    case 'sujet':
      return {
        href: `/sujets/${r.slug}`,
        titre: r.label,
        titreLong: true,
        badges: [],
        contexte: r.category ? r.category.charAt(0).toUpperCase() + r.category.slice(1) : undefined,
        detail: [
          r.scrutinCount ? `${r.scrutinCount} scrutin${r.scrutinCount > 1 ? 's' : ''}` : null,
          r.dossierCount ? `${r.dossierCount} dossier${r.dossierCount > 1 ? 's' : ''}` : null,
        ].filter(Boolean).join(' · ') || undefined,
        icone,
        teinte,
      };
    case 'lobbyiste':
      return {
        href: `/lobbying/${r.id}`,
        titre: r.nom,
        badges: [],
        contexte: r.secteur ?? undefined,
        detail: r.type ?? undefined,
        icone,
        teinte,
      };
    case 'dossier': {
      const etat = getDossierEtat(r.etat);
      return {
        href: `/dossiers/${r.uid}`,
        titre: formatDossierTitre(r.titre, r.procedureLibelle),
        titreLong: true,
        badges: etat ? [{ texte: etat.label, classe: etat.color }] : [],
        detail: r.loiNumero ? `Loi n° ${r.loiNumero}` : undefined,
        icone,
        teinte,
      };
    }
    case 'petition':
      return {
        href: cheminPetition(r),
        titre: r.titre,
        titreLong: true,
        badges: r.etape
          ? [{ texte: `${libelleEtape(r.etape, r.etapeDate)}${r.etapeDate ? ` · ${dateLongue(r.etapeDate)}` : ''}`, classe: COULEUR_ETAPE[r.etape] }]
          : [],
        contexte: `${signaturesEnClair(r.signatures)} · ${r.collecte === 'ouverte' ? 'signatures ouvertes' : 'collecte close'}`,
        detail: `Pétition n° ${r.numero} · ${LIBELLE_CHAMBRE[r.chambre]}`,
        icone,
        teinte,
      };
  }
}

const cleDe = (r: Resultat): string =>
  r._type === 'personne' ? r.cle : r._type === 'gouvernement' || r._type === 'groupe' || r._type === 'commission' || r._type === 'sujet'
    ? `${r._type}-${r.slug}`
    : r._type === 'dossier'
      ? `dossier-${r.uid}`
      : r._type === 'petition'
        ? `petition-${r.chambre}-${r.numero}`
        : `${r._type}-${r.id}`;

function CarteResultat({ resultat, enAvant = false }: { resultat: Resultat; enAvant?: boolean }) {
  const c = carteDe(resultat);
  const Icone = c.icone;
  return (
    <Link
      href={c.href}
      className={`block rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md ${
        enAvant ? 'border-primary/40 bg-primary/5' : 'bg-card'
      }`}
    >
      <div className="flex items-start gap-4">
        {c.photo ? (
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted" title={c.credit}>
            <Image src={c.photo} alt={c.titre} fill className="object-cover object-[50%_20%]" unoptimized />
          </div>
        ) : (
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${c.teinte}`}>
            <Icone className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            <span className={c.titreLong ? 'line-clamp-2' : ''}>{c.titre}</span>
            {c.badges.map((b) => (
              <span key={b.texte} className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.classe}`}>
                {b.texte}
              </span>
            ))}
          </h3>
          {c.contexte && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {c.pastille && (
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: c.pastille }} />
              )}
              {c.contexte}
            </p>
          )}
          {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
        </div>
      </div>
    </Link>
  );
}

// =============================================================================
// Page
// =============================================================================

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        actif ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
      }`}
    >
      {children}
    </button>
  );
}

const compte = (n: number | undefined) =>
  n != null ? <span className="ml-1 opacity-70">({n.toLocaleString('fr-FR')})</span> : null;

export default function RecherchePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [role, setRole] = useState<RolePersonne | null>(null);

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
    router.replace(value ? `/recherche?q=${encodeURIComponent(value)}` : '/recherche', { scroll: false });
  }, 300);

  useEffect(() => {
    debouncedSetQuery(query);
  }, [query, debouncedSetQuery]);

  const choisirFiltre = (f: Filtre) => {
    setFiltre(f);
    setRole(null);
  };

  const enabled = debouncedQuery.length >= 2;
  const tout = filtre === 'all';

  const requeteTout = useQuery<ReponseTout>({
    queryKey: ['search', debouncedQuery, 'all'],
    queryFn: () => api.get('/search', { params: { q: debouncedQuery, type: 'all' } }).then((r) => r.data),
    enabled: enabled && tout,
  });

  const requeteFiltree = useInfiniteQuery<ReponseFiltree>({
    queryKey: ['search-filtered', debouncedQuery, filtre, role],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get('/search', {
          params: {
            q: debouncedQuery,
            type: filtre,
            limit: PAGE_SIZE,
            page: pageParam,
            ...(filtre === 'personnes' && role ? { role } : {}),
          },
        })
        .then((r) => r.data),
    getNextPageParam: (derniere) => (derniere.meta.hasNext ? (derniere.meta.page ?? 1) + 1 : undefined),
    initialPageParam: 1,
    enabled: enabled && !tout,
  });

  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: requeteFiltree.hasNextPage,
    isFetchingNextPage: requeteFiltree.isFetchingNextPage,
    fetchNextPage: requeteFiltree.fetchNextPage,
  });

  const isLoading = tout ? requeteTout.isLoading : requeteFiltree.isLoading;
  const isFetching = tout ? requeteTout.isFetching : requeteFiltree.isFetching && !requeteFiltree.isFetchingNextPage;
  const error = tout ? requeteTout.error : requeteFiltree.error;
  const meta: Meta | undefined = requeteTout.data?.meta ?? requeteFiltree.data?.pages[0]?.meta;
  const counts = meta?.counts;
  const resultatsFiltres = requeteFiltree.data?.pages.flatMap((p) => p.data) ?? [];

  // Le meilleur résultat, en tête, et retiré de sa section.
  const sections = requeteTout.data?.sections;
  const meilleur = (() => {
    const m = requeteTout.data?.meta.meilleurResultat;
    if (!m || !sections) return null;
    return (
      sections[m.categorie].find((r) => (r._type === 'personne' ? r.cle : r._type === 'gouvernement' ? r.slug : null) === m.cle) ??
      null
    );
  })();

  const Approximatif = () =>
    meta?.approximatif ? (
      <p className="mb-4 text-sm text-muted-foreground">
        Aucun résultat exact pour « {debouncedQuery} ». Vous cherchiez peut-être :
      </p>
    ) : null;

  const Vide = () => (
    <div className="py-12 text-center text-muted-foreground">
      <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
      <p>Aucun résultat trouvé</p>
      <p className="mt-1 text-sm">Essayez avec d&apos;autres termes</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recherche</h1>
        <p className="mt-2 text-muted-foreground">
          Trouvez des parlementaires et des membres du Gouvernement, d’hier et d’aujourd’hui, des gouvernements, groupes,
          commissions, scrutins, sujets, lobbyistes, dossiers et pétitions
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-xl border bg-background px-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
              aria-label="Effacer la recherche"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {isFetching && (
            <Loader2 className="absolute right-12 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
        <Puce actif={tout} onClick={() => choisirFiltre('all')}>
          Tout{compte(counts?.total)}
        </Puce>
        {CATEGORIES.map((c) => (
          <Puce key={c} actif={filtre === c} onClick={() => choisirFiltre(c)}>
            {LIBELLES[c].pluriel}
            {compte(counts?.[c])}
          </Puce>
        ))}
      </div>

      {/* Sous-filtres des personnes : une personne passée par plusieurs rôles est dans chacun. */}
      {filtre === 'personnes' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const actif = role === r.valeur;
            const n = r.valeur ? counts?.personnesParRole[r.valeur] : counts?.personnes;
            return (
              <button
                key={r.libelle}
                onClick={() => setRole(r.valeur)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  actif ? 'border-primary bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                }`}
              >
                {r.libelle}
                {compte(n)}
              </button>
            );
          })}
        </div>
      )}
      {filtre !== 'personnes' && <div className="mb-3" />}

      {!debouncedQuery && (
        <div className="py-12 text-center text-muted-foreground">
          <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Commencez à taper pour rechercher</p>
          <p className="mt-1 text-sm">Minimum 2 caractères</p>
        </div>
      )}

      {debouncedQuery && debouncedQuery.length < 2 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>Minimum 2 caractères requis</p>
        </div>
      )}

      {isLoading && enabled && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/3 rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors de la recherche.
        </div>
      )}

      {/* Tout : le meilleur résultat, puis un aperçu par catégorie */}
      {tout && sections && !isLoading && (
        counts?.total === 0 ? (
          <Vide />
        ) : (
          <div className="space-y-8">
            <Approximatif />
            {meilleur && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Star className="h-4 w-4 text-primary" />
                  Meilleur résultat
                </h2>
                <CarteResultat resultat={meilleur} enAvant />
              </section>
            )}
            {CATEGORIES.map((c) => {
              const items = (sections[c] ?? []).filter((r) => r !== meilleur);
              if (items.length === 0) return null;
              const { pluriel, icone: Icone, teinte } = LIBELLES[c];
              const total = counts?.[c] ?? items.length;
              return (
                <section key={c}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <span className={`rounded-md p-1.5 ${teinte}`}>
                        <Icone className="h-4 w-4" />
                      </span>
                      {pluriel}
                      <span className="text-sm font-normal text-muted-foreground">({total.toLocaleString('fr-FR')})</span>
                    </h2>
                    {total > items.length + (meilleur && CATEGORIE_DU_TYPE[meilleur._type] === c ? 1 : 0) && (
                      <button onClick={() => choisirFiltre(c)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                        Voir les {total.toLocaleString('fr-FR')} résultats
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <CarteResultat key={cleDe(r)} resultat={r} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}

      {/* Une catégorie : toute la liste, page après page */}
      {!tout && requeteFiltree.data && !isLoading && (
        <>
          {resultatsFiltres.length === 0 ? (
            <Vide />
          ) : (
            <>
              <Approximatif />
              <div className="space-y-3">
                {resultatsFiltres.map((r) => (
                  <CarteResultat key={cleDe(r)} resultat={r} />
                ))}
              </div>
            </>
          )}
          <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
            {requeteFiltree.isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            )}
            {!requeteFiltree.hasNextPage && resultatsFiltres.length > 0 && (
              <p className="text-sm text-muted-foreground">Tous les résultats ont été chargés</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
