import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

interface GroupeOg {
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  membresActifsCount: number;
  stats: {
    presenceMoyenne: number;
    loyauteMoyenne: number;
  };
}

export default async function Image({
  params,
}: {
  params: { chambre: string; slug: string };
}) {
  const [font, res] = await Promise.all([
    loadFont(),
    fetchFromApi<{ data: GroupeOg }>(
      `/groupes/${params.chambre}/${params.slug}`,
    ),
  ]);
  const data = res?.data;
  if (!data) return new Response('Not found', { status: 404 });

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const color = data.couleur || '#3b82f6';

  return new ImageResponse(
    (
      <OgLayout badge={`Groupe politique · ${chambreLabel}`} badgeColor={color}>
        {/* Group color bar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              backgroundColor: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            {data.nom.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <span style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1.1 }}>
              {data.nom}
            </span>
            {data.nomComplet && data.nomComplet !== data.nom && (
              <span style={{ fontSize: '24px', color: '#94a3b8' }}>
                {data.nomComplet}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <OgStat
            label="Membres"
            value={data.membresActifsCount.toLocaleString('fr-FR')}
          />
          <OgStat
            label="Présence moy."
            value={`${data.stats.presenceMoyenne}%`}
          />
          <OgStat
            label="Loyauté moy."
            value={`${data.stats.loyauteMoyenne}%`}
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
