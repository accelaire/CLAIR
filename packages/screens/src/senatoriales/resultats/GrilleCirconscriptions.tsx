"use client";

import type { ResumeCirconscription } from "@clair/data";
import { useNavigation } from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { useState } from "react";
import { slugDepuisCode } from "../lib/departements.ts";
import { FAMILLES, ORDRE_FAMILLES } from "../lib/familles.ts";
import { PastilleEtat, PointsSieges } from "./Etats.tsx";
import classes from "./Resultats.module.css";

type Filtre = "toutes" | "pourvues" | "attente";
type Tri = "alpha" | "etat" | "sieges";

const RANG_ETAT: Record<ResumeCirconscription["statut"], number> = {
  pourvue: 0,
  partielle: 1,
  second_tour: 2,
  resultats_attendus: 3,
  vote_en_cours: 4,
  pas_ouvert: 5,
};

const TRIS: { value: Tri; label: string }[] = [
  { value: "alpha", label: "Ordre alphabétique" },
  { value: "etat", label: "Par état" },
  { value: "sieges", label: "Par nombre de sièges" },
];

const estTri = (valeur: string): valeur is Tri => TRIS.some((t) => t.value === valeur);

/**
 * Les 64 circonscriptions, une vignette chacune : son état et un point par siège. Le rendu
 * serveur montre la grille complète ; les filtres et le tri ne sont qu'un confort de lecture.
 */
export const GrilleCirconscriptions = ({
  circonscriptions,
  base,
}: {
  circonscriptions: ResumeCirconscription[];
  /** Préfixe des liens vers les pages de circonscription. */
  base: string;
}) => {
  const { Link } = useNavigation();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [tri, setTri] = useState<Tri>("alpha");

  const pourvues = circonscriptions.filter((c) => c.statut === "pourvue").length;
  const visibles = circonscriptions
    .filter((c) =>
      filtre === "toutes"
        ? true
        : filtre === "pourvues"
          ? c.statut === "pourvue"
          : c.statut !== "pourvue",
    )
    .sort((a, b) => {
      if (tri === "etat") {
        return RANG_ETAT[a.statut] - RANG_ETAT[b.statut] || a.nom.localeCompare(b.nom, "fr");
      }
      if (tri === "sieges") return b.nbSieges - a.nbSieges || a.nom.localeCompare(b.nom, "fr");
      return a.nom.localeCompare(b.nom, "fr");
    });

  const onglets: { cle: Filtre; libelle: string }[] = [
    { cle: "toutes", libelle: `Toutes · ${circonscriptions.length}` },
    { cle: "pourvues", libelle: `Pourvues · ${pourvues}` },
    { cle: "attente", libelle: `En attente · ${circonscriptions.length - pourvues}` },
  ];

  return (
    <section className={classes.pile} aria-labelledby="resultats-circonscriptions">
      <div className={classes.grilleEntete}>
        <div>
          <h2 id="resultats-circonscriptions" className={classes.titreBloc}>
            Résultats par circonscription
          </h2>
          <p className={classes.texteMention}>
            Chaque point est un siège. Le détail des voix est sur la page de chaque circonscription.
          </p>
        </div>
        <div className={classes.grilleControles}>
          {/* biome-ignore lint/a11y/useSemanticElements: groupe de boutons bascule, sans formulaire. */}
          <div className={classes.segments} role="group" aria-label="Filtrer les circonscriptions">
            {onglets.map((o) => (
              <button
                key={o.cle}
                type="button"
                onClick={() => setFiltre(o.cle)}
                aria-pressed={filtre === o.cle}
                className={classes.segmentBouton}
              >
                {o.libelle}
              </button>
            ))}
          </div>
          <NativeSelect
            label="Trier"
            classNames={{ label: "clair-visually-hidden" }}
            size="sm"
            data={TRIS}
            value={tri}
            onChange={(event) => {
              const valeur = event.currentTarget.value;
              if (estTri(valeur)) setTri(valeur);
            }}
          />
        </div>
      </div>

      <ul className={classes.legendeFamilles} aria-label="Légende">
        <li>Nuance des élus (ministère de l'Intérieur) :</li>
        {ORDRE_FAMILLES.map((f) => (
          <li key={f}>
            <span
              className={classes.point}
              style={{ backgroundColor: FAMILLES[f]?.couleur }}
              aria-hidden="true"
            />
            {FAMILLES[f]?.libelle}
          </li>
        ))}
        <li>
          <span className={classes.point} data-vide aria-hidden="true" />
          Siège non attribué
        </li>
      </ul>

      <ul className={classes.vignettes}>
        {visibles.map((c) => {
          const slug = slugDepuisCode(c.departement);
          const connue = c.statut === "pourvue";
          const contenu = (
            <>
              <span className={classes.vignetteTexte}>
                <span className={classes.vignetteNom}>{c.nom}</span>
                <PastilleEtat statut={c.statut} secondTour={c.secondTour} connue={connue} />
              </span>
              <PointsSieges sieges={c.sieges} />
            </>
          );
          const etat = connue ? "connue" : c.statut === "pas_ouvert" ? "pas_ouvert" : "attente";
          return (
            <li key={c.departement}>
              {slug ? (
                <Link href={`${base}/${slug}`} className={classes.vignette} data-etat={etat}>
                  {contenu}
                </Link>
              ) : (
                <div className={classes.vignette} data-etat={etat}>
                  {contenu}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
