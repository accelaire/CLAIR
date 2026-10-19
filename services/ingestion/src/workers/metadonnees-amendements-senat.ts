// =============================================================================
// Discussions, alinéa et parent des amendements du Sénat, depuis AMELI
// =============================================================================
//
// Le CSV par texte ne dit pas quels amendements sont discutés ensemble ou
// identiques, ni quel amendement modifie un sous-amendement (il les marque
// seulement « S/Amt »). Le dump AMELI le donne : `discomid` (38 % des
// amendements), `ideid` (17 %), `amdperid` (6 109 sous-amendements), et le
// numéro de l'alinéa visé (49 %). Relevé du 18/10/2026.
//
// Cette passe tourne chaque nuit après la synchro CSV, sur le dump qu'elle a
// déjà lu, et couvre TOUT le dump : l'historique se remplit au premier
// passage. Elle est le seul écrivain de ces colonnes pour le Sénat (le CSV
// écrit le libellé `alinea`) ; deux écrivains se les disputeraient chaque
// nuit, et `updated_at` bougerait sans changement. Une ligne qu'AMELI ne
// connaît pas n'est pas touchée.
//
// Le parent se retrouve par l'id AMELI (rows `SENAT-AMD-{id}`), ou par la clé
// `session/texteNum:numero` de son texte (rows du CSV). Plusieurs candidats :
// celui du même texte que l'enfant, puis celui du même schéma d'uid ; au-delà,
// on ne devine pas (les rows AMELI et CSV se doublonnent sur une période).
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import { normalizeSenatNumero, type MetadonneesAmeli } from '../sources/senat/amendements-client';
import { logger } from '../utils/logger';

export interface MetadonneesSenatAmeli {
  texteMapping: Map<number, { num: string; session: string }>;
  metadonneesByAmdId: Map<number, MetadonneesAmeli>;
  metadonneesByKey: Map<string, MetadonneesAmeli>;
}

export interface AmendementSenat {
  id: string;
  uid: string;
  numero: string;
  texteRef: string | null;
}

const UID_AMELI = /^SENAT-AMD-(\d+)$/;

/** La clé `session/texteNum:numero` d'un amendement, depuis son `texte_ref`. */
export function cleAmendementSenat(
  amd: { numero: string; texteRef: string | null },
  texteMapping: MetadonneesSenatAmeli['texteMapping'],
): string | null {
  const texteId = /^SENAT-TXT-(\d+)$/.exec(amd.texteRef ?? '');
  const texte = texteId ? texteMapping.get(Number(texteId[1])) : undefined;
  return texte && amd.numero ? `${texte.session}/${texte.num}:${normalizeSenatNumero(amd.numero)}` : null;
}

/** Les métadonnées AMELI d'un amendement, ou null si AMELI ne le connaît pas. */
export function metadonneesAmeli(amd: AmendementSenat, ameli: MetadonneesSenatAmeli): MetadonneesAmeli | null {
  const idAmeli = UID_AMELI.exec(amd.uid);
  if (idAmeli) return ameli.metadonneesByAmdId.get(Number(idAmeli[1])) ?? null;
  const cle = cleAmendementSenat(amd, ameli.texteMapping);
  return cle ? ameli.metadonneesByKey.get(cle) ?? null : null;
}

/** L'id du parent parmi les candidats, ou null s'il n'y en a pas un seul. */
export function choisirParentSenat(
  enfant: AmendementSenat,
  parent: NonNullable<MetadonneesAmeli['parent']>,
  index: { parUid: Map<string, AmendementSenat>; parCle: Map<string, AmendementSenat[]> },
): string | null {
  const candidats = new Map<string, AmendementSenat>();
  const direct = index.parUid.get(`SENAT-AMD-${parent.amdId}`);
  if (direct) candidats.set(direct.id, direct);
  for (const c of (parent.cle ? index.parCle.get(parent.cle) : undefined) ?? []) candidats.set(c.id, c);
  candidats.delete(enfant.id);

  let liste = [...candidats.values()];
  if (liste.length > 1) {
    const memeTexte = liste.filter((c) => c.texteRef === enfant.texteRef);
    if (memeTexte.length > 0) liste = memeTexte;
  }
  if (liste.length > 1) {
    const schemaEnfant = UID_AMELI.test(enfant.uid);
    const memeSchema = liste.filter((c) => UID_AMELI.test(c.uid) === schemaEnfant);
    if (memeSchema.length > 0) liste = memeSchema;
  }
  return liste.length === 1 ? liste[0]!.id : null;
}

