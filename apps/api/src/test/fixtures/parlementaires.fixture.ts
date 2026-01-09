// =============================================================================
// Fixtures - Données de test pour les parlementaires
// =============================================================================

export const mockGroupe = {
  id: 'groupe-1',
  slug: 'renaissance',
  chambre: 'assemblee' as const,
  nom: 'RE',
  nomComplet: 'Renaissance',
  couleur: '#FFD700',
  position: 'majorite' as const,
};

export const mockCirconscription = {
  id: 'circo-1',
  departement: '75',
  numero: 1,
  nom: 'Paris 1re',
  type: 'depute' as const,
};

export const mockParlementaire = {
  id: 'parl-1',
  uid: 'PA123456',
  slug: 'jean-dupont',
  civilite: 'M.',
  prenom: 'Jean',
  nom: 'Dupont',
  chambre: 'assemblee' as const,
  groupeId: 'groupe-1',
  circonscriptionId: 'circo-1',
  profession: 'Avocat',
  dateNaissance: new Date('1970-05-15'),
  dateDebutMandat: new Date('2022-06-19'),
  actif: true,
  photoUrl: 'https://example.com/photo.jpg',
  twitter: '@jeandupont',
  email: 'jean.dupont@assemblee-nationale.fr',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockParlementaireWithRelations = {
  ...mockParlementaire,
  groupe: mockGroupe,
  circonscription: mockCirconscription,
  _count: {
    votes: 150,
    interventions: 42,
    amendements: 25,
  },
};

export const mockParlementaireList = [
  mockParlementaireWithRelations,
  {
    ...mockParlementaireWithRelations,
    id: 'parl-2',
    uid: 'PA789012',
    slug: 'marie-martin',
    prenom: 'Marie',
    nom: 'Martin',
    civilite: 'Mme',
    circonscription: {
      ...mockCirconscription,
      id: 'circo-2',
      departement: '13',
      nom: 'Bouches-du-Rhône 1re',
    },
    _count: {
      votes: 145,
      interventions: 38,
      amendements: 12,
    },
  },
];

export const mockScrutin = {
  id: 'scrutin-1',
  numero: 123,
  chambre: 'assemblee' as const,
  date: new Date('2024-01-15'),
  titre: 'Projet de loi de finances 2024',
  sort: 'adopte' as const,
  typeVote: 'solennel' as const,
  slug: 'projet-loi-finances-2024',
  nombreVotants: 500,
  pour: 300,
  contre: 150,
  abstentions: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockVote = {
  id: 'vote-1',
  parlementaireId: 'parl-1',
  scrutinId: 'scrutin-1',
  position: 'pour' as const,
  createdAt: new Date(),
};

export const mockIntervention = {
  id: 'interv-1',
  parlementaireId: 'parl-1',
  date: new Date('2024-01-10'),
  texte: 'Lorem ipsum dolor sit amet...',
  type: 'question' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};
