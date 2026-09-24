// =============================================================================
// La page d'une réunion de commission
// =============================================================================
//
// Jusqu'ici, aucune réunion n'avait d'URL. Les commissions travaillent pourtant
// plus que l'hémicycle : elles auditionnent, examinent les amendements et se
// prononcent avant que la séance publique ne vote. Ce travail n'existait chez
// nous que par ricochet — une ligne dans la liste d'une commission, un bloc
// dans l'onglet d'un député — donc invisible pour qui cherche « audition de
// tel ministre » ou « avis de la commission sur tel amendement ».
//
// La page rassemble ce que la réunion a produit : son ordre du jour, qui était
// présent, le débat tel qu'il s'est tenu, et le tableau des avis quand elle en
// a rendu un.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { pointsDeLOrdreDuJour } from '@/lib/ordre-du-jour';
import PageClient from './PageClient';
import type { ReunionDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getReunion(uid: string) {
  return fetchFromApi<{ data: ReunionDetail }>(`/agenda/${encodeURIComponent(uid)}`);
}

/**
 * Le titre d'une réunion : la commission, puis ce qu'elle a fait.
 *
 * PAS `nomCourt` : sur 3 005 commissions qui en portent un, 2 821 y ont un CODE
 * — « CION-SOC », « XYNTHIA », « 3109 » — et non un nom court. Le même piège
 * que `titreCourt` sur les dossiers. On affiche donc `nom`.
 *
 * Un seul point d'ordre du jour, le premier : les mettre tous donne une phrase
 * à rallonge que le moteur coupe de toute façon.
 */
function titreDeLaReunion(reunion: ReunionDetail): string {
  const commission =
    reunion.type === 'seance'
      ? `Séance publique — ${reunion.commission?.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale'}`
      : (reunion.commission?.nom || 'Réunion de commission');
  const premierPoint = pointsDeLOrdreDuJour(reunion.odjResume, reunion.odjComplet)[0];
  return premierPoint ? `${commission} — ${premierPoint}` : commission;
}

/** « mercredi 16 septembre 2026 », dans le fuseau où la réunion s'est tenue. */
function jourDeLaReunion(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function generateMetadata({
  params,
}: {
  params: { uid: string };
}): Promise<Metadata> {
  const response = await getReunion(params.uid);
  const data = response?.data;
  if (!data) return {};

  const jour = jourDeLaReunion(data.dateDebut);
  const titre = `${titreDeLaReunion(data)} — ${jour}`;

  const morceaux: string[] = [
    data.commission?.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale',
    jour,
  ];
  if ((data.nbInterventions ?? 0) > 0) {
    morceaux.push(`${data.nbInterventions} prises de parole`);
  }
  if (data.avisCommission.length > 0) {
    morceaux.push(`${data.avisCommission.length} avis sur amendements`);
  }

  const url = `${BASE_URL}/reunions/${encodeURIComponent(data.uid)}`;

  // Le Sénat publie un compte rendu et une liste de scrutins par JOUR, quand
  // son agenda déclare deux à cinq séances dans la journée. Ces séances servent
  // donc le même débat : elles désignent la page de la journée comme canonique
  // plutôt que de faire indexer cinq fois le même compte rendu.
  const canonical = data.seanceCanonique
    ? `${BASE_URL}/reunions/${encodeURIComponent(data.seanceCanonique)}`
    : url;

  return {
    title: titre,
    description: morceaux.join(' · '),
    alternates: { canonical },
    openGraph: { title: titre, description: morceaux.join(' · '), url, type: 'article' },
  };
}

export default async function Page({ params }: { params: { uid: string } }) {
  const response = await getReunion(params.uid);
  const reunion = response?.data;
  if (!reunion) notFound();

  const chambreLabel = reunion.commission?.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          ...(reunion.type === 'seance'
            ? [{ name: 'Agenda', url: `${BASE_URL}/agenda` }]
            : [
                { name: 'Commissions', url: `${BASE_URL}/commissions` },
                ...(reunion.commission
                  ? [
                      {
                        name: reunion.commission.nom,
                        url: `${BASE_URL}/commissions/${reunion.commission.slug}`,
                      },
                    ]
                  : []),
              ]),
          {
            name: `${chambreLabel} — ${jourDeLaReunion(reunion.dateDebut)}`,
            url: `${BASE_URL}/reunions/${encodeURIComponent(reunion.uid)}`,
          },
        ]}
      />
      <PageClient reunion={reunion} />
    </>
  );
}
