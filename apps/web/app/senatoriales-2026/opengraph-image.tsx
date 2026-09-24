import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont, ogNombre } from '@/lib/og';
import { fetchFromApi } from '@/lib/api-server';
import type { ApercuSenatoriales } from './PageClient';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt =
  'Sénatoriales du 27 septembre 2026 : les candidats et le bilan des sortants — CLAIR.vote';

/**
 * Pré-généré et revalidé à l'heure : l'aperçu se fabrique avant le premier
 * partage plutôt qu'au moment où le robot du réseau social le réclame.
 */
export const revalidate = 3600;

/**
 * Aperçu social du scrutin.
 *
 * Les chiffres des candidatures sont lus par l'API — ils n'existaient pas quand
 * la page ne portait que le bilan des sortants, et l'image l'annonçait encore
 * alors que 1 938 candidats y figurent désormais. Mais une image OG doit se
 * générer même API éteinte, sinon l'aperçu du lien casse au moment où il est le
 * plus partagé : sans réponse, on retombe sur les seuls chiffres fixés par le
 * décret de convocation, qui ne bougeront plus.
 */
export default async function Image() {
  const [font, apercu] = await Promise.all([
    loadFont(),
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
  ]);

  const nbSieges = apercu?.scrutin.nbSieges ?? 178;
  const nbCirconscriptions = apercu?.scrutin.nbCirconscriptions ?? 64;
  // `null` ou absent tant que le fichier du ministère n'est pas publié : on ne
  // promet pas une liste de candidats qui n'existe pas encore.
  const candidatures = apercu?.candidatures ?? null;

  return new ImageResponse(
    (
      <OgPage
        badge="Élection"
        badgeColor="#f43f5e"
        surtitre="Dimanche 27 septembre 2026"
        titre="Sénatoriales 2026"
        sousTitre={
          candidatures
            ? `Les candidats en lice, et le bilan des ${nbSieges} sortants`
            : `Le bilan de mandature des ${nbSieges} sénateurs sortants`
        }
        stats={
          candidatures
            ? [
                { label: 'Candidats', value: ogNombre(candidatures.candidats) },
                { label: 'Listes', value: ogNombre(candidatures.listes) },
                { label: 'Sièges renouvelés', value: String(nbSieges) },
                { label: 'Circonscriptions', value: String(nbCirconscriptions) },
              ]
            : [
                { label: 'Sièges renouvelés', value: String(nbSieges) },
                { label: 'Circonscriptions', value: String(nbCirconscriptions) },
                { label: 'Sénat', value: '348 sièges' },
              ]
        }
      />
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}