interface LigneSenat {
  id: string; uid: string; numero: string; texte_ref: string | null;
  alinea_numero: number | null; id_discussion_commune: string | null; id_discussion_identique: string | null;
  amendement_parent_ref: string | null; amendement_parent_id: string | null;
}

export interface ResultatMetadonneesSenat {
  lignes: number;
  connuesAmeli: number;
  sousAmendements: number;
  parentsResolus: number;
  ecrites: number;
}

export async function alignerMetadonneesSenat(
  prisma: PrismaClient,
  ameli: MetadonneesSenatAmeli,
  options: { dryRun?: boolean } = {},
): Promise<ResultatMetadonneesSenat> {
  if (ameli.metadonneesByAmdId.size === 0) {
    logger.warn('Métadonnées Sénat : dump AMELI vide ou illisible, rien d\'aligné');
    return { lignes: 0, connuesAmeli: 0, sousAmendements: 0, parentsResolus: 0, ecrites: 0 };
  }

  const lignes = await prisma.$queryRaw<LigneSenat[]>`
    SELECT id, uid, numero, texte_ref, alinea_numero, id_discussion_commune, id_discussion_identique,
           amendement_parent_ref, amendement_parent_id
    FROM amendements WHERE chambre = 'senat'
  `;
  const amd = (l: LigneSenat): AmendementSenat => ({ id: l.id, uid: l.uid, numero: l.numero, texteRef: l.texte_ref });

  const parUid = new Map<string, AmendementSenat>();
  const parCle = new Map<string, AmendementSenat[]>();
  for (const l of lignes) {
    const a = amd(l);
    parUid.set(a.uid, a);
    const cle = cleAmendementSenat(a, ameli.texteMapping);
    if (cle) parCle.set(cle, [...(parCle.get(cle) ?? []), a]);
  }

  let connuesAmeli = 0;
  let sousAmendements = 0;
  let parentsResolus = 0;
  const aEcrire: Array<{
    id: string; alineaNumero: number | null; commune: string | null; identique: string | null;
    parentRef: string | null; parentId: string | null;
  }> = [];
  for (const l of lignes) {
    const meta = metadonneesAmeli(amd(l), ameli);
    if (!meta) continue;
    connuesAmeli++;
    const parentRef = meta.parent ? `SENAT-AMD-${meta.parent.amdId}` : null;
    const parentId = meta.parent ? choisirParentSenat(amd(l), meta.parent, { parUid, parCle }) : null;
    if (meta.parent) sousAmendements++;
    if (parentId) parentsResolus++;
    if (l.alinea_numero !== meta.alineaNumero
      || l.id_discussion_commune !== meta.idDiscussionCommune
      || l.id_discussion_identique !== meta.idDiscussionIdentique
      || l.amendement_parent_ref !== parentRef
      || l.amendement_parent_id !== parentId) {
      aEcrire.push({
        id: l.id, alineaNumero: meta.alineaNumero, commune: meta.idDiscussionCommune,
        identique: meta.idDiscussionIdentique, parentRef, parentId,
      });
    }
  }

  if (!options.dryRun) {
    const LOT = 2000;
    for (let i = 0; i < aEcrire.length; i += LOT) {
      const lot = aEcrire.slice(i, i + LOT);
      await prisma.$executeRaw`
        UPDATE amendements a SET
          alinea_numero = v.alinea_numero,
          id_discussion_commune = v.commune,
          id_discussion_identique = v.identique,
          amendement_parent_ref = v.parent_ref,
          amendement_parent_id = v.parent_id
        FROM UNNEST(
          ${lot.map((e) => e.id)}::text[],
          ${lot.map((e) => e.alineaNumero)}::int[],
          ${lot.map((e) => e.commune)}::text[],
          ${lot.map((e) => e.identique)}::text[],
          ${lot.map((e) => e.parentRef)}::text[],
          ${lot.map((e) => e.parentId)}::text[]
        ) AS v(id, alinea_numero, commune, identique, parent_ref, parent_id)
        WHERE a.id = v.id
      `;
    }
  }

  const resultat = { lignes: lignes.length, connuesAmeli, sousAmendements, parentsResolus, ecrites: aEcrire.length };
  logger.info({ ...resultat, dryRun: !!options.dryRun }, 'Métadonnées des amendements Sénat alignées sur AMELI');
  return resultat;
}
