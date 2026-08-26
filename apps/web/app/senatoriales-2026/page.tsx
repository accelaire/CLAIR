import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import Link from 'next/link';
import { BreadcrumbJsonLd, ElectionJsonLd, FaqJsonLd } from '@/components/seo/JsonLd';
import { SENATORIALES_2026 } from '@/lib/senatoriales';
import { slugDepuisCode } from '@/lib/senatoriales/departements';
import PageClient from './PageClient';
import type { ApercuSenatoriales, Sortant } from './PageClient';
import { TRIS_SORTANTS, type FiltresSortants } from '@/lib/senatoriales/graphiques';

/**
 * Rendu à la demande, et non au build.
 *
 * `PageClient` lit les filtres dans l'URL (`useUrlFilters` → `useSearchParams`).
 * Sur une route pré-rendue, Next ne connaît pas les paramètres de recherche au
 * moment du build : il abandonne le pré-rendu du sous-arbre et écrit à la place
 * le `fallback` de la `<Suspense>` la plus proche. Le HTML servi ne contenait
 * donc que le squelette de chargement — 15 Ko sans un seul nom de sénateur,
 * alors que le fetch serveur juste en dessous avait bien ramené les 178 lignes.
 * Elles ne voyageaient que dans la charge utile RSC, à l'intérieur de balises
 * `script` : le navigateur les affichait instantanément, mais rien de tout cela
 * n'existait pour qui n'exécute pas le JavaScript. C'est précisément ce que
 * cette page cherche à éviter.
 *
 * En rendu à la demande, les paramètres sont connus et l'arbre est rendu en
 * entier côté serveur : le contenu revient dans le DOM (307 Ko, 178 sortants).
 * Le coût est absorbé par le cache edge posé sur ce chemin dans `vercel.json`,
 * sur le modèle du proxy `/api/v1/[...path]` : le CDN rend la page une fois et
 * la sert ensuite sans réveiller la fonction.
 */
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

const title = 'Sénatoriales 2026 — le bilan des sortants';
const description =
  "Le 27 septembre 2026, 178 des 348 sièges du Sénat sont renouvelés dans 64 départements. Présence, loyauté, interventions et amendements : le bilan de mandature de chaque sénateur sortant sur CLAIR.vote.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${BASE_URL}/senatoriales-2026` },
  openGraph: {
    title: 'Sénatoriales du 27 septembre 2026 — CLAIR.vote',
    description:
      "178 sièges renouvelés, 64 départements. Le bilan de mandature des sénateurs sortants, chiffres à l'appui.",
    url: `${BASE_URL}/senatoriales-2026`,
    type: 'article',
  },
  // Sans bloc `twitter` explicite, Next conserve celui du layout : la carte
  // partagée affichait le titre générique du site au lieu de celui de la page.
  twitter: {
    card: 'summary_large_image',
    title: 'Sénatoriales du 27 septembre 2026',
    description:
      "178 sièges renouvelés, 64 départements. Le bilan de mandature des sénateurs sortants.",
  },
};

/**
 * Les données sont chargées ici, côté serveur, et non seulement dans le composant
 * client : sans ça le HTML servi ne contient que le squelette de chargement. Aucun
 * nom de sénateur, aucun département, pas même le texte d'explication — tout le
 * contenu indexable de la page était invisible pour qui n'exécute pas le
 * JavaScript, ce qui est le cas des robots d'aperçu social et d'une partie des
 * moteurs.
 */
type ListeSortants = { data: Sortant[]; meta: { total: number } };

