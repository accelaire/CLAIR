import { Info } from 'lucide-react';
import { heureDeParis, type ResultatsNationaux } from '@/lib/senatoriales/resultats';
import { SuiviScrutin } from './SuiviScrutin';
import { HemicycleAvantApres } from './HemicycleAvantApres';
import { GrilleCirconscriptions } from './GrilleCirconscriptions';
import { BadgeEtat } from './EnTete';

/**
 * Le scrutin a-t-il commencé quelque part ?
 *
 * Tant qu'aucune circonscription n'a ouvert ses bureaux, la page reste celle
 * des candidats et du bilan : un suivi où tout est « à venir » et une grille de
 * 64 vignettes identiques n'apprendraient rien au lecteur. Le premier bureau à
 * ouvrir est celui de Wallis-et-Futuna, le samedi à 22h30, heure de Paris.
 */
export function scrutinCommence(donnees: ResultatsNationaux | null): donnees is ResultatsNationaux {
  return Boolean(donnees?.circonscriptions.some((c) => c.statut !== 'pas_ouvert'));
}

export function resultatsPublies(donnees: ResultatsNationaux): boolean {
  const c = donnees.compteurs;
  return c.pourvue + c.partielle + c.second_tour > 0;
}

function chapeau(d: ResultatsNationaux): string {
  const c = d.compteurs;
  if (c.pourvue === c.circonscriptions) {
    return `Les ${c.sieges} sièges remis en jeu sont attribués. Les élus prennent leurs fonctions le 1er octobre ; les groupes politiques se constituent le 5.`;
  }
  const maintenant = new Date(d.maintenant).getTime();
  const avantMidi = maintenant < new Date('2026-09-27T12:00:00+02:00').getTime();
  const avantSoir = maintenant < new Date('2026-09-27T17:30:00+02:00').getTime();
  if (!resultatsPublies(d)) {
    return avantMidi
      ? 'Premiers résultats attendus vers midi, pour le 1er tour au scrutin majoritaire. Le reste suivra en soirée.'
      : 'Les résultats du 1er tour au scrutin majoritaire sont attendus.';
  }
  if (avantSoir) {
    return 'Le 1er tour au scrutin majoritaire est connu. Prochaine vague en soirée : 2nd tours et scrutin proportionnel.';
  }
  return "Les résultats arrivent circonscription par circonscription. L'outre-mer suit dans la nuit, la Polynésie française lundi matin.";
}

/**
 * Les résultats en tête de la page des sénatoriales, du premier bureau ouvert
 * jusqu'au dernier siège attribué : l'état de la soirée, l'hémicycle avant et
 * après, et les 64 circonscriptions. Le reste de la page (candidats, bilan des
 * sortants) ne bouge pas et suit en dessous.
 */
export function BlocResultatsNationaux({ donnees }: { donnees: ResultatsNationaux }) {
  const complet = donnees.compteurs.pourvue === donnees.compteurs.circonscriptions;

  return (
    <div id="resultats" className="scroll-mt-24 space-y-8">
      <div className="space-y-3">
        <p className="text-muted-foreground">{chapeau(donnees)}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <BadgeEtat compteurs={donnees.compteurs} maintenant={donnees.maintenant} />
          <span>
            Mis à jour à{' '}
            <strong className="font-semibold text-foreground">{heureDeParis(donnees.verifieA ?? donnees.maintenant)}</strong>,
            heure de Paris
          </span>
          <span>
            Source :{' '}
            <a href={donnees.source} className="text-primary underline underline-offset-2" rel="noopener">
              ministère de l&apos;Intérieur
            </a>
          </span>
          {resultatsPublies(donnees) && (
            <span className="inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" aria-hidden />
              Résultats provisoires, sous réserve des décisions du juge de l&apos;élection
            </span>
          )}
        </div>
      </div>

      <SuiviScrutin donnees={donnees} />

      <HemicycleAvantApres
        avant={donnees.hemicycle.avant}
        apres={donnees.hemicycle.apres}
        notes={donnees.hemicycle.notes}
        complet={complet}
      />

      <GrilleCirconscriptions circonscriptions={donnees.circonscriptions} base="/senatoriales-2026" />
    </div>
  );
}
