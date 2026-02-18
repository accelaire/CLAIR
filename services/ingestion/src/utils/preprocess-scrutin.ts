// =============================================================================
// Prétraitement des titres de scrutins pour TF-IDF matching
// Port fidèle du preprocessing Python (notebooks/compare_embeddings_scrutins.ipynb)
// =============================================================================

/**
 * Stopwords français (NLTK french_stopwords) + stopwords parlementaires.
 * Utilisés pour filtrer les tokens non-discriminants dans le TF-IDF.
 */
export const FRENCH_STOPWORDS = new Set([
  'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle',
  'en', 'et', 'eux', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur', 'lui',
  'ma', 'mais', 'me', 'mes', 'mon', 'ni', 'nos', 'notre', 'nous', 'on',
  'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 'sa', 'se', 'ses', 'son',
  'sur', 'ta', 'te', 'tes', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous',
  'ai', 'as', 'es', 'est', 'sont', 'suis', 'a', 'ont',
  'ne', 'y', 'si', 'plus', 'aussi', 'autre', 'autres',
  'tout', 'tous', 'toute', 'toutes', 'quel', 'quelle', 'quels', 'quelles',
  'sans', 'non', 'oui', 'car', 'donc', 'or', 'entre', 'vers', 'chez',
  'cette', 'cet', 'cela', 'ci', 'dont', 'ici', 'moi', 'toi', 'soi',
  'peu', 'trop', 'tres', 'bien', 'mal', 'rien', 'tout',
  'apres', 'avant', 'depuis', 'pendant', 'sous', 'devant', 'derriere',
  'dessus', 'dessous', 'alors', 'encore', 'meme', 'quand', 'comme',
  'comment', 'pourquoi', 'parce', 'ainsi', 'ailleurs', 'deja',
  'd', 'l', 'n', 's', 'c', 'j', 'm', 't',
]);

export const DOMAIN_STOPWORDS = new Set([
  'visant', 'relatif', 'relative', 'relatifs', 'relatives',
  'portant', 'tendant', 'article', 'articles', 'alinea',
  'premier', 'premiere', 'deuxieme', 'troisieme',
  'amendement', 'amendements', 'sous-amendement',
  'rect', 'rectifie',
  'projet', 'proposition', 'loi', 'resolution',
  'texte', 'commission', 'lecture', 'deliberation',
  'nationale', 'assemblee', 'senat',
  'gouvernement', 'president', 'presidente',
  'scrutin', 'vote', 'public',
  'ensemble', 'motion', 'renvoi',
]);

// All stopwords combined for fast lookup
const ALL_STOPWORDS = new Set([...FRENCH_STOPWORDS, ...DOMAIN_STOPWORDS]);

// =============================================================================
// Step 1: Normalize unicode artifacts (CP1252 → UTF-8)
// =============================================================================
function normalizeUnicode(text: string): string {
  return text
    .replace(/\u0092/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u0096/g, '-')
    .replace(/\u009c/g, 'oe')
    .replace(/\u2013/g, '-')  // en-dash
    .replace(/\u2014/g, '-')  // em-dash
    .replace(/\u00ab/g, '"')  // «
    .replace(/\u00bb/g, '"')  // »
    .replace(/[\u0080-\u009f]/g, ''); // remaining C1 controls
}

// =============================================================================
// Step 2: Strip lecture/reading suffixes
// =============================================================================
function stripSuffixes(text: string): string {
  return text
    .replace(/\s*\(premi[eè]re lecture\)\.?\s*/gi, ' ')
    .replace(/\s*\(deuxi[eè]me lecture\)\.?\s*/gi, ' ')
    .replace(/\s*\(nouvelle lecture\)\.?\s*/gi, ' ')
    .replace(/\s*\(lecture d[eé]finitive\)\.?\s*/gi, ' ')
    .replace(/\s*\(seconde d[eé]lib[eé]ration\)\.?\s*/gi, ' ')
    .replace(/\s*\(texte de la commission\)\.?\s*/gi, ' ')
    .replace(/\s*\(supprim[eé]\)\.?\s*/gi, ' ')
    .replace(/\s*\(texte du s[eé]nat\)\.?\s*/gi, ' ')
    .replace(/\s*\(CMP\)\.?\s*/gi, ' ')
    .trim();
}

// =============================================================================
// Step 3: Extract the subject anchor
// =============================================================================

