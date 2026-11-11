'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { Motion } from '@/components/gouvernements/bilan-gouvernement';
import {
  LIBELLES_STADE,
  dateLongue,
  nombre,
  type BilanPoste,
  type FonctionGouvernementale,
  type ProjetLoi,
} from '@/lib/gouvernements';

interface MembreReponse {
  data: { postes: Array<{ uid: string; bilan: BilanPoste | null }> };
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

/**
 * Bilan d'un poste ministériel sur la fiche d'un parlementaire : le résumé
 * vient avec la fiche, la liste des textes et des 49.3 se charge à l'ouverture
 * (`/gouvernements/membres/:slug`).
 */
export function BilanPosteLigne({ f }: { f: FonctionGouvernementale }) {
  const [ouvert, setOuvert] = useState(false);
  const membre = useQuery({
    queryKey: ['gouvernement-membre', f.membreSlug],
    queryFn: () => fetcher<MembreReponse>(`/gouvernements/membres/${f.membreSlug}`),
    enabled: ouvert && !!f.membreSlug,
    staleTime: 3_600_000,
  });
  if (!f.bilan) return null;
  const morceaux = resumeBilanPoste(f.bilan);
  if (morceaux.length === 0) return null;
  const detail = membre.data?.data.postes.find((p) => p.uid === f.uid)?.bilan;
  const textes = detail?.textes?.liste ?? [];
  const engagements = detail?.premierMinistre?.listeEngagements ?? [];
  const motions = detail?.premierMinistre?.listeMotions ?? [];

  return (
    <div className="mt-1 text-sm text-muted-foreground">
      <p>{morceaux.join(' · ')}</p>
      {f.membreSlug && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="mt-0.5 text-xs text-primary hover:underline"
          aria-expanded={ouvert}
        >
          {ouvert ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      )}
      {ouvert && (
        <div className="mt-2 rounded-lg border bg-card px-3 py-2 text-foreground">
          {membre.isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
          {membre.isError && <p className="text-xs text-muted-foreground">Le détail n&apos;a pas pu être chargé.</p>}
          {detail && (
            <>
              {engagements.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold">Recours au 49.3</p>
                  <ul className="text-sm">
                    {engagements.map((e) => (
                      <li key={e.dossier.uid} className="py-0.5">
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
                      <Projet key={t.dossier.uid} p={t} role={t.role} />
                    ))}
                  </ul>
                </>
              ) : (
                engagements.length === 0 &&
                motions.length === 0 && <p className="text-xs text-muted-foreground">Aucun projet de loi signé.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
