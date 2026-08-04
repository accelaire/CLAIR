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
  orientation?: string | null;
}

interface VoteArticle {
  article: string;
  sort: string;
  groupes: GroupePosition[];
}

interface DossierPromptData {
  titre: string;
  titreCourt?: string | null;
  chambre?: 'assemblee' | 'senat' | null;
  procedureLibelle?: string | null;
  etat?: string | null;
  scrutinsResumes: { titre: string; sort: string; typeVote: string; resumeIA?: string | null }[];
  positionsEnsemble: GroupePosition[];
  votesArticles: VoteArticle[];
  amendementsClefs: { numero: string; exposeSommaire?: string | null; auteurLibelle?: string | null; sort?: string | null }[];
}

function formatGroupePosition(g: GroupePosition): string {
  const total = g.pour + g.contre + g.abstention;
  if (total === 0) return `${g.nom} : aucun vote exprimé`;

  // L'abstention est une position, pas une absence de position : quand elle
  // domine le groupe, elle prime sur le ratio pour/contre des rares voix
  // exprimées. Sans ça un groupe à 0 pour / 1 contre / 12 abstentions était
  // annoncé « Très opposé » au modèle.
  const expressed = g.pour + g.contre;
  let tendency: string;
  if (expressed === 0) {
    tendency = 'Abstention totale';
  } else if (g.abstention >= expressed) {
    tendency = 'Abstention majoritaire';
  } else {
    const pctPourExpr = (g.pour / expressed) * 100;
    if (pctPourExpr >= 70) tendency = 'Très favorable';
    else if (pctPourExpr >= 55) tendency = 'Plutôt favorable';
    else if (pctPourExpr <= 30) tendency = 'Très opposé';
    else if (pctPourExpr <= 45) tendency = 'Plutôt opposé';
    else tendency = 'Divisé';
  }

  const orientationLabel = g.orientation ? ` [${g.orientation.replace(/_/g, ' ')}]` : '';
  return `${g.nom}${orientationLabel} : ${g.pour} pour, ${g.contre} contre, ${g.abstention} abstention → ${tendency}`;
}

/** Position dominante d'un groupe, `null` si aucune voix. */
function positionDominante(g: GroupePosition): 'POUR' | 'CONTRE' | 'ABSTENTION' | null {
  const max = Math.max(g.pour, g.contre, g.abstention);
  if (max === 0) return null;
  if (g.abstention === max) return 'ABSTENTION';
  return g.pour === max ? 'POUR' : 'CONTRE';
}

/** Coupe un libellé de scrutin à une longueur lisible. */
function articleCourt(titre: string): string {
  const cut = titre.slice(0, 70).trim();
  return cut.length < titre.length ? `${cut}…` : cut;
}

/**
 * Divergences entre le vote d'un groupe sur l'ensemble et ses votes article par
 * article. Le calcul est fait ICI plutôt que délégué au modèle : livré aux
 * seules lignes chiffrées, il concluait « le groupe X a voté pour tous les
 * articles » alors que X s'était abstenu en bloc sur l'un d'eux.
 */
function formatDivergences(positionsEnsemble: GroupePosition[], votesArticles: VoteArticle[]): string[] {
  if (positionsEnsemble.length === 0 || votesArticles.length === 0) return [];

  const ensembleParGroupe = new Map(positionsEnsemble.map(g => [g.nom, positionDominante(g)]));
  const lignes: string[] = [];

  for (const [nom, posEnsemble] of ensembleParGroupe) {
    if (!posEnsemble) continue;
    const ecarts: string[] = [];

    for (const va of votesArticles) {
      const g = va.groupes.find(x => x.nom === nom);
      if (!g) continue;
      const posArticle = positionDominante(g);
      if (posArticle && posArticle !== posEnsemble) {
        ecarts.push(`${posArticle} sur « ${articleCourt(va.article)} »`);
      }
    }

    if (ecarts.length > 0) {
      lignes.push(`${nom} : ${posEnsemble} sur l'ensemble, MAIS ${ecarts.join(' ; ')}`);
    }
  }

  if (lignes.length === 0) {
    return ['Aucune : chaque groupe a tenu la même position sur l\'ensemble et sur les articles fournis.'];
  }
  return lignes;
}

