// =============================================================================
// Tests unitaires - Configuration des sources
// =============================================================================

import { describe, it, expect } from 'vitest';
import { SOURCES, SourceConfig } from './source-freshness';

describe('SOURCES Configuration', () => {
  describe('Assemblée Nationale', () => {
    it('devrait avoir une configuration pour les députés', () => {
      const config = SOURCES['assemblee_nationale:deputes']!;
      expect(config).toBeDefined();
      expect(config.source).toBe('assemblee_nationale');
      expect(config.dataType).toBe('deputes');
      expect(config.url).toContain('assemblee-nationale.fr');
      expect(config.url).toContain('.zip');
    });

    it('devrait avoir une configuration pour les scrutins', () => {
      const config = SOURCES['assemblee_nationale:scrutins']!;
      expect(config).toBeDefined();
      expect(config.source).toBe('assemblee_nationale');
      expect(config.dataType).toBe('scrutins');
      expect(config.url).toContain('Scrutins.json.zip');
    });

    it('devrait avoir une configuration pour les amendements', () => {
      const config = SOURCES['assemblee_nationale:amendements']!;
      expect(config).toBeDefined();
      expect(config.dataType).toBe('amendements');
    });

    it('devrait avoir une configuration pour les dossiers', () => {
      const config = SOURCES['assemblee_nationale:dossiers']!;
      expect(config).toBeDefined();
      expect(config.dataType).toBe('dossiers');
    });
  });

  describe('Sénat', () => {
    it('devrait avoir une configuration pour les sénateurs', () => {
      const config = SOURCES['senat:senateurs']!;
      expect(config).toBeDefined();
      expect(config.source).toBe('senat');
      expect(config.dataType).toBe('senateurs');
      expect(config.url).toContain('senat.fr');
    });

    it('devrait avoir une configuration pour les scrutins', () => {
      const config = SOURCES['senat:scrutins']!;
      expect(config).toBeDefined();
      expect(config.dataType).toBe('scrutins');
    });

    it('devrait avoir une configuration pour les amendements', () => {
      const config = SOURCES['senat:amendements']!;
      expect(config).toBeDefined();
      expect(config.url).toContain('ameli.zip');
    });

    it('devrait avoir une configuration pour les interventions', () => {
      const config = SOURCES['senat:interventions']!;
      expect(config).toBeDefined();
      expect(config.url).toContain('cri.zip');
    });
  });

  describe('DILA', () => {
    it('devrait avoir une configuration pour les interventions', () => {
      const config = SOURCES['dila:interventions']!;
      expect(config).toBeDefined();
      expect(config.source).toBe('dila');
      expect(config.dataType).toBe('interventions');
      expect(config.url).toContain('echanges.dila.gouv.fr');
    });

    it("devrait utiliser l'année courante dans l'URL", () => {
      const config = SOURCES['dila:interventions']!;
      const currentYear = new Date().getFullYear();
      expect(config.url).toContain(currentYear.toString());
    });
  });

  describe('HATVP', () => {
    it('devrait avoir une configuration pour les lobbyistes', () => {
      const config = SOURCES['hatvp:lobbyistes']!;
      expect(config).toBeDefined();
      expect(config.source).toBe('hatvp');
      expect(config.dataType).toBe('lobbyistes');
      expect(config.url).toContain('hatvp.fr');
    });
  });

  describe('Validation des URLs', () => {
    it('toutes les URLs devraient être valides', () => {
      for (const [, config] of Object.entries(SOURCES)) {
        expect(() => new URL(config.url)).not.toThrow();
      }
    });

    it('toutes les sources devraient avoir les champs requis', () => {
      const requiredFields: (keyof SourceConfig)[] = ['source', 'dataType', 'url'];

      for (const [, config] of Object.entries(SOURCES)) {
        for (const field of requiredFields) {
          expect(config[field]).toBeDefined();
          expect(config[field]).not.toBe('');
        }
      }
    });
  });

  describe('Sources sans signal de fraîcheur', () => {
    it('devrait marquer les réunions Sénat en sync systématique', () => {
      // Le Sénat renvoie 403 sur le listing du répertoire des comptes rendus :
      // sans ce drapeau, le check échouait chaque nuit en ERROR pour retomber
      // malgré tout sur un sync complet.
      expect(SOURCES['senat:reunions']!.alwaysSync).toBe(true);
    });

    it('ne devrait pas marquer les sources qui exposent ETag/Last-Modified', () => {
      expect(SOURCES['assemblee_nationale:scrutins']!.alwaysSync).toBeUndefined();
      expect(SOURCES['senat:dossiers']!.alwaysSync).toBeUndefined();
    });
  });

  describe('Exhaustivité', () => {
    it('devrait avoir au moins 8 sources configurées', () => {
      const sourceCount = Object.keys(SOURCES).length;
      expect(sourceCount).toBeGreaterThanOrEqual(8);
    });

    it('devrait couvrir les 4 providers principaux', () => {
      const providers = new Set(Object.values(SOURCES).map((c) => c.source));
      expect(providers).toContain('assemblee_nationale');
      expect(providers).toContain('senat');
      expect(providers).toContain('dila');
      expect(providers).toContain('hatvp');
    });
  });
});
