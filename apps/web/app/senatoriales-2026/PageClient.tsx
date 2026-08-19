'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Search, ChevronDown, ExternalLink, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';
import { SortantCard } from './components/SortantCard';
import { RepartitionGroupes } from './components/RepartitionGroupes';
import { SelecteurLecture } from './components/SelecteurLecture';
import { CadreGraphique } from './components/graphiques/CadreGraphique';

/**
 * Les graphiques sont chargés à l'affichage, pas au chargement de la page.
 *
 * Une seule lecture est visible à la fois, mais les sept partaient dans le
 * paquet initial — dont la carte et ses cinquante-trois kilo-octets de tracés
 * de départements, payés même par qui arrive sur `?tri=presence` et ne verra
 * jamais de carte.
 *
 * `ssr` reste actif : le rendu serveur est la raison d'être de cette page, et
 * la couper du HTML servi reviendrait à défaire le travail d'indexation.
 * Seul le découpage du JavaScript change.
 */
const CarteDepartements = dynamic(
  () => import('./components/graphiques/CarteDepartements').then((m) => m.CarteDepartements),
);
const PartRemiseEnJeu = dynamic(
  () => import('./components/graphiques/PartRemiseEnJeu').then((m) => m.PartRemiseEnJeu),
);
const DistributionBilan = dynamic(
  () => import('./components/graphiques/DistributionBilan').then((m) => m.DistributionBilan),
);
const NuageActivite = dynamic(
  () => import('./components/graphiques/NuageActivite').then((m) => m.NuageActivite),
);
const PyramideAges = dynamic(
  () => import('./components/graphiques/PyramideAges').then((m) => m.PyramideAges),
);
const BarresComptage = dynamic(
  () => import('./components/graphiques/BarresComptage').then((m) => m.BarresComptage),
);
import {
  GRAPHIQUES,
  GRAPHIQUE_PAR_TRI,
  SANS_COMMISSION,
  SANS_PROFESSION,
  familleProfession,
  type FiltresSortants,
  parCommission,
  parFamilleProfession,
  repartitionParGroupe,
  siegesParDepartement,
} from '@/lib/senatoriales/graphiques';

export interface ApercuSenatoriales {
  scrutin: {
    date: string;
    priseDeFonction: string;
    serie: string;
    mandatureSortante: number;
    mandatureEntrante: number;
    nbSieges: number;
    nbCirconscriptions: number;
    sources: { label: string; url?: string }[];
  };
  sortants: {
    total: number;
    mandatComplet: number;
    arriveesEnCours: number;
    parGroupe: GroupeRepartition[];
  };
  circonscriptions: {
    departement: string;
    nom: string;
    nbSieges: number;
  }[];
}

export interface GroupeRepartition {
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  /** Sièges du groupe remis en jeu. */
  sieges: number;
  /**
   * Sièges du groupe dans le Sénat entier, série 1 comprise.
   *
   * Optionnel côté client : l'aperçu est mis en cache une heure par l'API, et un
   * déploiement peut donc servir un instant des charges utiles antérieures à ce
   * champ. Les graphiques retombent alors sur les seuls sièges sortants.
   */
  siegesSenat?: number;
}

/**
 * Nom affichable d'un groupe. L'API résout déjà `nom` vers le libellé d'usage du
 * Sénat ; il ne reste ici que le cas du mandat sans groupe rattaché.
 */
export function nomGroupe(groupe: { nom: string } | null): string {
  return groupe ? groupe.nom : 'Sans groupe';
}

/**
 * Ancre d'une section de département : `#gironde`, `#bouches-du-rhone`.
 *
 * Dérivée du libellé et non du code INSEE, pour que l'URL partagée reste lisible
 * et corresponde à ce qu'un lecteur taperait.
 */
