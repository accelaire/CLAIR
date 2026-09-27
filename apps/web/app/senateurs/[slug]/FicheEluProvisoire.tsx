import Link from 'next/link';
import { Info } from 'lucide-react';
import { couleurFamille, libelleFamille } from '@/lib/senatoriales/familles';
import { locutionDepuisCode, slugDepuisCode } from '@/lib/senatoriales/departements';
import {
  accorder,
  heureDeParis,
  lienElu,
  nomComplet,
  nombre,
  pourcentage,
  type FicheEluProvisoire as Fiche,
} from '@/lib/senatoriales/resultats';

const CARTE = 'rounded-xl border bg-card p-5';

/** Types de mandat de `mandats-locaux.ts` qui sont des fonctions exécutives. */
const EXECUTIFS = new Set(['maire', 'adjoint', 'executif_collectivite', 'executif_intercommunalite']);

/** Répertoire national des élus, sur data.gouv. */
export const URL_RNE = 'https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/';

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function depuis(date: string | null): string | null {
  return date ? `depuis ${MOIS.format(new Date(`${date}T00:00:00Z`))}` : null;
}

/** « élu sénateur dans l'Aisne », « élue sénatrice en Gironde ». */
export function titreElu(fiche: Pick<Fiche, 'elu' | 'circonscription'>): string {
  const { elu, circonscription } = fiche;
  return `${accorder(elu.sexe, 'élu sénateur', 'élue sénatrice')} ${locutionDepuisCode(circonscription.departement, circonscription.nom)}`;
}

/**
 * Fiche d'un sénateur élu le 27 septembre qui n'a pas encore de fiche.
 *
 * Elle vit à l'adresse de sa fiche définitive (`/senateurs/<slug>`, le slug que
 * l'annuaire du Sénat lui donnera) : le 1er octobre, la vraie fiche prend sa
 * place sans redirection, et ce que la page a gagné dans les moteurs de
 * recherche lui reste.
 *
 * Tout y est sourcé : l'élection par le ministère de l'Intérieur, les mandats
 * par le Répertoire national des élus. Rien n'est déduit.
 */
