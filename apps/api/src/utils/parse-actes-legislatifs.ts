// =============================================================================
// Utilitaire - Parsing des actes législatifs (source_data JSONB)
// =============================================================================

export interface LegislativeStep {
  code: string;
  label: string;
  chambre: 'assemblee' | 'senat' | 'both';
  status: 'done' | 'active' | 'pending';
  outcome:
    | 'adopted'
    | 'adopted_modified'
    | 'adopted_conforme'
    | 'rejected'
    | 'adopted_49_3'
    | 'adopted_definitive'
    | 'cmp_accord'
    | 'cmp_desaccord'
    | 'cc_conforme'
    | 'cc_partiel'
    | 'cc_reserve'
    | null;
  date: string | null;
  detail: string | null;
}

// ---------------------------------------------------------------------------
// Mappings statiques
// ---------------------------------------------------------------------------

const ACTE_CODE_CONFIG: Record<string, { label: string; chambre: 'assemblee' | 'senat' | 'both' }> = {
  AN1:    { label: '1ère lecture AN',            chambre: 'assemblee' },
  SN1:    { label: '1ère lecture Sénat',         chambre: 'senat' },
  AN2:    { label: '2ème lecture AN',            chambre: 'assemblee' },
  SN2:    { label: '2ème lecture Sénat',         chambre: 'senat' },
  CMP:    { label: 'Commission mixte paritaire', chambre: 'both' },
  ANNLEC: { label: 'Nouvelle lecture AN',        chambre: 'assemblee' },
  SNNLEC: { label: 'Nouvelle lecture Sénat',     chambre: 'senat' },
  ANLDEF: { label: 'Lecture définitive',         chambre: 'assemblee' },
  ANLUNI: { label: 'Lecture unique',             chambre: 'assemblee' },
  CC:     { label: 'Conseil constitutionnel',    chambre: 'both' },
  PROM:   { label: 'Promulgation',               chambre: 'both' },
};

const FAM_CODE_OUTCOME: Record<string, LegislativeStep['outcome']> = {
  TSORTF01: 'adopted',
  TSORTF02: 'adopted_modified',
  TSORTF03: 'adopted_conforme',
  TSORTF05: 'adopted_modified',
  TSORTF06: 'adopted_49_3',
  TSORTF07: 'rejected',
  TSORTF18: 'adopted',
  TSORTF19: 'adopted_definitive',
  TSORTF24: 'rejected',
  TCCMP01:  'cmp_accord',
  TCCMP02:  'cmp_desaccord',
  TMRC01:   'rejected',
  TCD01:    'cc_conforme',
  TCD02:    'cc_partiel',
  TCD03:    'cc_reserve',
};

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Normalise un champ acteLegislatif en tableau (peut être un objet ou un tableau). */
function toArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/** Type guard minimal pour un nœud d'acte (objet avec codeActe). */
function isActeNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'codeActe' in value;
}

/** Récupère les enfants d'un nœud (actesLegislatifs.acteLegislatif). */
function getChildren(node: Record<string, unknown>): Record<string, unknown>[] {
  const nested = node['actesLegislatifs'];
  if (!nested || typeof nested !== 'object') return [];
  const inner = (nested as Record<string, unknown>)['acteLegislatif'];
  return toArray(inner).filter(isActeNode);
}

/**
 * Recherche récursive en profondeur d'abord du premier nœud dont le codeActe
 * correspond au prédicat fourni.
 */
function findNodeDeep(
  nodes: Record<string, unknown>[],
  predicate: (code: string) => boolean,
): Record<string, unknown> | null {
  for (const node of nodes) {
    const code = node['codeActe'];
    if (typeof code === 'string' && predicate(code)) {
      return node;
    }
    const found = findNodeDeep(getChildren(node), predicate);
    if (found) return found;
  }
  return null;
}

/** Extrait le fam_code de statutConclusion (retourne null si absent/invalide). */
function getFamCode(node: Record<string, unknown>): string | null {
  const sc = node['statutConclusion'];
  if (!sc || typeof sc !== 'object') return null;
  const famCode = (sc as Record<string, unknown>)['fam_code'];
  if (typeof famCode !== 'string' || famCode === 'TSORTFnull' || famCode === '') return null;
  return famCode;
}

