// =============================================================================
// Prompts FR pour l'enrichissement IA des entités parlementaires
// =============================================================================

export const SYSTEM_PROMPT = `Tu es un vulgarisateur parlementaire expert. Tu expliques les décisions de l'Assemblée nationale et du Sénat en français clair et accessible pour un citoyen non-expert.

Règles :
- Sois factuel, neutre et concis.
- N'utilise pas de jargon juridique sans l'expliquer.
- Ne prends pas parti politiquement.
- Réponds en texte brut, sans markdown ni bullet points.
- 1 à 3 phrases maximum.`;

export const SYSTEM_PROMPT_DOSSIER = `Tu es un analyste parlementaire expert. Tu résumes les dossiers législatifs et analyses les positions des groupes politiques de manière factuelle et accessible.

Règles :
- Sois factuel, neutre et pédagogue.
- N'utilise pas de jargon juridique sans l'expliquer.
- Ne prends pas parti politiquement.
- Réponds en texte brut, sans markdown.
- Analyse les positions des groupes à partir de leurs votes et actions concrètes.`;

export const SYSTEM_PROMPT_SUJET = `Tu es un analyste parlementaire expert. Tu synthétises les sujets législatifs cross-chambre (Assemblée nationale et Sénat) pour les rendre accessibles aux citoyens.

Règles :
- Sois factuel, neutre et pédagogue.
- N'utilise pas de jargon juridique sans l'expliquer.
- Ne prends pas parti politiquement.
- Réponds en texte brut, sans markdown.
- Distingue clairement le résumé factuel des enjeux politiques.`;

// =============================================================================
// SCRUTINS
// =============================================================================

interface ScrutinPromptData {
  titre: string;
  sort: string;
  typeVote: string;
  objetLibelle?: string | null;
  tags?: string[];
  dossierTitre?: string | null;
  amendements?: { numero: string; exposeSommaire?: string | null; dispositif?: string | null }[];
}

export function buildScrutinResumePrompt(data: ScrutinPromptData): string {
  const parts: string[] = [
    `Titre du scrutin : ${data.titre}`,
    `Résultat : ${data.sort === 'adopte' ? 'Adopté' : 'Rejeté'}`,
    `Type : ${data.typeVote}`,
  ];

  if (data.objetLibelle) {
    parts.push(`Objet : ${data.objetLibelle}`);
  }
  if (data.tags && data.tags.length > 0) {
    parts.push(`Thèmes : ${data.tags.join(', ')}`);
  }
  if (data.dossierTitre) {
    parts.push(`Dossier législatif : ${data.dossierTitre}`);
  }

  // Inclure le contenu des amendements votés (exposé sommaire = explication du "pourquoi")
  if (data.amendements && data.amendements.length > 0) {
    for (const amdt of data.amendements.slice(0, 3)) {
      const amParts: string[] = [`\nAmendement n°${amdt.numero} :`];
      if (amdt.exposeSommaire) {
        const expose = amdt.exposeSommaire.length > 1500
          ? amdt.exposeSommaire.slice(0, 1500) + '...'
          : amdt.exposeSommaire;
        amParts.push(`Exposé sommaire : ${expose}`);
      }
      if (amdt.dispositif) {
        const dispositif = amdt.dispositif.length > 500
          ? amdt.dispositif.slice(0, 500) + '...'
          : amdt.dispositif;
        amParts.push(`Dispositif : ${dispositif}`);
      }
      parts.push(amParts.join('\n'));
    }
  }

  parts.push(
    '',
    'Explique en 1 à 3 phrases simples ce qui a été voté et quel impact concret cela peut avoir pour les citoyens.'
  );

  return parts.join('\n');
}

// =============================================================================
// DOSSIERS LÉGISLATIFS
// =============================================================================

interface GroupePosition {
  nom: string;
  slug: string;
  pour: number;
  contre: number;
  abstention: number;
}

interface DossierPromptData {
  titre: string;
  titreCourt?: string | null;
  procedureLibelle?: string | null;
  etat?: string | null;
  scrutinsResumes: { titre: string; sort: string; typeVote: string; resumeIA?: string | null }[];
  positionsGroupes: GroupePosition[];
  amendementsClefs: { numero: string; exposeSommaire?: string | null; auteurLibelle?: string | null; sort?: string | null }[];
}

function formatGroupePosition(g: GroupePosition): string {
  const total = g.pour + g.contre + g.abstention;
  if (total === 0) return `${g.nom} : aucun vote exprimé`;
  const pctPour = Math.round((g.pour / total) * 100);
  const pctContre = Math.round((g.contre / total) * 100);
  const pctAbst = Math.round((g.abstention / total) * 100);

  let tendency: string;
  if (pctPour >= 70) tendency = 'Très favorable';
  else if (pctPour >= 55) tendency = 'Plutôt favorable';
  else if (pctContre >= 70) tendency = 'Très opposé';
  else if (pctContre >= 55) tendency = 'Plutôt opposé';
  else tendency = 'Divisé';

  return `${g.nom} : ${pctPour}% pour, ${pctContre}% contre, ${pctAbst}% abstention → ${tendency}`;
}

