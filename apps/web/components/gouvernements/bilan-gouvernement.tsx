import Link from 'next/link';
import { scrutinHref } from '@/lib/scrutin-url';
import {
  LIBELLES_STADE,
  dateLongue,
  lienFiche,
  nombre,
  nomComplet,
  type BilanGouvernement,
  type Domaine,
  type MotionCensure,
  type PersonneGouvernement,
  type ProjetLoi,
  type StadeProjet,
} from '@/lib/gouvernements';

export function Nom({ p }: { p: PersonneGouvernement }) {
  const fiche = lienFiche(p);
  return fiche ? (
    <Link href={fiche} className="text-primary hover:underline">
      {nomComplet(p)}
    </Link>
  ) : (
    <span>{nomComplet(p)}</span>
  );
}

const COULEUR_STADE: Record<StadeProjet, string> = {
  promulgue: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  adopte: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  examine: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  depose: 'bg-muted text-muted-foreground',
};

export function Stade({ stade }: { stade: StadeProjet }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${COULEUR_STADE[stade]}`}>{LIBELLES_STADE[stade]}</span>;
}

function LigneProjet({ p, chefDeFile }: { p: ProjetLoi; chefDeFile?: PersonneGouvernement | null }) {
  return (
    <li className="border-b py-2 last:border-b-0">
      <Link href={`/dossiers/${p.dossier.uid}`} className="text-sm font-medium hover:text-primary hover:underline">
        {p.dossier.titre}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          Déposé {p.chambreDepot === 'senat' ? 'au Sénat' : 'à l’Assemblée'} le {dateLongue(p.dateDepot)}
        </span>
        {chefDeFile && (
          <span>
            · porté par <Nom p={chefDeFile} />
          </span>
        )}
        <Stade stade={p.stade} />
        {p.loi &&
          (p.loi.urlLegifrance ? (
            <a href={p.loi.urlLegifrance} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              loi n° {p.loi.numero}
            </a>
          ) : (
            <span>loi n° {p.loi.numero}</span>
          ))}
      </div>
    </li>
  );
}

export function Motion({ m }: { m: MotionCensure }) {
  const contenu = (
    <>
      <span className="font-medium">
        {m.premierSignataire ? `Motion de ${m.premierSignataire}` : 'Motion de censure'}
      </span>
      {' : '}
      {m.pour.toLocaleString('fr-FR')} voix pour
      {m.majoriteRequise !== null && <>, {m.majoriteRequise.toLocaleString('fr-FR')} requises</>},{' '}
      {m.adoptee ? <strong>adoptée, le gouvernement est renversé</strong> : 'rejetée'}
      {' · '}
      <Link href={scrutinHref(m.scrutin)} className="underline hover:text-foreground">
        scrutin du {dateLongue(m.date)}
      </Link>
    </>
  );
  return m.adoptee ? (
    <li className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm">{contenu}</li>
  ) : (
    <li className="py-1 text-sm text-muted-foreground">{contenu}</li>
  );
}

/** Les textes portés comptés en tête, hors ratifications d'ordonnances et conventions. */
export const textesPortes = (b: BilanGouvernement) =>
  b.textes.liste.filter((p) => p.nature !== 'ratification_ordonnance' && p.nature !== 'convention');

/**
 * Projets de loi d'un gouvernement (SPEC-BILAN-MINISTRE.md, §2) : les textes
 * portés par domaine du ministre chef de file, puis les ratifications
 * d'ordonnances et les conventions, comptées à part.
 */
export function BilanTextes({ bilan, domaines }: { bilan: BilanGouvernement; domaines: Domaine[] }) {
  const { textes } = bilan;
  const portes = textesPortes(bilan);
  const aPart = textes.liste.filter((p) => p.nature === 'ratification_ordonnance' || p.nature === 'convention');
  const s = textes.parStadePortes;

  if (textes.total === 0) {
    return <p className="text-sm text-muted-foreground">Aucun projet de loi déposé pendant ce gouvernement.</p>;
  }

  // Rangés par domaine du ministre chef de file, dans l'ordre de présentation
  // d'un gouvernement ; « Premier ministre seul » à la fin.
  const libelleDomaine = new Map(domaines.map((d) => [d.cle, d.libelle]));
  const groupes = new Map<string, typeof portes>();
  for (const p of portes) {
    const cle = p.chefDeFile ? p.chefDeFile.domaine ?? 'autres' : 'premier-ministre-seul';
    groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
  }
  const ordre = [...domaines.map((d) => d.cle), 'autres', 'premier-ministre-seul'];
  const sections = ordre
    .filter((cle) => groupes.has(cle))
    .map((cle) => ({
      cle,
      titre:
        cle === 'premier-ministre-seul'
          ? 'Signés du Premier ministre seul'
          : cle === 'autres'
            ? 'Autres portefeuilles'
            : libelleDomaine.get(cle) ?? cle,
      projets: groupes.get(cle)!,
    }));

  return (
    <div className="space-y-6">
      {textes.portes > 0 && (
        <p className="text-sm text-muted-foreground">
          Sur {nombre(textes.portes, 'texte porté', 'textes portés')} : {nombre(s.promulgue, 'promulgué')}
          {s.adopte > 0 && <>, {nombre(s.adopte, 'adopté')} sans promulgation connue</>},{' '}
          {nombre(s.examine, 'examiné')} sans adoption définitive, {s.depose} jamais{' '}
          {s.depose > 1 ? 'examinés' : 'examiné'} en séance.
        </p>
      )}

      {sections.map((sec) => (
        <section key={sec.cle}>
          <h3 className="mb-1 text-sm font-semibold">
            {sec.titre} <span className="font-normal text-muted-foreground">({sec.projets.length})</span>
          </h3>
          <ul>
            {sec.projets.map((p) => (
              <LigneProjet key={p.dossier.uid} p={p} chefDeFile={p.chefDeFile?.membre} />
            ))}
          </ul>
        </section>
      ))}

      {aPart.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Ratifications d&apos;ordonnances et conventions ({aPart.length})
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Comptées à part. Déposer le projet de ratification d&apos;une ordonnance est une obligation de l&apos;article 38
            de la Constitution, sous peine de caducité de l&apos;ordonnance : la plupart ne sont jamais examinés, et le
            gouvernement qui le dépose n&apos;est pas toujours celui qui a pris l&apos;ordonnance.
          </p>
          <ul className="mt-2">
            {aPart.map((p) => (
              <LigneProjet key={p.dossier.uid} p={p} chefDeFile={p.chefDeFile?.membre} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Recours au 49.3 et motions de censure (SPEC-BILAN-MINISTRE.md, §3 et §4), en frise. */
export function BilanCensure({ bilan }: { bilan: BilanGouvernement }) {
  const { engagements, motions } = bilan;
  const motionsSpontanees = motions.liste.filter((m) => m.alinea === 2);
  const motions493SansEngagement = motions.liste.filter((m) => m.alinea === 3 && !m.engagementDossierUid);
  // Les motions sans engagement identifié votées dans les 10 jours d'un 49.3.
  const sansEngagementApres = (jour: string) => {
    const fin = new Date(`${jour}T12:00:00Z`);
    fin.setUTCDate(fin.getUTCDate() + 10);
    const borne = fin.toISOString().slice(0, 10);
    return motions493SansEngagement.filter((m) => m.date >= jour && m.date <= borne);
  };

  if (engagements.length === 0 && motions.total === 0) {
    return <p className="text-sm text-muted-foreground">Aucun recours au 49.3 ni motion de censure pendant ce gouvernement.</p>;
  }

  return (
    <div className="space-y-6">
      {engagements.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">
            Recours à l&apos;article 49, alinéa 3 ({engagements.length})
          </h3>
          <ol className="relative space-y-4 border-l-2 border-muted pl-6">
            {engagements.map((e) => (
              <li key={e.dossier.uid} className="relative">
                <span className="absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                <p className="text-sm">
                  <span className="font-medium">{dateLongue(e.date)}</span> · 49.3 sur{' '}
                  <Link href={`/dossiers/${(e.texte ?? e.dossier).uid}`} className="text-primary hover:underline">
                    {(e.texte ?? e.dossier).titre}
                  </Link>
                </p>
                {e.motions.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {e.motions.map((m) => (
                      <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sansEngagementApres(e.date).length > 0
                      ? `Motions votées le ${dateLongue(sansEngagementApres(e.date)[0]!.date)}, sans que la source dise à quel 49.3 chacune répond (voir plus bas).`
                      : 'Aucune motion de censure.'}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {motions493SansEngagement.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Motions en réponse à un 49.3 non identifié</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deux engagements votés le même jour : la source ne dit pas auquel chaque motion répond.
          </p>
          <ul className="mt-1 space-y-1">
            {motions493SansEngagement.map((m) => (
              <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
            ))}
          </ul>
        </section>
      )}

      {motionsSpontanees.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">
            Motions de censure spontanées (article 49, alinéa 2) ({motionsSpontanees.length})
          </h3>
          <ul className="mt-1 space-y-1">
            {motionsSpontanees.map((m) => (
              <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
