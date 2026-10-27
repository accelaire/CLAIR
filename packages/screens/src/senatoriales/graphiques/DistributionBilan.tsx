"use client";

import type { Sortant } from "@clair/data";
import { couleurGroupe, Link } from "@clair/ui";
import { useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { COULEUR_PRINCIPALE, COULEUR_SECONDAIRE } from "../lib/couleurs.ts";
import { bandesBilan, extremesBilan, type MetriqueBilan, mediane } from "../lib/graphiques.ts";
import { EntreeGraphique, type Selection } from "./BarresComptage.tsx";
import classes from "./Graphiques.module.css";

/** En deçà, la liste des plus bas recouvrirait l'essentiel de la sélection. */
const SEUIL_EXTREMES = 15;

const LIBELLES: Record<MetriqueBilan, { nom: string; couleur: string }> = {
  presence: { nom: "présence en séance", couleur: COULEUR_PRINCIPALE },
  loyaute: { nom: "loyauté au groupe", couleur: COULEUR_SECONDAIRE },
};

/**
 * Répartition des sortants par tranche de présence ou de loyauté. Les tranches, inégales et
 * resserrées vers le haut, montrent la masse au-dessus de 95 % et la dizaine qui en est loin.
 */
export const DistributionBilan = ({
  sortants,
  metrique,
  onSelection,
}: {
  sortants: Sortant[];
  metrique: MetriqueBilan;
  onSelection?: Selection;
}) => {
  const { infobulle, gestionnaires } = useInfobulle();
  const bandes = bandesBilan(sortants, metrique);
  const valeurs = sortants
    .map((s) => s.bilan[metrique])
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const valeurMediane = mediane(valeurs);
  const extremes = extremesBilan(sortants, metrique, 5);
  const mesures = valeurs.length;

  if (mesures === 0) return <p className={classes.vide}>Aucune donnée disponible.</p>;

  const max = Math.max(...bandes.map((b) => b.effectif), 1);
  const { nom, couleur } = LIBELLES[metrique];

  return (
    <div className={classes.pile}>
      <ul className={classes.barres} data-espace="serre">
        {bandes.map((bande) => {
          const mandatIds = sortants
            .filter((s) => {
              const v = s.bilan[metrique];
              if (v === null) return false;
              return bande.max === 100 ? v >= bande.min : v >= bande.min && v < bande.max;
            })
            .map((s) => s.mandatId);
          return (
            <li key={bande.label}>
              <EntreeGraphique
                selectionnable={onSelection !== undefined}
                onSelect={() => onSelection?.(mandatIds, bande.label)}
                libelle={`Surligner les sortants : ${nom} ${bande.label}, ${bande.effectif}`}
                className={classes.bande}
                gestionnaires={gestionnaires({
                  titre: bande.label,
                  lignes: [{ label: "Sortants", valeur: String(bande.effectif) }],
                })}
              >
                <span className={classes.bandeLibelle}>{bande.label}</span>
                <span className={classes.piste} data-taille="epaisse" data-forme="carree">
                  {bande.effectif > 0 ? (
                    <span
                      className={classes.remplissage}
                      style={{
                        width: `${(bande.effectif / max) * 100}%`,
                        backgroundColor: couleur,
                      }}
                    />
                  ) : null}
                </span>
                <span className={`${classes.bandeEffectif} clair-chiffres`}>{bande.effectif}</span>
              </EntreeGraphique>
            </li>
          );
        })}
      </ul>

      <p className={classes.note}>
        {mesures} sortants mesurés, médiane à{" "}
        {valeurMediane !== null ? Math.round(valeurMediane) : "—"} % de {nom}.{" "}
        <Link href="/methodologie">Comment ce taux est calculé</Link>.
      </p>

      {mesures >= SEUIL_EXTREMES && extremes.length > 0 ? (
        <div className={classes.extremes}>
          <h4 className={classes.sousTitre}>Les cinq taux les plus bas</h4>
          <ul className={classes.listeExtremes}>
            {extremes.map((point) => (
              <li key={point.slug}>
                <span
                  className={classes.pastille}
                  data-taille="petite"
                  style={{ backgroundColor: couleurGroupe(point.groupe, point.couleur) }}
                  aria-hidden="true"
                />
                <Link href={`/senateurs/${point.slug}`} className={classes.libelleTronque}>
                  {point.nom}
                </Link>
                <span className={`${classes.mention} ${classes.libelleTronque}`}>
                  {point.groupe}
                </span>
                <span className={`${classes.valeurExtreme} clair-chiffres`}>
                  {Math.round(point.valeur)} %
                </span>
              </li>
            ))}
          </ul>
          <p className={classes.note}>
            Un taux bas peut refléter une absence de longue durée, un mandat interrompu ou une
            entrée tardive au Sénat : le chiffre ne dit pas la raison.
          </p>
        </div>
      ) : null}

      <TableauDonnees
        legende={`Sortants par tranche de ${nom}`}
        colonnes={[
          { cle: "tranche", libelle: "Tranche" },
          { cle: "effectif", libelle: "Sortants", numerique: true },
        ]}
        lignes={bandes.map((b) => ({ tranche: b.label, effectif: b.effectif }))}
      />
      {infobulle}
    </div>
  );
};
