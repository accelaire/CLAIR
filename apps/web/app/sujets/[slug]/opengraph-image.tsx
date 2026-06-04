import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

interface SujetOg {
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  dossierCount: number;
  scrutinCount: number;
  status: string;
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const [font, res] = await Promise.all([
    loadFont(),
    fetchFromApi<{ data: SujetOg }>(`/sujets/${params.slug}`),
  ]);
  const data = res?.data;
  if (!data) return new Response('Not found', { status: 404 });

  return new ImageResponse(
    (
      <OgLayout
        badge={data.category ? `Sujet · ${data.category}` : 'Sujet politique'}
        badgeColor="#8b5cf6"
      >
        {/* Title */}
        <span style={{ fontSize: '56px', fontWeight: 700, lineHeight: 1.15 }}>
          {data.label}
        </span>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <OgStat
            label="Dossiers"
            value={data.dossierCount.toLocaleString('fr-FR')}
          />
          <OgStat
            label="Scrutins"
            value={data.scrutinCount.toLocaleString('fr-FR')}
          />
        </div>
      </OgLayout>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
