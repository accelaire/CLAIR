// =============================================================================
// Utilitaires de recherche multi-mots
// =============================================================================

/**
 * Construit une condition Prisma pour rechercher un parlementaire par nom/prénom
 * Gère les recherches multi-mots (ex: "Marine Le Pen", "Jean-Luc Mélenchon")
 */
export function buildParlementaireSearchCondition(search: string) {
  const searchTerm = search.toLowerCase().trim();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

  // Cas simple: un seul mot - chercher dans nom, prénom ou slug
  if (words.length === 1) {
    return {
      OR: [
        { nom: { contains: searchTerm, mode: 'insensitive' as const } },
        { prenom: { contains: searchTerm, mode: 'insensitive' as const } },
        { slug: { contains: searchTerm, mode: 'insensitive' as const } },
      ],
    };
  }

  // Cas multi-mots: chercher "prénom nom" ou "nom prénom"
  // Ex: "Marine Le Pen" → (prenom contains "Marine" AND nom contains "Le Pen")
  //                    OR (prenom contains "Marine Le" AND nom contains "Pen")
  //                    OR slug contains "marine-le-pen"
  const orConditions: any[] = [];

  // Essayer toutes les combinaisons de split (prénom | nom)
  for (let i = 1; i < words.length; i++) {
    const firstPart = words.slice(0, i).join(' ');
    const secondPart = words.slice(i).join(' ');

    // prénom + nom
    orConditions.push({
      AND: [
        { prenom: { contains: firstPart, mode: 'insensitive' as const } },
        { nom: { contains: secondPart, mode: 'insensitive' as const } },
      ],
    });

    // nom + prénom (inversé)
    orConditions.push({
      AND: [
        { nom: { contains: firstPart, mode: 'insensitive' as const } },
        { prenom: { contains: secondPart, mode: 'insensitive' as const } },
      ],
    });
  }

  // Aussi chercher dans le slug (transformé avec tirets)
  const slugSearch = searchTerm.replace(/\s+/g, '-');
  orConditions.push({ slug: { contains: slugSearch, mode: 'insensitive' as const } });

  // Et la recherche simple sur chaque mot (fallback)
  orConditions.push({
    AND: words.map(word => ({
      OR: [
        { nom: { contains: word, mode: 'insensitive' as const } },
        { prenom: { contains: word, mode: 'insensitive' as const } },
      ],
    })),
  });

  return { OR: orConditions };
}

/**
 * Construit une condition Prisma pour rechercher dans un champ texte
 * Gère les recherches multi-mots en cherchant tous les mots
 * @param field - Nom du champ à rechercher (ex: 'nom', 'titre')
 * @param search - Terme de recherche
 */
export function buildTextSearchCondition(field: string, search: string) {
  const searchTerm = search.toLowerCase().trim();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

  // Cas simple: un seul mot
  if (words.length === 1) {
    return {
      [field]: { contains: searchTerm, mode: 'insensitive' as const },
    };
  }

  // Multi-mots: tous les mots doivent être présents dans le champ
  return {
    AND: words.map(word => ({
      [field]: { contains: word, mode: 'insensitive' as const },
    })),
  };
}

/**
 * Construit une condition Prisma pour rechercher dans plusieurs champs texte
 * @param fields - Noms des champs à rechercher
 * @param search - Terme de recherche
 */
export function buildMultiFieldSearchCondition(fields: string[], search: string) {
  const searchTerm = search.toLowerCase().trim();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);

  // Cas simple: un seul mot - chercher dans tous les champs
  if (words.length === 1) {
    return {
      OR: fields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' as const },
      })),
    };
  }

  // Multi-mots:
  // Option 1: Tous les mots dans UN des champs
  // Option 2: Chaque mot dans au moins un des champs
  const orConditions: any[] = [];

  // Option 1: tous les mots dans un seul champ
  for (const field of fields) {
    orConditions.push({
      AND: words.map(word => ({
        [field]: { contains: word, mode: 'insensitive' as const },
      })),
    });
  }

  // Option 2: chaque mot doit matcher au moins un champ
  orConditions.push({
    AND: words.map(word => ({
      OR: fields.map(field => ({
        [field]: { contains: word, mode: 'insensitive' as const },
      })),
    })),
  });

  return { OR: orConditions };
}
