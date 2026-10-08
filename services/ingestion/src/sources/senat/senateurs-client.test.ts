import { describe, it, expect } from 'vitest';
import { commissionPermanenteDe, type SenatOrganisme } from './senateurs-client';

const AFEU: SenatOrganisme = { code: 'COMEUR-AFEU', type: 'COMMISSION', libelle: 'Commission des affaires européennes', ordre: 7101 };
const CAE: SenatOrganisme = { code: 'COM-CAE', type: 'COMMISSION', libelle: 'Commission des affaires économiques', ordre: 7002 };
const BUR: SenatOrganisme = { code: 'BUR', type: 'INTERNE', libelle: 'Bureau du Sénat', ordre: 1 };

describe('commissionPermanenteDe', () => {
  it('ignore la commission des affaires européennes, même listée en premier', () => {
    expect(commissionPermanenteDe([AFEU, CAE])?.code).toBe('COM-CAE');
    expect(commissionPermanenteDe([CAE, AFEU])?.code).toBe('COM-CAE');
  });

  it('ignore les organismes qui ne sont pas des commissions', () => {
    expect(commissionPermanenteDe([BUR, CAE])?.code).toBe('COM-CAE');
  });

  it("ne rend rien sans commission permanente (président du Sénat, AFEU seule)", () => {
    expect(commissionPermanenteDe([AFEU])).toBeUndefined();
    expect(commissionPermanenteDe([])).toBeUndefined();
    expect(commissionPermanenteDe(undefined)).toBeUndefined();
  });
});