// Patterns for amendment/article prefixes that should be removed to find the core subject
const AMENDMENT_PREFIXES = [
  // Amendement / sous-amendement (AN format)
  /^l'amendement\s+n[°º]\s*\d+[A-Z]*\s*(?:rect\.?)?\s*(?:de\s+(?:M\.|Mme|MM\.)\s+[\w-]+\s*)?/i,
  /^le sous-amendement\s+n[°º]\s*\d+[A-Z]*\s*(?:de\s+(?:M\.|Mme|MM\.)\s+[\w-]+\s*)?/i,
  /^les amendements?\s+(?:identiques?\s+)?n[°ºs]*\s*[\d,\s]+/i,

  // Sénat format: "sur les amendements identiques n° I-77 rectifié, présenté par M. X et ..., n° I-388, présenté par ..."
  // These blocks list multiple amendment numbers with author attributions, separated by commas.
  // We strip the entire "n° ..., présenté par ... collègues" chain before the anchor word (tendant/à l'article/du).
  /,?\s*n[°º]\s*[A-Z]*-?\d+(?:\s*rect(?:ifi[eé])?\.?(?:\s*(?:bis|ter|quater|quinquies))?)?(?:\s*,\s*pr[eé]sent[eé]\s+par\s+[^,]+(?:,\s*)?)+/gi,
  // Strip remaining "présenté par M. X et plusieurs de ses collègues" (after amendment number was already removed)
  /,?\s*pr[eé]sent[eé]\s+par\s+(?:M\.|Mme|MM\.)\s+[^,]+(?:et\s+(?:plusieurs\s+de\s+ses\s+coll[eè]gues|les\s+membres\s+du\s+groupe\s+[^,]+))?(?:\s*,\s*)?/gi,
  // "tendant à insérer un article additionnel après l'article X du..."
  /,?\s*tendant\s+[àa]\s+ins[eé]rer\s+un\s+article\s+additionnel\s+/i,

  // Article references
  /^l'article\s+(?:unique|premier|premier bis|\d+[A-Z]*(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies))?)\s+(?:de\s+|constituant\s+l'ensemble\s+de\s+)/i,
  /^sur l'article\s+(?:unique|premier|premier bis|\d+[A-Z]*(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies))?)\s+(?:de\s+|constituant\s+l'ensemble\s+de\s+)/i,
  /^l'ensemble (?:du texte [eé]labor[eé]\s+par\s+la\s+commission\s+mixte\s+paritaire\s+sur\s+)?de\s+/i,
  /^sur l'ensemble (?:du texte [eé]labor[eé]\s+par\s+la\s+commission\s+mixte\s+paritaire\s+sur\s+)?de\s+/i,
  /^sur\s+/i,
  // "sur les crédits de la mission «...» figurant à l'état B du projet de loi..."
  /^les cr[eé]dits de la mission\s+[«"]?\s*[^»"]+[»"]?\s*figurant\s+[àa]\s+l'[eé]tat\s+[A-Z]\s+du\s+/i,
  // Position in text
  /[àa] l'article\s+(?:unique|premier|premier bis|\d+[A-Z]*(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies))?)\s+du?\s+/i,
  /apr[eè]s l'article\s+(?:unique|premier|premier bis|\d+[A-Z]*(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies))?)\s+du?\s+/i,
  /avant l'article\s+(?:unique|premier|premier bis|\d+[A-Z]*(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies|terdecies))?)\s+du?\s+/i,
  /au titre de\s+/i,
  // Qualifiers
  /de suppression\s+(?:de\s+)?/i,
  /de r[eé]tablissement\s+(?:de\s+)?/i,
  /et l(?:'|es\s+)amendements?\s+identiques?\s+suivants?\s*/i,
  // "la motion n° X, présentée par ..."
  /^la motion n[°º]\s*\d+,?\s*pr[eé]sent[eé]e?\s+par\s+[^,]+(?:,\s*)?/i,
];

// Anchor patterns to find the subject
const SUBJECT_ANCHORS = /(?:projet de loi|proposition de loi|proposition de r[eé]solution|d[eé]claration du gouvernement)/i;

// Special case patterns that are self-contained subjects
// extract(match, fullText) → string (use as subject) | null (fall through to normal pipeline)
const SPECIAL_CASES: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray, fullText: string) => string | null }> = [
  {
    pattern: /motion de censure/i,
    extract: () => 'motion de censure',
  },
  {
    pattern: /d[eé]claration de politique g[eé]n[eé]rale/i,
    extract: () => 'declaration de politique generale',
  },
  {
    pattern: /motion de rejet pr[eé]alable/i,
    extract: (_m, fullText) => {
      // MRP titles follow: "la motion de rejet préalable, déposée par X, du projet de loi relatif à Y"
      // If the bill name anchor exists, fall through to normal pipeline to extract "Y"
      if (SUBJECT_ANCHORS.test(fullText)) return null;
      return 'motion de rejet prealable';
    },
  },
  {
    pattern: /motion r[eé]f[eé]rendaire/i,
    extract: () => 'motion referendaire',
  },
  {
    pattern: /suspension de s[eé]ance/i,
    extract: () => 'suspension de seance',
  },
];

/**
 * Extracts the core subject from a scrutin or dossier title.
 * Removes amendment references, article numbers, procedural suffixes, etc.
 * Returns the cleaned subject string for TF-IDF matching.
 */
