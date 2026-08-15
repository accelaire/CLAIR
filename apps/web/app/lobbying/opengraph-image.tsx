import { ImageResponse } from 'next/og';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Lobbying — Données HATVP — CLAIR.vote';

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgPage
        badge='Lobbying'
        badgeColor='#f59e0b'
        titre='Lobbying'
        sousTitre="Les représentants d'intérêts déclarés à la HATVP : budgets, secteurs, actions menées."
      />
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
