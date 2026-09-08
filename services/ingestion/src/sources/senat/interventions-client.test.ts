import { describe, it, expect } from 'vitest';
import { matriculeDepuisLien } from './interventions-client';

describe('matriculeDepuisLien', () => {
  it('extrait le matricule du lien vers la fiche du sénateur', () => {
    const html = '<a class="lien_senfic" href="/senateur/narassiguin_corinne18231d.html">Mme Corinne Narassiguin</a>';
    expect(matriculeDepuisLien(html)).toBe('18231D');
  });

  it('met le matricule en majuscules, comme parlementaires.source_id', () => {
    // La table est indexée sur `18231D` ; renvoyer `18231d` ne correspondrait à rien.
    expect(matriculeDepuisLien('<a href="/senateur/mandelli_didier14031r.html">x</a>')).toBe('14031R');
  });

  it('accepte les matricules courts des sénateurs les plus anciens', () => {
    expect(matriculeDepuisLien('<a href="/senateur/dupont_jean1234a.html">x</a>')).toBe('1234A');
  });

  it('ne renvoie rien quand le lien ne porte pas de matricule', () => {
    // Mieux vaut laisser le repli par le nom opérer que d'inventer une clé.
    expect(matriculeDepuisLien('<a href="/senateur/ancien_senateur.html">x</a>')).toBeUndefined();
  });

  it('ne renvoie rien en l\'absence de lien', () => {
    expect(matriculeDepuisLien('<span class="orateur_nom">M. le président.</span>')).toBeUndefined();
  });

  it('ignore les liens qui ne pointent pas vers une fiche de sénateur', () => {
    expect(matriculeDepuisLien('<a href="/dossier-legislatif/pjl25-123.html">texte</a>')).toBeUndefined();
  });
});