/** Minuscules sans accents — la forme sur laquelle se comparent les saisies. */
function sansAccents(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function ancreDepartement(libelle: string): string {
  return sansAccents(libelle)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface Sortant {
  mandatId: string;
  personne: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    profession: string | null;
    dateNaissance: string | null;
    /** 'M' | 'F', déduit de la civilité par la source. */
    sexe: string | null;
  };
  groupe: {
    slug: string;
    nom: string;
    nomComplet: string | null;
    couleur: string | null;
    position: string | null;
  } | null;
  // `departement` est le code INSEE ('01', '997'), `nom` le libellé ('Ain').
  circonscription: {
    departement: string;
    nom: string;
  } | null;
  commissionPermanente: string | null;
  mandat: {
    dateDebut: string;
    dateFin: string | null;
    mandatComplet: boolean;
    dureeMois: number;
    segments: number;
    interrompu: boolean;
  };
  /** Statistiques de carrière — identiques à celles de la fiche du sénateur. */
  bilan: {
    presence: number | null;
    loyaute: number | null;
    participation: number | null;
    interventions: number | null;
    amendements: number | null;
    calculatedAt: string | null;
  };
}

// Effectif du Sénat fixé par l'article L.O. 274 du code électoral.
const SIEGES_SENAT = 348;

/**
 * Regroupe les identifiants de mandat par libellé.
 *
 * `BarresComptage` ne reçoit que des couples libellé/effectif : il ne peut pas
 * deviner quels sortants se cachent derrière une barre. Cet index le lui dit,
 * et doit donc dériver exactement de la même clé que le comptage affiché.
 */
function indexerPar(
  sortants: Sortant[],
  cle: (sortant: Sortant) => string,
): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const sortant of sortants) {
    const libelle = cle(sortant);
    (index[libelle] ??= []).push(sortant.mandatId);
  }
  return index;
}

/** Tris qui rassemblent les sortants en sections plutôt que de les classer. */
const TRIS_REGROUPANTS = ['departement', 'groupe', 'commission', 'profession'];

/**
 * Clé de regroupement d'un sortant et libellé de sa section.
 *
 * Les deux diffèrent : la clé ordonne, le libellé s'affiche. Pour un département
 * la clé est le code INSEE — il range '01' avant '10', ce que le libellé ne fait
 * pas — et le titre reste le nom du département. Les valeurs absentes prennent
 * une clé préfixée `zzz`, qui les envoie en fin de liste sans les confondre avec
 * une section réelle dont le nom commencerait par un z.
 */
function clefDeSection(tri: string, sortant: Sortant): { cle: string; libelle: string } {
  switch (tri) {
    case 'groupe':
      return {
        cle: sortant.groupe?.slug ?? 'zzz-sans-groupe',
        libelle: nomGroupe(sortant.groupe),
      };
    case 'commission':
      return {
        cle: sortant.commissionPermanente ?? 'zzz-sans-commission',
        libelle: sortant.commissionPermanente ?? SANS_COMMISSION,
      };
    case 'profession': {
      // Même découpage que l'API et que le graphique : « Salariés (Cadres
      // divers) » et « Salariés (Retraités) » tombent dans la même section.
      const famille = familleProfession(sortant.personne.profession);
      return {
        cle: famille ?? 'zzz-sans-profession',
        libelle: famille ?? SANS_PROFESSION,
      };
    }
    default:
      return {
        cle: sortant.circonscription?.departement ?? 'zzz',
        libelle: sortant.circonscription?.nom ?? 'Circonscription non renseignée',
      };
  }
}

interface PageClientProps {
  initialApercu?: ApercuSenatoriales;
  initialSortants?: { data: Sortant[]; meta: { total: number } };
  /**
   * Les 178 sortants sans aucun filtre, pour la carte — qui décrit toujours le
   * renouvellement entier, quels que soient les filtres appliqués à la liste.
   *
   * Absente quand `initialSortants` n'est lui-même pas filtré : la transmettre
   * alors ferait voyager deux fois la même liste.
   */
  initialTousSortants?: Sortant[];
  /** Filtres avec lesquels `initialSortants` a été demandé côté serveur. */
  initialFiltres?: FiltresSortants;
}

