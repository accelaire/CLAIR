import Link from 'next/link';
import { Gavel, Landmark } from 'lucide-react';
import { Motion, Nom, Stade } from './bilan-gouvernement';
import {
  dateLongue,
  libellePoste,
  nomComplet,
  type ContexteGouvernemental,
  type MotionDuScrutin,
  type RepereGouvernement,
} from '@/lib/gouvernements';

function LienGouvernement({ g, ancre }: { g: RepereGouvernement | null; ancre?: string }) {
  if (!g) return <>le Gouvernement</>;
  return (
    <Link href={`/gouvernements/${g.slug}${ancre ? `#${ancre}` : ''}`} className="font-medium text-primary hover:underline">
      gouvernement {g.nom}
    </Link>
  );
}

type Signataire = ContexteGouvernemental['projets'][number]['signataires'][number];

function NomEtPoste({ s }: { s: Signataire }) {
  return (
    <>
      <Nom p={s.membre} />
      <span className="text-muted-foreground"> ({libellePoste(s.qualite, s.intituleCourt, s.intitule).toLowerCase()})</span>
    </>
  );
}

/** « Porté par X (ministre · intérieur), avec Y et Z, au nom du Premier ministre W. » */
function Signataires({ signataires }: { signataires: Signataire[] }) {
  const pm = signataires.find((s) => s.role === 'premier_ministre');
  const chef = signataires.find((s) => s.role === 'chef_de_file');
  const cos = signataires.filter((s) => s.role === 'cosignataire');
  if (!chef && pm) {
    return (
      <p className="mt-1 text-sm">
        Signé du Premier ministre seul : <Nom p={pm.membre} />.
      </p>
    );
  }
  if (!chef) return null;
  return (
    <p className="mt-1 text-sm">
      Porté par <NomEtPoste s={chef} />
      {cos.length > 0 && (
        <>
          , avec{' '}
          {cos.map((c, i) => (
            <span key={c.membre.slug}>
              {i > 0 && (i === cos.length - 1 ? ' et ' : ', ')}
              <NomEtPoste s={c} />
            </span>
          ))}
        </>
      )}
      {pm && (
        <>
          , au nom du Premier ministre <Nom p={pm.membre} />
        </>
      )}
      .
    </p>
  );
}

/**
 * Ce que le Gouvernement a fait de ce texte : le projet de loi qu'il a déposé
 * et ses signataires, et ses recours au 49.3 avec les motions de censure
 * qu'ils ont suscitées. Bandeau de la page d'un dossier et d'un sujet.
 * `dossierUid` : sur la page d'un dossier d'engagement, le texte visé est
 * nommé plutôt que « ce texte ».
 */
export function ContexteGouvernementalBandeau({
  contexte,
  dossierUid,
}: {
  contexte: ContexteGouvernemental | null | undefined;
  dossierUid?: string;
}) {
  if (!contexte || (contexte.projets.length === 0 && contexte.engagements.length === 0)) return null;

  return (
    <section className="mb-8 space-y-5 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      {contexte.projets.map((p) => (
        <div key={p.dossier.uid} className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Projet de loi du Gouvernement</p>
            <p className="mt-1 text-sm">
              Déposé {p.chambreDepot === 'senat' ? 'au Sénat' : 'à l’Assemblée'} le {dateLongue(p.dateDepot)} par le{' '}
              <LienGouvernement g={p.gouvernement} ancre="textes" />. <Stade stade={p.stade} />
            </p>
            <Signataires signataires={p.signataires} />
          </div>
        </div>
      ))}

      {contexte.engagements.length > 0 && (
        <div className="flex items-start gap-3">
          <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {contexte.engagements.length > 1
                ? `${contexte.engagements.length} recours à l’article 49, alinéa 3`
                : 'Recours à l’article 49, alinéa 3'}
            </p>
            <ol className="mt-2 space-y-3">
              {contexte.engagements.map((e) => {
                const surCeDossier = dossierUid === e.dossier.uid;
                return (
                  <li key={e.dossier.uid} className="text-sm">
                    <p>
                      <span className="font-medium">{dateLongue(e.date)}</span> :{' '}
                      {nomComplet(e.premierMinistre)} engage la responsabilité du <LienGouvernement g={e.gouvernement} ancre="censure" />{' '}
                      {surCeDossier && e.texte ? (
                        <>
                          sur{' '}
                          <Link href={`/dossiers/${e.texte.uid}`} className="text-primary hover:underline">
                            {e.texte.titre}
                          </Link>
                        </>
                      ) : (
                        <>
                          (
                          <Link href={`/dossiers/${e.dossier.uid}`} className="hover:underline">
                            {e.dossier.titre.replace(/^Engagement de la responsabilité du Gouvernement sur /i, '')}
                          </Link>
                          )
                        </>
                      )}
                      .
                    </p>
                    {e.motions.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {e.motions.map((m) => (
                          <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Aucune motion de censure rattachée à cet engagement.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Bandeau du scrutin d'une motion de censure : le gouvernement visé (celui en
 * fonction le jour du vote), le 49.3 auquel elle répond, la majorité requise et
 * le résultat. Une motion adoptée renverse le gouvernement : elle est mise en
 * avant par un fond teinté rouge et une bordure complète.
 */
export function MotionCensureBandeau({ motion }: { motion: MotionDuScrutin | null | undefined }) {
  if (!motion) return null;
  const adoptee = motion.adoptee;
  return (
    <section
      className={`mb-8 rounded-xl border p-4 sm:p-5 ${
        adoptee ? 'border-red-500/40 bg-red-500/5' : 'border-primary/30 bg-primary/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <Gavel className={`mt-0.5 h-5 w-5 shrink-0 ${adoptee ? 'text-red-700 dark:text-red-400' : 'text-primary'}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className={`text-xs font-semibold uppercase tracking-wide ${adoptee ? 'text-red-700 dark:text-red-400' : 'text-primary'}`}>
            Motion de censure · article 49, alinéa {motion.alinea}
            {motion.alinea === 2 ? ' (motion spontanée)' : ' (en réponse à un 49.3)'}
          </p>
          <p className="mt-1">
            Contre le <LienGouvernement g={motion.gouvernement} ancre="censure" />
            {motion.engagement && (
              <>
                , en réponse au 49.3 du {dateLongue(motion.engagement.date)}
                {motion.engagement.texte && (
                  <>
                    {' '}sur{' '}
                    <Link href={`/dossiers/${motion.engagement.texte.uid}`} className="text-primary hover:underline">
                      {motion.engagement.texte.titre}
                    </Link>
                  </>
                )}
              </>
            )}
            {motion.alinea === 3 && !motion.engagement && <>, en réponse à un 49.3 que la source ne précise pas</>}
            .
          </p>
          <p className="mt-1">
            {motion.premierSignataire && <>Déposée par {motion.premierSignataire}. </>}
            {motion.pour.toLocaleString('fr-FR')} voix pour
            {motion.majoriteRequise !== null && (
              <>, {motion.majoriteRequise.toLocaleString('fr-FR')} requises (majorité absolue des membres de l&apos;Assemblée)</>
            )}{' '}
            :{' '}
            {adoptee ? (
              <strong className="text-red-700 dark:text-red-400">adoptée, le gouvernement est renversé</strong>
            ) : (
              'rejetée, le gouvernement reste en place'
            )}
            .
          </p>
        </div>
      </div>
    </section>
  );
}
