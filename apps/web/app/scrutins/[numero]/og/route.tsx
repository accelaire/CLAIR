import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgVoteBar, OG_SIZE, loadFont } from '@/lib/og';
import { scrutinQuery } from '@/lib/scrutin-url';
import { isScrutinAdopte } from '@/lib/scrutin-sort';

export const runtime = 'nodejs';

// Route handler (et non fichier-convention `opengraph-image.tsx`) : au Sénat le
// numéro de scrutin n'est pas unique, il faut chambre + session pour résoudre le
// bon scrutin. Or les fonctions `opengraph-image` ne reçoivent pas `searchParams`
// dans Next.js — un route handler, lui, a accès à l'URL complète de la requête.
interface ScrutinOg {
  numero: number;
  chambre: string;
  titre: string;
  date: string;
  sort: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { numero: string } },
) {
  const { searchParams } = request.nextUrl;
  const query = scrutinQuery({
    chambre: searchParams.get('chambre'),
    session: searchParams.get('session'),
  });

  const [font, res] = await Promise.all([
    loadFont(),
    fetchFromApi<{ data: ScrutinOg }>(`/scrutins/${params.numero}?${query}`),
  ]);
  const data = res?.data;
  if (!data) return new Response('Not found', { status: 404 });

  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const isAdopted = isScrutinAdopte(data.sort);
  const dateStr = new Date(data.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return new ImageResponse(
    (
      <OgLayout badge={`Scrutin n°${data.numero} · ${chambreLabel}`}>
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

        {/* Vote bar */}
        <OgVoteBar
          pour={data.nombrePour}
          contre={data.nombreContre}
          abstention={data.nombreAbstention}
        />

        {/* Result row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: isAdopted
                ? 'rgba(34,197,94,0.2)'
                : 'rgba(239,68,68,0.2)',
              color: isAdopted ? '#22c55e' : '#ef4444',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            {isAdopted ? 'Adopté' : 'Rejeté'}
          </div>
          <span style={{ fontSize: '22px', color: '#94a3b8' }}>
            {data.nombrePour} pour · {data.nombreContre} contre ·{' '}
            {data.nombreAbstention} abstentions
          </span>
          <span style={{ fontSize: '20px', color: '#64748b', marginLeft: 'auto' }}>
            {dateStr}
          </span>
        </div>
      </OgLayout>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
