import type { ReactNode } from 'react';
import Link from 'next/link';
import { Motion } from './bilan-gouvernement';
import {
  LIBELLES_STADE,
  dateLongue,
  libellePoste,
  moisAnnee,
  nombre,
  type BilanPoste,
  type EntreeGouvernementale,
  type ProjetLoi,
} from '@/lib/gouvernements';

// Le parcours au Gouvernement, commun à la fiche d'un parlementaire et à la
// page d'un membre sans fiche. Sans état ni hook : rendu côté serveur sur la
// page d'un membre, dans la frise (composant client) sur une fiche.

// Pastille des fonctions gouvernementales : bleu de la République, carrée pour
// se distinguer des pastilles rondes aux couleurs des groupes.
const COULEUR_GOUVERNEMENT = '#000091';

/** Le libellé d'une entrée : celui du poste le plus récent. */
export function libelleEntree(entree: EntreeGouvernementale): string {
  const f = entree.postes[0]!;
  return f.type === 'presidence' ? f.qualite : libellePoste(f.qualite, f.intituleCourt, f.intitule);
}

/** La ligne de résumé d'un poste : textes portés et réponses en séance ; 49.3 et motions pour un PM. */
export function resumeBilanPoste(b: BilanPoste): string[] {
  const morceaux: string[] = [];
  if (b.textes) {
    const c = b.textes.chefDeFile;
    if (c.portes > 0) {
      morceaux.push(
        `${nombre(c.portes, 'texte porté', 'textes portés')}, ${
          c.parStadePortes.promulgue > 0 ? `dont ${nombre(c.parStadePortes.promulgue, 'promulgué')}` : 'aucun promulgué'
        }`,
      );
    }
    const aPart = c.parNature.ratification_ordonnance + c.parNature.convention;
    if (aPart > 0) morceaux.push(nombre(aPart, 'ratification ou convention', 'ratifications ou conventions'));
    if (b.textes.cosignataire > 0) morceaux.push(nombre(b.textes.cosignataire, 'texte cosigné', 'textes cosignés'));
  }
  const reponses = b.reponses.assemblee + b.reponses.senat;
  if (reponses > 0) morceaux.push(nombre(reponses, 'réponse en séance', 'réponses en séance'));
  if (b.premierMinistre) {
    morceaux.push(nombre(b.premierMinistre.engagements, 'recours au 49.3', 'recours au 49.3'));
    morceaux.push(nombre(b.premierMinistre.motions, 'motion de censure', 'motions de censure'));
  }
  return morceaux;
}

/** « Gouvernements Borne, Attal, Barnier et Bayrou », chacun lié à sa page. */
export function ListeGouvernements({ gouvernements }: { gouvernements: EntreeGouvernementale['gouvernements'] }) {
  return (
    <>
      {gouvernements.length > 1 ? 'Gouvernements ' : 'Gouvernement '}
      {gouvernements.map((g, i) => (
        <span key={g.slug}>
          {i > 0 && (i === gouvernements.length - 1 ? ' et ' : ', ')}
          <Link href={`/gouvernements/${g.slug}`} className="hover:text-foreground hover:underline">
            {g.nom}
          </Link>
        </span>
      ))}
    </>
  );
}

function Projet({ p, role }: { p: ProjetLoi; role: string }) {
  return (
    <li className="border-b py-1.5 last:border-b-0">
      <Link href={`/dossiers/${p.dossier.uid}`} className="hover:text-primary hover:underline">
        {p.dossier.titre}
      </Link>
      <span className="text-xs text-muted-foreground">
        {' '}
        · {role === 'chef_de_file' ? 'chef de file' : 'cosignataire'} · déposé le {dateLongue(p.dateDepot)} ·{' '}
        {LIBELLES_STADE[p.stade]}
      </span>
    </li>
  );
}