async function chargerDonnees(filtres: FiltresSortants) {
  const parametres = new URLSearchParams();
  if (filtres.departement) parametres.set('departement', filtres.departement);
  if (filtres.groupe) parametres.set('groupe', filtres.groupe);
  if (filtres.tri) parametres.set('tri', filtres.tri);
  const requete = parametres.toString();

  // La carte a besoin de la liste entière : elle sert à choisir un département,
  // et construite sur une liste déjà filtrée elle se réduirait au département
  // sélectionné, sans plus aucun moyen d'en désigner un autre.
  //
  // Ce second appel n'a lieu que si un filtre restreint réellement la liste. Un
  // tri ne fait que la réordonner, et la carte se moque de l'ordre. Sans cette
  // condition, la page sans filtre embarquait deux fois les mêmes 178 sortants
  // dans sa charge utile — quinze kilo-octets compressés pour rien, puisque les
  // deux appels renvoient des objets distincts que la sérialisation ne sait pas
  // reconnaître comme identiques.
  const listeRestreinte = Boolean(filtres.departement || filtres.groupe);

  const [apercu, sortants, tousSortantsFiltres] = await Promise.all([
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
    fetchFromApi<ListeSortants>(
      `/senatoriales/2026/sortants${requete ? `?${requete}` : ''}`,
      3600,
    ),
    listeRestreinte
      ? fetchFromApi<ListeSortants>('/senatoriales/2026/sortants', 3600)
      : Promise.resolve(null),
  ]);

  // Volontairement laissée indéfinie quand la liste affichée est déjà complète :
  // transmettre le même tableau sous deux props le fait sérialiser deux fois
  // dans la charge utile React, qui ne reconnaît pas les deux références comme
  // un seul objet. C'était vingt-cinq kilo-octets compressés de doublon sur la
  // page la plus consultée. Le client sait retomber sur la liste affichée.
  return { apercu, sortants, tousSortants: tousSortantsFiltres };
}

/**
 * Filtres retenus pour l'appel serveur.
 *
 * `search` n'y figure pas : la recherche par nom se fait dans le navigateur, sur
 * la liste déjà reçue, et l'envoyer ici multiplierait les entrées de cache par
 * autant de saisies au clavier.
 *
 * Les valeurs sont validées avant d'être transmises. Un tri inconnu ferait
 * répondre 400 à l'API, donc rendre une page vide ; une valeur libre trop longue
 * ferait une entrée de cache par variante, à la main du premier venu.
 */
// Les trois filtres décrivent des ensembles finis et connus : un code INSEE de
// département, un slug de groupe. Les borner n'est pas une précaution de saisie
// — la page est en rendu à la demande derrière un cache edge dont la clé est
// l'URL entière. Une valeur libre, c'est une entrée de cache et une invocation
// de fonction par variante, à la main du premier venu, pour un rendu toujours
// identique. Même classe de faille que celle refermée côté API par 2abbc16.
const DEPARTEMENT_VALIDE = /^(?:\d{2,3}|2[AB])$/;
const GROUPE_VALIDE = /^[a-z0-9-]{1,60}$/;

function lireFiltres(searchParams: Record<string, string | string[] | undefined>): FiltresSortants {
  const texte = (
    valeur: string | string[] | undefined,
    forme: RegExp,
  ): string | undefined => {
    const brut = Array.isArray(valeur) ? valeur[0] : valeur;
    return brut && forme.test(brut) ? brut : undefined;
  };
  const tri = Array.isArray(searchParams.tri) ? searchParams.tri[0] : searchParams.tri;

  return {
    departement: texte(searchParams.departement, DEPARTEMENT_VALIDE),
    groupe: texte(searchParams.groupe, GROUPE_VALIDE),
    tri: tri && TRIS_SORTANTS.includes(tri) ? tri : undefined,
  };
}