function SenatorialesPageContent({
  initialApercu,
  initialSortants,
  initialTousSortants,
  initialFiltres,
}: PageClientProps) {
  const [filters, setFilter, , clearAll] = useUrlFilters<{
    search: string;
    departement: string;
    groupe: string;
    tri: string;
  }>(['search', 'departement', 'groupe', 'tri']);

  const [countdownText, setCountdownText] = useState<string | null>(null);

  /**
   * Sortants désignés par un clic dans un graphique.
   *
   * Une sélection ne filtre pas la liste, elle la surligne : filtrer ferait
   * disparaître le reste, et le lecteur perdrait l'échelle à laquelle comparer.
   * Cliquer sur « moins de 50 % de présence » doit montrer ces dix sortants
   * *parmi* les autres, pas à leur place.
   */
  const [surbrillance, setSurbrillance] = useState<{
    ids: Set<string>;
    libelle: string;
  } | null>(null);

  const listeRef = useRef<HTMLDivElement>(null);

  /**
   * Amène la liste sous les yeux après une action faite plus haut.
   *
   * Sans ça, cliquer sur un département de la carte ne semble rien faire : le
   * résultat existe, mais mille pixels plus bas. Le défilement est différé d'une
   * image pour laisser React poser la liste filtrée avant de viser sa position.
   */
  const glisserVersListe = useCallback(() => {
    requestAnimationFrame(() => {
      listeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const selectionnerDepartement = useCallback(
    (code: string) => {
      setFilter('departement', code);
      setSurbrillance(null);
      if (code) glisserVersListe();
    },
    [setFilter, glisserVersListe],
  );

  const selectionnerDepuisGraphique = useCallback(
    (mandatIds: string[], libelle: string) => {
      if (mandatIds.length === 0) return;
      setSurbrillance({ ids: new Set(mandatIds), libelle });
      glisserVersListe();
    },
    [glisserVersListe],
  );

  // Changer de tri ou de filtre invalide la sélection : les cartes surlignées
  // ne sont plus forcément à l'écran, et le bandeau annoncerait un décompte faux.
  useEffect(() => {
    setSurbrillance(null);
  }, [filters.tri, filters.departement, filters.groupe, filters.search]);

  useEffect(() => {
    const target = new Date('2026-09-27');
    const priseDeFonction = new Date('2026-10-01');
    const now = new Date();
    if (now < target) {
      const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setCountdownText(`J-${diff} avant le scrutin`);
    } else if (now < priseDeFonction) {
      setCountdownText('Scrutin passé');
    } else {
      setCountdownText('Les nouveaux sénateurs sont entrés en fonction');
    }
  }, []);

  const { data, isLoading, error } = useQuery<ApercuSenatoriales>({
    queryKey: ['senatoriales-2026'],
    queryFn: () => api.get('/senatoriales/2026').then((res) => res.data),
    initialData: initialApercu,
    // Aligné sur le `revalidate` du rendu serveur : sans délai de péremption,
    // React Query juge les données hydratées périmées dès le montage et relance
    // la requête, faisant transiter la liste une seconde fois pour rien.
    staleTime: 3_600_000,
  });

  const {
    data: sortantsData,
    isLoading: sortantsLoading,
    error: sortantsError,
  } = useQuery<{ data: Sortant[]; meta: { total: number } }>({
    queryKey: ['senatoriales-2026-sortants', { departement: filters.departement, groupe: filters.groupe, tri: filters.tri }],
    queryFn: () =>
      api
        .get('/senatoriales/2026/sortants', {
          params: {
            departement: filters.departement || undefined,
            groupe: filters.groupe || undefined,
            tri: filters.tri || undefined,
          },
        })
        .then((res) => res.data),
    // Les données du serveur ne servent d'amorce que si elles ont été demandées
    // avec les mêmes filtres : sinon on afficherait une liste qui ne correspond
    // pas à ce que l'URL réclame, le temps que la requête revienne.
    initialData: memesFiltres(filters, initialFiltres) ? initialSortants : undefined,
    // Aligné sur le `revalidate` du rendu serveur : sans délai de péremption,
    // React Query juge les données hydratées périmées dès le montage et relance
    // la requête, faisant transiter la liste une seconde fois pour rien.
    staleTime: 3_600_000,
  });

  const sortants = useMemo(() => sortantsData?.data ?? [], [sortantsData]);

  /**
   * Les 178 sortants, hors de toute sélection.
   *
   * Les graphiques décrivent le renouvellement dans son ensemble ; les calculer
   * sur la liste filtrée les viderait au premier clic sur la carte — laquelle
   * ne montrerait plus que le département qu'on vient de choisir, sans moyen
   * d'en choisir un autre. La liste complète est déjà chargée par le rendu
   * serveur, qui l'appelle sans filtre : la réutiliser n'ajoute aucune requête.
   */
  const tousSortants = useMemo(() => {
    // Trois sources, dans l'ordre de fiabilité : la liste complète que le serveur
    // joint quand il a filtré ; à défaut sa liste principale, qui est alors elle
    // -même complète ; en dernier recours la liste affichée, si les deux appels
    // serveur ont échoué.
    if (initialTousSortants?.length) return initialTousSortants;
    const serveurNonFiltre = !initialFiltres?.departement && !initialFiltres?.groupe;
    if (serveurNonFiltre && initialSortants?.data?.length) return initialSortants.data;
    return sortants;
  }, [initialTousSortants, initialSortants, initialFiltres, sortants]);

  // Le tri n'entre pas dans le compte : il réordonne la liste, il ne la restreint pas.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.departement) count++;
    if (filters.groupe) count++;
    return count;
  }, [filters.search, filters.departement, filters.groupe]);

  const handleClearFilters = () => {
    clearAll();
  };

  const filteredSortants = useMemo(() => {
    if (!filters.search) return sortants;
    // Les accents sont retirés des deux côtés, comme partout ailleurs dans les
    // listes du site : sans ça « Herve » ne trouve pas « Hervé » et la recherche
    // paraît cassée à qui tape au clavier sans se relire.
    const q = sansAccents(filters.search);
    return sortants.filter((s) =>
      sansAccents(`${s.personne.prenom} ${s.personne.nom}`).includes(q)
    );
  }, [sortants, filters.search]);

  // Regroupement des cartes en sections.
  //
  // Quatre tris produisent des sections — département, groupe, commission,
  // profession. Les autres sont des classements : présence, âge, nombre
  // d'amendements. Les découper en paquets casserait précisément l'ordre qu'on
  // demande à voir.
  const groupedSortants = useMemo(() => {
    const tri = filters.tri || 'departement';
    if (!TRIS_REGROUPANTS.includes(tri)) return null;

    const map = new Map<string, { libelle: string; ancre: string; sortants: Sortant[] }>();
    for (const s of filteredSortants) {
      const { cle, libelle } = clefDeSection(tri, s);
      if (!map.has(cle)) {
        map.set(cle, { libelle, ancre: ancreDepartement(libelle), sortants: [] });
      }
      map.get(cle)!.sortants.push(s);
    }

    const sections = Array.from(map.entries());
    // Le département s'ordonne sur le code INSEE, qui range '01' avant '10' là où
    // le libellé placerait l'Ain après l'Aube. Les autres regroupements n'ont pas
    // d'ordre naturel : on met les plus gros effectifs en tête, ce qui répond à
    // la question qu'on se pose en les demandant — lesquels pèsent le plus.
    if (tri === 'departement') {
      return sections.sort((a, b) => a[0].localeCompare(b[0]));
    }
    // Départage par libellé : deux sections de même effectif s'échangeraient
    // sinon d'un rendu à l'autre.
    return sections.sort(
      (a, b) =>
        b[1].sortants.length - a[1].sortants.length ||
        a[1].libelle.localeCompare(b[1].libelle, 'fr'),
    );
  }, [filteredSortants, filters.tri]);

  /**
   * Le graphique qu'appelle le tri courant, calculé sur la sélection.
   *
   * Contrairement à la carte, il décrit ce qui est affiché en dessous et pas le
   * renouvellement entier : filtrer sur la Gironde puis trier par présence doit
   * montrer les présences des sortants de Gironde, sinon le graphique et la liste
   * qu'il surplombe raconteraient deux choses différentes.
   */
  const graphiqueContextuel = useMemo(() => {
    const tri = filters.tri || 'departement';
    const slug = GRAPHIQUE_PAR_TRI[tri];
    // La carte a déjà sa place en haut de page ; la répéter ici n'apprendrait rien.
    if (!slug || slug === 'carte' || filteredSortants.length === 0) return null;

    const meta = GRAPHIQUES[slug];
    const contenu = (() => {
      switch (tri) {
        case 'groupe':
          return (
            <PartRemiseEnJeu
              parGroupe={repartitionParGroupe(
                filteredSortants,
                data?.sortants.parGroupe ?? [],
              )}
              sortants={filteredSortants}
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'commission':
          return (
            <BarresComptage
              donnees={parCommission(filteredSortants)}
              total={filteredSortants.length}
              sortantsParLabel={indexerPar(filteredSortants, (s) =>
                s.commissionPermanente ?? SANS_COMMISSION,
              )}
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'profession':
          return (
            <BarresComptage
              donnees={parFamilleProfession(filteredSortants)}
              total={filteredSortants.length}
              couleur="#8b5cf6"
              sortantsParLabel={indexerPar(
                filteredSortants,
                (s) => familleProfession(s.personne.profession) ?? SANS_PROFESSION,
              )}
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'age':
          return (
            <PyramideAges
              sortants={filteredSortants}
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'presence':
          return (
            <DistributionBilan
              sortants={filteredSortants}
              metrique="presence"
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'loyaute':
          return (
            <DistributionBilan
              sortants={filteredSortants}
              metrique="loyaute"
              onSelection={selectionnerDepuisGraphique}
            />
          );
        case 'amendements':
        case 'interventions':
          return (
            <NuageActivite
              sortants={filteredSortants}
              onSelection={selectionnerDepuisGraphique}
            />
          );
        default:
          return null;
      }
    })();

    if (!contenu) return null;

    // Le sous-titre annonce la base de calcul dès qu'elle n'est plus l'ensemble
    // des sortants : sans ça, un lecteur arrivé sur un filtre prendrait ces
    // chiffres pour ceux des 178.
    const filtre = activeFilterCount > 0;
    const sousTitre = filtre
      ? `${meta.sousTitre} Calculé sur les ${filteredSortants.length} sortants correspondant aux filtres.`
      : meta.sousTitre;

    return (
      <CadreGraphique slug={slug} titre={meta.titre} sousTitre={sousTitre} lienPageDediee>
        {contenu}
      </CadreGraphique>
    );
  }, [filters.tri, filteredSortants, data, activeFilterCount, selectionnerDepuisGraphique]);

  // L'erreur se teste avant le chargement : en cas d'échec `data` reste indéfini,
  // et l'ordre inverse afficherait le squelette indéfiniment.
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des données.
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <SenatorialesPageSkeleton />;
  }

  const { scrutin, sortants: apercuSortants, circonscriptions } = data;
  const nonRenouveles = SIEGES_SENAT - scrutin.nbSieges;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sénatoriales du 27 septembre 2026</h1>
          <p className="mt-2 text-muted-foreground">
            {scrutin.nbSieges} des {SIEGES_SENAT} sièges du Sénat sont renouvelés. Voici le
            bilan de mandature des sortants.
          </p>
          {countdownText && (
            <p className="mt-3 inline-flex items-center rounded-lg border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {countdownText}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Comment fonctionne une élection sénatoriale ?</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Les sénateurs sont élus au suffrage <strong>indirect</strong>, par environ 162 000 grands électeurs (députés, conseillers régionaux et départementaux, et surtout délégués des conseils municipaux, qui forment près de 95 % du collège).
          </p>
          <p>
            Le Sénat se renouvelle <strong>par moitié tous les trois ans</strong>. Le 27 septembre 2026, c&apos;est la série 2 : {scrutin.nbSieges} sièges dans {scrutin.nbCirconscriptions} circonscriptions.
          </p>
          <p>
            Le mode de scrutin dépend du département : <strong>majoritaire à deux tours</strong> là où il y a un ou deux sièges, <strong>proportionnel de liste à un tour</strong> à partir de trois sièges.
          </p>
          <p>
            Les élus prennent leurs fonctions le <strong>1er octobre 2026</strong>. Le mandat dure six ans.
          </p>
        </div>
        {scrutin.sources.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {scrutin.sources.map((source, i) =>
              source.url ? (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {source.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span key={i} className="text-sm text-muted-foreground">
                  {source.label}
                </span>
              )
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{scrutin.nbSieges.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">sièges renouvelés</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{scrutin.nbCirconscriptions.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">départements concernés</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-3xl font-bold">{nonRenouveles.toLocaleString('fr-FR')}</p>
          <p className="text-sm text-muted-foreground">sièges non concernés</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Répartition des sièges sortants par groupe</h2>
        <RepartitionGroupes parGroupe={apercuSortants.parGroupe} total={apercuSortants.total} />
      </div>

      {/* La carte est le seul graphique affiché en permanence, et le seul calculé
          sur l'ensemble des 178 sortants. C'est qu'elle ne sert pas seulement à
          décrire : on clique dedans pour filtrer. La recalculer sur la sélection
          la réduirait au département qu'on vient de choisir, sans plus aucun
          moyen d'en désigner un autre. */}
      <CadreGraphique
        slug="carte"
        titre={GRAPHIQUES.carte.titre}
        sousTitre={GRAPHIQUES.carte.sousTitre}
        lienPageDediee
      >
        <CarteDepartements
          sieges={siegesParDepartement(tousSortants)}
          selection={filters.departement}
          onSelect={selectionnerDepartement}
        />
      </CadreGraphique>

      <SelecteurLecture valeur={filters.tri} onChange={(tri) => setFilter('tri', tri)} />

      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={handleClearFilters}
        search={
          <div className="relative flex-1 md:min-w-[10rem]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un sortant..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full rounded-lg border bg-background px-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        }
      >
        <div className="relative w-full md:w-52">
          <select
            value={filters.departement}
            onChange={(e) => setFilter('departement', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les départements</option>
            {[...circonscriptions]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((c) => (
                <option key={c.departement} value={c.departement}>
                  {c.nom} ({c.nbSieges})
                </option>
              ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative w-full md:w-52">
          <select
            value={filters.groupe}
            onChange={(e) => setFilter('groupe', e.target.value)}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {apercuSortants.parGroupe.map((g) => (
              <option key={g.slug} value={g.slug}>
                {nomGroupe(g)} ({g.sieges})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

      </FilterBar>

      {graphiqueContextuel}

      <div ref={listeRef} className="scroll-mt-20 space-y-4">
        {surbrillance && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
            <span>
              <strong>{surbrillance.libelle}</strong> — {surbrillance.ids.size} sortant
              {surbrillance.ids.size > 1 ? 's' : ''} surligné
              {surbrillance.ids.size > 1 ? 's' : ''} dans la liste
            </span>
            <button
              type="button"
              onClick={() => setSurbrillance(null)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Retirer la surbrillance
            </button>
          </div>
        )}

      {sortantsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortantsError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Une erreur est survenue lors du chargement des sortants.
        </div>
      ) : filteredSortants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun sortant ne correspond aux critères.</p>
      ) : groupedSortants ? (
        <div className="space-y-8">
          {groupedSortants.map(([code, { libelle, ancre, sortants: list }]) => (
            // `scroll-mt` réserve la hauteur de l'en-tête collant : sans lui, une
            // arrivée sur l'ancre place le titre de section sous la barre de navigation.
            <section key={code} id={ancre} className="scroll-mt-24">
              <h3 className="mb-3 text-lg font-semibold">
                <a href={`#${ancre}`} className="hover:underline">
                  {libelle}
                </a>{' '}
                · {list.length} siège{list.length > 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((sortant) => (
                  <SortantCard
                    key={sortant.mandatId}
                    sortant={sortant}
                    surbrillance={surbrillance?.ids.has(sortant.mandatId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSortants.map((sortant) => (
            <SortantCard
              key={sortant.mandatId}
              sortant={sortant}
              surbrillance={surbrillance?.ids.has(sortant.mandatId)}
            />
          ))}
        </div>
      )}
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Les chiffres affichés sont ceux de la <strong>carrière au Sénat</strong> de
          chaque sortant : ce sont exactement ceux de sa fiche. Les taux de présence et
          de loyauté sont comparables entre eux ; les compteurs d&apos;interventions et
          d&apos;amendements le sont moins, un sénateur arrivé en cours de mandature
          ayant eu moins d&apos;occasions de siéger — d&apos;où le badge sur sa carte.
        </p>
        <p>
          Quelques mandats ont été exercés en plusieurs périodes, une entrée au
          gouvernement suspendant le mandat parlementaire. Ces sénateurs portent le badge{' '}
          <em>mandat interrompu</em> ; leurs chiffres couvrent bien l&apos;ensemble de
          leur passage au Sénat, et non la seule période en cours.
        </p>
        <p>
          <Link href="/methodologie" className="underline hover:text-foreground">
            En savoir plus sur la méthodologie
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PageClient({
  initialApercu,
  initialSortants,
  initialTousSortants,
  initialFiltres,
}: PageClientProps) {
  return (
    <Suspense fallback={<SenatorialesPageSkeleton />}>
      <SenatorialesPageContent
        initialApercu={initialApercu}
        initialSortants={initialSortants}
        initialTousSortants={initialTousSortants}
        initialFiltres={initialFiltres}
      />
    </Suspense>
  );
}

/**
 * Les filtres de l'URL sont-ils ceux avec lesquels le serveur a chargé la liste ?
 *
 * Le tri par défaut de l'API est `departement` : une URL sans `tri` et une URL
 * avec `tri=departement` demandent donc la même liste, et l'amorce du serveur
 * vaut pour les deux.
 */
function memesFiltres(
  courants: { departement: string; groupe: string; tri: string },
  serveur: FiltresSortants | undefined,
): boolean {
  const normaliserTri = (tri: string | undefined) => tri || 'departement';
  return (
    courants.departement === (serveur?.departement ?? '') &&
    courants.groupe === (serveur?.groupe ?? '') &&
    normaliserTri(courants.tri) === normaliserTri(serveur?.tri)
  );
}

function SenatorialesPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="mb-8">
        <div className="h-8 w-80 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-8 w-16 rounded bg-muted" />
            <div className="mt-2 h-4 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-8 w-full animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}