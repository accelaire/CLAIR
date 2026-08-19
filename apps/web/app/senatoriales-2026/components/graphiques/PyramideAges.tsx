'use client';

import { useMemo } from 'react';
import { PAS_TRANCHE, ageA, pyramideAges } from '@/lib/senatoriales/graphiques';
import { SENATORIALES_2026 } from '@/lib/senatoriales';
import { useChartTooltip } from '@/components/charts/ChartTooltip';
import type { Sortant } from '../../PageClient';

const COULEUR_HOMMES = '#3b82f6';
const COULEUR_FEMMES = '#f43f5e';
const COULEUR_AUTRES = '#94a3b8';

/**
 * Pyramide des âges des sortants au jour du scrutin.
 *
 * L'âge est figé à la date du 27 septembre 2026 plutôt que calculé au jour de la
 * visite : c'est l'âge au moment où le siège est remis en jeu qui a un sens, et
 * il a l'avantage de ne plus bouger — sinon les chiffres de la page changeraient
 * silencieusement d'un mois sur l'autre.
 */
export function PyramideAges({ sortants, onSelection }: { sortants: Sortant[]; onSelection?: (mandatIds: string[], libelle: string) => void }) {
  const { tooltip, handlers } = useChartTooltip();

  const { tranches, maxCote, totaux, sansDate, scrutin } = useMemo(() => {
    const scrutin = new Date(`${SENATORIALES_2026.scrutin}T00:00:00Z`);
    const tranches = pyramideAges(sortants, scrutin);
    const maxCote = tranches.reduce(
      (max, t) => Math.max(max, t.hommes, t.femmes + t.autres),
      0,
    );
    const totaux = tranches.reduce(
      (acc, t) => ({
        hommes: acc.hommes + t.hommes,
        femmes: acc.femmes + t.femmes,
        autres: acc.autres + t.autres,
      }),
      { hommes: 0, femmes: 0, autres: 0 },
    );
    return {
      tranches,
      maxCote,
      totaux,
      sansDate: sortants.filter((s) => !s.personne.dateNaissance).length,
      scrutin,
    };
  }, [sortants]);

  if (tranches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Les dates de naissance ne sont pas encore disponibles pour ces sénateurs.
      </p>
    );
  }

  const total = totaux.hommes + totaux.femmes + totaux.autres;

  return (
    <div className="space-y-4">
      <ul className="space-y-1.5">
        {tranches.map((tranche) => {
          const lignes = [];
          if (tranche.hommes > 0) {
            lignes.push({ label: 'Hommes', valeur: String(tranche.hommes) });
          }
          if (tranche.femmes > 0) {
            lignes.push({ label: 'Femmes', valeur: String(tranche.femmes) });
          }
          if (tranche.autres > 0) {
            lignes.push({ label: 'Non renseigné', valeur: String(tranche.autres) });
          }
          const contenuTooltip = {
            titre: `${tranche.label} ans`,
            lignes,
          };
          const mandatIds = sortants
            .filter((s) => {
              if (!s.personne.dateNaissance) return false;
              const age = ageA(s.personne.dateNaissance, scrutin);
              return age >= tranche.debut && age < tranche.debut + PAS_TRANCHE;
            })
            .map((s) => s.mandatId);

          return (
            <li
              key={tranche.debut}
              className={`flex items-center gap-2 text-xs ${onSelection ? 'cursor-pointer hover:opacity-80' : ''}`}
              {...handlers(contenuTooltip)}
              {...(onSelection
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onSelection(mandatIds, `${tranche.label} ans`),
                    onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelection(mandatIds, `${tranche.label} ans`);
                      }
                    },
                  }
                : {})}
            >
              <div className="flex flex-1 justify-end">
                <Barre
                  valeur={tranche.hommes}
                  max={maxCote}
                  couleur={COULEUR_HOMMES}
                  alignement="droite"
                  libelle={`${tranche.hommes} homme${tranche.hommes > 1 ? 's' : ''} de ${tranche.label} ans`}
                />
              </div>
              <span className="w-14 shrink-0 text-center tabular-nums text-muted-foreground">
                {tranche.label}
              </span>
              <div className="flex flex-1 gap-px">
                <Barre
                  valeur={tranche.femmes}
                  max={maxCote}
                  couleur={COULEUR_FEMMES}
                  alignement="gauche"
                  libelle={`${tranche.femmes} femme${tranche.femmes > 1 ? 's' : ''} de ${tranche.label} ans`}
                />
                {tranche.autres > 0 && (
                  <Barre
                    valeur={tranche.autres}
                    max={maxCote}
                    couleur={COULEUR_AUTRES}
                    alignement="gauche"
                    libelle={`${tranche.autres} sortant(s) de ${tranche.label} ans, sexe non renseigné`}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COULEUR_HOMMES }} />
          {totaux.hommes} hommes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COULEUR_FEMMES }} />
          {totaux.femmes} femmes
        </span>
        {totaux.autres > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COULEUR_AUTRES }}
            />
            {totaux.autres} non renseigné{totaux.autres > 1 ? 's' : ''}
          </span>
        )}
        <span>
          Âge au 27 septembre 2026, sur {total} sortant{total > 1 ? 's' : ''}
          {sansDate > 0 && ` (${sansDate} sans date de naissance connue)`}.
        </span>
      </div>
      {tooltip}
    </div>
  );
}

function Barre({
  valeur,
  max,
  couleur,
  alignement,
  libelle,
}: {
  valeur: number;
  max: number;
  couleur: string;
  alignement: 'gauche' | 'droite';
  libelle: string;
}) {
  if (valeur === 0) return null;
  return (
    <span
      aria-label={libelle}
      className={`h-4 ${alignement === 'droite' ? 'rounded-l-sm' : 'rounded-r-sm'}`}
      style={{
        width: `${(valeur / max) * 100}%`,
        backgroundColor: couleur,
      }}
    />
  );
}
