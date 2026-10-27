"use client";

import { useApiQuery } from "@clair/api-client";
import type {
  ApiData,
  Chambre,
  PageMeta,
  ParlementaireCompare,
  ParlementaireListItem,
} from "@clair/data";
import { buildHref, ComparisonBar, type ComparisonItem } from "@clair/ui";
import { CHAMBRE_CONFIG, MAX_COMPARAISON } from "../shared/parlementaires/chambre.ts";

type Elu = Pick<ParlementaireListItem, "slug" | "prenom" | "nom" | "photoUrl"> & {
  groupe: { nom: string } | null;
};

type SelectionComparaisonProps = {
  chambre: Chambre;
  /** Slugs choisis, lus dans l'URL. */
  slugs: string[];
  /** Élus de la page affichée : leurs noms sont déjà connus. */
  connus: Elu[];
  onChange: (slugs: string[]) => void;
};

const versItem = (elu: Elu): ComparisonItem => ({
  id: elu.slug,
  name: `${elu.prenom} ${elu.nom}`,
  detail: elu.groupe?.nom,
  photoUrl: elu.photoUrl ?? undefined,
});

/**
 * Barre du comparateur. La sélection vit dans l'URL (`?compare=a,b`) : elle survit au changement
 * de page et de filtre. Les élus choisis sur une autre page sont retrouvés auprès de l'API
 * (comparaison si deux ou plus, recherche par slug sinon).
 */
export const SelectionComparaison = ({
  chambre,
  slugs,
  connus,
  onChange,
}: SelectionComparaisonProps) => {
  const { chemin, singulier, pluriel } = CHAMBRE_CONFIG[chambre];
  const manquants = slugs.filter((slug) => !connus.some((elu) => elu.slug === slug));
  const [premierManquant = ""] = manquants;

  const unSeul = useApiQuery<PageMeta<ParlementaireListItem>>(
    chemin,
    { search: premierManquant, limit: 1 },
    { enabled: manquants.length === 1 },
  );
  const plusieurs = useApiQuery<ApiData<ParlementaireCompare[]>>(
    `${chemin}/compare`,
    { slugs: manquants.join(",") },
    { enabled: manquants.length >= 2 },
  );

  const retrouves: Elu[] = [
    ...connus,
    ...(manquants.length === 1 ? (unSeul.data?.data ?? []) : []),
    ...(manquants.length >= 2 ? (plusieurs.data?.data ?? []) : []),
  ];

  const items = slugs.map((slug) => {
    const elu = retrouves.find((candidat) => candidat.slug === slug);
    return elu ? versItem(elu) : { id: slug, name: slug };
  });

  return (
    <ComparisonBar
      items={items}
      max={MAX_COMPARAISON}
      noun={[singulier, pluriel]}
      compareHref={buildHref(`${chemin}/comparer`, { slugs: slugs.join(",") })}
      onRemove={(id) => onChange(slugs.filter((slug) => slug !== id))}
      onClear={() => onChange([])}
    />
  );
};
