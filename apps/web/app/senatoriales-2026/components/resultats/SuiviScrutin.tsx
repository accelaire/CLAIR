import type { ResultatsNationaux, StatutCirconscription } from '@/lib/senatoriales/resultats';
import { BarreEtats } from './BarreEtats';

/**
 * Compteurs de la soirée et déroulé de la journée.
 *
 * Les états de la barre se lisent de gauche à droite dans l'ordre où une
 * circonscription les traverse à rebours : pourvue, à moitié, en attente de
 * 2nd tour, close sans résultat, vote en cours, pas encore ouverte.
 */

const ORDRE: { statut: StatutCirconscription; libelle: string; classe: string }[] = [
  { statut: 'pourvue', libelle: 'Pourvues', classe: 'bg-foreground' },
  {
    statut: 'partielle',
    libelle: 'Pourvues à moitié',
    classe: 'bg-[repeating-linear-gradient(135deg,hsl(var(--foreground))_0_3px,transparent_3px_6px)]',
  },
  { statut: 'second_tour', libelle: '2nd tour à venir ou en cours', classe: 'bg-muted-foreground' },
  { statut: 'resultats_attendus', libelle: 'Scrutin clos, résultats attendus', classe: 'bg-muted-foreground/60' },
  { statut: 'vote_en_cours', libelle: 'Vote en cours', classe: 'bg-muted-foreground/30' },
  { statut: 'pas_ouvert', libelle: 'Vote pas encore ouvert', classe: 'border border-dashed border-muted-foreground/60' },
];

function Compteur({ valeur, total, libelle }: { valeur: number; total: number; libelle: string }) {
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tabular-nums">{valeur}</span>
        <span className="text-lg text-muted-foreground">/ {total}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{libelle}</p>
    </div>
  );
}

type EtatEtape = 'fait' | 'en_cours' | 'a_venir';

interface Etape {
  heure: string;
  libelle: string;
  etat: EtatEtape;
}

/** Heure de Paris le jour du scrutin, en instant absolu. */
const a = (heure: string, jour = '27') => new Date(`2026-09-${jour}T${heure}:00+02:00`).getTime();

function etapes(donnees: ResultatsNationaux): Etape[] {
  const t = new Date(donnees.maintenant).getTime();
  const outreMer = new Set(['973', '977', '978', '986', '987']);
  const metropoleComplete = donnees.circonscriptions
    .filter((c) => !outreMer.has(c.departement))
    .every((c) => c.statut === 'pourvue');
  const toutComplet = donnees.compteurs.pourvue === donnees.compteurs.circonscriptions;

  const liste: { heure: string; libelle: string; fait: boolean; commence: boolean }[] = [
    { heure: '7h30', libelle: 'Wallis-et-Futuna pourvue', fait: t >= a('07:30'), commence: t >= a('01:00') },
    { heure: '11h', libelle: 'Fin du 1er tour au majoritaire', fait: t >= a('11:00'), commence: t >= a('11:00') },
    { heure: 'vers 12h', libelle: 'Résultats du 1er tour', fait: t >= a('12:00'), commence: t >= a('11:00') },
    { heure: '15h30 → 17h30', libelle: '2nd tour au majoritaire', fait: t >= a('17:30'), commence: t >= a('15:30') },
    { heure: '17h30', libelle: 'Fin du vote à la proportionnelle', fait: t >= a('17:30'), commence: t >= a('17:30') },
    { heure: 'en soirée', libelle: 'Résultats de la métropole', fait: metropoleComplete, commence: t >= a('17:30') },
    {
      heure: '22h30 → lun. 5h30',
      libelle: 'Outre-mer : Guyane, Saint-Barthélemy, Saint-Martin, Polynésie',
      fait: toutComplet,
      commence: t >= a('22:30'),
    },
  ];

  return liste.map((e) => ({
    heure: e.heure,
    libelle: e.libelle,
    etat: e.fait ? 'fait' : e.commence ? 'en_cours' : 'a_venir',
  }));
}

export function SuiviScrutin({ donnees }: { donnees: ResultatsNationaux }) {
  const c = donnees.compteurs;
  const presents = ORDRE.filter((o) => c[o.statut] > 0);

  return (
    <section className="space-y-6 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Suivi du scrutin</h2>
        <p className="text-xs text-muted-foreground">Les pages sont mises à jour toutes les quelques minutes.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Compteur valeur={c.pourvue} total={c.circonscriptions} libelle="circonscriptions pourvues" />
          <BarreEtats
            etats={presents.map((o) => ({ ...o, nombre: c[o.statut] }))}
            total={c.circonscriptions}
            circonscriptions={donnees.circonscriptions.map(({ departement, nom, statut }) => ({ departement, nom, statut }))}
          />
        </div>

        <div className="space-y-3">
          <Compteur valeur={c.siegesAttribues} total={c.sieges} libelle="sièges attribués" />
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-foreground"
              style={{ width: `${(c.siegesAttribues / c.sieges) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <p className="mb-3 text-sm">
          <span className="font-semibold">Le déroulé de la journée</span>
          <span className="text-muted-foreground">, heure de Paris : les bureaux ferment à l&apos;heure locale</span>
        </p>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {etapes(donnees).map((e) => (
            <li key={e.heure} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                    e.etat === 'fait'
                      ? 'border-foreground bg-foreground'
                      : e.etat === 'en_cours'
                        ? 'border-foreground bg-background'
                        : 'border-muted-foreground/50'
                  }`}
                  aria-hidden
                />
                <span className={`h-px flex-1 ${e.etat === 'fait' ? 'bg-foreground' : 'bg-border'}`} aria-hidden />
              </div>
              <p className={`text-sm font-semibold ${e.etat === 'a_venir' ? 'text-muted-foreground' : ''}`}>{e.heure}</p>
              <p className={`text-xs ${e.etat === 'en_cours' ? 'text-foreground' : 'text-muted-foreground'}`}>
                {e.libelle}
                <span className="sr-only">
                  {e.etat === 'fait' ? ' (fait)' : e.etat === 'en_cours' ? ' (en cours)' : ' (à venir)'}
                </span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