/** Les listes d'un bilan de poste : recours au 49.3, motions de censure, projets de loi signés. */
export function DetailBilan({ bilan }: { bilan: BilanPoste }) {
  const textes = bilan.textes?.liste ?? [];
  const engagements = bilan.premierMinistre?.listeEngagements ?? [];
  const motions = bilan.premierMinistre?.listeMotions ?? [];
  return (
    <>
      {engagements.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold">Recours au 49.3</p>
          <ul className="text-sm">
            {engagements.map((e) => (
              <li key={`${e.date}-${e.dossier.uid}`} className="py-0.5">
                {dateLongue(e.date)} ·{' '}
                <Link href={`/dossiers/${(e.texte ?? e.dossier).uid}`} className="hover:text-primary hover:underline">
                  {(e.texte ?? e.dossier).titre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {motions.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold">Motions de censure contre son gouvernement</p>
          <ul className="space-y-0.5">
            {motions.map((m) => (
              <Motion key={`${m.scrutin.session}-${m.scrutin.numero}`} m={m} />
            ))}
          </ul>
        </div>
      )}
      {textes.length > 0 ? (
        <>
          <p className="text-xs font-semibold">Projets de loi signés</p>
          <ul className="text-sm">
            {textes.map((t) => (
              <Projet key={`${t.dossier.uid}-${t.role}`} p={t} role={t.role} />
            ))}
          </ul>
        </>
      ) : (
        engagements.length === 0 &&
        motions.length === 0 && <p className="text-xs text-muted-foreground">Aucun projet de loi signé.</p>
      )}
    </>
  );
}

/**
 * Une entrée de la frise : un poste ministériel (ou des postes reconduits
 * d'un gouvernement à l'autre) ou une présidence de la République, au même
 * rang qu'un mandat. Le bilan vient en dessous (`children`) : chargé à
 * l'ouverture sur une fiche, dans la page sur celle d'un membre.
 */
export function EntreeParcours({ entree, children }: { entree: EntreeGouvernementale; children?: ReactNode }) {
  const enCours = !entree.dateFin;
  return (
    <li className="relative">
      <span
        className={`absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-sm ring-2 ring-background ${enCours ? '' : 'opacity-60'}`}
        style={{ backgroundColor: COULEUR_GOUVERNEMENT }}
        aria-hidden
      />
      <div className={enCours ? '' : 'opacity-75'}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium">{libelleEntree(entree)}</span>
          <span className="text-xs text-muted-foreground">
            {moisAnnee(entree.dateDebut)} → {enCours ? 'en cours' : moisAnnee(entree.dateFin!)}
          </span>
        </div>
        {entree.gouvernements.length > 0 && (
          <div className="mt-1 text-sm text-muted-foreground">
            <ListeGouvernements gouvernements={entree.gouvernements} />
          </div>
        )}
        {children}
      </div>
    </li>
  );
}

/**
 * Le bilan d'une entrée quand ses listes sont déjà là (page d'un membre) : le
 * même résumé et le même « Voir le détail » que sur une fiche, mais le détail
 * est dans le HTML servi, déplié sans script.
 */
export function BilanEntreeDeplie({ entree }: { entree: EntreeGouvernementale }) {
  const f = entree.postes[0]!;
  if (!entree.bilan) {
    return f.type === 'poste_ministeriel' ? (
      <p className="mt-1 text-sm text-muted-foreground">Pas de données de bilan avant juin 2017.</p>
    ) : null;
  }
  const morceaux = resumeBilanPoste(entree.bilan);
  const listes =
    (entree.bilan.textes?.liste?.length ?? 0) +
    (entree.bilan.premierMinistre?.listeEngagements?.length ?? 0) +
    (entree.bilan.premierMinistre?.listeMotions?.length ?? 0);
  if (morceaux.length === 0 && listes === 0) return null;
  return (
    <div className="mt-1 text-sm text-muted-foreground">
      {morceaux.length > 0 && <p>{morceaux.join(' · ')}</p>}
      {listes > 0 && (
        <details className="group">
          <summary className="mt-0.5 w-fit cursor-pointer list-none text-xs text-primary hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Voir le détail</span>
            <span className="hidden group-open:inline">Masquer le détail</span>
          </summary>
          <div className="mt-2 rounded-lg border bg-card px-3 py-2 text-foreground">
            <DetailBilan bilan={entree.bilan} />
          </div>
        </details>
      )}
    </div>
  );
}
