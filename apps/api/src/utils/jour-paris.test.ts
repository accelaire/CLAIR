import { describe, expect, it } from 'vitest';
import { debutDuJourAParis } from './jour-paris';

describe('debutDuJourAParis', () => {
  it('heure d’hiver : minuit à Paris = 23 h UTC la veille', () => {
    expect(debutDuJourAParis(new Date('2026-11-17T12:00:00Z')).toISOString()).toBe('2026-11-16T23:00:00.000Z');
  });

  it('heure d’été : minuit à Paris = 22 h UTC la veille', () => {
    expect(debutDuJourAParis(new Date('2026-07-01T08:00:00Z')).toISOString()).toBe('2026-06-30T22:00:00.000Z');
  });

  it('après minuit à Paris mais avant minuit UTC : déjà le lendemain', () => {
    expect(debutDuJourAParis(new Date('2026-11-17T23:30:00Z')).toISOString()).toBe('2026-11-17T23:00:00.000Z');
  });
});
