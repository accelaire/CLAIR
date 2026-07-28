// =============================================================================
// Tests unitaires - Groupe d'époque (CTE de majorité de groupe)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { CTE_GROUP_MAJORITY_EPOQUE, joinMandatEpoque } from './groupe-epoque';

const PARLEMENTAIRE = 'ac08f258-d040-4a0b-93c0-ebbe55dc9aec';
const GROUPE = '4a306451-bd1f-4879-b9d1-56cc19bdd862';

/** Compresse les espaces pour comparer du SQL sans dépendre de l'indentation. */
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('CTE_GROUP_MAJORITY_EPOQUE', () => {
  it('rejette un identifiant qui n’est pas un UUID', () => {
    expect(() => CTE_GROUP_MAJORITY_EPOQUE("'; DROP TABLE votes; --", GROUPE)).toThrow(
      /UUID attendu/,
    );
    expect(() => CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, 'not-a-uuid')).toThrow(/UUID attendu/);
  });

  it('interpole les deux identifiants dans la CTE', () => {
    const sql = CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE);
    expect(sql).toContain(`mv.parlementaire_id = '${PARLEMENTAIRE}'`);
    expect(sql).toContain(`COALESCE(mm.groupe_id, '${GROUPE}')`);
  });

  it('n’utilise aucun paramètre $n, pour ne pas décaler ceux de l’appelant', () => {
    const sql = CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE);
    expect(sql).not.toMatch(/\$\d/);
  });

  it('exclut les absents du calcul de la majorité', () => {
    expect(norm(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE))).toContain(
      "gv.position != 'absent'",
    );
  });

  // ---------------------------------------------------------------------------
  // Ex æquo → pas de majorité
  // ---------------------------------------------------------------------------

  it('annule la majorité quand plusieurs positions sont ex æquo en tête', () => {
    const sql = norm(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE));
    // Le compte des positions à égalité avec le maximum…
    expect(sql).toContain('COUNT(*) FILTER (WHERE nb = nb_max) OVER (PARTITION BY scrutin_id)');
    // …et la bascule vers NULL dès qu’il y en a plus d’une.
    expect(sql).toContain('CASE WHEN nb_ex_aequo = 1 THEN position END as majority_position');
  });

  it('ordonne le classement de façon déterministe (départage par position)', () => {
    // Sans second critère, deux exécutions du même SQL peuvent désigner des
    // gagnants différents : c’est ce qui faisait vaciller le badge « dissident ».
    expect(norm(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE))).toContain(
      'ROW_NUMBER() OVER (PARTITION BY scrutin_id ORDER BY nb DESC, position ASC) as rn',
    );
  });

  it('expose toujours une ligne rn = 1 par scrutin, majorité ou non', () => {
    const sql = norm(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE));
    // Le NULL est porté par la valeur, pas par l’absence de ligne : les
    // appelants joignent en LEFT JOIN ... AND gm.rn = 1.
    expect(sql).toContain('rn FROM (');
  });

  // ---------------------------------------------------------------------------
  // Restriction à la page
  // ---------------------------------------------------------------------------

  it('ne restreint rien par défaut', () => {
    expect(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE)).not.toContain('IN (SELECT');
  });

  it('restreint le calcul aux scrutins de la sous-requête fournie', () => {
    const sql = CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE, {
      scrutinIdsSubquery: 'SELECT scrutin_id FROM page',
    });
    expect(sql).toContain('AND gv.scrutin_id IN (SELECT scrutin_id FROM page)');
  });

  it('ne change que le périmètre, pas la logique d’agrégation', () => {
    const complet = norm(CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE));
    const borne = norm(
      CTE_GROUP_MAJORITY_EPOQUE(PARLEMENTAIRE, GROUPE, {
        scrutinIdsSubquery: 'SELECT scrutin_id FROM page',
      }),
    );
    expect(borne.replace(' AND gv.scrutin_id IN (SELECT scrutin_id FROM page)', '')).toBe(complet);
  });
});

describe('joinMandatEpoque', () => {
  it('joint sur la législature à l’Assemblée et sur l’intervalle de dates au Sénat', () => {
    const sql = norm(joinMandatEpoque('v', 's', 'm'));
    expect(sql).toContain("s.chambre = 'assemblee' AND s.legislature IS NOT NULL");
    expect(sql).toContain('m.legislature = s.legislature');
    expect(sql).toContain("s.chambre = 'senat' AND m.date_debut <= s.date");
    expect(sql).toContain('m.date_fin IS NULL OR m.date_fin >= s.date');
  });

  it('reste un LEFT JOIN, pour que le repli sur le groupe courant fonctionne', () => {
    expect(norm(joinMandatEpoque('v', 's', 'm'))).toMatch(/^LEFT JOIN/);
  });

  it('permet deux jointures indépendantes dans la même requête', () => {
    const votant = joinMandatEpoque('gv', 'gs', 'gm');
    const etudie = joinMandatEpoque('mv', 'gs', 'mm');
    expect(votant).not.toBe(etudie);
    expect(norm(votant)).toContain('gm.personne_id = gv.parlementaire_id');
    expect(norm(etudie)).toContain('mm.personne_id = mv.parlementaire_id');
  });
});