export function buildDossierResumePrompt(data: DossierPromptData): string {
  const parts: string[] = [
    `Dossier : ${data.titre}`,
  ];

  if (data.titreCourt) {
    parts.push(`Titre court : ${data.titreCourt}`);
  }
  if (data.procedureLibelle) {
    parts.push(`Procédure : ${data.procedureLibelle}`);
  }
  if (data.etat) {
    parts.push(`État : ${data.etat}`);
  }

  // Scrutins clés avec leurs résumés IA
  if (data.scrutinsResumes.length > 0) {
    parts.push('\n--- Votes clés ---');
    for (const s of data.scrutinsResumes) {
      const résultat = s.sort === 'adopte' ? 'Adopté' : 'Rejeté';
      if (s.resumeIA) {
        parts.push(`[${s.typeVote}, ${résultat}] ${s.resumeIA}`);
      } else {
        parts.push(`[${s.typeVote}, ${résultat}] ${s.titre}`);
      }
    }
  }

  // Positions des groupes
  if (data.positionsGroupes.length > 0) {
    parts.push('\n--- Positions des groupes politiques (agrégées sur tous les scrutins) ---');
    for (const g of data.positionsGroupes) {
      parts.push(formatGroupePosition(g));
    }
  }

  // Amendements clés
  if (data.amendementsClefs.length > 0) {
    parts.push('\n--- Amendements significatifs ---');
    for (const a of data.amendementsClefs) {
      const sortStr = a.sort ? ` (${a.sort})` : '';
      const auteur = a.auteurLibelle ? ` — ${a.auteurLibelle}` : '';
      const expose = a.exposeSommaire
        ? a.exposeSommaire.length > 500 ? a.exposeSommaire.slice(0, 500) + '...' : a.exposeSommaire
        : '';
      parts.push(`Amendement n°${a.numero}${auteur}${sortStr} : ${expose}`);
    }
  }

  parts.push(
    '',
    'Génère un résumé structuré en deux parties séparées par la ligne exacte "---POSITIONS---" :',
    '1. RÉSUMÉ (3 à 5 phrases) : Explique de quoi traite ce dossier, ce qui a été décidé, et l\'impact pour les citoyens.',
    '2. POSITIONS (3 à 6 phrases) : Analyse les positions de chaque groupe politique majeur en t\'appuyant sur leurs votes et amendements. Explique pourquoi chaque camp soutient ou s\'oppose au texte.',
  );

  return parts.join('\n');
}

// =============================================================================
// SUJETS PARLEMENTAIRES
// =============================================================================

interface SujetPromptData {
  label: string;
  description?: string | null;
  category?: string | null;
  status: string;
  dossiersResumes: { titre: string; chambre: string; etat?: string | null; resumeIA?: string | null }[];
  positionsGroupes: GroupePosition[];
}

export function buildSujetResumePrompt(data: SujetPromptData): string {
  const parts: string[] = [
    `Sujet parlementaire : ${data.label}`,
    `Statut : ${data.status}`,
  ];

  if (data.description) {
    parts.push(`Description : ${data.description}`);
  }
  if (data.category) {
    parts.push(`Catégorie : ${data.category}`);
  }

  // Dossiers liés avec leurs résumés IA
  if (data.dossiersResumes.length > 0) {
    parts.push('\n--- Dossiers législatifs liés ---');
    for (const d of data.dossiersResumes) {
      const chambreLabel = d.chambre === 'senat' ? 'Sénat' : d.chambre === 'assemblee' ? 'AN' : 'AN+Sénat';
      const etatStr = d.etat ? ` [${d.etat}]` : '';
      if (d.resumeIA) {
        parts.push(`${chambreLabel}${etatStr} : ${d.resumeIA}`);
      } else {
        parts.push(`${chambreLabel}${etatStr} : ${d.titre}`);
      }
    }
  }

  // Positions des groupes (agrégées cross-dossiers)
  if (data.positionsGroupes.length > 0) {
    parts.push('\n--- Positions des groupes politiques (agrégées cross-chambre) ---');
    for (const g of data.positionsGroupes) {
      parts.push(formatGroupePosition(g));
    }
  }

  parts.push(
    '',
    'Génère une réponse structurée en trois parties séparées par les lignes exactes "---RESUME---" et "---ENJEUX---" :',
    '1. TITRE (une seule ligne, pas de préfixe) : Un titre court et clair en français pour ce sujet parlementaire, compréhensible par un citoyen (ex: "Financement de la sécurité sociale pour 2026", "Droit à l\'aide à mourir", "Organisation des JO 2030"). Pas d\'acronymes, pas de numéro de législature.',
    '---RESUME---',
    '2. RÉSUMÉ (3 à 5 phrases) : Synthèse accessible de ce sujet pour un citoyen. De quoi s\'agit-il, où en est-on, qu\'est-ce qui a été voté à l\'Assemblée et au Sénat.',
    '---ENJEUX---',
    '3. ENJEUX (3 à 6 phrases) : Quels sont les enjeux concrets pour les citoyens et quelles sont les positions des principaux groupes politiques. Pourquoi ce sujet est important ou controversé.',
  );

  return parts.join('\n');
}
