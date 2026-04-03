import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

interface LobbyisteOg {
  id: string;
  nom: string;
  type: string | null;
  secteur: string | null;
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  actions: unknown[];
}

const typeLabels: Record<string, string> = {
  entreprise: 'Entreprise',
  association: 'Association',
  cabinet: 'Cabinet de conseil',
  syndicat: 'Syndicat',
  organisation_pro: 'Organisation professionnelle',
};

function formatBudget(budget: number | null): string {
  if (!budget) return 'N/D';
  if (budget >= 1_000_000) return `${(budget / 1_000_000).toFixed(1)} M\u20ac`;
  if (budget >= 1_000) return `${(budget / 1_000).toFixed(0)} k\u20ac`;
  return `${budget} \u20ac`;
}

export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const [font, res] = await Promise.all([
    loadFont(),
    fetchFromApi<{ data: LobbyisteOg }>(`/lobbying/${params.id}`),
  ]);
  const data = res?.data;
  if (!data) return new Response('Not found', { status: 404 });

  const typeLabel = data.type ? typeLabels[data.type] || data.type : null;

  return new ImageResponse(
    (
      <OgLayout badge="Lobbying · Données HATVP" badgeColor="#f59e0b">
        {/* Name */}
        <span
          style={{
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.15,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.nom}
        </span>

        {/* Type + sector */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '26px', color: '#cbd5e1' }}>
          {typeLabel && <span>{typeLabel}</span>}
          {data.secteur && (
            <>
              {typeLabel && <span style={{ color: '#475569' }}>·</span>}
              <span>{data.secteur}</span>
            </>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          {data.budgetAnnuel && (
            <OgStat label="Budget" value={formatBudget(data.budgetAnnuel)} />
          )}
          {data.actions?.length > 0 && (
            <OgStat label="Actions" value={String(data.actions.length)} />
          )}
          {data.nbLobbyistes && (
            <OgStat label="Lobbyistes" value={String(data.nbLobbyistes)} />
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