export function extractSubject(titre: string): string {
  if (!titre) return '';

  let text = normalizeUnicode(titre);
  text = stripSuffixes(text);

  // Check special cases first
  for (const { pattern, extract } of SPECIAL_CASES) {
    const m = text.match(pattern);
    if (m) {
      const result = extract(m, text);
      if (result !== null) return result;
      break; // null → fall through to normal pipeline
    }
  }

  // PRIMARY strategy: find subject anchor in the raw text.
  // This handles Sénat format where amendment prefixes are complex and hard to regex.
  // If "projet de loi" / "proposition de loi" appears, everything before it is noise.
  const anchorMatch = text.match(SUBJECT_ANCHORS);
  if (anchorMatch && anchorMatch.index !== undefined) {
    text = text.substring(anchorMatch.index);
  } else {
    // FALLBACK: no anchor found → strip amendment/article prefixes iteratively (AN format)
    let prevText = '';
    while (prevText !== text) {
      prevText = text;
      for (const pattern of AMENDMENT_PREFIXES) {
        text = text.replace(pattern, '').trim();
      }
    }
  }

  // Save text after anchor/prefix stripping as a fallback —
  // further stripping (law prefix, connecting phrase) can reduce it too much
  // (e.g., "projet de loi de finances pour 2025" → "2025").
  const afterAnchor = text;

  // Strip law type prefix (projet de loi / proposition de loi / etc.)
  text = stripLawPrefix(text);

  // Strip connecting phrases
  text = stripConnectingPhrase(text);

  // Strip leading articles
  text = stripLeadingArticle(text);

  // Final cleanup
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/[.,:;]+$/, '').trim();

  // If too short after full stripping, fall back to anchor-cut text (still useful for TF-IDF)
  if (text.length < 5 && afterAnchor.length >= 5) {
    return afterAnchor.replace(/\s+/g, ' ').trim().replace(/[.,:;]+$/, '').trim();
  }

  // If still too short, fall back to original
  if (text.length < 5) {
    return normalizeUnicode(titre).replace(/\s+/g, ' ').trim();
  }

  return text;
}

// =============================================================================
// Step 4: Strip the law type prefix
// =============================================================================
function stripLawPrefix(text: string): string {
  return text
    .replace(/^(?:projet|proposition)\s+de\s+(?:loi|r[eé]solution)\s*/i, '')
    .replace(/^organique\s*/i, '')
    .replace(/^constitutionnelle?\s*/i, '')
    .replace(/^de\s+programmation\s*/i, '')
    .replace(/^de\s+finances?\s*/i, '')
    .replace(/^de\s+financement\s*/i, '')
    .replace(/^de\s+r[eè]glement\s*/i, '')
    .replace(/^adopt[eé]e?\s+par\s+(?:le\s+s[eé]nat|l'assembl[eé]e\s+nationale)\s*/i, '')
    .replace(/^(?:,\s*)?adopt[eé]e?\s+(?:en\s+\w+\s+lecture\s+)?par\s+(?:le\s+s[eé]nat|l'assembl[eé]e\s+nationale)\s*/i, '')
    .trim();
}

// =============================================================================
// Step 5: Strip connecting phrases
// =============================================================================
function stripConnectingPhrase(text: string): string {
  return text
    .replace(/^relatif(?:ve|s|ves)?\s+[àa]\s*/i, '')
    .replace(/^visant\s+[àa]\s*/i, '')
    .replace(/^portant\s+(?:sur\s+)?/i, '')
    .replace(/^tendant\s+[àa]\s*/i, '')
    .replace(/^concernant\s*/i, '')
    .replace(/^pour\s+/i, '')
    .replace(/^sur\s+/i, '')
    .trim();
}

// =============================================================================
// Step 6: Strip leading article
// =============================================================================
function stripLeadingArticle(text: string): string {
  return text
    .replace(/^l(?:'|')/i, '')
    .replace(/^la\s+/i, '')
    .replace(/^le\s+/i, '')
    .replace(/^les\s+/i, '')
    .replace(/^du\s+/i, '')
    .replace(/^des\s+/i, '')
    .replace(/^d(?:'|')/i, '')
    .replace(/^un\s+/i, '')
    .replace(/^une\s+/i, '')
    .trim();
}

// =============================================================================
// Step 7: Tokenize + filter stopwords → normalized tokens
// =============================================================================

/**
 * Tokenizes text and filters stopwords.
 * Returns an array of normalized tokens for TF-IDF.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for stopword matching
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !ALL_STOPWORDS.has(t));
}

/**
 * Full preprocessing pipeline: extractSubject → tokenize → join.
 * Returns a space-separated string of tokens ready for TF-IDF.
 */
export function preprocessTitle(titre: string): string {
  const subject = extractSubject(titre);
  const tokens = tokenize(subject);
  return tokens.join(' ');
}

/**
 * Jaccard similarity between two token sets: |A ∩ B| / |A ∪ B|.
 * Returns 0 if both sets are empty.
 */
export function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
