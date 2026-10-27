"use client";

import { useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { CHEMINS_DEPARTEMENTS, VIEWBOX_DEPARTEMENTS } from "../lib/geo-departements.ts";
import { CHEMINS_OUTRE_MER, VIEWBOX_OUTRE_MER } from "../lib/geo-outre-mer.ts";
import {
  classeCarte,
  couleurCarte,
  estMetropole,
  RAMPE_CARTE,
  type SiegesDepartement,
} from "../lib/graphiques.ts";
import classes from "./Graphiques.module.css";

type CarteDepartementsProps = {
  sieges: SiegesDepartement[];
  /** Code INSEE actuellement filtré, s'il y en a un. */
  selection?: string;
  onSelect?: (code: string) => void;
};

const CODES = Object.keys(CHEMINS_DEPARTEMENTS);

const sRenouveles = (n: number) => `siège${n > 1 ? "s" : ""} renouvelé${n > 1 ? "s" : ""}`;

/**
 * Échelle de la rampe, recalculée depuis la même fonction de classement que la carte ; les
 * classes sans effectif sont écartées.
 */
const Legende = ({ maxSieges }: { maxSieges: number }) => {
  const parClasse = new Map<number, number[]>();
  for (let sieges = 1; sieges <= maxSieges; sieges++) {
    const classe = classeCarte(sieges, maxSieges);
    parClasse.set(classe, [...(parClasse.get(classe) ?? []), sieges]);
  }
  const bornes = RAMPE_CARTE.flatMap((couleur, index) => {
    const valeurs = parClasse.get(index);
    if (!valeurs || valeurs.length === 0) return [];
    const min = Math.min(...valeurs);
    const max = Math.max(...valeurs);
    return [{ couleur, label: min === max ? `${min}` : `${min}–${max}` }];
  });

  return (
    <div className={classes.pileSerree}>
      <h4 className={classes.sousTitre}>Sièges renouvelés</h4>
      <ul className={classes.legende}>
        {bornes.map((borne) => (
          <li key={borne.label} className={classes.legendeEntree}>
            <span
              className={classes.carre}
              style={{ backgroundColor: borne.couleur }}
              aria-hidden="true"
            />
            {borne.label}
          </li>
        ))}
        <li className={`${classes.legendeEntree} ${classes.mention}`}>
          <span className={classes.carre} data-hors-serie aria-hidden="true" />
          non concerné
        </li>
      </ul>
    </div>
  );
};

/**
 * Carte des sièges remis en jeu. Les départements sans siège renouvelé restent dessinés, en
 * gris ; l'outre-mer et les Français de l'étranger sont présentés en vignettes à côté.
 */
export const CarteDepartements = ({ sieges, selection, onSelect }: CarteDepartementsProps) => {
  const { infobulle, gestionnaires } = useInfobulle();
  const parCode = new Map(sieges.map((s) => [s.code, s]));
  const maxSieges = sieges.reduce((max, s) => Math.max(max, s.sieges), 0);
  const horsMetropole = sieges.filter((s) => !estMetropole(s.code));
  const totalHorsMetropole = horsMetropole.reduce((somme, s) => somme + s.sieges, 0);

  return (
    <div className={classes.pile}>
      <div className={classes.carteGrille}>
        <svg
          viewBox={`0 0 ${VIEWBOX_DEPARTEMENTS} ${VIEWBOX_DEPARTEMENTS}`}
          className={classes.carte}
          role="img"
          aria-label="Carte des départements dont les sièges sénatoriaux sont renouvelés le 27 septembre 2026"
        >
          {CODES.map((code) => {
            const entree = parCode.get(code);
            const nbSieges = entree?.sieges ?? 0;
            const actif = nbSieges > 0;
            const selectionne = selection === code;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: la liste déroulante des départements et le tableau des données donnent le même choix au clavier ; le clic sur la carte en est un raccourci.
              <path
                key={code}
                d={CHEMINS_DEPARTEMENTS[code]}
                className={classes.departement}
                data-actif={actif || undefined}
                data-selection={selectionne || undefined}
                style={actif ? { fill: couleurCarte(nbSieges, maxSieges) } : undefined}
                strokeWidth={selectionne ? 6 : 2}
                onClick={actif && onSelect ? () => onSelect(selectionne ? "" : code) : undefined}
                cursor={actif && onSelect ? "pointer" : undefined}
                {...gestionnaires(
                  entree
                    ? {
                        titre: entree.nom,
                        lignes: [{ label: "Sièges renouvelés", valeur: String(nbSieges) }],
                      }
                    : {
                        titre: code,
                        lignes: [{ label: "Renouvellement", valeur: "aucun siège en 2026" }],
                      },
                )}
              />
            );
          })}
        </svg>

        <div className={classes.pile}>
          <Legende maxSieges={maxSieges} />
          {horsMetropole.length > 0 ? (
            <div className={classes.pileSerree}>
              <h4 className={classes.sousTitre}>
                Hors métropole · {totalHorsMetropole} siège{totalHorsMetropole > 1 ? "s" : ""}{" "}
                <span className={classes.mentionNormale}>— échelles non comparables</span>
              </h4>
              <ul className={classes.vignettes}>
                {horsMetropole.map((circo) => {
                  const selectionne = selection === circo.code;
                  const chemin = CHEMINS_OUTRE_MER[circo.code];
                  const couleur = couleurCarte(circo.sieges, maxSieges);
                  const contenu = (
                    <>
                      {chemin ? (
                        <svg
                          viewBox={`0 0 ${VIEWBOX_OUTRE_MER} ${VIEWBOX_OUTRE_MER}`}
                          className={classes.vignetteForme}
                          aria-hidden="true"
                        >
                          <path d={chemin} style={{ fill: couleur }} />
                        </svg>
                      ) : (
                        <span
                          className={classes.vignetteBloc}
                          style={{ backgroundColor: couleur }}
                          aria-hidden="true"
                        />
                      )}
                      <span className={classes.libelleTronque}>{circo.nom}</span>
                      <span className={`${classes.vignetteSieges} clair-chiffres`}>
                        {circo.sieges}
                        <span className="clair-visually-hidden"> {sRenouveles(circo.sieges)}</span>
                      </span>
                    </>
                  );
                  const infobulleVignette = gestionnaires({
                    titre: circo.nom,
                    lignes: [{ label: "Sièges renouvelés", valeur: String(circo.sieges) }],
                  });
                  return (
                    <li key={circo.code}>
                      {onSelect ? (
                        <button
                          type="button"
                          onClick={() => onSelect(selectionne ? "" : circo.code)}
                          className={classes.vignette}
                          data-selection={selectionne || undefined}
                          aria-pressed={selectionne}
                          {...infobulleVignette}
                        >
                          {contenu}
                        </button>
                      ) : (
                        <span className={classes.vignette} {...infobulleVignette}>
                          {contenu}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <TableauDonnees
        legende="Sièges renouvelés par département"
        colonnes={[
          { cle: "nom", libelle: "Circonscription" },
          { cle: "sieges", libelle: "Sièges renouvelés", numerique: true },
        ]}
        lignes={sieges.map((s) => ({ nom: s.nom, sieges: s.sieges }))}
      />
      {infobulle}
    </div>
  );
};
