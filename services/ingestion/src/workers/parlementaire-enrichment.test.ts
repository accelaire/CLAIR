import { describe, it, expect } from 'vitest';
import { miseAJourMandatEnrichi } from './parlementaire-enrichment';

// Organe de F. Boccaletti tel que le gardait le snapshot AMO10 de sa fiche
// après son départ de l'Assemblée, le 10/11/2026.
const commission = {
  typeOrgane: 'COMPER',
  institution: 'Commission permanente',
  qualite: 'Membre',
  dateDebut: '2024-07-20',
  sourceUid: 'PM846159',
  organeRef: 'PO59046',
};

describe('miseAJourMandatEnrichi', () => {
  it('ne rouvre pas un mandat que la source donne sans date de fin', () => {
    expect(miseAJourMandatEnrichi({ ...commission, dateFin: null })).not.toHaveProperty('dateFin');
    expect(miseAJourMandatEnrichi(commission)).not.toHaveProperty('dateFin');
  });

  it('écrit la date de fin que la source publie', () => {
    expect(miseAJourMandatEnrichi({ ...commission, dateFin: '2026-11-10' }).dateFin).toEqual(new Date('2026-11-10'));
  });
});
