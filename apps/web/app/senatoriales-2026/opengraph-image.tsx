import { ImageResponse } from 'next/og';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = 'Sénatoriales 2026 — Renouvellement du 27 septembre 2026';

// Les chiffres sont figés par le décret de convocation ; l'image OG ne doit pas dépendre d'un appel réseau.
export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <OgLayout badge="Élection" badgeColor="#f43f5e">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <span style={{ fontSize: '28px', color: '#f43f5e' }}>
            Dimanche 27 septembre 2026
          </span>
          <span style={{ fontSize: '64px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.15 }}>
            Sénatoriales 2026
          </span>
          <span style={{ fontSize: '32px', color: '#e2e8f0', lineHeight: 1.3, maxWidth: '900px' }}>
            Le bilan de mandature des 178 sénateurs sortants
          </span>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <OgStat label="Sièges renouvelés" value="178" />
            <OgStat label="Départements" value="64" />
            <OgStat label="Sénat" value="348 sièges" />
          </div>
        </div>
      </OgLayout>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}