/** Extrait le libellé de statutConclusion avec première lettre capitalisée. */
function getLibelle(node: Record<string, unknown>): string | null {
  const sc = node['statutConclusion'];
  if (!sc || typeof sc !== 'object') return null;
  const libelle = (sc as Record<string, unknown>)['libelle'];
  if (typeof libelle !== 'string' || libelle.trim() === '') return null;
  const trimmed = libelle.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Extrait une date ISO depuis dateActe (retourne null si absent). */
function getDate(node: Record<string, unknown>): string | null {
  const d = node['dateActe'];
  if (typeof d !== 'string' || d.trim() === '') return null;
  return d.trim();
}

// ---------------------------------------------------------------------------
// Logique de décision par type d'étape
// ---------------------------------------------------------------------------

interface DecisionResult {
  outcome: LegislativeStep['outcome'];
  date: string | null;
  detail: string | null;
}

/**
 * Cherche le nœud de décision pour les lectures (AN1, SN1, AN2, SN2, ANNLEC,
 * SNNLEC, ANLDEF) : nœud dont le codeActe se termine par '-DEBATS-DEC'.
 */
function findLectureDecision(
  acte: Record<string, unknown>,
): DecisionResult | null {
  const children = getChildren(acte);
  const decNode = findNodeDeep(children, (c) => c.endsWith('-DEBATS-DEC'));
  if (!decNode) return null;
  const famCode = getFamCode(decNode);
  return {
    outcome: famCode ? (FAM_CODE_OUTCOME[famCode] ?? null) : null,
    date: getDate(decNode),
    detail: getLibelle(decNode),
  };
}

/**
 * ANLUNI : cherche '-DEBATS-DEC' ou '-COM-CAE-DEC' (rejet en commission).
 */
function findAnluniDecision(
  acte: Record<string, unknown>,
): DecisionResult | null {
  const children = getChildren(acte);
  const decNode = findNodeDeep(
    children,
    (c) => c.endsWith('-DEBATS-DEC') || c.endsWith('-COM-CAE-DEC'),
  );
  if (!decNode) return null;
  const famCode = getFamCode(decNode);
  return {
    outcome: famCode ? (FAM_CODE_OUTCOME[famCode] ?? null) : null,
    date: getDate(decNode),
    detail: getLibelle(decNode),
  };
}

/**
 * CMP : cherche 'CMP-DEC'. Les votes CMP-DEBATS-AN-DEC / CMP-DEBATS-SN-DEC
 * sont secondaires ; seule la décision principale est retournée.
 */
function findCmpDecision(
  acte: Record<string, unknown>,
): DecisionResult | null {
  const children = getChildren(acte);
  const decNode = findNodeDeep(children, (c) => c === 'CMP-DEC');
  if (!decNode) return null;
  const famCode = getFamCode(decNode);
  return {
    outcome: famCode ? (FAM_CODE_OUTCOME[famCode] ?? null) : null,
    date: getDate(decNode),
    detail: getLibelle(decNode),
  };
}

/**
 * CC : cherche 'CC-CONCLUSION'.
 */
function findCcDecision(
  acte: Record<string, unknown>,
): DecisionResult | null {
  const children = getChildren(acte);
  const decNode = findNodeDeep(children, (c) => c === 'CC-CONCLUSION');
  if (!decNode) return null;
  const famCode = getFamCode(decNode);
  return {
    outcome: famCode ? (FAM_CODE_OUTCOME[famCode] ?? null) : null,
    date: getDate(decNode),
    detail: getLibelle(decNode),
  };
}

// ---------------------------------------------------------------------------
// Étape de dépôt
// ---------------------------------------------------------------------------

/** Détermine la chambre de dépôt depuis le code d'acte parent. */
function depotChambre(parentCode: string): 'assemblee' | 'senat' | 'both' {
  if (parentCode.startsWith('SN')) return 'senat';
  if (parentCode.startsWith('AN')) return 'assemblee';
  return 'both';
}

/**
 * Cherche le premier nœud DEPOT (codeActe contient 'DEPOT' et dateActe non
 * null) dans l'ensemble des actes de premier niveau.
 * Retourne le nœud trouvé et le code de son parent.
 */
function findDepotNode(
  topLevel: Record<string, unknown>[],
): { node: Record<string, unknown>; parentCode: string } | null {
  for (const acte of topLevel) {
    const parentCode = typeof acte['codeActe'] === 'string' ? acte['codeActe'] : '';
    const children = getChildren(acte);
    // Chercher dans les enfants directs et récursivement
    const depot = findNodeDeep(
      children,
      (c) => c.includes('DEPOT'),
    );
    if (depot && getDate(depot) !== null) {
      return { node: depot, parentCode };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parsing principal
// ---------------------------------------------------------------------------

export interface ParseMeta {
  etat?: string | null;
  loiDateJO?: Date | string | null;
}

export function parseActesLegislatifs(sourceData: unknown, meta?: ParseMeta): LegislativeStep[] {
  // Validation de l'entrée
  if (!sourceData || typeof sourceData !== 'object') return [];

  const root = sourceData as Record<string, unknown>;
  const actesLegislatifs = root['actesLegislatifs'];
  if (!actesLegislatifs || typeof actesLegislatifs !== 'object') return [];

  const acteLegislatifRaw = (actesLegislatifs as Record<string, unknown>)['acteLegislatif'];
  if (!acteLegislatifRaw) return [];

  const topLevel = toArray(acteLegislatifRaw).filter(isActeNode);
  if (topLevel.length === 0) return [];

  const steps: LegislativeStep[] = [];

  // --- Étape de dépôt ---
  const depotResult = findDepotNode(topLevel);
  if (depotResult) {
    steps.push({
      code: 'DEPOT',
      label: 'Dépôt',
      chambre: depotChambre(depotResult.parentCode),
      status: 'done',
      outcome: null,
      date: getDate(depotResult.node),
      detail: null,
    });
  }

  // --- Étapes législatives ---
  for (const acte of topLevel) {
    const code = acte['codeActe'];
    if (typeof code !== 'string') continue;

    const config = ACTE_CODE_CONFIG[code];
    if (!config) continue;

    // PROM : cas spécial, pas de nœud de décision enfant
    if (code === 'PROM') {
      steps.push({
        code,
        label: config.label,
        chambre: config.chambre,
        status: 'done',
        outcome: null,
        date: getDate(acte),
        detail: null,
      });
      continue;
    }

    // Trouver la décision selon le type d'étape
    let decision: DecisionResult | null = null;

    if (code === 'CMP') {
      decision = findCmpDecision(acte);
    } else if (code === 'CC') {
      decision = findCcDecision(acte);
    } else if (code === 'ANLUNI') {
      decision = findAnluniDecision(acte);
    } else {
      // Lectures : AN1, SN1, AN2, SN2, ANNLEC, SNNLEC, ANLDEF
      decision = findLectureDecision(acte);
    }

    // Déterminer le statut
    let status: LegislativeStep['status'];
    if (decision) {
      status = 'done';
    } else {
      // Vérifier si des enfants existent (acte en cours)
      const children = getChildren(acte);
      status = children.length > 0 ? 'active' : 'pending';
    }

    steps.push({
      code,
      label: config.label,
      chambre: config.chambre,
      status,
      outcome: decision?.outcome ?? null,
      date: decision?.date ?? null,
      detail: decision?.detail ?? null,
    });
  }

  // Tri chronologique (null dates en dernier pour une position donnée)
  steps.sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });

  return addForwardLookingSteps(steps, meta);
}

// ---------------------------------------------------------------------------
// Étapes prospectives (ce qui vient logiquement après les données connues)
// ---------------------------------------------------------------------------

function pending(code: string, label: string, chambre: LegislativeStep['chambre']): LegislativeStep {
  return { code, label, chambre, status: 'pending', outcome: null, date: null, detail: null };
}

/**
 * Ajoute des étapes "pending" pour signaler la suite logique du parcours
 * quand le processus n'est pas encore terminé.
 */
function addForwardLookingSteps(steps: LegislativeStep[], meta?: ParseMeta): LegislativeStep[] {
  const isPromulgated = meta?.etat === 'promulgue';

  // Si déjà promulgué dans les données, rien à ajouter
  if (steps.some(s => s.code === 'PROM')) return steps;

  // Le dossier est promulgué mais PROM absent de source_data : ajouter step done
  if (isPromulgated) {
    const loiDateJO = meta?.loiDateJO;
    const date = loiDateJO instanceof Date
      ? loiDateJO.toISOString()
      : (typeof loiDateJO === 'string' ? loiDateJO : null);
    return [...steps, { code: 'PROM', label: 'Promulgation', chambre: 'both', status: 'done', outcome: null, date, detail: null }];
  }

  // Rejet définitif : dernière étape faite est rejetée ET aucun acte actif après
  const hasActive = steps.some(s => s.status === 'active');
  const lastDone = [...steps].reverse().find(s => s.status === 'done');
  if (lastDone?.outcome === 'rejected' && !hasActive) return steps;

  const result = [...steps];
  const codes = new Set(steps.map(s => s.code));

  // Lecture unique adoptée → direct promulgation
  if (codes.has('ANLUNI') && !codes.has('PROM')) {
    result.push(pending('PROM', 'Promulgation', 'both'));
    return result;
  }

  // AN1 terminée (non-conforme, non-rejetée) sans SN1 → ajouter SN1 + PROM
  const an1 = steps.find(s => s.code === 'AN1');
  if (an1?.status === 'done' && !codes.has('SN1') && an1.outcome !== 'adopted_conforme' && an1.outcome !== 'rejected') {
    result.push(pending('SN1', '1ère lecture Sénat', 'senat'));
    result.push(pending('PROM', 'Promulgation', 'both'));
    return result;
  }

  // SN1 terminée (non-conforme, non-rejetée) sans AN1 → ajouter AN1 + PROM
  const sn1 = steps.find(s => s.code === 'SN1');
  if (sn1?.status === 'done' && !codes.has('AN1') && sn1.outcome !== 'adopted_conforme' && sn1.outcome !== 'rejected') {
    result.push(pending('AN1', '1ère lecture AN', 'assemblee'));
    result.push(pending('PROM', 'Promulgation', 'both'));
    return result;
  }

  // Cas général : ajouter au moins Promulgation en attente
  result.push(pending('PROM', 'Promulgation', 'both'));
  return result;
}
