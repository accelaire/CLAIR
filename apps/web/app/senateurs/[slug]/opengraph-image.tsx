import { ImageResponse } from 'next/og';
import { fetchFromApi } from '@/lib/api-server';
import { OgLayout, OgStat, OG_SIZE, loadFont } from '@/lib/og';
import { couleurFamille } from '@/lib/senatoriales/familles';
import { nomComplet, type FicheEluProvisoire } from '@/lib/senatoriales/resultats';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

interface SenateurOg {
  slug: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  photoUrl: string | null;
  groupe: { nom: string; couleur: string | null } | null;
  circonscription: { departement: string; numero: number; nom: string } | null;
  stats?: { presence: number; loyaute: number; participation: number };
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const [font, res] = await Promise.all([
    loadFont(),
    fetchFromApi<{ data: SenateurOg }>(`/senateurs/${params.slug}?include=stats`),
  ]);
  const data = res?.data;
  if (!data) {
    // Élu du 27 septembre sans fiche encore : son image dit l'élection et son
    // mandat local principal, en attendant les statistiques d'un mandat.
    const provisoire = await fetchFromApi<FicheEluProvisoire>(`/senatoriales/2026/elus/${params.slug}`);
    if (!provisoire) return new Response('Not found', { status: 404 });
    const { elu, circonscription } = provisoire;
    const mandat = elu.mandatsLocaux?.mandats[0]?.libelle;
    return new ImageResponse(
      (
        <OgLayout badge={elu.sexe === 'F' ? 'Élue sénatrice' : 'Élu sénateur'} badgeColor={couleurFamille(elu.famille)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '52px', fontWeight: 700, lineHeight: 1.1 }}>
              {nomComplet(elu.prenom, elu.nom)}
            </span>
            {elu.nuanceLibelle && <span style={{ fontSize: '28px', color: '#cbd5e1' }}>{elu.nuanceLibelle}</span>}
            <span style={{ fontSize: '26px', color: '#94a3b8' }}>
              {circonscription.nom} · élection du 27 septembre 2026
            </span>
            {mandat && <span style={{ fontSize: '26px', color: '#94a3b8' }}>{mandat}</span>}
          </div>
        </OgLayout>
      ),
      { ...size, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
    );
  }

  const fullName = `${data.prenom} ${data.nom}`;
  const title = data.sexe === 'F' ? 'Sénatrice' : 'Sénateur';

  return new ImageResponse(
    (
      <OgLayout badge={title} badgeColor={data.groupe?.couleur || '#3b82f6'}>
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
              {fullName}
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
            {data.circonscription && (
              <span style={{ fontSize: '24px', color: '#94a3b8' }}>
                {data.circonscription.nom} ({data.circonscription.departement})
              </span>
            )}
          </div>
        </div>

        {data.stats && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <OgStat label="Présence" value={`${data.stats.presence}%`} />
            <OgStat label="Loyauté" value={`${data.stats.loyaute}%`} />
            <OgStat label="Participation" value={`${data.stats.participation}%`} />
          </div>
        )}
      </OgLayout>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 600 }],
    },
  );
}
