import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Sénatoriales du 27 septembre 2026 — CLAIR.vote';

// Les chiffres sont fixés par le décret de convocation. Ils sont figés ici plutôt
// que lus par l'API : une image OG doit se générer même quand l'API est en panne,
// sinon l'aperçu du lien casse au moment où il est le plus partagé.
export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgPage
        badge="Élection"
        badgeColor="#f43f5e"
        surtitre="Dimanche 27 septembre 2026"
        titre="Sénatoriales 2026"
        sousTitre="Le bilan de mandature des 178 sénateurs sortants"
        stats={[
          { label: 'Sièges renouvelés', value: '178' },
          { label: 'Départements', value: '64' },
          { label: 'Sénat', value: '348 sièges' },
        ]}
      />
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
