import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import {
  GRAPHIQUES,
  SLUGS_GRAPHIQUES,
  estSlugGraphique,
  type SlugGraphique,
} from '@/lib/senatoriales/graphiques';
import type { ApercuSenatoriales, Sortant } from '../../PageClient';
import GraphiqueClient from './GraphiqueClient';
import { PastillesLecture } from '../../components/PastillesLecture';

/**
 * Une page par graphique — et non un paramètre de requête sur la page mère.
 *
 * C'est ce que réclame le partage : une image Open Graph ne reçoit que les
 * segments du chemin, jamais la chaîne de requête. Un graphique choisi par
 * `?graphique=carte` aurait donc partout affiché l'aperçu générique de la page
 * mère, quel que soit le graphique regardé. Le slug est dans le chemin pour que
 * l'aperçu du lien soit celui du graphique qu'il désigne.
 *
 * Contrairement à `/senatoriales-2026`, ces pages ne lisent aucun paramètre de
 * recherche : elles peuvent donc être pré-rendues et revalidées, sans retomber
 * dans le piège du squelette servi à la place du contenu.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SLUGS_GRAPHIQUES.map((slug) => ({ slug }));
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  if (!estSlugGraphique(params.slug)) return {};
  const meta = GRAPHIQUES[params.slug];
  const url = `${BASE_URL}/senatoriales-2026/graphiques/${params.slug}`;
  const titre = `${meta.titre} — Sénatoriales 2026`;

  return {
    title: titre,
    description: meta.sousTitre,
    alternates: { canonical: url },
    openGraph: { title: titre, description: meta.sousTitre, url, type: 'article' },
    // Sans bloc explicite, Next conserve celui du layout et la carte partagée
    // annonce le titre générique du site au lieu de celui du graphique.
    twitter: { card: 'summary_large_image', title: meta.titre, description: meta.sousTitre },
  };
}

async function chargerDonnees() {
  const [apercu, sortants] = await Promise.all([
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
    fetchFromApi<{ data: Sortant[]; meta: { total: number } }>(
      '/senatoriales/2026/sortants',
      3600,
    ),
  ]);
  return { apercu, sortants };
}

export default async function GraphiquePage({ params }: { params: { slug: string } }) {
  if (!estSlugGraphique(params.slug)) notFound();
  const slug: SlugGraphique = params.slug;
  const meta = GRAPHIQUES[slug];

  const { apercu, sortants } = await chargerDonnees();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Sénatoriales 2026', url: `${BASE_URL}/senatoriales-2026` },
          {
            name: meta.titre,
            url: `${BASE_URL}/senatoriales-2026/graphiques/${slug}`,
          },
        ]}
      />

      <div className="container mx-auto space-y-6 px-4 py-8">
        <Link
          href="/senatoriales-2026"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sénatoriales du 27 septembre 2026
        </Link>

        {/* La même bande de pastilles que la page mère, et au même endroit :
            celui qui arrive ici par un lien partagé n'a pas parcouru la page
            d'origine et ne sait pas que six autres lectures existent. Reléguée
            en bas, cette liste n'était vue que par ceux qui avaient déjà fini. */}
        <PastillesLecture
          titre="Voir aussi"
          actif={slug}
          pastilles={SLUGS_GRAPHIQUES.map((autre) => ({
            cle: autre,
            label: GRAPHIQUES[autre].court,
            aide: GRAPHIQUES[autre].titre,
            href: `/senatoriales-2026/graphiques/${autre}`,
          }))}
        />

        <GraphiqueClient
          slug={slug}
          apercu={apercu ?? undefined}
          sortants={sortants?.data ?? []}
        />
      </div>
    </>
  );
}
