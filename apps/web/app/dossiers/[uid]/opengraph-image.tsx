import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

interface DossierOg {
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: string;
  procedureLibelle: string | null;
  etat: string | null;
  scrutinsCount: number;
  amendementsCount: number;
}

const etatColors: Record<string, string> = {
  en_cours: '#3b82f6',
  adopte: '#22c55e',
  promulgue: '#22c55e',
  rejete: '#ef4444',
  caduc: '#6b7280',
  retire: '#6b7280',
  fusionne: '#eab308',
};

const etatLabels: Record<string, string> = {
  en_cours: 'En cours',
  adopte: 'Adopté',
  promulgue: 'Promulgué',
  rejete: 'Rejeté',
  caduc: 'Caduc',
  retire: 'Retiré',
  fusionne: 'Fusionné',
};

export default async function Image({
  params,
}: {
  params: { uid: string };
}) {
  const [font, data] = await Promise.all([
    loadFont(),
    fetchFromApi<DossierOg>(`/dossiers/${params.uid}`),
  ]);
  if (!data) return new Response('Not found', { status: 404 });

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';

  return new ImageResponse(
    (
      <OgLayout badge={`Dossier législatif · ${chambreLabel}`}>
        {/* État badge */}
        {data.etat && (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: `${etatColors[data.etat] || '#6b7280'}33`,
              color: etatColors[data.etat] || '#94a3b8',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            {etatLabels[data.etat] || data.etat}
          </div>
        )}

        {/* Title */}
        <span
          style={{
            fontSize: '44px',
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.titre}
        </span>

        {/* Info row */}
        <div style={{ display: 'flex', gap: '24px', fontSize: '24px', color: '#94a3b8' }}>
          {data.procedureLibelle && <span>{data.procedureLibelle}</span>}
          {data.scrutinsCount > 0 && (
            <span>{data.scrutinsCount} scrutin{data.scrutinsCount > 1 ? 's' : ''}</span>
          )}
          {data.amendementsCount > 0 && (
            <span>{data.amendementsCount} amendement{data.amendementsCount > 1 ? 's' : ''}</span>
          )}
        </div>
      </OgLayout>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