export function buildDossierResumePrompt(data: DossierPromptData): string {
  const chambreLabel = data.chambre === 'senat' ? 'Sénat' : data.chambre === 'assemblee' ? 'Assemblée nationale' : null;
  const parts: string[] = [
    `Dossier : ${data.titre}`,
  ];

  if (chambreLabel) {
    parts.push(`Chambre : ${chambreLabel}`);
  }
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

  // Positions des groupes — votes sur l'ensemble du texte (solennel ou ordinaire)
  if (data.positionsEnsemble.length > 0) {
    parts.push('\n--- Positions des groupes sur l\'ensemble du texte (données fiables) ---');
    for (const g of data.positionsEnsemble) {
      parts.push(formatGroupePosition(g));
    }
  }

  // Votes sur les articles clés — nuance qualitative
  if (data.votesArticles.length > 0) {
    parts.push('\n--- Votes sur les articles clés (positions nuancées par article) ---');
    // Tous les groupes présents, sans troncature : couper la liste faisait
    // disparaître ceux qui s'abstenaient en bloc, et le modèle leur inventait
    // une position à partir du vote sur l'ensemble.
    for (const va of data.votesArticles) {
      const résultat = va.sort === 'adopte' ? 'Adopté' : 'Rejeté';
      parts.push(`${va.article} (${résultat}) :`);
      for (const g of va.groupes) {
        parts.push(`  ${formatGroupePosition(g)}`);
      }
    }

    const divergences = formatDivergences(data.positionsEnsemble, data.votesArticles);
    if (divergences.length > 0) {
      parts.push('\n--- Divergences entre le vote sur l\'ensemble et les votes par article (calculées, à reprendre telles quelles) ---');
      parts.push(...divergences);
    }
  }

  // Amendements clés — contexte qualitatif sur les enjeux du débat
  if (data.amendementsClefs.length > 0) {
    parts.push('\n--- Amendements significatifs (contexte sur les points de débat) ---');
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
    '1. RÉSUMÉ (3 à 5 phrases) : Explique de quoi traite ce dossier, ce qui a été décidé, et l\'impact pour les citoyens. RÈGLES STRICTES :',
    '- N\'attribue un contenu à un article numéroté que si les données ci-dessus le disent. Un exposé sommaire d\'amendement décrit ce que son auteur veut changer, PAS le contenu de l\'article ni celui du texte adopté.',
    '- Si tu ne sais pas ce que contient un article, décris la mesure sans la numéroter plutôt que d\'inventer le rattachement.',
    '- Ne présente pas une mesure de portée limitée (dérogation locale, cas particulier) comme une mesure principale du texte.',
    data.positionsEnsemble.length > 0 || data.votesArticles.length > 0
      ? '2. POSITIONS (3 à 6 phrases) : Analyse les positions de chaque groupe politique majeur. RÈGLES STRICTES :'
      : '2. POSITIONS (1 à 2 phrases) : Indique simplement que les votes disponibles ne portent que sur des amendements et ne permettent pas de déterminer la position globale des groupes. Ne décris AUCUNE position de groupe.',
    ...(data.positionsEnsemble.length > 0 || data.votesArticles.length > 0 ? [
    '- Base-toi UNIQUEMENT sur les votes sur l\'ensemble du texte et/ou sur les articles fournis ci-dessus.',
    '- Si des votes par article sont disponibles, mentionne les positions nuancées (ex: "le groupe X s\'est opposé à l\'article 3 sur la clause de conscience").',
    '- L\'ABSTENTION EST UNE POSITION. Un groupe qui s\'abstient n\'est ni favorable ni opposé : dis "s\'est abstenu", jamais "a voté pour" ni "a voté contre". Si un groupe s\'abstient en bloc sur un article alors qu\'il vote pour ailleurs, signale-le explicitement.',
    '- Ne généralise JAMAIS le vote d\'un groupe sur l\'ensemble du texte à ses votes article par article, ni l\'inverse. Chaque affirmation doit correspondre à une ligne chiffrée ci-dessus.',
    '- Toute divergence listée dans la section « Divergences » DOIT apparaître dans ta réponse. Elle est calculée à partir des votes, ne la contredis pas et ne l\'omets pas.',
    '- N\'affirme "tous les articles" / "systématiquement" / "à chaque vote" que si le groupe a effectivement la même position sur TOUTES les lignes fournies.',
    '- Utilise l\'orientation politique entre crochets [gauche/droite/etc.] pour classifier correctement les groupes. Ne JAMAIS inventer de classification (ex: le RN est extrême droite, PAS gauche radicale).',
    '- Nomme les groupes EXACTEMENT comme ci-dessus (ex: "LFI-NFP", pas "LFI-NUPES"). N\'utilise aucun sigle ou intitulé venant de tes connaissances.',
    '- Si un groupe n\'apparaît pas dans les données fournies, ne lui attribue AUCUNE position.',
    '- Si un groupe traditionnellement de gauche vote avec la droite (ou inversement), mentionne-le explicitement.',
    '- ATTENTION : ne regroupe JAMAIS des groupes de familles politiques opposées dans la même catégorie, même s\'ils ont voté de la même manière.',
    ] : []),
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
  positionsEnsemble: GroupePosition[];
  votesArticles: VoteArticle[];
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

  // Dossiers liés avec leurs résumés IA.
  // Ces résumés sont eux-mêmes générés : en cas de contradiction avec les votes
  // chiffrés plus bas, ce sont les votes qui font foi (cf. règles du prompt).
  if (data.dossiersResumes.length > 0) {
    parts.push('\n--- Dossiers législatifs liés (synthèses rédigées, à recouper) ---');
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

  // Positions des groupes — votes sur l'ensemble du texte
  if (data.positionsEnsemble.length > 0) {
    parts.push('\n--- Positions des groupes sur l\'ensemble du texte (données fiables) ---');
    for (const g of data.positionsEnsemble) {
      parts.push(formatGroupePosition(g));
    }
  }

  // Votes sur les articles clés
  if (data.votesArticles.length > 0) {
    parts.push('\n--- Votes sur les articles clés (positions nuancées par article) ---');
    // Aucune troncature : voir buildDossierResumePrompt.
    for (const va of data.votesArticles) {
      const résultat = va.sort === 'adopte' ? 'Adopté' : 'Rejeté';
      parts.push(`${va.article} (${résultat}) :`);
      for (const g of va.groupes) {
        parts.push(`  ${formatGroupePosition(g)}`);
      }
    }

    const divergences = formatDivergences(data.positionsEnsemble, data.votesArticles);
    if (divergences.length > 0) {
      parts.push('\n--- Divergences entre le vote sur l\'ensemble et les votes par article (calculées, à reprendre telles quelles) ---');
      parts.push(...divergences);
    }
  }

  parts.push(
    '',
    'Génère une réponse structurée en trois parties séparées par les lignes exactes "---RESUME---" et "---ENJEUX---" :',
    '1. TITRE (une seule ligne, pas de préfixe) : Un titre court et clair en français pour ce sujet parlementaire, compréhensible par un citoyen (ex: "Financement de la sécurité sociale pour 2026", "Droit à l\'aide à mourir", "Organisation des JO 2030"). Pas d\'acronymes, pas de numéro de législature.',
    '---RESUME---',
    '2. RÉSUMÉ (3 à 5 phrases) : Synthèse accessible de ce sujet pour un citoyen. De quoi s\'agit-il, où en est-on, qu\'est-ce qui a été voté à l\'Assemblée et au Sénat. RÈGLES STRICTES :',
    '- Les synthèses de dossiers ci-dessus sont des textes rédigés, pas des données brutes : ne recopie pas une affirmation qui contredit les votes chiffrés.',
    '- N\'attribue un contenu à un article numéroté que si les données ci-dessus le disent explicitement.',
    '- Ne présente pas une mesure de portée limitée (dérogation locale, cas particulier) comme une mesure principale du texte.',
    '---ENJEUX---',
    data.positionsEnsemble.length > 0 || data.votesArticles.length > 0
      ? '3. ENJEUX (3 à 6 phrases) : Quels sont les enjeux concrets pour les citoyens et quelles sont les positions des principaux groupes politiques. RÈGLES STRICTES :'
      : '3. ENJEUX (2 à 4 phrases) : Quels sont les enjeux concrets pour les citoyens. Ne décris AUCUNE position de groupe politique car les seuls votes disponibles portent sur des amendements et ne reflètent pas les positions globales.',
    ...(data.positionsEnsemble.length > 0 || data.votesArticles.length > 0 ? [
    '- Base-toi UNIQUEMENT sur les votes chiffrés sur l\'ensemble du texte et/ou sur les articles fournis. En cas de contradiction avec une synthèse de dossier ci-dessus, les chiffres l\'emportent.',
    '- Si des votes par article sont disponibles, mentionne les positions nuancées.',
    '- L\'ABSTENTION EST UNE POSITION. Un groupe qui s\'abstient n\'est ni favorable ni opposé : dis "s\'est abstenu", jamais "a voté pour" ni "a voté contre". Si un groupe s\'abstient en bloc sur un article alors qu\'il vote pour ailleurs, signale-le explicitement.',
    '- Ne généralise JAMAIS le vote d\'un groupe sur l\'ensemble du texte à ses votes article par article, ni l\'inverse. Chaque affirmation doit correspondre à une ligne chiffrée ci-dessus.',
    '- Toute divergence listée dans la section « Divergences » DOIT apparaître dans ta réponse. Elle est calculée à partir des votes, ne la contredis pas et ne l\'omets pas.',
    '- N\'affirme "tous les articles" / "systématiquement" / "à chaque vote" que si le groupe a effectivement la même position sur TOUTES les lignes fournies.',
    '- Utilise l\'orientation politique entre crochets pour classifier les groupes. Ne JAMAIS inventer de classification.',
    '- Nomme les groupes EXACTEMENT comme ci-dessus (ex: "LFI-NFP", pas "LFI-NUPES"). N\'utilise aucun sigle ou intitulé venant de tes connaissances.',
    '- Si un groupe n\'apparaît pas dans les données, ne lui attribue AUCUNE position.',
    '- Si un groupe vote contre son camp habituel, mentionne-le.',
    '- Ne regroupe JAMAIS des groupes de familles opposées dans la même catégorie.',
    '- Ne conclus pas à un "soutien transpartisan" ou à un "large consensus" si une famille politique entière a voté contre ou s\'est abstenue.',
    ] : []),
    '- Pourquoi ce sujet est important ou controversé.',
  );

  return parts.join('\n');
}

// =============================================================================
// SUJETS — DESCRIPTIONS AMENDEMENTS PAR GROUPE
// =============================================================================

export const SYSTEM_PROMPT_SUJET_GROUPES = `Tu es un analyste parlementaire expert. Tu synthétises l'action législative des groupes politiques sur un sujet donné, en te basant sur les amendements déposés.

Règles :
- Sois factuel, neutre et concis.
- 1 à 2 phrases maximum par groupe.
- Décris ce que le groupe a proposé concrètement via ses amendements.
- N'utilise pas de jargon juridique sans l'expliquer.
- Réponds en texte brut, sans markdown.`;

interface GroupeAmendementPromptData {
  sujetLabel: string;
  groupes: Array<{
    nom: string;
    slug: string;
    chambre: string;
    amendements: Array<{
      numero: string;
      exposeSommaire: string;
      sort?: string | null;
    }>;
  }>;
}

export function buildGroupeAmendementPrompt(data: GroupeAmendementPromptData): string {
  const parts: string[] = [
    `Sujet parlementaire : ${data.sujetLabel}`,
    '',
    'Pour chaque groupe politique ci-dessous, génère une description de 1 à 2 phrases résumant ce que le groupe propose via ses amendements.',
    '',
    'Format de réponse STRICT — une entrée par groupe, séparée par "---" :',
    'GROUPE:slug-chambre',
    'Description du groupe...',
    '---',
    '',
  ];

  for (const groupe of data.groupes) {
    const chambreLabel = groupe.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
    parts.push(`--- Groupe : ${groupe.nom} (${chambreLabel}) [clé: ${groupe.slug}-${groupe.chambre}] ---`);
    parts.push(`Amendements (${groupe.amendements.length}) :`);
    for (const a of groupe.amendements.slice(0, 8)) {
      const sortStr = a.sort ? ` [${a.sort}]` : '';
      const expose = a.exposeSommaire.length > 300 ? a.exposeSommaire.slice(0, 300) + '...' : a.exposeSommaire;
      parts.push(`  n°${a.numero}${sortStr} : ${expose}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// =============================================================================
// PARLEMENTAIRES (fiches enrichies)
// =============================================================================

export const SYSTEM_PROMPT_PARLEMENTAIRE = `Tu es un biographe parlementaire expert. Tu rédiges des fiches de synthèse sur les parlementaires français (députés et sénateurs) destinées aux citoyens.

Règles :
- Sois factuel, neutre et informatif.
- Ne prends jamais parti politiquement.
- Cite les faits vérifiables : mandats, votes notables, prises de position publiques.
- Si des informations manquent, n'invente rien.
- Réponds en texte brut, sans markdown.
- Utilise un ton accessible et engageant, comme un journaliste politique de qualité.`;

interface MandatInfo {
  typeOrgane: string;
  institution: string;
  qualite: string;
  dateDebut: string;
  dateFin?: string | null;
}

interface VoteStats {
  presence: number | null;
  loyaute: number | null;
  participation: number | null;
  interventions: number | null;
  amendements: number | null;
  amendementsAdoptes: number | null;
}

interface LobbyingTarget {
  lobbyiste: string;
  type: string;
  description: string;
  secteurs: string[];
}

export interface ParlementairePromptData {
  prenom: string;
  nom: string;
  chambre: string;
  groupe?: string | null;
  profession?: string | null;
  dateNaissance?: string | null;
  circonscription?: string | null;
  commissionPermanente?: string | null;
  actif: boolean;

  // Stats pré-calculées
  stats: VoteStats;

  // Mandats extraits du sourceData
  mandats: MandatInfo[];

  // Lobbying ciblant ce parlementaire
  lobbyingActions: LobbyingTarget[];

  // Déclarations HATVP
  declarations: { type: string; label: string; datePublication?: string | null; urlDossier?: string | null }[];

  // Sources web
  wikipediaBio?: string | null;
  tavilyResults?: { title: string; content: string }[];
}

export function buildParlementaireResumePrompt(data: ParlementairePromptData): string {
  const chambreLabel = data.chambre === 'senat' ? 'Sénateur' : 'Député';
  const parts: string[] = [
    `${data.prenom} ${data.nom} — ${chambreLabel}${data.actif ? '' : ' (ancien)'}`,
  ];

  if (data.groupe) {
    parts.push(`Groupe politique : ${data.groupe}`);
  }
  if (data.profession) {
    parts.push(`Profession : ${data.profession}`);
  }
  if (data.dateNaissance) {
    parts.push(`Date de naissance : ${data.dateNaissance}`);
  }
  if (data.circonscription) {
    parts.push(`Circonscription : ${data.circonscription}`);
  }
  if (data.commissionPermanente) {
    parts.push(`Commission permanente : ${data.commissionPermanente}`);
  }

  // Stats d'activité
  const statsLines: string[] = [];
  if (data.stats.presence != null) statsLines.push(`Présence aux scrutins : ${data.stats.presence}%`);
  if (data.stats.loyaute != null) statsLines.push(`Loyauté au groupe : ${data.stats.loyaute}%`);
  if (data.stats.participation != null) statsLines.push(`Votes exprimés : ${data.stats.participation}`);
  if (data.stats.interventions != null) statsLines.push(`Interventions : ${data.stats.interventions}`);
  if (data.stats.amendements != null) {
    const adoptStr = data.stats.amendementsAdoptes != null
      ? ` (${data.stats.amendementsAdoptes} adoptés)` : '';
    statsLines.push(`Amendements déposés : ${data.stats.amendements}${adoptStr}`);
  }
  if (statsLines.length > 0) {
    parts.push('\n--- Activité parlementaire ---');
    parts.push(...statsLines);
  }

  // Mandats et fonctions
  if (data.mandats.length > 0) {
    parts.push('\n--- Mandats et fonctions ---');
    for (const m of data.mandats.slice(0, 15)) {
      const finStr = m.dateFin ? ` → ${m.dateFin}` : ' → en cours';
      parts.push(`${m.dateDebut}${finStr} : ${m.qualite} — ${m.institution} (${m.typeOrgane})`);
    }
  }

  // Actions de lobbying ciblant ce parlementaire
  if (data.lobbyingActions.length > 0) {
    parts.push('\n--- Actions de lobbying le ciblant ---');
    for (const a of data.lobbyingActions.slice(0, 5)) {
      const secteurs = a.secteurs.length > 0 ? ` [${a.secteurs.join(', ')}]` : '';
      parts.push(`${a.lobbyiste} (${a.type})${secteurs} : ${a.description}`);
    }
  }

  // Déclarations HATVP (transparence)
  if (data.declarations.length > 0) {
    parts.push('\n--- Déclarations HATVP (transparence) ---');
    for (const d of data.declarations) {
      const dateStr = d.datePublication ? ` (publiée le ${d.datePublication})` : '';
      parts.push(`${d.label}${dateStr}`);
    }
  } else {
    parts.push('\n--- Déclarations HATVP ---');
    parts.push('Aucune déclaration publiée trouvée sur le site de la HATVP.');
  }

  // Bio Wikipedia
  if (data.wikipediaBio) {
    const bio = data.wikipediaBio.length > 2000
      ? data.wikipediaBio.slice(0, 2000) + '...'
      : data.wikipediaBio;
    parts.push('\n--- Biographie Wikipedia ---');
    parts.push(bio);
  }

  // Résultats Tavily (presse / actualités)
  if (data.tavilyResults && data.tavilyResults.length > 0) {
    parts.push('\n--- Actualités et articles de presse ---');
    for (const r of data.tavilyResults.slice(0, 3)) {
      const content = r.content.length > 500
        ? r.content.slice(0, 500) + '...'
        : r.content;
      parts.push(`[${r.title}] ${content}`);
    }
  }

  parts.push(
    '',
    'Génère une fiche de synthèse structurée en trois parties séparées par les lignes exactes "---PARCOURS---" et "---POSITIONS---" et "---FAITS---" :',
    '1. RÉSUMÉ (3 à 5 phrases) : Qui est ce parlementaire ? Son parcours politique en quelques mots, son rôle actuel, ce qui le distingue. Accessible et engageant.',
    '---PARCOURS---',
    '2. PARCOURS (3 à 8 phrases) : Détaille sa carrière politique, ses mandats importants, ses responsabilités passées et actuelles. Mentionne sa formation ou profession d\'origine si pertinent.',
    '---POSITIONS---',
    '3. POSITIONS CLÉS (3 à 6 phrases) : Ses prises de position notables, ses combats politiques, les sujets sur lesquels il s\'est distingué. Appuie-toi sur ses votes, amendements et interventions.',
    '---FAITS---',
    '4. FAITS NOTABLES (2 à 4 phrases) : Faits marquants, controverses, réalisations spécifiques ou anecdotes pertinentes. Uniquement des faits vérifiables.',
  );

  return parts.join('\n');
}
