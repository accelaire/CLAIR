// =============================================================================
// Fonctions hors de la chambre d'un parlementaire, pour sa fiche IA
// =============================================================================
//
// Postes ministériels (`postes_ministeriels`), présidences de la République
// (`presidences`) et des chambres (`presidences_chambre`), datés et nommés.
// Ils remplacent dans le prompt les lignes GOUVERNEMENT, MINISTERE et PRESREP du
// `source_data` de l'AN : sans portefeuille ni gouvernement, souvent sans date de
// fin (appartenances au gouvernement Bayrou jamais closes, présidence de François
// Hollande rattachée à l'organe de Nicolas Sarkozy), et absentes pour un ministre
// venu du Sénat (SPEC-GOUVERNEMENT §7, étape 2 ; SPEC-BILAN-MINISTRE §14).
// =============================================================================

import type { PrismaClient } from '@prisma/client';

export interface FonctionHorsChambre {
  /** Identifiant source : PM… (poste, présidence de l'AN), PO… (République), SENBUR-… */
  uid: string;
  libelle: string;
  gouvernement: string | null;
  dateDebut: Date;
  dateFin: Date | null;
}

const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Le nom usuel des gouvernements, comme l'API les nomme (`nommerGouvernements`) :
 * le Premier ministre, suivi d'un chiffre romain s'il en a dirigé plusieurs
 * (« Valls II », « Borne »). Le PM est le poste de rang 1 ouvert le premier jour
 * du gouvernement, à défaut le plus ancien.
 */
export function nomsDesGouvernements(
  gouvernements: ReadonlyArray<{
    id: string;
    numero: number;
    dateDebut: Date;
    rangUn: ReadonlyArray<{ acteurUid: string; nom: string; dateDebut: Date; uid: string }>;
  }>,
): Map<string, string> {
  const pm = new Map<string, { acteurUid: string; nom: string } | undefined>();
  for (const g of gouvernements) {
    const tries = [...g.rangUn].sort(
      (a, b) =>
        Number(b.dateDebut.getTime() === g.dateDebut.getTime()) - Number(a.dateDebut.getTime() === g.dateDebut.getTime()) ||
        a.dateDebut.getTime() - b.dateDebut.getTime() ||
        a.uid.localeCompare(b.uid),
    );
    pm.set(g.id, tries[0]);
  }
  const parPM = new Map<string, number>();
  for (const p of pm.values()) if (p) parPM.set(p.acteurUid, (parPM.get(p.acteurUid) ?? 0) + 1);
  const noms = new Map<string, string>();
  for (const g of gouvernements) {
    const p = pm.get(g.id);
    if (!p) continue;
    noms.set(g.id, (parPM.get(p.acteurUid) ?? 0) > 1 ? `${p.nom} ${ROMAINS[g.numero] ?? g.numero}` : p.nom);
  }
  return noms;
}

/**
 * Libellé d'un poste : « Ministre de l'intérieur », « Ministre déléguée auprès
 * du …, chargée de … », « Premier ministre ». La qualité accordée au titulaire
 * et le complément de l'intitulé (`libelleEdition`), à défaut l'intitulé.
 */
export function libellePoste(p: { qualite: string; qualiteAccordee: string | null; intitule: string; intituleComplement: string | null }): string {
  const qualite = p.qualiteAccordee ?? p.qualite;
  if (/^premi(er|ère) ministre$/i.test(qualite)) return qualite;
  return p.intituleComplement ? `${qualite} ${p.intituleComplement}` : `${qualite}, ${p.intitule}`;
}

/** Toutes les fonctions hors chambre des parlementaires qui ont une fiche, par fiche. */
export async function chargerFonctionsHorsChambre(prisma: PrismaClient): Promise<Map<string, FonctionHorsChambre[]>> {
  const [gouvernements, postes, presidences, presidencesChambre] = await Promise.all([
    prisma.gouvernement.findMany({
      select: {
        id: true,
        numero: true,
        dateDebut: true,
        postes: {
          where: { rangProtocolaire: 1 },
          select: { uid: true, dateDebut: true, membre: { select: { acteurUid: true, nom: true } } },
        },
      },
    }),
    prisma.posteMinisteriel.findMany({
      where: { membre: { parlementaireId: { not: null } } },
      select: {
        uid: true, qualite: true, qualiteAccordee: true, intitule: true, intituleComplement: true,
        dateDebut: true, dateFin: true, gouvernementId: true,
        membre: { select: { parlementaireId: true } },
      },
    }),
    prisma.presidence.findMany({
      where: { parlementaireId: { not: null } },
      select: { uid: true, civilite: true, dateDebut: true, dateFin: true, parlementaireId: true },
    }),
    prisma.presidenceChambre.findMany({
      where: { parlementaireId: { not: null } },
      select: { uid: true, chambre: true, dateDebut: true, dateFin: true, parlementaireId: true, parlementaire: { select: { sexe: true } } },
    }),
  ]);

  const noms = nomsDesGouvernements(
    gouvernements.map((g) => ({
      id: g.id,
      numero: g.numero,
      dateDebut: g.dateDebut,
      rangUn: g.postes.map((p) => ({ uid: p.uid, dateDebut: p.dateDebut, acteurUid: p.membre.acteurUid, nom: p.membre.nom })),
    })),
  );

  const parFiche = new Map<string, FonctionHorsChambre[]>();
  const ajouter = (id: string, f: FonctionHorsChambre) => parFiche.set(id, [...(parFiche.get(id) ?? []), f]);
  for (const p of postes) {
    ajouter(p.membre.parlementaireId!, {
      uid: p.uid,
      libelle: libellePoste(p),
      gouvernement: noms.get(p.gouvernementId) ?? null,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
    });
  }
  for (const p of presidences) {
    ajouter(p.parlementaireId!, {
      uid: p.uid,
      libelle: p.civilite === 'Mme' ? 'Présidente de la République' : 'Président de la République',
      gouvernement: null,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
    });
  }
  for (const p of presidencesChambre) {
    const titre = p.parlementaire?.sexe === 'F' ? 'Présidente' : 'Président';
    ajouter(p.parlementaireId!, {
      uid: p.uid,
      libelle: p.chambre === 'senat' ? `${titre} du Sénat` : `${titre} de l'Assemblée nationale`,
      gouvernement: null,
      dateDebut: p.dateDebut,
      dateFin: p.dateFin,
    });
  }
  for (const liste of parFiche.values()) {
    liste.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime() || a.uid.localeCompare(b.uid));
  }
  return parFiche;
}

/** Date civile `YYYY-MM-DD` d'une colonne `@db.Date`. */
export const jourCivil = (d: Date): string => d.toISOString().slice(0, 10);
