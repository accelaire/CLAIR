import Link from 'next/link';
import { couleurFamille, libelleFamille } from '@/lib/senatoriales/familles';
import {
  accorder,
  heureDeParis,
  libelleParcours,
  nombre,
  pluriel,
  pourcentage,
  type Elu,
  type LigneResultat,
  type Participation,
  type ResultatsCirconscription,
  type TourResultat,
} from '@/lib/senatoriales/resultats';

/**
 * Blocs de la page de résultats d'une circonscription.
 *
 * Tous rendus côté serveur : la page doit être complète dans le HTML servi,
 * sans JavaScript. Les listes non élues se replient dans un `<details>`, qui
 * fonctionne sans script lui aussi.
 */

function lienPersonne(personne: { slug: string; chambre: string }) {
  return `/${personne.chambre === 'senat' ? 'senateurs' : 'deputes'}/${personne.slug}`;
}

function Pastille({ famille }: { famille: string | null }) {
  return (
    <span
      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: couleurFamille(famille) }}
      title={libelleFamille(famille)}
      aria-hidden
    />
  );
}

function Initiales({ prenom, nom }: { prenom: string; nom: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
      {`${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()}
    </span>
  );
}

const CARTE = 'rounded-xl border bg-card p-5';

// --- En tête ---------------------------------------------------------------

export function ListeEnTete({
  ligne,
  nbSieges,
  autres,
}: {
  ligne: LigneResultat;
  nbSieges: number;
  /** Les autres listes qui ont obtenu des sièges. */
  autres: LigneResultat[];
}) {
  const tete = ligne.candidats.find((c) => c.ordre === 1 && c.role === 'titulaire');
  const sansSiege = (ligne.sieges ?? 0) === 0;
  return (
    <section className={CARTE}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liste arrivée en tête</p>
      <div className="mt-3 flex items-start gap-2.5">
        <Pastille famille={ligne.famille} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-snug">{ligne.libelle}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ligne.nuanceLibelle ?? libelleFamille(ligne.famille)}
            {tete && (
              <>
                {' · menée par '}
                {tete.personne ? (
                  <Link href={lienPersonne(tete.personne)} className="text-primary hover:underline">
                    {tete.prenom} {tete.nom}
                  </Link>
                ) : (
                  `${tete.prenom} ${tete.nom}`
                )}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-4xl font-bold tabular-nums">{pourcentage(ligne.pctExprimes)}</p>
          <p className="text-xs text-muted-foreground">{nombre(ligne.voix)} voix</p>
        </div>
        {!sansSiege && (
          <div>
            <span className="inline-flex gap-1" aria-hidden>
              {Array.from({ length: nbSieges }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < (ligne.sieges ?? 0) ? '' : 'border border-muted-foreground/60'}`}
                  style={i < (ligne.sieges ?? 0) ? { backgroundColor: couleurFamille(ligne.famille) } : undefined}
                />
              ))}
            </span>
            <p className="text-xs text-muted-foreground">
              {ligne.sieges} {pluriel(ligne.sieges ?? 0, 'siège')} sur {nbSieges}
            </p>
          </div>
        )}
      </div>
      {autres.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {autres.map((a, i) => (
            <span key={a.sourceUid}>
              {i > 0 && ', '}
              <strong className="font-medium text-foreground">{a.libelle}</strong> {a.sieges}{' '}
              {pluriel(a.sieges ?? 0, 'siège')}
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

// --- Élus -------------------------------------------------------------------

export function CarteElus({
  elus,
  ou,
  nbSieges,
  resteAPourvoir,
  horaireSecondTour,
}: {
  elus: Elu[];
  ou: string;
  /** « de 15h30 à 17h30, heure de Paris » */
  horaireSecondTour?: string;
  nbSieges: number;
  /** Sièges encore à pourvoir au 2nd tour (majoritaire, résultats partiels). */
  resteAPourvoir: number;
}) {
  return (
    <section className={CARTE}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {elus.length === nbSieges
            ? `${elus.length > 1 ? `Les ${elus.length} élus` : accorder(elus[0]?.sexe, "L'élu", "L'élue")} ${ou}`
            : `${elus.length} ${pluriel(elus.length, 'élu')} sur ${nbSieges} ${ou}`}
        </h2>
        <p className="text-xs text-muted-foreground">Prise de fonction le 1er octobre</p>
      </div>
      <ul className="mt-3 divide-y">
        {elus.map((e) => (
          <li key={`${e.nom}-${e.prenom}`} className="flex items-center gap-3 py-3">
            <Initiales prenom={e.prenom} nom={e.nom} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                {e.prenom} {e.nom}
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    e.parcours === 'nouveau' ? 'border text-muted-foreground' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {libelleParcours(e)}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  e.liste,
                  e.nuanceLibelle ?? libelleFamille(e.famille),
                  e.tour === 2 ? accorder(e.sexe, 'élu au 2nd tour', 'élue au 2nd tour') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {e.personne ? (
              <Link href={lienPersonne(e.personne)} className="shrink-0 text-sm text-primary hover:underline">
                Voir sa fiche →
              </Link>
            ) : (
              <span className="hidden max-w-[10rem] shrink-0 text-right text-xs text-muted-foreground sm:block">
                Fiche CLAIR à l&apos;ouverture de son mandat, début octobre
              </span>
            )}
          </li>
        ))}
        {resteAPourvoir > 0 && (
          <li className="py-3 text-sm text-muted-foreground">
            {resteAPourvoir} {pluriel(resteAPourvoir, 'siège reste', 'sièges restent')} à pourvoir au 2nd
            tour{horaireSecondTour ? `, ${horaireSecondTour}` : ''}.
          </li>
        )}
      </ul>
    </section>
  );
}

// --- Voix par liste (proportionnel) -----------------------------------------

export function ResultatsParListe({ tour, nbSieges }: { tour: TourResultat; nbSieges: number }) {
  const max = Math.max(...tour.lignes.map((l) => l.pctExprimes ?? 0), 1);
  return (
    <section className={CARTE}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Résultats par liste</h2>
        <p className="text-xs text-muted-foreground">
          Scrutin proportionnel, un tour · {nbSieges} {pluriel(nbSieges, 'siège')}
        </p>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="w-6 py-2 font-medium">#</th>
            <th scope="col" className="py-2 font-medium">Liste</th>
            <th scope="col" className="hidden py-2 font-medium md:table-cell">
              <span className="sr-only">Part des exprimés</span>
            </th>
            <th scope="col" className="py-2 text-right font-medium">% des exprimés</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Voix</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Sièges</th>
          </tr>
        </thead>
        <tbody>
          {tour.lignes.map((l, i) => (
            <tr key={l.sourceUid} className="border-b last:border-0">
              <td className="py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2.5">
                <span className="flex items-start gap-2">
                  <Pastille famille={l.famille} />
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{l.libelle}</span>
                    <span className="block text-xs text-muted-foreground">{l.nuanceLibelle ?? libelleFamille(l.famille)}</span>
                  </span>
                </span>
              </td>
              <td className="hidden w-2/5 px-4 py-2.5 md:table-cell">
                <span className="block h-1.5 w-full rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${((l.pctExprimes ?? 0) / max) * 100}%`,
                      backgroundColor: (l.sieges ?? 0) > 0 ? couleurFamille(l.famille) : 'hsl(var(--muted-foreground))',
                    }}
                  />
                </span>
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{pourcentage(l.pctExprimes)}</td>
              <td className="py-2.5 pl-4 text-right text-muted-foreground tabular-nums">{nombre(l.voix)}</td>
              <td className="py-2.5 pl-4 text-right">
                {(l.sieges ?? 0) > 0 ? (
                  <span className="inline-flex gap-0.5" aria-label={`${l.sieges} ${pluriel(l.sieges ?? 0, 'siège')}`}>
                    {Array.from({ length: l.sieges ?? 0 }).map((_, k) => (
                      <span key={k} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleurFamille(l.famille) }} />
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// --- Tours du majoritaire ---------------------------------------------------

export function TourMajoritaire({ tour, rappel }: { tour: TourResultat; rappel: boolean }) {
  return (
    <section className={CARTE}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {rappel ? 'Rappel du 1er tour' : tour.tour === 1 ? 'Résultats du 1er tour' : 'Résultats du 2nd tour'}
        </h2>
        <p className="text-xs text-muted-foreground">Publiés à {heureDeParis(tour.publieA)}, heure de Paris</p>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 font-medium">Candidat</th>
            <th scope="col" className="py-2 text-right font-medium">% des exprimés</th>
            <th scope="col" className="py-2 text-right font-medium">Voix</th>
            <th scope="col" className="py-2 text-right font-medium">Élu</th>
          </tr>
        </thead>
        <tbody>
          {tour.lignes.map((l) => {
            const titulaire = l.candidats.find((c) => c.role === 'titulaire');
            const remplacant = l.candidats.find((c) => c.role === 'suppleant');
            return (
              <tr key={l.sourceUid} className="border-b last:border-0">
                <td className="py-2.5">
                  <span className="flex items-start gap-2">
                    <Pastille famille={l.famille} />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {titulaire?.personne ? (
                          <Link href={lienPersonne(titulaire.personne)} className="text-primary hover:underline">
                            {l.libelle}
                          </Link>
                        ) : (
                          l.libelle
                        )}
                        {titulaire?.sortant && (
                          <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[11px] font-medium text-primary">
                            {accorder(titulaire.sexe, 'sortant', 'sortante')}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {l.nuanceLibelle ?? libelleFamille(l.famille)}
                        {remplacant && ` · remplaçant${remplacant.sexe === 'F' ? 'e' : ''} : ${remplacant.prenom} ${remplacant.nom}`}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{pourcentage(l.pctExprimes)}</td>
                <td className="py-2.5 text-right text-muted-foreground tabular-nums">{nombre(l.voix)}</td>
                <td className="py-2.5 text-right">
                  {l.elu ? (
                    <span className="rounded bg-foreground px-1.5 py-0.5 text-xs font-medium text-background">
                      {accorder(titulaire?.sexe, 'élu', 'élue')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tour.tour === 1 && !rappel && tour.lignes.some((l) => l.candidats.length > 0) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Est élu au 1er tour le candidat qui réunit la majorité absolue des suffrages exprimés et le quart des
          inscrits. Chaque grand électeur vote pour autant de noms que de sièges : la somme des voix peut dépasser
          le nombre d&apos;exprimés.
        </p>
      )}
    </section>
  );
}

// --- Répartition des sièges (proportionnel) ---------------------------------

export function RepartitionSieges({
  repartition,
  nbSieges,
}: {
  repartition: NonNullable<ResultatsCirconscription['repartition']>;
  nbSieges: number;
}) {
  // Les listes qui ont eu un siège, plus celle qui a failli l'avoir : c'est la
  // comparaison qui explique le dernier siège.
  const dernier = repartition.attributions[repartition.attributions.length - 1];
  const moyenneDernier = (() => {
    if (!dernier) return 0;
    const liste = repartition.listes.find((l) => l.sourceUid === dernier.sourceUid);
    return liste?.moyennes[dernier.diviseur - 1] ?? 0;
  })();
  const avecSiege = repartition.listes.filter((l) => l.sieges > 0);
  const premiereSansSiege = repartition.listes
    .filter((l) => l.sieges === 0)
    .sort((a, b) => b.voix - a.voix)[0];
  const lignes = premiereSansSiege ? [...avecSiege, premiereSansSiege] : avecSiege;
  const rangDe = (uid: string, diviseur: number) =>
    repartition.attributions.find((a) => a.sourceUid === uid && a.diviseur === diviseur)?.rang;
  const colonnes = Math.min(nbSieges, Math.max(...avecSiege.map((l) => l.sieges), 1) + 1);
  const restantes = repartition.listes.length - lignes.length;

  return (
    <section className={CARTE}>
      <h2 className="text-lg font-semibold">
        Comment {nbSieges > 1 ? `les ${nbSieges} sièges ont été répartis` : 'le siège a été attribué'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Règle de la plus forte moyenne : on divise les voix de chaque liste par 1, 2, 3… et on attribue les sièges
        aux plus grands résultats.
        {premiereSansSiege && dernier && (
          <>
            {' '}
            Le dernier siège s&apos;est joué à {nombre(moyenneDernier)} contre {nombre(premiereSansSiege.voix)} pour{' '}
            {premiereSansSiege.libelle} (en pointillés).
          </>
        )}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 font-medium">Liste</th>
              {Array.from({ length: colonnes }).map((_, k) => (
                <th key={k} scope="col" className="py-2 text-right font-medium">
                  ÷ {k + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.sourceUid} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="flex items-start gap-2">
                    <Pastille famille={l.famille} />
                    <span className="line-clamp-2">{l.libelle}</span>
                  </span>
                </th>
                {Array.from({ length: colonnes }).map((_, k) => {
                  const rang = rangDe(l.sourceUid, k + 1);
                  const valeur = l.moyennes[k] ?? 0;
                  const candidateSuivante = l === premiereSansSiege && k === 0;
                  return (
                    <td key={k} className="py-2 text-right tabular-nums">
                      {rang ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background">
                          {nombre(valeur)} <span className="font-normal">{rang}{rang === 1 ? 'er' : 'e'} siège</span>
                        </span>
                      ) : candidateSuivante ? (
                        <span className="rounded border border-dashed border-foreground/60 px-1.5 py-0.5 text-xs">
                          {nombre(valeur)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{nombre(valeur)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {restantes > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {restantes === 1 ? "L'autre liste" : `Les ${restantes} autres listes`}, qui {restantes === 1 ? 'a' : 'ont'}{' '}
          moins de voix, {restantes === 1 ? "n'est pas détaillée" : 'ne sont pas détaillées'} : aucune de leurs
          moyennes n&apos;approche le dernier siège.
        </p>
      )}
    </section>
  );
}

// --- Participation ------------------------------------------------------------

export function BlocParticipation({ participation, titre }: { participation: Participation; titre: string }) {
  const p = participation;
  const taux = p.inscrits > 0 ? (p.votants / p.inscrits) * 100 : null;
  const cases: { valeur: string; libelle: string }[] = [
    { valeur: nombre(p.inscrits), libelle: 'inscrits' },
    { valeur: nombre(p.votants), libelle: `votants · ${pourcentage(taux)}` },
    { valeur: nombre(p.abstentions), libelle: 'abstentions' },
    { valeur: nombre(p.blancs), libelle: 'blancs' },
    { valeur: nombre(p.nuls), libelle: 'nuls' },
    { valeur: nombre(p.exprimes), libelle: 'exprimés' },
  ];
  return (
    <section className={CARTE}>
      <h2 className="text-lg font-semibold">{titre}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Le vote est obligatoire pour les grands électeurs : une abstention sans motif légitime est passible d&apos;une
        amende de 100 €. D&apos;où des taux proches de 100 %.
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        {cases.map((c) => (
          <div key={c.libelle}>
            <dt className="sr-only">{c.libelle}</dt>
            <dd className="text-xl font-bold tabular-nums">{c.valeur}</dd>
            <dd className="text-xs text-muted-foreground">{c.libelle}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// --- Listes et candidats, avec la ligne de flottaison ------------------------

function CandidatLigne({ c }: { c: LigneResultat['candidats'][number] }) {
  return (
    <li className="flex items-baseline gap-2 py-1.5 text-sm">
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{c.ordre}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {c.personne ? (
            <Link href={lienPersonne(c.personne)} className="font-medium text-primary hover:underline">
              {c.prenom} {c.nom}
            </Link>
          ) : (
            <span className={c.elu ? 'font-medium' : ''}>
              {c.prenom} {c.nom}
            </span>
          )}
          {c.sortant && (
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[11px] font-medium text-primary">
              {accorder(c.sexe, 'sortant', 'sortante')}
            </span>
          )}
          {c.elu && (
            <span className="rounded bg-foreground px-1 py-0.5 text-[11px] font-medium text-background">
              {accorder(c.sexe, 'élu', 'élue')}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">
          {[c.profession, c.anneeNaissance ? `${accorder(c.sexe, 'né', 'née')} en ${c.anneeNaissance}` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </li>
  );
}

export function ListesEtCandidats({ tour }: { tour: TourResultat }) {
  const elues = tour.lignes.filter((l) => (l.sieges ?? 0) > 0);
  const autres = tour.lignes.filter((l) => (l.sieges ?? 0) === 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">
          Les {tour.lignes.length} listes et leurs candidats
        </h2>
        <p className="text-sm text-muted-foreground">
          Classées par voix. Dans chaque liste, les noms au-dessus de la ligne de flottaison sont élus, dans
          l&apos;ordre de la liste.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {elues.map((l) => {
          const titulaires = l.candidats.filter((c) => c.role === 'titulaire');
          const n = l.sieges ?? 0;
          return (
            <article key={l.sourceUid} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-2.5">
                <Pastille famille={l.famille} />
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{l.libelle}</h3>
                  <p className="text-sm text-muted-foreground">{l.nuanceLibelle ?? libelleFamille(l.famille)}</p>
                  <p className="mt-1 text-sm">
                    <strong className="font-semibold">{pourcentage(l.pctExprimes)}</strong>
                    <span className="text-muted-foreground">
                      {' '}· {nombre(l.voix)} voix · {n} {pluriel(n, 'siège')}
                    </span>
                  </p>
                </div>
              </div>
              <ol className="mt-3 border-t pt-2">
                {titulaires.slice(0, n).map((c) => (
                  <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                ))}
                <li className="my-1 flex items-center gap-2 text-[11px] text-muted-foreground" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  ligne de flottaison · {n} {pluriel(n, 'élu')}
                  <span className="h-px flex-1 bg-border" />
                </li>
                {titulaires.slice(n).map((c) => (
                  <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                ))}
              </ol>
            </article>
          );
        })}
      </div>
      <div className="space-y-2">
        {autres.map((l) => {
          const sortants = l.candidats.filter((c) => c.sortant);
          return (
            <details key={l.sourceUid} className="group rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <span className="flex min-w-0 items-start gap-2.5">
                  <Pastille famille={l.famille} />
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug">{l.libelle}</span>
                    <span className="block text-sm text-muted-foreground">
                      {l.nuanceLibelle ?? libelleFamille(l.famille)} · {pourcentage(l.pctExprimes)} · aucun élu
                      {sortants.length > 0 &&
                        ` · dont ${sortants.length} ${pluriel(sortants.length, 'sortant')} : ${sortants
                          .map((s) => `${s.prenom} ${s.nom}`)
                          .join(', ')}`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 rounded-md border px-2.5 py-1 text-sm group-open:hidden">
                  Voir les {l.candidats.filter((c) => c.role === 'titulaire').length} candidats
                </span>
              </summary>
              <ol className="border-t px-4 pb-3 pt-2">
                {l.candidats
                  .filter((c) => c.role === 'titulaire')
                  .map((c) => (
                    <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                  ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}

// --- Avant les résultats ---------------------------------------------------------

export function AttenteResultats({
  resultats,
  maintenant,
  nbListes,
  sortantsCandidats,
  nbSortants,
}: {
  resultats: ResultatsCirconscription;
  maintenant: string;
  nbListes: number;
  sortantsCandidats: number;
  nbSortants: number;
}) {
  const c = resultats.circonscription;
  const h = c.horaires;
  const t = new Date(maintenant).getTime();
  const proportionnel = c.modeScrutin === 'proportionnel';
  const jalons = proportionnel
    ? [
        { heure: heureDeParis(h.ouverture), libelle: 'Ouverture du scrutin', fait: t >= Date.parse(h.ouverture) },
        { heure: heureDeParis(h.cloture), libelle: 'Clôture, début du dépouillement', fait: t >= Date.parse(h.cloture) },
        { heure: 'en soirée', libelle: "Publication des résultats par le ministère de l'Intérieur", fait: false },
      ]
    : [
        { heure: heureDeParis(h.ouverture), libelle: 'Ouverture du 1er tour', fait: t >= Date.parse(h.ouverture) },
        { heure: heureDeParis(h.cloture), libelle: 'Clôture du 1er tour', fait: t >= Date.parse(h.cloture) },
        {
          heure: `${heureDeParis(h.ouvertureT2 ?? h.cloture)} → ${heureDeParis(h.clotureT2 ?? h.cloture)}`,
          libelle: '2nd tour, si un siège reste à pourvoir',
          fait: h.clotureT2 !== null && t >= Date.parse(h.clotureT2),
        },
      ];

  const titre = (() => {
    if (c.statut === 'pas_ouvert') return `Le scrutin ouvre à ${heureDeParis(h.ouverture)}, heure de Paris`;
    if (c.statut === 'vote_en_cours') return `Le vote est en cours jusqu'à ${heureDeParis(h.cloture)}`;
    return `Le scrutin est clos depuis ${heureDeParis(h.cloture)}`;
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className={`${CARTE} lg:col-span-3`}>
        <h2 className="text-lg font-semibold">{titre}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {proportionnel
            ? `Les résultats seront publiés d'un bloc, pour toutes les listes, dans la soirée. Ils s'afficheront ici dès leur publication par le ministère de l'Intérieur.`
            : `Les résultats du 1er tour sont attendus vers midi. Si tous les sièges ne sont pas pourvus, un 2nd tour a lieu l'après-midi. Ils s'afficheront ici dès leur publication par le ministère de l'Intérieur.`}
        </p>
        <ol className="mt-5 grid grid-cols-3 gap-4">
          {jalons.map((j) => (
            <li key={j.libelle} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full border-2 ${j.fait ? 'border-foreground bg-foreground' : 'border-muted-foreground/60'}`}
                  aria-hidden
                />
                <span className={`h-px flex-1 ${j.fait ? 'bg-foreground' : 'bg-border'}`} aria-hidden />
              </div>
              <p className="text-sm font-semibold">{j.heure}</p>
              <p className="text-xs text-muted-foreground">{j.libelle}</p>
            </li>
          ))}
        </ol>
        {['973', '977', '978', '986', '987'].includes(c.departement) && (
          <p className="mt-4 text-xs text-muted-foreground">
            Horaires convertis en heure de Paris : les bureaux ouvrent et ferment à l&apos;heure locale.
          </p>
        )}
      </section>
      <section className={`${CARTE} lg:col-span-2`}>
        <h2 className="text-lg font-semibold">Ce qui se joue</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dd className="text-2xl font-bold tabular-nums">{c.nbSieges}</dd>
            <dt className="text-xs text-muted-foreground">{pluriel(c.nbSieges, 'siège')} à pourvoir</dt>
          </div>
          <div>
            <dd className="text-2xl font-bold tabular-nums">{nbListes}</dd>
            <dt className="text-xs text-muted-foreground">
              {proportionnel ? `${pluriel(nbListes, 'liste')} en lice` : pluriel(nbListes, 'candidature')}
            </dt>
          </div>
          {c.grandsElecteurs !== null && (
            <div>
              <dd className="text-2xl font-bold tabular-nums">{nombre(c.grandsElecteurs)}</dd>
              <dt className="text-xs text-muted-foreground">grands électeurs</dt>
            </div>
          )}
          <div>
            <dd className="text-2xl font-bold tabular-nums">
              {sortantsCandidats} sur {nbSortants}
            </dd>
            <dt className="text-xs text-muted-foreground">sortants candidats</dt>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {proportionnel
            ? 'Scrutin proportionnel à un tour : pas de résultat intermédiaire à la mi-journée, contrairement aux départements au scrutin majoritaire.'
            : 'Scrutin majoritaire à deux tours, le même jour.'}
        </p>
      </section>
    </div>
  );
}
