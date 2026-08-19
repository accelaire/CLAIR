'use client';

import { useMemo } from 'react';
import { GRAPHIQUES, siegesParDepartement, parCommission, parFamilleProfession, type SlugGraphique } from '@/lib/senatoriales/graphiques';
import { CadreGraphique } from '../../components/graphiques/CadreGraphique';
import { CarteDepartements } from '../../components/graphiques/CarteDepartements';
import { PartRemiseEnJeu } from '../../components/graphiques/PartRemiseEnJeu';
import { DistributionBilan } from '../../components/graphiques/DistributionBilan';
import { NuageActivite } from '../../components/graphiques/NuageActivite';
import { PyramideAges } from '../../components/graphiques/PyramideAges';
import { BarresComptage } from '../../components/graphiques/BarresComptage';
import type { ApercuSenatoriales, Sortant } from '../../PageClient';

interface GraphiqueClientProps {
  slug: SlugGraphique;
  apercu?: ApercuSenatoriales;
  sortants: Sortant[];
}

/**
 * Rendu plein format d'un graphique, sur sa page dédiée.
 *
 * Les composants sont les mêmes que ceux intégrés à la page mère : le lecteur
 * qui arrive par un lien partagé doit retrouver exactement ce qu'il a vu dans
 * l'aperçu, et non une variante « page de détail ».
 */
export default function GraphiqueClient({ slug, apercu, sortants }: GraphiqueClientProps) {
  const meta = GRAPHIQUES[slug];

  const contenu = useMemo(() => {
    if (sortants.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Les données ne sont pas disponibles pour le moment.
        </p>
      );
    }

    switch (slug) {
      case 'carte':
        return <CarteDepartements sieges={siegesParDepartement(sortants)} />;
      case 'groupes':
        return apercu ? <PartRemiseEnJeu parGroupe={apercu.sortants.parGroupe} /> : null;
      case 'presence':
        return (
          <div className="space-y-8">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Présence en séance</h3>
              <DistributionBilan sortants={sortants} metrique="presence" />
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Loyauté au groupe</h3>
              <DistributionBilan sortants={sortants} metrique="loyaute" />
            </section>
          </div>
        );
      case 'activite':
        return <NuageActivite sortants={sortants} />;
      case 'ages':
        return <PyramideAges sortants={sortants} />;
      case 'commissions':
        return <BarresComptage donnees={parCommission(sortants)} total={sortants.length} />;
      case 'professions':
        return (
          <BarresComptage
            donnees={parFamilleProfession(sortants)}
            total={sortants.length}
            couleur="#8b5cf6"
          />
        );
    }
  }, [slug, apercu, sortants]);

  return (
    <CadreGraphique
      slug={slug}
      titre={meta.titre}
      sousTitre={meta.sousTitre}
      niveauTitre="h1"
    >
      {contenu}
    </CadreGraphique>
  );
}
