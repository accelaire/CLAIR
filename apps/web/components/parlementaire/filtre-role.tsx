'use client';

import { FiltreSelect } from '../FiltreSelect';
import type { ListesFiche } from './onglets-fiche';

/**
 * Amendements montrés sur une fiche : ceux dont l'élu est l'auteur, ou ceux
 * qu'il a seulement cosignés (`role` de l'API). Un député LFI cosigne des
 * dizaines de milliers d'amendements de son groupe : mêlés, ils noyaient ceux
 * qu'il a déposés.
 */
export type RoleAmendement = 'depose' | 'cosigne';

/**
 * Rôle ouvert par défaut : les déposés, sauf pour qui n'en a aucun et n'a
 * fait que cosigner. Sans `listes` (réponse mise en cache avant leur ajout),
 * les déposés.
 */
export function roleParDefaut(listes: ListesFiche | null | undefined): RoleAmendement {
  if (listes?.amendementsDeposes === 0 && listes.amendements > 0) return 'cosigne';
  return 'depose';
}

/** Les mots de la liste selon le rôle : « 12 amendements déposés ». */
export function libelleRole(role: RoleAmendement, n: number): string {
  const pluriel = n > 1 ? 's' : '';
  return role === 'depose' ? `déposé${pluriel}` : `cosigné${pluriel}`;
}

/**
 * Filtre « déposés / cosignés » de l'onglet Amendements, avec la taille de
 * chaque liste sur toute la carrière (sans la période). Sans `listes`
 * (réponse mise en cache avant leur ajout), sans compteurs.
 */
export function FiltreRole({
  value,
  onChange,
  listes,
}: {
  value: RoleAmendement;
  onChange: (v: RoleAmendement) => void;
  listes?: ListesFiche | null;
}) {
  const deposes = listes?.amendementsDeposes;
  // `amendements` compte l'union : les déposés, plus les cosignés dont il
  // n'est pas l'auteur. La différence est exactement le compte de `cosigne`.
  const cosignes = deposes !== undefined && listes ? listes.amendements - deposes : undefined;
  const avecCompte = (libelle: string, n?: number) =>
    n === undefined ? libelle : `${libelle} (${n.toLocaleString('fr-FR')})`;
  return (
    <FiltreSelect
      value={value}
      onChange={onChange}
      ariaLabel="Amendements déposés ou cosignés"
      options={[
        { value: 'depose', label: avecCompte('Déposés', deposes), disabled: deposes === 0 },
        { value: 'cosigne', label: avecCompte('Cosignés', cosignes), disabled: cosignes === 0 },
      ]}
    />
  );
}
