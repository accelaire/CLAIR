import { TexteAmendement } from '@/components/TexteAmendement';
import { nettoyerTexteAmendement, type RenvoiDroit } from '@/lib/texte-amendement';

interface ContenuAmendementProps {
  dispositif?: string | null;
  /** Liens Légifrance du dispositif. */
  renvois?: RenvoiDroit[];
  exposeSommaire?: string | null;
  /** Liens Légifrance de l'exposé sommaire. */
  renvoisExpose?: RenvoiDroit[];
  /** Chaque texte coupé à trois lignes (carte repliée). */
  replie?: boolean;
}

/**
 * Le texte d'un amendement et son exposé, sous les mêmes intitulés partout
 * (fiche, dossier, page d'un vote), toujours dans cet ordre.
 *
 * Le dispositif est ce qui modifierait la loi, ce qui est mis aux voix ;
 * l'exposé sommaire (« objet » au Sénat) est l'argumentaire de ses auteurs.
 * Présenter l'exposé seul, sans intitulé, le faisait passer pour l'amendement
 * lui-même, voire pour un résumé neutre.
 */
export function ContenuAmendement({ dispositif, renvois, exposeSommaire, renvoisExpose, replie }: ContenuAmendementProps) {
  const expose = exposeSommaire ? nettoyerTexteAmendement(exposeSommaire).trim() : '';
  const coupe = replie ? 'line-clamp-3' : '';

  if (!dispositif && !expose) {
    return <p className="text-sm italic text-muted-foreground">Texte non disponible</p>;
  }

  return (
    <div className="space-y-3">
      {dispositif && (
        <section>
          <h4 className="mb-1 text-xs font-semibold text-foreground">
            Texte de l&apos;amendement
            <span className="font-normal text-muted-foreground"> · la modification proposée</span>
          </h4>
          <div className="rounded-lg bg-muted/50 p-3">
            <TexteAmendement
              texte={dispositif}
              renvois={renvois}
              compact={replie}
              className={`text-sm leading-relaxed ${coupe}`}
            />
          </div>
        </section>
      )}
      {expose && exposeSommaire && (
        <section>
          <h4 className="mb-1 text-xs font-semibold text-foreground">
            Exposé sommaire
            <span className="font-normal text-muted-foreground"> · les raisons données par ses auteurs</span>
          </h4>
          <TexteAmendement
            texte={exposeSommaire}
            renvois={renvoisExpose}
            compact={replie}
            className={`text-sm leading-relaxed text-muted-foreground ${coupe}`}
          />
        </section>
      )}
    </div>
  );
}

/** Vrai quand la carte repliée coupe une partie du texte : « Voir plus » sert. */
export function contenuAmendementDepasse(dispositif?: string | null, exposeSommaire?: string | null): boolean {
  // Trois lignes font environ 150 caractères sur un téléphone.
  const depasse = (t?: string | null) => !!t && (t.length > 150 || t.split('\n').length > 3);
  return depasse(dispositif) || depasse(exposeSommaire);
}
