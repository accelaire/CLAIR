"use client";

import { CHAMBRES, type Chambre, type GroupePolitique } from "@clair/data";
import { Card, ChambreBadge, GroupeBadge, Hemicycle, type HemicycleGroup, Link } from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import type { ReactNode } from "react";
import { formatNombre, libellePosition, nomDuGroupe, parPosition } from "./format.ts";
import classes from "./GroupesListeScreen.module.css";

/** Choix de période d'une chambre (législature ou session), affiché s'il y en a plusieurs. */
export type ChoixPeriode = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

type SectionChambreProps = {
  chambre: Chambre;
  /** Tous les groupes de la chambre (hémicycle). */
  groupes: GroupePolitique[];
  /** Groupes retenus par la recherche (cartes). */
  visibles: GroupePolitique[];
  recherche: boolean;
  periode: ChoixPeriode | null;
  /** Lien « Voir tous les élus » de la période choisie. */
  listeHref: string;
  /** Paramètre de période ajouté au lien de chaque fiche. */
  periodeQuery: string;
};

const SIEGES: Record<Chambre, number> = { assemblee: 577, senat: 348 };
const ELU: Record<Chambre, string> = { assemblee: "député", senat: "sénateur" };

const total = (groupes: GroupePolitique[]) =>
  groupes.reduce((somme, groupe) => somme + groupe.membresCount, 0);

const pluriel = (nombre: number, mot: string) =>
  `${formatNombre(nombre)} ${mot}${nombre > 1 ? "s" : ""}`;

/**
 * Une chambre dans la liste des groupes : titre, effectifs, choix de période, hémicycle et
 * cartes des groupes (chaque carte mène à la fiche, période comprise).
 */
export const SectionChambre = ({
  chambre,
  groupes,
  visibles,
  recherche,
  periode,
  listeHref,
  periodeQuery,
}: SectionChambreProps) => {
  const { nom, membres } = CHAMBRES[chambre];
  const titreId = `groupes-${chambre}`;
  const ordonnes = parPosition(groupes);
  const hemicycle: HemicycleGroup[] = ordonnes.map((groupe) => ({
    id: groupe.slug,
    sigle: groupe.nom,
    nom: nomDuGroupe(groupe),
    sieges: groupe.membresCount,
    couleur: groupe.couleur,
    href: `/groupes/${chambre}/${groupe.slug}${periodeQuery}`,
  }));
  const compte: ReactNode = recherche
    ? `${visibles.length} groupe${visibles.length > 1 ? "s" : ""} sur ${groupes.length}, ${pluriel(total(visibles), ELU[chambre])}`
    : `${pluriel(groupes.length, "groupe")}, ${pluriel(total(groupes), ELU[chambre])}`;

  return (
    <section aria-labelledby={titreId} className={classes.section}>
      <div className={classes.sectionHeader}>
        <div>
          <h2 id={titreId} className={classes.sectionTitle}>
            {nom}
          </h2>
          <p className={classes.count}>{compte}</p>
        </div>
        <div className={classes.sectionActions}>
          {periode ? (
            <NativeSelect
              label={periode.label}
              value={periode.value}
              onChange={(event) => periode.onChange(event.currentTarget.value)}
              data={periode.options}
            />
          ) : null}
          <Link href={listeHref}>Voir tous les {membres}</Link>
        </div>
      </div>

      <div className={classes.hemicycle}>
        <Hemicycle
          groupes={hemicycle}
          totalSieges={SIEGES[chambre]}
          title={`Répartition des sièges, ${nom}`}
          headingLevel={3}
        />
      </div>

      {visibles.length > 0 ? (
        <ul className={classes.grid} aria-label={`Groupes, ${nom}`}>
          {parPosition(visibles).map((groupe) => (
            <Card
              key={groupe.id}
              as="li"
              titleAs="h3"
              href={`/groupes/${chambre}/${groupe.slug}${periodeQuery}`}
              title={nomDuGroupe(groupe)}
              eyebrow={
                <span className={classes.eyebrow}>
                  <GroupeBadge sigle={groupe.nom} couleur={groupe.couleur} />
                  <ChambreBadge chambre={chambre} short size="sm" />
                </span>
              }
              footer={
                <span className={classes.meta}>
                  <span>
                    <span className="clair-chiffres">{formatNombre(groupe.membresCount)}</span>{" "}
                    membre{groupe.membresCount > 1 ? "s" : ""}
                  </span>
                  {groupe.position ? <span>{libellePosition(groupe.position)}</span> : null}
                </span>
              }
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
};
