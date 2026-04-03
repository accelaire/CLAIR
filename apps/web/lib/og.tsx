import { type ReactNode } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

const FONT_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-600-normal.woff';

let fontCache: ArrayBuffer | null = null;

export async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const buf = await fetch(FONT_URL).then((r) => r.arrayBuffer());
  fontCache = buf;
  return buf;
}

/** Shared OG image shell — dark background, CLAIR.vote branding. */
export function OgLayout({
  children,
  badge,
  badgeColor = '#3b82f6',
}: {
  children: ReactNode;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px 64px',
        background: 'linear-gradient(145deg, #0c1222 0%, #162032 100%)',
        color: 'white',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Top: badge */}
      {badge && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
            }}
          />
          <span
            style={{
              fontSize: '22px',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {badge}
          </span>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {children}
      </div>

      {/* Bottom: CLAIR.vote branding */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <span style={{ fontSize: '20px', color: '#475569' }}>
          Transparence politique en France
        </span>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>
          CLAIR.vote
        </span>
      </div>
    </div>
  );
}

/** Stat pill used in parlementaire OG images. */
export function OgStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ fontSize: '20px', color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: '22px', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

/** Proportional bar used for scrutin results. */
export function OgVoteBar({
  pour,
  contre,
  abstention,
}: {
  pour: number;
  contre: number;
  abstention: number;
}) {
  const total = pour + contre + abstention || 1;
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '32px',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${(pour / total) * 100}%`,
          backgroundColor: '#22c55e',
          display: 'flex',
        }}
      />
      <div
        style={{
          width: `${(contre / total) * 100}%`,
          backgroundColor: '#ef4444',
          display: 'flex',
        }}
      />
      <div
        style={{
          width: `${(abstention / total) * 100}%`,
          backgroundColor: '#eab308',
          display: 'flex',
        }}
      />
    </div>
  );
}
