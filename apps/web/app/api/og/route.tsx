import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';

export const runtime = 'nodejs';

const SORT_LABELS: Record<string, string> = {
  presence: 'Présence',
  loyaute: 'Loyauté',
  amendements: 'Amendements',
  interventions: 'Interventions',
};

const CHAMBRE_LABELS: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

// =============================================================================
// Types
// =============================================================================

interface ParlementaireOg {
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  chambre: 'assemblee' | 'senat';
  groupe: { nom: string; couleur: string | null } | null;
  stats: {
    presence: number;
    loyaute: number;
    participation: number;
    amendements: number;
    interventions: number;
  } | null;
}

interface GroupeOg {
  slug: string;
  chambre: 'assemblee' | 'senat';
  nom: string;
  couleur: string | null;
  membresActifsCount: number;
  statsPresenceMoyenne: number | null;
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
}

// =============================================================================
// Renderers
// =============================================================================

async function renderClassement(searchParams: URLSearchParams, font: ArrayBuffer) {
  const sort = searchParams.get('sort') || 'presence';
  const chambre = searchParams.get('chambre') || '';
  const label = SORT_LABELS[sort] || 'Présence';
  const chambreLabel = chambre ? CHAMBRE_LABELS[chambre] : 'Toutes chambres';

  const res = await fetchFromApi<{ data: ParlementaireOg[] }>(
    `/parlementaires?sort=${sort}&order=desc&limit=5${chambre ? `&chambre=${chambre}` : ''}`,
  );
  const top = res?.data ?? [];

  return new ImageResponse(
    (
      <OgLayout badge={`Classement · ${label}`} badgeColor="#3b82f6">
        <span style={{ fontSize: '44px', fontWeight: 700, lineHeight: 1.2 }}>
          Classement par {label.toLowerCase()}
        </span>
        <span style={{ fontSize: '24px', color: '#94a3b8' }}>
          {chambreLabel}
        </span>

        {/* Top 5 list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {top.slice(0, 5).map((p, i) => (
            <div
              key={p.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '8px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#94a3b8', width: '32px' }}>
                {i + 1}
              </span>
              {p.photoUrl && (
                <img
                  src={p.photoUrl}
                  width={40}
                  height={40}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                  alt=""
                />
              )}
              <span style={{ fontSize: '22px', fontWeight: 600, flex: 1 }}>
                {p.prenom} {p.nom}
              </span>
              <span style={{ fontSize: '22px', fontWeight: 700, color: '#3b82f6' }}>
                {p.stats
                  ? sort === 'presence' || sort === 'loyaute'
                    ? `${p.stats[sort as 'presence' | 'loyaute']}%`
                    : (p.stats[sort as 'amendements' | 'interventions'] ?? 0).toLocaleString('fr-FR')
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      </OgLayout>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}

async function renderClassementParlementaire(searchParams: URLSearchParams, font: ArrayBuffer) {
  const slug = searchParams.get('slug') || '';
  const sort = searchParams.get('sort') || 'presence';
  const rank = searchParams.get('rank') || '?';
  const label = SORT_LABELS[sort] || 'Présence';

  const res = await fetchFromApi<{ data: ParlementaireOg }>(
    `/parlementaires/${slug}?include=stats`,
  );
  const data = res?.data;
  if (!data) return new Response('Not found', { status: 404 });

  const statValue = data.stats
    ? sort === 'presence' || sort === 'loyaute'
      ? `${data.stats[sort as 'presence' | 'loyaute']}%`
      : (data.stats[sort as 'amendements' | 'interventions'] ?? 0).toLocaleString('fr-FR')
    : '—';

  return new ImageResponse(
    (
      <OgLayout
        badge={`#${rank} en ${label.toLowerCase()}`}
        badgeColor={data.groupe?.couleur || '#3b82f6'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          {data.photoUrl && (
            <img
              src={data.photoUrl}
              width={160}
              height={160}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
              alt=""
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <span style={{ fontSize: '52px', fontWeight: 700, lineHeight: 1.1 }}>
              {data.prenom} {data.nom}
            </span>
            {data.groupe && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '4px',
                    backgroundColor: data.groupe.couleur || '#6b7280',
                  }}
                />
                <span style={{ fontSize: '28px', color: '#cbd5e1' }}>
                  {data.groupe.nom}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <OgStat label={label} value={statValue} />
          {data.stats && (
            <>
              <OgStat label="Présence" value={`${data.stats.presence}%`} />
              <OgStat label="Loyauté" value={`${data.stats.loyaute}%`} />
            </>
          )}
        </div>
      </OgLayout>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}

async function renderClassementGroupes(searchParams: URLSearchParams, font: ArrayBuffer) {
  const chambre = searchParams.get('chambre') || '';
  const sort = searchParams.get('sort') || 'presence';
  const chambreLabel = chambre ? CHAMBRE_LABELS[chambre] : 'Toutes chambres';

  const res = await fetchFromApi<{ data: GroupeOg[] }>(
    `/groupes${chambre ? `?chambre=${chambre}` : ''}`,
  );
  const groupes = (res?.data ?? [])
    .filter((g) => g.membresActifsCount > 0)
    .sort((a, b) => {
      if (sort === 'loyaute') return (b.statsLoyauteMoyenne ?? 0) - (a.statsLoyauteMoyenne ?? 0);
      if (sort === 'cohesion') return (b.statsCohesion ?? 0) - (a.statsCohesion ?? 0);
      return (b.statsPresenceMoyenne ?? 0) - (a.statsPresenceMoyenne ?? 0);
    })
    .slice(0, 5);

  const label = sort === 'loyaute' ? 'Loyauté' : sort === 'cohesion' ? 'Cohésion' : 'Présence';

  return new ImageResponse(
    (
      <OgLayout badge={`Classement groupes · ${label}`} badgeColor="#3b82f6">
        <span style={{ fontSize: '44px', fontWeight: 700, lineHeight: 1.2 }}>
          Groupes politiques par {label.toLowerCase()}
        </span>
        <span style={{ fontSize: '24px', color: '#94a3b8' }}>
          {chambreLabel}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {groupes.map((g, i) => {
            const val =
              sort === 'loyaute'
                ? g.statsLoyauteMoyenne
                : sort === 'cohesion'
                  ? g.statsCohesion
                  : g.statsPresenceMoyenne;
            return (
              <div
                key={g.slug}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#94a3b8', width: '32px' }}>
                  {i + 1}
                </span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: g.couleur || '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {g.nom.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ fontSize: '22px', fontWeight: 600, flex: 1 }}>
                  {g.nom}
                </span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#3b82f6' }}>
                  {val !== null ? `${val}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </OgLayout>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');

  if (!type) {
    return new Response('Missing "type" parameter', { status: 400 });
  }

  const font = await loadFont();

  switch (type) {
    case 'classement':
      return renderClassement(searchParams, font);
    case 'classement-parlementaire':
      return renderClassementParlementaire(searchParams, font);
    case 'classement-groupes':
      return renderClassementGroupes(searchParams, font);
    default:
      return new Response(`Unknown type "${type}"`, { status: 400 });
  }
}
