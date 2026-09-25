import { positionsHemicycle } from '@/lib/hemicycle-geometrie';
import {
  CATEGORIES_HEMICYCLE,
  FAMILLES_ARC,
  HORS_ARC,
  nombre,
} from '@/lib/senatoriales/resultats';

/**
 * Le Sénat avant et après le scrutin, par famille politique.
 *
 * Une seule grille des deux côtés : la famille de la nuance que le ministère
 * de l'Intérieur a attribuée au titulaire de chaque siège lors de son élection.
 * Ce n'est pas la composition par groupe, qui n'existe qu'à partir du 5 octobre.
 *
 * Seules les familles qui ont une place sur l'axe gauche-droite entrent dans
 * l'arc. Les régionalistes, les divers et les nuances non publiées sont
 * comptés à côté : les ranger quelque part dans l'arc leur donnerait une
 * position qu'aucune source ne leur attribue. Les sièges pas encore attribués,
 * eux, restent dans l'arc, au centre et en pointillé, parce qu'ils vont s'y
 * placer dans la soirée.
 */

type Repartition = Record<string, number>;

const VIEWBOX = { largeur: 500, hauteur: 270 };
const CENTRE = { x: 250, y: 255 };
const RAYONS = { interieur: 78, exterieur: 238 };

function Arc({ repartition, etiquette }: { repartition: Repartition; etiquette: string }) {
  // À gauche, de la gauche vers la droite ; les sièges non attribués au milieu,
  // entre les deux blocs, comme la place qu'ils occuperont.
  const gaucheDeLArc = (['gauche', 'centre'] as const).flatMap((f) => Array(repartition[f] ?? 0).fill(f));
  const droiteDeLArc = (['droite', 'droite_ou_extreme_droite', 'extreme_droite'] as const).flatMap((f) =>
    Array(repartition[f] ?? 0).fill(f),
  );
  const sieges: string[] = [
    ...gaucheDeLArc,
    ...Array(repartition.non_attribue ?? 0).fill('non_attribue'),
    ...droiteDeLArc,
  ];
  const positions = positionsHemicycle(sieges.length, CENTRE.x, CENTRE.y, RAYONS.interieur, RAYONS.exterieur);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.largeur} ${VIEWBOX.hauteur}`}
      className="h-auto w-full"
      role="img"
      aria-label={etiquette}
    >
      {positions.map((p, i) => {
        const categorie = sieges[i] ?? 'non_attribue';
        const vide = categorie === 'non_attribue';
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.6}
            fill={vide ? 'none' : CATEGORIES_HEMICYCLE[categorie]?.couleur}
            stroke={vide ? 'currentColor' : 'none'}
            strokeOpacity={vide ? 0.35 : 1}
            strokeDasharray={vide ? '1.5 1.5' : undefined}
            strokeWidth={vide ? 1 : 0}
          />
        );
      })}
    </svg>
  );
}

function HorsArc({ repartition }: { repartition: Repartition }) {
  const presents = HORS_ARC.filter((c) => c !== 'non_attribue' && (repartition[c] ?? 0) > 0);
  if (presents.length === 0) return <p className="text-xs text-muted-foreground">Aucun siège hors de l&apos;axe.</p>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {presents.map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5" aria-hidden>
            {Array.from({ length: Math.min(repartition[c] ?? 0, 12) }).map((_, i) => (
              <span key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORIES_HEMICYCLE[c]?.couleur }} />
            ))}
          </span>
          {repartition[c]} {CATEGORIES_HEMICYCLE[c]?.libelle.toLowerCase()}
        </li>
      ))}
    </ul>
  );
}

export function HemicycleAvantApres({
  avant,
  apres,
  notes,
  complet,
}: {
  avant: Repartition;
  apres: Repartition;
  notes: string[];
  /** Tous les sièges sont attribués : les écarts deviennent lisibles. */
  complet: boolean;
}) {
  const nonAttribues = apres.non_attribue ?? 0;
  // Avant le premier résultat, « à ce stade de la soirée » n'a pas de sens :
  // l'arc de droite montre simplement la série 1, qui n'est pas renouvelée.
  const commence = nonAttribues < 178;
  const legende = [...FAMILLES_ARC, ...HORS_ARC.filter((c) => c !== 'non_attribue')].filter(
    (c) => (avant[c] ?? 0) > 0 || (apres[c] ?? 0) > 0,
  );

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Le Sénat avant et après le scrutin</h2>
        <p className="text-sm text-muted-foreground">
          348 sièges, par famille politique de la nuance attribuée par le ministère
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <figure className="space-y-2">
          <figcaption className="text-sm font-medium">Avant le 27 septembre</figcaption>
          <Arc repartition={avant} etiquette="Hémicycle du Sénat avant le scrutin, par famille politique" />
          <HorsArc repartition={avant} />
        </figure>
        <figure className="space-y-2">
          <figcaption className="text-sm font-medium">
            {complet ? 'Après le 27 septembre' : commence ? 'À ce stade de la soirée' : 'Après le 27 septembre'}
            {!complet && (
              <span className="ml-2 font-normal text-muted-foreground">
                {commence
                  ? `${nombre(nonAttribues)} ${nonAttribues > 1 ? 'sièges pas encore attribués' : 'siège pas encore attribué'}`
                  : 'les 178 sièges remis en jeu, en pointillés'}
              </span>
            )}
          </figcaption>
          <Arc repartition={apres} etiquette="Hémicycle du Sénat après le scrutin, par famille politique" />
          <HorsArc repartition={apres} />
        </figure>
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Sièges par famille politique, avant et après le scrutin</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1.5 font-medium">Famille</th>
            <th scope="col" className="py-1.5 text-right font-medium">Avant</th>
            <th scope="col" className="py-1.5 text-right font-medium">{complet ? 'Après' : 'À ce stade'}</th>
            {complet && <th scope="col" className="py-1.5 text-right font-medium">Écart</th>}
          </tr>
        </thead>
        <tbody>
          {legende.map((c) => {
            const a = avant[c] ?? 0;
            const b = apres[c] ?? 0;
            const ecart = b - a;
            return (
              <tr key={c} className="border-b last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORIES_HEMICYCLE[c]?.couleur }} aria-hidden />
                    {CATEGORIES_HEMICYCLE[c]?.libelle}
                  </span>
                </th>
                <td className="py-1.5 text-right tabular-nums">{a}</td>
                <td className="py-1.5 text-right tabular-nums">{b}</td>
                {complet && (
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {ecart === 0 ? '=' : ecart > 0 ? `+${ecart}` : `−${-ecart}`}
                  </td>
                )}
              </tr>
            );
          })}
          {!complet && (
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground" aria-hidden />
                  Siège non attribué
                </span>
              </th>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">0</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{nonAttribues}</td>
            </tr>
          )}
        </tbody>
      </table>

      <ul className="space-y-1 text-xs text-muted-foreground">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>
          Les régionalistes, les divers et les nuances non publiées n&apos;ont pas de place sur un axe
          gauche-droite : ils sont comptés sous l&apos;hémicycle plutôt que placés dans l&apos;arc.
        </li>
      </ul>
    </section>
  );
}
