import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Scrutins publics — CLAIR.vote';

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgPage
        badge='Scrutins'
        badgeColor='#3b82f6'
        titre='Scrutins publics'
        sousTitre="Les votes de l'Assemblée nationale et du Sénat, scrutin par scrutin."
      />
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
