import { describe, it, expect } from 'vitest';
import { classifyNatureScrutin, NATURES_SCRUTIN } from './nature-scrutin';

// Tous les libellés ci-dessous sont copiés tels quels depuis la base de
// production (21 731 scrutins), coquilles de saisie comprises.

describe('classifyNatureScrutin', () => {
  describe('amendements', () => {
    it('reconnaît un amendement AN', () => {
      expect(
        classifyNatureScrutin(
          "l'amendement n° 212 de Mme Santiago à l'article 2 de la proposition de loi renforçant la protection des mineurs victimes de violences sexuelles (première lecture).",
        ),
      ).toBe('amendement');
    });

    it('reconnaît un amendement Sénat malgré le préfixe « sur »', () => {
      expect(
        classifyNatureScrutin(
          "sur l'amendement n° 37 rectifié, présenté par M. Jacques Grosperrin et plusieurs de ses collègues, à l'article 5 du projet de loi relatif à la régulation de l'enseignement supérieur privé",
        ),
      ).toBe('amendement');
    });

    it('classe un sous-amendement comme un amendement', () => {
      expect(
        classifyNatureScrutin(
          "le sous-amendement n° 82 de M. Rancoule à l'amendement n° 75 rectifié de M. Grelier",
        ),
      ).toBe('amendement');
    });

    it('reconnaît les amendements identiques et les quantièmes', () => {
      expect(
        classifyNatureScrutin(
          "sur les quatre amendements n° 330, n° 499, n° 645 et n° 967, à l'article 12 du projet de loi",
        ),
      ).toBe('amendement');
      expect(
        classifyNatureScrutin(
          "l'amendement de suppression n° 1223 de M. Di Filippo et les amendements identiques suivants à l'article 19 du projet de loi de finances pour 2026 (première lecture).",
        ),
      ).toBe('amendement');
    });

    it('suit le renvoi partitif vers l’amendement visé', () => {
      // Le vote porte sur un fragment d'amendement : la nature reste l'amendement.
      expect(
        classifyNatureScrutin(
          "sur le III de l'amendement n° 1180 rectifié bis, présenté par le Gouvernement, à l'article 6 du projet de loi",
        ),
      ).toBe('amendement');
      expect(
        classifyNatureScrutin(
          "sur le I de l'amendement n° 101, présenté par le Gouvernement, à l'article 1er du projet de loi relatif au statut de Paris",
        ),
      ).toBe('amendement');
    });

    it('absorbe les coquilles de saisie des sources', () => {
      // Espace parasite après l'apostrophe (Sénat).
      expect(
        classifyNatureScrutin("sur l' amendement n° 82, présenté par M. Didier Guillaume"),
      ).toBe('amendement');
      // « qur » pour « sur » (Sénat).
      expect(
        classifyNatureScrutin("qur l'amendement n° 365 rectifié, présenté par M. Yvon Collin"),
      ).toBe('amendement');
      // « sous-amendmeent » et « amenedement » (AN).
      expect(
        classifyNatureScrutin(
          "le sous-amendmeent n° 196 de M. Léaument à l'amendement n° 109 de M. Boudié",
        ),
      ).toBe('amendement');
      expect(
        classifyNatureScrutin("l'amenedement n° 187 de M. Renault à l'article 35"),
      ).toBe('amendement');
    });
  });

  describe('articles', () => {
    it('reconnaît un article numéroté, premier ou unique', () => {
      expect(classifyNatureScrutin("l'article 9 de la proposition de loi relative au droit à l'aide à mourir (première lecture).")).toBe('article');
      expect(classifyNatureScrutin("l'article premier de la proposition de loi visant à renforcer la stabilité économique")).toBe('article');
      expect(classifyNatureScrutin("l'article unique de la proposition de résolution")).toBe('article');
    });

    it('suit le renvoi partitif vers l’article visé', () => {
      expect(
        classifyNatureScrutin("sur le paragraphe II bis de l'article 22 bis du projet de loi"),
      ).toBe('article');
    });

    it('absorbe la coquille « aticle »', () => {
      expect(
        classifyNatureScrutin("l'aticle 6 du projet de loi sur la justice criminelle et le respect des victimes (première lecture)."),
      ).toBe('article');
    });

    it("traite l'article unique constituant l'ensemble comme un vote final", () => {
      // Un texte à article unique : l'intitulé dit lui-même que c'est le vote
      // sur l'ensemble, pas un vote d'article parmi d'autres.
      expect(
        classifyNatureScrutin("sur l'article unique constituant l'ensemble de la proposition de loi"),
      ).toBe('ensemble');
    });
  });

  describe('ensemble du texte', () => {
    it('reconnaît un vote sur l’ensemble', () => {
      expect(classifyNatureScrutin("l'ensemble du projet de loi de finances rectificative pour 2021 (première lecture).")).toBe('ensemble');
      expect(classifyNatureScrutin("sur l'ensemble de la proposition de loi visant à remobiliser le bâti rural")).toBe('ensemble');
    });

    it('reconnaît le texte de CMP et les conclusions de commission', () => {
      expect(classifyNatureScrutin("sur le texte élaboré par la commission mixte paritaire sur le projet de loi organique")).toBe('ensemble');
      expect(classifyNatureScrutin("sur les conclusions négatives de la commission des affaires sociales sur la proposition de loi")).toBe('ensemble');
      expect(classifyNatureScrutin("les conclusions de rejet de la commission des lois de la proposition de résolution")).toBe('ensemble');
    });

    it('reconnaît les parties de loi de finances et les résolutions', () => {
      expect(classifyNatureScrutin('la première partie du projet de loi de finances pour 2026 (première lecture).')).toBe('ensemble');
      expect(classifyNatureScrutin("sur la troisième partie du projet de loi de financement de la sécurité sociale")).toBe('ensemble');
      expect(classifyNatureScrutin("la proposition de résolution visant à lutter contre la disparition des abeilles (art. 34-1 de la Constitution)")).toBe('ensemble');
    });
  });

  describe('motions et procédure', () => {
    it('reconnaît les motions de censure et de rejet préalable', () => {
      expect(classifyNatureScrutin("la motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par M. Boris Vallaud et 65 députés.")).toBe('motion');
      expect(classifyNatureScrutin("la motion de rejet préalable, déposée par Mme Mathilde Panot, du projet de loi relatif à l'organisation des jeux Olympiques")).toBe('motion');
    });

    it("reconnaît question préalable, exception d'irrecevabilité et seconde délibération", () => {
      expect(classifyNatureScrutin("sur la motion n° 944, présentée par Mme Cathy Apourceau-Poly, tendant à opposer la question préalable au projet de loi de financement de la sécurité sociale pour 2024")).toBe('motion');
      expect(classifyNatureScrutin("Sur la motion n° 4, présentée par Mme Joëlle GARRIAUD-MAYLAM tendant à opposer l'exception d'irrecevabilité")).toBe('motion');
      expect(classifyNatureScrutin("sur la demande de seconde délibération, présentée par le Gouvernement, de l'article 1er de la proposition de loi")).toBe('motion');
    });

    it('rattrape une motion annoncée après des conclusions de commission', () => {
      // Sans le repêchage global, ce libellé tomberait dans « ensemble ».
      expect(
        classifyNatureScrutin("sur les conclusions de la commission des affaires économiques sur la motion, présentée par M. J"),
      ).toBe('motion');
    });

    it('ne confond pas « promotion » avec « motion »', () => {
      // Le repêchage global est borné aux mots entiers : sans cela, tout
      // amendement à une loi « de promotion de… » basculerait en motion.
      expect(
        classifyNatureScrutin("l'ensemble de la proposition de loi relative à la promotion de la santé scolaire"),
      ).toBe('ensemble');
    });
  });

  describe('crédits budgétaires et déclarations', () => {
    it('reconnaît les crédits de mission', () => {
      expect(classifyNatureScrutin("les crédits de la mission Défense à l'article 20 et État B de la seconde partie du projet de loi de finances")).toBe('credits');
      expect(classifyNatureScrutin("sur les crédits de la mission « Outre-mer » figurant à l'état B du projet de loi de finances pour 2026")).toBe('credits');
    });

    it('reconnaît les déclarations du Gouvernement', () => {
      expect(classifyNatureScrutin("la déclaration du Gouvernement relative à la programmation militaire (application de l'article 50-1 de la Constitution)")).toBe('declaration');
      expect(classifyNatureScrutin("la déclaration de politique générale du Gouvernement de M. Édouard Philippe (application de l'article 49)")).toBe('declaration');
      expect(classifyNatureScrutin("sur la demande d'approbation de la déclaration de politique générale du Gouvernement formulée par Monsieur le Premier ministre")).toBe('declaration');
    });

    it("reconnaît les autorisations d'intervention des forces armées (art. 35)", () => {
      expect(classifyNatureScrutin("sur l'autorisation de la prolongation de l'intervention des forces armées au Kosovo")).toBe('declaration');
      expect(classifyNatureScrutin("sur la demande du Gouvernement d'autorisation de prolongation de l'engagement des forces aériennes")).toBe('declaration');
    });
  });

  describe('repli « autre »', () => {
    it('range la procédure de séance dans « autre »', () => {
      expect(classifyNatureScrutin("la demande de suspension de séance présentée par M. Lachaud (article 58 du Règlement de l'Assemblée nationale).")).toBe('autre');
      expect(classifyNatureScrutin("sur la modification de l'ordre du jour du mardi 9 novembre 2010")).toBe('autre');
      expect(classifyNatureScrutin("sur les conclusions de la Conférence des Présidents réunie le 28 juin 2012")).toBe('autre');
      expect(classifyNatureScrutin("la demande de constitution de commission spéciale pour l'examen de la proposition de loi")).toBe('autre');
    });

    it('ne jette jamais sur une entrée absente ou vide', () => {
      expect(classifyNatureScrutin(null)).toBe('autre');
      expect(classifyNatureScrutin(undefined)).toBe('autre');
      expect(classifyNatureScrutin('   ')).toBe('autre');
      expect(classifyNatureScrutin('')).toBe('autre');
    });

    it("bascule sur le titre quand l'objet est absent", () => {
      // Le Sénat renseigne les deux à l'identique, mais l'AN laisse parfois
      // objet.libelle vide sur les scrutins anciens.
      expect(classifyNatureScrutin(null, "l'ensemble du projet de loi de finances pour 2026")).toBe('ensemble');
      expect(classifyNatureScrutin('', "l'amendement n° 12 de M. Dupont")).toBe('amendement');
    });

    it('retourne toujours une nature déclarée', () => {
      const echantillon = [
        "l'amendement n° 1",
        "l'article 2",
        "l'ensemble du projet de loi",
        'la motion de censure',
        'les crédits de la mission Défense',
        'la déclaration du Gouvernement',
        'un libellé totalement imprévu',
      ];
      for (const libelle of echantillon) {
        expect(NATURES_SCRUTIN).toContain(classifyNatureScrutin(libelle));
      }
    });
  });
});
