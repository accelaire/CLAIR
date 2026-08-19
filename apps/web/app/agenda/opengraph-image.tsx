import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Agenda parlementaire — CLAIR.vote';

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgPage
        badge='Agenda'
        badgeColor='#10b981'
        titre='Agenda parlementaire'
        sousTitre="Réunions de commissions et séances publiques, à l'Assemblée nationale et au Sénat."
      />
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