export function FicheEluProvisoire({ fiche }: { fiche: Fiche }) {
  const { elu, circonscription, election } = fiche;
  const nom = nomComplet(elu.prenom, elu.nom);
  const slugCirco = slugDepuisCode(circonscription.departement);
  const proportionnel = circonscription.modeScrutin === 'proportionnel';
  const mandats = elu.mandatsLocaux?.mandats ?? [];

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <Link href="/senatoriales-2026" className="hover:underline">
          Sénatoriales 2026
        </Link>
        {slugCirco && (
          <>
            {' › '}
            <Link href={`/senatoriales-2026/${slugCirco}`} className="hover:underline">
              {circonscription.nom}
            </Link>
          </>
        )}
      </nav>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{nom}</h1>
        <p className="text-muted-foreground">
          {titreElu(fiche).charAt(0).toUpperCase() + titreElu(fiche).slice(1)} le 27 septembre 2026
          {election?.tour === 2 ? ', au 2nd tour' : ''}. {accorder(elu.sexe, 'Il', 'Elle')} prend ses fonctions le 1er
          octobre.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(elu.nuanceLibelle || elu.famille) && (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleurFamille(elu.famille) }} aria-hidden />
              {elu.nuanceLibelle ?? libelleFamille(elu.famille)}
            </span>
          )}
          <span className="rounded-md border px-2.5 py-1 text-muted-foreground">
            {elu.parcours === 'nouveau' ? accorder(elu.sexe, 'Nouveau au Parlement', 'Nouvelle au Parlement') : 'Déjà passé par le Parlement'}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className={CARTE}>
          <h2 className="text-lg font-semibold">Son élection</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {proportionnel && elu.liste && (
              <div>
                <dt className="text-muted-foreground">Liste</dt>
                <dd className="font-medium">{elu.liste}</dd>
              </div>
            )}
            {election && (
              <div>
                <dt className="text-muted-foreground">{proportionnel ? 'Voix de la liste' : 'Voix'}</dt>
                <dd className="font-medium">
                  {nombre(election.voix)}
                  {election.pctExprimes !== null && ` (${pourcentage(election.pctExprimes)} des exprimés)`}
                  {proportionnel && election.sieges !== null && ` · ${election.sieges} ${election.sieges > 1 ? 'sièges' : 'siège'}`}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Circonscription</dt>
              <dd className="font-medium">
                {slugCirco ? (
                  <Link href={`/senatoriales-2026/${slugCirco}`} className="text-primary hover:underline">
                    {circonscription.nom}
                  </Link>
                ) : (
                  circonscription.nom
                )}{' '}
                · {circonscription.nbSieges} {circonscription.nbSieges > 1 ? 'sièges' : 'siège'}, scrutin{' '}
                {proportionnel ? 'proportionnel' : 'majoritaire'}
              </dd>
            </div>
          </dl>
          {election && (
            <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Résultats provisoires publiés à {heureDeParis(election.publieA)}, heure de Paris, par le{' '}
                <a href={election.sourceUrl} className="underline underline-offset-2" rel="noopener">
                  ministère de l&apos;Intérieur
                </a>
                .
              </span>
            </p>
          )}
        </section>

        <section className={CARTE}>
          <h2 className="text-lg font-semibold">Ses mandats locaux</h2>
          {mandats.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {mandats.map((m) => (
                <li key={m.libelle}>
                  <span className="font-medium">{m.libelle}</span>
                  {m.depuis && <span className="text-muted-foreground">, {depuis(m.depuis)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun mandat local n&apos;est rattaché à {nom} dans le Répertoire national des élus.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Source :{' '}
            <a href={URL_RNE} className="underline underline-offset-2" rel="noopener">
              Répertoire national des élus
            </a>
            {elu.mandatsLocaux && `, mise à jour du ${JOUR.format(new Date(`${elu.mandatsLocaux.source}T00:00:00Z`))}`}. Les
            mandats sont rapprochés par nom, prénom et date de naissance, jamais sur le seul nom.
          </p>
          {mandats.some((m) => EXECUTIFS.has(m.type) || /vice-présidente?\b/i.test(m.libelle)) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Depuis 2017, un parlementaire ne peut plus cumuler son mandat avec une fonction exécutive locale : maire,
              adjoint, présidence ou vice-présidence d&apos;une collectivité ou d&apos;une intercommunalité.
            </p>
          )}
        </section>
      </div>

      <section className={CARTE}>
        <h2 className="text-lg font-semibold">Son profil</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {elu.anneeNaissance && (
            <div>
              <dt className="text-muted-foreground">{accorder(elu.sexe, 'Né en', 'Née en')}</dt>
              <dd className="font-medium">{elu.anneeNaissance}</dd>
            </div>
          )}
          {elu.profession && (
            <div>
              <dt className="text-muted-foreground">Profession déclarée à sa candidature</dt>
              <dd className="font-medium">{elu.profession}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Sa fiche complète s&apos;ouvrira ici avec son mandat : groupe politique (les groupes se constituent le 5
          octobre), votes, interventions et amendements.
        </p>
      </section>

      {fiche.coElus.length > 0 && (
        <section className={CARTE}>
          <h2 className="text-lg font-semibold">
            {accorder(elu.sexe, 'Élus avec lui', 'Élus avec elle')} {locutionDepuisCode(circonscription.departement, circonscription.nom)}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {fiche.coElus.map((c) => {
              const lien = lienElu(c);
              const libelle = nomComplet(c.prenom, c.nom);
              return (
                <li key={libelle} className="rounded-md border bg-card px-2.5 py-1">
                  {lien ? (
                    <Link href={lien} className="text-primary hover:underline">
                      {libelle}
                    </Link>
                  ) : (
                    libelle
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
