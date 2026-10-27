"use client";

import type { Chambre, GroupeOption } from "@clair/data";
import { type ActiveFilter, FilterBar, SearchInput, SortSelect } from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { CHAMBRE_CONFIG } from "../shared/parlementaires/chambre.ts";
import { estTri, type ParlementairesListeFiltres, TRIS } from "./params.ts";

/** Période proposée dans le filtre (législature ou session). */
export type PeriodeOption = { valeur: string; label: string };

type ListeFiltresProps = {
  chambre: Chambre;
  filtres: ParlementairesListeFiltres;
  groupes: GroupeOption[];
  /** Périodes disponibles, la plus récente d'abord ; le filtre est masqué s'il n'y en a qu'une. */
  periodes: PeriodeOption[];
  /** Applique de nouveaux filtres (l'écran remet la page à 1 et met l'URL à jour). */
  onChange: (changement: Partial<ParlementairesListeFiltres>) => void;
  onReset: () => void;
};

const OPTIONS_TRI = Object.entries(TRIS).map(([value, { label }]) => ({ value, label }));

/**
 * Barre de filtres de la liste : recherche (nom, département, circonscription), groupe, période
 * (s'il y en a plusieurs en base) et tri. Chaque changement passe par l'URL.
 */
export const ListeFiltres = ({
  chambre,
  filtres,
  groupes,
  periodes,
  onChange,
  onReset,
}: ListeFiltresProps) => {
  const config = CHAMBRE_CONFIG[chambre];
  const periodeCourante = periodes[0]?.valeur ?? "";
  const groupeChoisi = groupes.find((groupe) => groupe.slug === filtres.groupe);
  const periodeChoisie = periodes.find((periode) => periode.valeur === filtres.periode);

  const actifs: ActiveFilter[] = [];
  if (filtres.recherche) {
    actifs.push({
      id: "search",
      label: `Recherche : ${filtres.recherche}`,
      onRemove: () => onChange({ recherche: "" }),
    });
  }
  if (filtres.groupe) {
    actifs.push({
      id: `groupe=${filtres.groupe}`,
      label: `Groupe : ${groupeChoisi?.nom ?? filtres.groupe}`,
      onRemove: () => onChange({ groupe: "" }),
    });
  }
  if (filtres.periode && filtres.periode !== periodeCourante) {
    actifs.push({
      id: `periode=${filtres.periode}`,
      label: periodeChoisie?.label ?? filtres.periode,
      // Les groupes changent d'une période à l'autre : le groupe choisi est retiré aussi.
      onRemove: () => onChange({ periode: "", groupe: "" }),
    });
  }

  return (
    <FilterBar
      label={`Filtrer les ${config.pluriel}`}
      activeFilters={actifs}
      onReset={onReset}
      search={
        <SearchInput
          label={`Rechercher un ${config.singulier}`}
          placeholder="Nom, département ou circonscription"
          value={filtres.recherche}
          debounceMs={300}
          onChange={(recherche) => onChange({ recherche: recherche.trim() })}
        />
      }
    >
      <NativeSelect
        label="Groupe politique"
        value={filtres.groupe}
        onChange={(event) => onChange({ groupe: event.currentTarget.value })}
        data={[
          { value: "", label: "Tous les groupes" },
          ...groupes.map((groupe) => ({
            value: groupe.slug,
            label: `${groupe.nom} (${groupe.membresCount})`,
          })),
        ]}
      />
      {periodes.length > 1 ? (
        <NativeSelect
          label={chambre === "senat" ? "Session" : "Législature"}
          value={filtres.periode || periodeCourante}
          onChange={(event) => {
            const valeur = event.currentTarget.value;
            onChange({ periode: valeur === periodeCourante ? "" : valeur, groupe: "" });
          }}
          data={periodes.map((periode, index) => ({
            value: periode.valeur,
            label: index === 0 ? `${periode.label} (en cours)` : periode.label,
          }))}
        />
      ) : null}
      <SortSelect
        value={filtres.tri}
        options={OPTIONS_TRI}
        onChange={(tri) => {
          if (estTri(tri)) onChange({ tri });
        }}
      />
    </FilterBar>
  );
};
