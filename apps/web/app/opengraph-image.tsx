import { ImageResponse } from 'next/og';
import { OgLayout, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'CLAIR.vote — Transparence politique en France';

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgLayout>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <span style={{ fontSize: '72px', fontWeight: 700, color: '#3b82f6' }}>
            CLAIR.vote
          </span>
          <span style={{ fontSize: '36px', color: '#e2e8f0', lineHeight: 1.3 }}>
            Transparence politique en France
          </span>
          <span style={{ fontSize: '24px', color: '#94a3b8', lineHeight: 1.5, maxWidth: '800px' }}>
            Votes, présence, loyauté des parlementaires. Lobbying, groupes politiques, classements. Données officielles, analysées pour les citoyens.
          </span>
        </div>
      </OgLayout>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
