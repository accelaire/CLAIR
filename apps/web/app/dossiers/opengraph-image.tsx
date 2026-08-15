import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Dossiers législatifs — CLAIR.vote';

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgPage
        badge='Législation'
        badgeColor='#8b5cf6'
        titre='Dossiers législatifs'
        sousTitre="Projets et propositions de loi, de leur dépôt à leur promulgation."
      />
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
