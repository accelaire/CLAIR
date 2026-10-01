import { fetchRessource } from '@/lib/api-server';

/**
 * Chambre de la fiche d'un parlementaire, quelle que soit l'adresse demandée.
 *
 * Une personne n'a qu'une fiche, rangée dans la chambre où elle siège ou a
 * siégé en dernier. Un député élu sénateur la voit passer de `/deputes/<slug>`
 * à `/senateurs/<slug>`, avec le même slug : l'ancienne adresse doit mener à la
 * nouvelle, sans quoi ses liens et son référencement sont perdus.
 *
 * `null` quand aucun parlementaire ne porte ce slug.
 */
export async function chambreDeLaFiche(slug: string): Promise<'assemblee' | 'senat' | null> {
  const res = await fetchRessource<{ data: { chambre: 'assemblee' | 'senat' } }>(`/parlementaires/${slug}`);
  return res?.data.chambre ?? null;
}
