'use client';

import { useMemo } from 'react';
import { useChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHEMINS_DEPARTEMENTS,
  VIEWBOX_DEPARTEMENTS,
} from '@/lib/senatoriales/geo-departements';
import {
  CHEMINS_OUTRE_MER,
  VIEWBOX_OUTRE_MER,
} from '@/lib/senatoriales/geo-outre-mer';
import {
  RAMPE_CARTE,
  classeCarte,
  couleurCarte,
  estMetropole,
  type SiegesDepartement,
} from '@/lib/senatoriales/graphiques';

interface CarteDepartementsProps {
  sieges: SiegesDepartement[];
  /** Code INSEE actuellement filtré, s'il y en a un. */
  selection?: string;
  onSelect?: (code: string) => void;
}

/**
 * Carte des sièges remis en jeu.
 *
 * Les départements sans siège renouvelé restent dessinés, en gris : les retirer
 * donnerait une France trouée dont on ne saurait plus lire la forme, et
 * l'information « ce département n'est pas concerné » disparaîtrait avec eux.
 */
export function CarteDepartements({ sieges, selection, onSelect }: CarteDepartementsProps) {
  /**
   * Infobulle partagée pour la carte et les encarts.
   * Un seul élément de survol est affiché à la fois : le hook centralise
   * l'état et les coordonnées pour éviter les superpositions.
   */
  const { tooltip, handlers } = useChartTooltip();

  const { parCode, maxSieges, horsMetropole, totalHorsMetropole } = useMemo(() => {
    const parCode = new Map(sieges.map((s) => [s.code, s]));
    const maxSieges = sieges.reduce((max, s) => Math.max(max, s.sieges), 0);
    const horsMetropole = sieges.filter((s) => !estMetropole(s.code));
    return {
      parCode,
      maxSieges,
      horsMetropole,
      totalHorsMetropole: horsMetropole.reduce((somme, s) => somme + s.sieges, 0),
    };
  }, [sieges]);

  const codes = useMemo(() => Object.keys(CHEMINS_DEPARTEMENTS), []);

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <svg
          viewBox={`0 0 ${VIEWBOX_DEPARTEMENTS} ${VIEWBOX_DEPARTEMENTS}`}
          className="h-auto w-full"
          role="img"
          aria-label="Carte des départements dont les sièges sénatoriaux sont renouvelés le 27 septembre 2026"
        >
          {codes.map((code) => {
            const entree = parCode.get(code);
            const nbSieges = entree?.sieges ?? 0;
            const actif = nbSieges > 0;
            const selectionne = selection === code;

            // Infobulle commune : les données clés au survol évitent au lecteur
            // de chercher la légende à chaque département.
            const tooltipProps = handlers(
              entree
                ? {
                    titre: entree.nom,
                    lignes: [{ label: 'Sièges renouvelés', valeur: String(nbSieges) }],
                  }
                : {
                    titre: code,
                    lignes: [{ label: 'Renouvellement', valeur: 'aucun siège en 2026' }],
                  }
            );

            return (
              <path
                key={code}
                d={CHEMINS_DEPARTEMENTS[code]}
                // Les départements hors série gardent leur teinte du thème ; ceux
                // qui portent des sièges reçoivent la rampe, qui ne dépend pas du
                // thème pour que l'image partagée et la page se ressemblent.
                className={
                  actif
                    ? 'stroke-background transition-opacity hover:opacity-80'
                    : 'fill-slate-200 stroke-background dark:fill-slate-800'
                }
                style={actif ? { fill: couleurCarte(nbSieges, maxSieges) } : undefined}
                strokeWidth={selectionne ? 6 : 2}
                stroke={selectionne ? '#0f172a' : undefined}
                onClick={actif && onSelect ? () => onSelect(selectionne ? '' : code) : undefined}
                cursor={actif && onSelect ? 'pointer' : undefined}
                // Décrit par `aria-label` et non par un `<title>` : le navigateur
                // affiche celui-ci sous forme d'infobulle native, qui doublonnerait
                // avec la nôtre — deux bulles, deux styles, deux temporisations.
                aria-label={
                  entree
                    ? `${entree.nom} — ${nbSieges} siège${nbSieges > 1 ? 's' : ''} renouvelé${nbSieges > 1 ? 's' : ''}`
                    : `${code} — aucun siège renouvelé en 2026`
                }
                {...tooltipProps}
              />
            );
          })}
        </svg>

        <div className="space-y-4">
          <Legende maxSieges={maxSieges} />

          {horsMetropole.length > 0 && (
            <div className="space-y-2">
              {/* La mise en garde tient dans le titre : deux paragraphes de
                  petits caractères sous les encarts se lisaient comme une note
                  de bas de page, c'est-à-dire pas du tout. */}
              <h4 className="text-sm font-semibold">
                Hors métropole · {totalHorsMetropole} siège
                {totalHorsMetropole > 1 ? 's' : ''}{' '}
                <span className="font-normal text-muted-foreground">— échelles non comparables</span>
              </h4>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                {horsMetropole.map((circo) => {
                  const selectionne = selection === circo.code;

                  // On récupère le contour vectoriel s'il existe ; les codes
                  // absents de la table recevront un bloc coloré en fallback.
                  const chemin = CHEMINS_OUTRE_MER[circo.code];

                  // Même infobulle que pour la métropole : l'expérience de
                  // survol reste cohérente quel que soit le territoire.
                  const tooltipProps = handlers({
                    titre: circo.nom,
                    lignes: [
                      { label: 'Sièges renouvelés', valeur: String(circo.sieges) },
                    ],
                  });

                  const contenu = (
                    <>
                      {chemin ? (
                        <svg
                          viewBox={`0 0 ${VIEWBOX_OUTRE_MER} ${VIEWBOX_OUTRE_MER}`}
                          className="h-16 w-16 shrink-0"
                        >
                          <path
                            d={chemin}
                            fill={couleurCarte(circo.sieges, maxSieges)}
                          />
                        </svg>
                      ) : (
                        <div
                          className="h-16 w-16 shrink-0 rounded-sm opacity-60"
                          style={{
                            backgroundColor: couleurCarte(circo.sieges, maxSieges),
                          }}
                        />
                      )}
                      <span className="truncate">{circo.nom}</span>
                      <span className="ml-auto shrink-0 font-medium">
                        {circo.sieges}
                      </span>
                    </>
                  );

                  const classes = `flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                    selectionne ? 'border-primary bg-muted' : 'hover:bg-muted'
                  }`;

                  return (
                    <li key={circo.code}>
                      {onSelect ? (
                        <button
                          type="button"
                          onClick={() => onSelect(selectionne ? '' : circo.code)}
                          className={classes}
                          {...tooltipProps}
                        >
                          {contenu}
                        </button>
                      ) : (
                        <span className={classes} {...tooltipProps}>
                          {contenu}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      {tooltip}
    </div>
  );
}

/**
 * Échelle de la rampe.
 *
 * Les bornes affichées sont recalculées depuis la même fonction de classement que
 * la carte : une légende écrite à la main se désaligne au premier changement de
 * données, et personne ne s'en aperçoit.
 */
function Legende({ maxSieges }: { maxSieges: number }) {
  const bornes = useMemo<{ couleur: string; label: string }[]>(() => {
    const parClasse = new Map<number, number[]>();
    for (let sieges = 1; sieges <= maxSieges; sieges++) {
      const classe = classeCarte(sieges, maxSieges);
      const valeurs = parClasse.get(classe) ?? [];
      valeurs.push(sieges);
      parClasse.set(classe, valeurs);
    }

    // Les classes sans effectif sont écartées : une légende qui annonce une
    // teinte absente de la carte fait chercher au lecteur ce qui n'y est pas.
    const resultat: { couleur: string; label: string }[] = [];
    RAMPE_CARTE.forEach((couleur, index) => {
      const valeurs = parClasse.get(index);
      if (!valeurs || valeurs.length === 0) return;
      const min = Math.min(...valeurs);
      const max = Math.max(...valeurs);
      resultat.push({ couleur, label: min === max ? `${min}` : `${min}–${max}` });
    });
    return resultat;
  }, [maxSieges]);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Sièges renouvelés</h4>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {bornes.map((borne) => (
          <li key={borne.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: borne.couleur }}
            />
            {borne.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-800" />
          non concerné
        </li>
      </ul>
    </div>
  );
}
