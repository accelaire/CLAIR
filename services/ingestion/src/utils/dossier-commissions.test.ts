import { describe, it, expect } from 'vitest';
import { extractCommissionSaisines } from './dossier-commissions';

describe('extractCommissionSaisines', () => {
  const makeDossier = (actes: unknown) => ({
    actesLegislatifs: actes,
  });

  it('returns [] for null/undefined sourceData', () => {
    expect(extractCommissionSaisines(null)).toEqual([]);
    expect(extractCommissionSaisines(undefined)).toEqual([]);
    expect(extractCommissionSaisines({})).toEqual([]);
    expect(extractCommissionSaisines({ actesLegislatifs: null })).toEqual([]);
  });

  it('handles acteLegislatif as single object (1 étape)', () => {
    const dossier = makeDossier({
      acteLegislatif: {
        codeActe: 'AN1',
        actesLegislatifs: {
          acteLegislatif: {
            codeActe: 'AN1-COM-FOND',
            organeRef: 'PO420120',
          },
        },
      },
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([{ organeRef: 'PO420120', role: 'fond' }]);
  });

  it('handles acteLegislatif as array (multi-étapes)', () => {
    const dossier = makeDossier({
      acteLegislatif: [
        {
          codeActe: 'AN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'AN1-COM-FOND',
              organeRef: 'PO420120',
            },
          },
        },
        {
          codeActe: 'SN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'SN1-COM-FOND',
              organeRef: 'PO211493',
            },
          },
        },
      ],
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
      { organeRef: 'PO211493', role: 'fond' },
    ]);
  });

  it('extracts COM-FOND and COM-AVIS from the same dossier', () => {
    const dossier = makeDossier({
      acteLegislatif: {
        codeActe: 'AN1',
        actesLegislatifs: {
          acteLegislatif: [
            {
              codeActe: 'AN1-COM-FOND',
              organeRef: 'PO420120',
            },
            {
              codeActe: 'AN1-COM-AVIS',
              organeRef: 'PO59048',
            },
          ],
        },
      },
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
      { organeRef: 'PO59048', role: 'avis' },
    ]);
  });

  it('ignores COM-FOND without organeRef', () => {
    const dossier = makeDossier({
      acteLegislatif: {
        codeActe: 'AN1',
        actesLegislatifs: {
          acteLegislatif: {
            codeActe: 'AN1-COM-FOND',
          },
        },
      },
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([]);
  });

  it('does NOT extract sub-acts (COM-FOND-SAISIE, COM-FOND-NOMIN, etc.)', () => {
    const dossier = makeDossier({
      acteLegislatif: {
        codeActe: 'AN1',
        actesLegislatifs: {
          acteLegislatif: [
            {
              codeActe: 'AN1-COM-FOND',
              organeRef: 'PO420120',
              actesLegislatifs: {
                acteLegislatif: [
                  { codeActe: 'AN1-COM-FOND-SAISIE', organeRef: 'PO420120' },
                  { codeActe: 'AN1-COM-FOND-NOMIN', organeRef: 'PO420120' },
                  { codeActe: 'AN1-COM-FOND-REUNION', organeRef: 'PO420120' },
                  { codeActe: 'AN1-COM-FOND-RAPPORT', organeRef: 'PO420120' },
                ],
              },
            },
            {
              codeActe: 'AN1-COM-AVIS',
              organeRef: 'PO59048',
              actesLegislatifs: {
                acteLegislatif: [
                  { codeActe: 'AN1-COM-AVIS-SAISIE', organeRef: 'PO59048' },
                  { codeActe: 'AN1-COM-AVIS-NOMIN', organeRef: 'PO59048' },
                ],
              },
            },
          ],
        },
      },
    });
    const result = extractCommissionSaisines(dossier);
    // Only the COM-FOND and COM-AVIS, not their sub-acts
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
      { organeRef: 'PO59048', role: 'avis' },
    ]);
  });

  it('handles deeply nested multi-navette structure', () => {
    // Realistic: AN1 -> COM (fond + avis), then SN1 -> COM (fond)
    const dossier = makeDossier({
      acteLegislatif: [
        {
          codeActe: 'AN1',
          actesLegislatifs: {
            acteLegislatif: [
              {
                codeActe: 'AN1-COM',
                actesLegislatifs: {
                  acteLegislatif: [
                    {
                      codeActe: 'AN1-COM-FOND',
                      organeRef: 'PO420120',
                      actesLegislatifs: {
                        acteLegislatif: [
                          { codeActe: 'AN1-COM-FOND-SAISIE', organeRef: 'PO420120' },
                          { codeActe: 'AN1-COM-FOND-NOMIN' },
                          { codeActe: 'AN1-COM-FOND-RAPPORT' },
                        ],
                      },
                    },
                    {
                      codeActe: 'AN1-COM-AVIS',
                      organeRef: 'PO59048',
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          codeActe: 'SN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'SN1-COM-FOND',
              organeRef: 'PO211493',
            },
          },
        },
      ],
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
      { organeRef: 'PO59048', role: 'avis' },
      { organeRef: 'PO211493', role: 'fond' },
    ]);
  });

  it('deduplicates identical entries across navettes', () => {
    const dossier = makeDossier({
      acteLegislatif: [
        {
          codeActe: 'AN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'AN1-COM-FOND',
              organeRef: 'PO420120',
            },
          },
        },
        {
          codeActe: 'AN2',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'AN2-COM-FOND',
              organeRef: 'PO420120',
            },
          },
        },
      ],
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
    ]);
  });

  it('keeps same commission with different roles', () => {
    const dossier = makeDossier({
      acteLegislatif: [
        {
          codeActe: 'AN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'AN1-COM-FOND',
              organeRef: 'PO420120',
            },
          },
        },
        {
          codeActe: 'SN1',
          actesLegislatifs: {
            acteLegislatif: {
              codeActe: 'SN1-COM-AVIS',
              organeRef: 'PO420120',
            },
          },
        },
      ],
    });
    const result = extractCommissionSaisines(dossier);
    expect(result).toEqual([
      { organeRef: 'PO420120', role: 'fond' },
      { organeRef: 'PO420120', role: 'avis' },
    ]);
  });
});