export default async function Senatoriales2026Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Les filtres de l'URL sont transmis à l'appel serveur, et pas seulement lus
  // par le composant client. Sans ça, arriver sur `?tri=presence` faisait rendre
  // au serveur la liste par défaut, que le client refusait ensuite d'utiliser
  // parce qu'elle ne correspondait pas aux filtres demandés : le HTML servi ne
  // contenait alors qu'un squelette, et ni la liste ni le graphique du tri
  // n'existaient pour qui n'exécute pas le JavaScript.
  const filtres = lireFiltres(searchParams);
  const { apercu, sortants, tousSortants } = await chargerDonnees(filtres);

  // Trié par libellé et non par code INSEE : c'est un index que l'on parcourt à
  // l'œil pour y trouver un nom, pas une table de référence.
  const circonscriptions = (apercu?.circonscriptions ?? [])
    .map((c) => ({
      nom: c.nom.replace(/\s*\(Série \d+\)\s*$/, '').trim(),
      nbSieges: c.nbSieges,
      slug: slugDepuisCode(c.departement),
    }))
    .filter((c): c is { nom: string; nbSieges: number; slug: string } => Boolean(c.slug))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Sénatoriales 2026', url: `${BASE_URL}/senatoriales-2026` },
        ]}
      />
      <ElectionJsonLd
        name="Élections sénatoriales françaises du 27 septembre 2026"
        description={description}
        url={`${BASE_URL}/senatoriales-2026`}
        startDate={SENATORIALES_2026.scrutin}
      />
      {/* Les mêmes questions et les mêmes réponses que le bloc « Comment
          fonctionne une élection sénatoriale ? » rendu par `PageClient`. Le
          balisage décrit un contenu visible ; il ne doit rien ajouter que le
          lecteur ne verrait pas, sous peine d'être traité comme trompeur. */}
      <FaqJsonLd
        items={[
          {
            question: 'Qui élit les sénateurs ?',
            reponse:
              'Les sénateurs sont élus au suffrage indirect, par environ 162 000 grands électeurs : députés, conseillers régionaux et départementaux, et surtout délégués des conseils municipaux, qui forment près de 95 % du collège.',
          },
          {
            question: 'Combien de sièges sont renouvelés en 2026 ?',
            reponse:
              'Le Sénat se renouvelle par moitié tous les trois ans. Le 27 septembre 2026, c’est la série 2 : 178 sièges sur 348, dans 64 circonscriptions.',
          },
          {
            question: 'Quel est le mode de scrutin des élections sénatoriales ?',
            reponse:
              'Le mode de scrutin dépend du département : majoritaire à deux tours là où il y a un ou deux sièges à pourvoir, proportionnel de liste à un tour à partir de trois sièges.',
          },
          {
            question: 'Quand les sénateurs élus en 2026 prennent-ils leurs fonctions ?',
            reponse:
              'Les élus prennent leurs fonctions le 1er octobre 2026, pour un mandat de six ans.',
          },
        ]}
      />
      <PageClient
        initialApercu={apercu ?? undefined}
        initialSortants={sortants ?? undefined}
        initialTousSortants={tousSortants?.data ?? undefined}
        initialFiltres={filtres}
      />

      {/* Index des 64 circonscriptions, rendu ici plutôt que dans `PageClient`.
          Le sélecteur de département de la page filtre la liste par paramètre de
          requête, sous un canonique figé sur cette URL : il ne désigne aucune
          autre page, et n'en fait donc découvrir aucune. Ces liens-là sont le
          seul chemin depuis un document exploré vers les 64 pages de
          circonscription — et ils sont dans le HTML servi, sans quoi ils
          n'existeraient pas pour un robot qui n'exécute pas le JavaScript.
          C'est précisément le défaut que cette page a déjà corrigé pour sa
          propre liste. */}
      {circonscriptions.length > 0 && (
        <div className="container mx-auto px-4 pb-12">
          <div className="space-y-3 border-t pt-6">
            <h2 className="text-lg font-semibold">Le renouvellement département par département</h2>
            <p className="text-sm text-muted-foreground">
              Le détail du scrutin et le bilan des sortants, pour chacune des{' '}
              {circonscriptions.length} circonscriptions concernées.
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
              {circonscriptions.map((circo) => (
                <li key={circo.slug}>
                  <Link
                    href={`/senatoriales-2026/${circo.slug}`}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {circo.nom}{' '}
                    <span className="tabular-nums opacity-60">({circo.nbSieges})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
