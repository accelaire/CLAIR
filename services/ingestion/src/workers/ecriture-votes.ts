import type { PrismaClient } from '@prisma/client';
import { differencier } from '../utils/synchro-differentielle';

/** Un vote tel que la source le donne, rapporté à un parlementaire connu. */
export interface VoteVoulu {
  parlementaireId: string;
  position: string;
  parDelegation: boolean;
}

interface VoteEnBase extends VoteVoulu {
  id: string;
}

export interface BilanVotes {
  crees: number;
  modifies: number;
  supprimes: number;
  inchanges: number;
}

/**
 * Aligne les votes d'un scrutin sur ceux de la source, par différence.
 *
 * Le remplacement complet (tout effacer, tout réinsérer) faisait disparaître
 * proprement un vote retiré à la source, mais redonnait un identifiant neuf à
 * chaque vote réécrit : ~37 700 votes du Sénat chaque nuit, identiques à la
 * veille (mesuré le 18/10/2026). Ici, un vote garde son identifiant tant que le
 * parlementaire a voté sur ce scrutin ; seule sa position est mise à jour.
 *
 * La transaction est conservée, pour les deux raisons qui l'avaient imposée :
 * l'API ne doit jamais servir un scrutin à moitié écrit, et l'empreinte du
 * scrutin AN (`sourceHash`) n'est posée qu'avec ses votes, pour qu'un échec
 * laisse l'ancienne et que le scrutin soit repris la nuit suivante.
 */
export async function ecrireVotesDuScrutin(
  prisma: PrismaClient,
  scrutinId: string,
  voulus: VoteVoulu[],
  sourceHash?: string,
): Promise<BilanVotes> {
  return prisma.$transaction(
    async (tx) => {
      const existants: VoteEnBase[] = await tx.vote.findMany({
        where: { scrutinId },
        select: { id: true, parlementaireId: true, position: true, parDelegation: true },
      });
      const d = differencier(
        existants,
        voulus,
        { existant: (e) => e.parlementaireId, voulu: (v) => v.parlementaireId },
        ['position', 'parDelegation'],
      );

      if (d.aSupprimer.length > 0) {
        await tx.vote.deleteMany({ where: { id: { in: d.aSupprimer.map((e) => e.id) } } });
      }
      for (const groupe of regrouperModifications(d.aModifier)) {
        await tx.vote.updateMany({ where: { id: { in: groupe.ids } }, data: groupe.valeurs });
      }
      if (d.aCreer.length > 0) {
        await tx.vote.createMany({ data: d.aCreer.map((v) => ({ ...v, scrutinId })) });
      }
      if (sourceHash !== undefined) {
        await tx.scrutin.update({ where: { id: scrutinId }, data: { sourceHash } });
      }

      return {
        crees: d.aCreer.length,
        modifies: d.aModifier.length,
        supprimes: d.aSupprimer.length,
        inchanges: d.inchanges,
      };
    },
    // Le défaut de Prisma (5 s) suffit à un scrutin ordinaire ; la marge couvre
    // un scrutin de l'AN entièrement rectifié, écrit sur une base distante.
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/**
 * Regroupe les votes à modifier par valeur cible : une requête par couple
 * (position, délégation) plutôt qu'une par vote. Il n'en existe que huit.
 */
export function regrouperModifications(
  aModifier: Array<{ existant: { id: string }; voulu: VoteVoulu }>,
): Array<{ valeurs: { position: string; parDelegation: boolean }; ids: string[] }> {
  const groupes = new Map<string, { valeurs: { position: string; parDelegation: boolean }; ids: string[] }>();
  for (const { existant, voulu } of aModifier) {
    const k = `${voulu.position}\u0000${voulu.parDelegation}`;
    let g = groupes.get(k);
    if (!g) {
      g = { valeurs: { position: voulu.position, parDelegation: voulu.parDelegation }, ids: [] };
      groupes.set(k, g);
    }
    g.ids.push(existant.id);
  }
  return [...groupes.values()];
}
