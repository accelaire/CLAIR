import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont, ogNombre } from '@/lib/og';
import { LIBELLE_CHAMBRE, dateLongue, libelleEtape, type PetitionDetail } from '@/lib/petitions';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

export default async function Image({ params }: { params: { chambre: string; numero: string } }) {
  const valide = (params.chambre === 'assemblee' || params.chambre === 'senat') && /^[1-9]\d{0,6}$/.test(params.numero);
  const [font, reponse] = await Promise.all([
    loadFont(),
    valide ? fetchFromApi<{ data: PetitionDetail }>(`/petitions/${params.chambre}/${params.numero}`) : Promise.resolve(null),
  ]);
  const p = reponse?.data;
  if (!p) return new Response('Not found', { status: 404 });

  const etape = p.etape
    ? `${libelleEtape(p.etape, p.etapeDate)}${p.etapeDate ? ` · ${dateLongue(p.etapeDate)}` : ''}`
    : 'Aucune étape en commission';

  return new ImageResponse(
    (
      <OgLayout badge={`Pétition n° ${p.numero} · ${LIBELLE_CHAMBRE[p.chambre]}`}>
        <span
          style={{
            fontSize: '46px',
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.titre}
        </span>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <OgStat label="signatures" value={p.signatures === null ? '—' : ogNombre(p.signatures)} />
          <OgStat label="" value={etape} />
        </div>
      </OgLayout>
    ),
    { ...size, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}
