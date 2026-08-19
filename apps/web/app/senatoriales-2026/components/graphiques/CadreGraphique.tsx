'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Download, Maximize2 } from 'lucide-react';
import { ShareButton } from '@/components/ShareButton';
import { GRAPHIQUES, type SlugGraphique } from '@/lib/senatoriales/graphiques';

/**
 * Habillage commun aux trois actions, pour qu'elles restent alignées.
 *
 * `rounded-md` et non `rounded-lg` : `ShareButton` pose déjà son propre
 * `rounded-md` en variante icône, et deux arrondis concurrents sur le même
 * élément se départagent par l'ordre de la feuille de style, pas par celui de
 * l'attribut — le bouton de partage aurait pris un coin différent des deux autres.
 */
const ACTION_CLASSES =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

interface CadreGraphiqueProps {
  slug: SlugGraphique;
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  /** `h1` sur la page dédiée au graphique, `h2` quand il est intégré à la page mère. */
  niveauTitre?: 'h1' | 'h2';
  /** Affiche le lien « voir en grand » — inutile sur la page dédiée elle-même. */
  lienPageDediee?: boolean;
}

/**
 * Habillage commun d'un graphique : titre, actions de partage, mention de source.
 *
 * Le partage vise toujours la page dédiée du graphique, jamais l'URL courante.
 * Un lecteur qui partage depuis la page mère veut envoyer *ce* graphique ; s'il
 * envoyait l'adresse de la page mère, son correspondant recevrait l'aperçu
 * générique et atterrirait en haut d'une page longue, sans savoir ce qu'on
 * voulait lui montrer.
 */
export function CadreGraphique({
  slug,
  titre,
  sousTitre,
  children,
  niveauTitre = 'h2',
  lienPageDediee = false,
}: CadreGraphiqueProps) {
  const Titre = niveauTitre;
  const chemin = `/senatoriales-2026/graphiques/${slug}`;
  const meta = GRAPHIQUES[slug];

  return (
    <section id={slug} className="scroll-mt-24 space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Titre className={niveauTitre === 'h1' ? 'text-2xl font-bold' : 'text-lg font-semibold'}>
            {titre}
          </Titre>
          {sousTitre && <p className="text-sm text-muted-foreground">{sousTitre}</p>}
        </div>

        {/* Trois icônes sans libellé : ces actions se répètent au-dessus de
            chaque graphique, et trois boutons de texte y prenaient plus de place
            que le titre qu'ils accompagnent. Chacune porte un `aria-label` et un
            `title` — sans eux, un bouton réduit à son icône n'est nommé nulle
            part, ni pour un lecteur d'écran ni au survol. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {lienPageDediee && (
            <Link
              href={chemin}
              aria-label={`Voir « ${titre} » en grand`}
              title="Voir en grand"
              className={ACTION_CLASSES}
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
          )}
          {/* Le PNG est produit par la même fonction que l'aperçu Open Graph :
              ce que le lecteur enregistre est exactement ce que verra la
              personne à qui il envoie le lien, bandeau CLAIR compris. */}
          <a
            href={`${chemin}/image`}
            download={`clair-senatoriales-2026-${slug}.png`}
            aria-label={`Télécharger l'image de « ${titre} »`}
            title="Télécharger l'image"
            className={ACTION_CLASSES}
          >
            <Download className="h-4 w-4" />
          </a>
          <ShareButton
            url={chemin}
            title={`${meta.titre} — Sénatoriales 2026`}
            text={meta.sousTitre}
            variant="icon"
            className={ACTION_CLASSES}
          />
        </div>
      </div>

      {children}
    </section>
  );
}
