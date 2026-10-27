/**
 * Lecture des réunions de commission et des séances, partagée par les écrans commission, agenda
 * et réunion (reprise de `lib/ordre-du-jour.ts`, `lib/compte-rendu-url.ts` et `lib/debats.ts`
 * de apps/web).
 */

/**
 * Points de l'ordre du jour, un par entrée, sans ponctuation de liste. `odjComplet` d'abord :
 * `odjResume` est plafonné à 500 caractères et son dernier point est souvent coupé.
 */
export const pointsDeLOrdreDuJour = (
  resume: string | null | undefined,
  complet: string | null | undefined,
): string[] => {
  const source = complet || resume || "";
  if (source.length === 0) return [];
  return source
    .split(complet ? "\n" : "|")
    .map((point) =>
      point
        .trim()
        .replace(/^[-–—]\s*/u, "")
        .replace(/\s*[;,]\s*$/u, "")
        .trim(),
    )
    .filter((point) => point.length > 0);
};

/**
 * Adresse publique du compte rendu d'une réunion, ou `null`. Quatre formes de référence :
 * commission de l'Assemblée (`CRCANR…`), séance de l'Assemblée (`CRSANR…`), URL directe du
 * Sénat, séance du Sénat (`CRSSNR…AAAAMMJJ`).
 */
export const urlDuCompteRendu = (ref: string | null | undefined): string | null => {
  if (!ref) return null;
  if (ref.startsWith("http")) return ref;
  if (ref.startsWith("CRCANR")) return `https://www.assemblee-nationale.fr/dyn/docs/${ref}.html`;
  if (ref.startsWith("CRSANR")) {
    const legislature = /L(\d+)/.exec(ref)?.[1] ?? "17";
    return `https://www.assemblee-nationale.fr/dyn/${legislature}/comptes-rendus/seance/${ref}`;
  }
  if (ref.startsWith("CRSSNR")) {
    const jour = /(\d{8})$/.exec(ref)?.[1];
    return jour ? `https://www.senat.fr/cra/s${jour}/s${jour}_mono.html` : null;
  }
  return null;
};

/** Seules les adresses http(s) deviennent des liens (vidéo, compte rendu). */
export const lienSur = (url: string | null | undefined): string | null =>
  url && /^https?:\/\//.test(url) ? url : null;

/**
 * « vendredi 26 juin 2026, 9 heures ». L'horodatage stocké est l'heure de Paris sérialisée en
 * UTC : il se relit donc en UTC. Une heure à minuit (Sénat) n'est pas annoncée.
 */
export const libelleDeSeance = (iso: string): string => {
  const quand = new Date(iso);
  if (Number.isNaN(quand.getTime())) return "";
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(quand);
  const heures = quand.getUTCHours();
  const minutes = quand.getUTCMinutes();
  if (heures === 0 && minutes === 0) return jour;
  const heure =
    minutes === 0
      ? `${heures} heure${heures > 1 ? "s" : ""}`
      : `${heures} h ${String(minutes).padStart(2, "0")}`;
  return `${jour}, ${heure}`;
};

/** « 9 h 30 », en heure de Paris. */
export const heureDe = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

/** « mardi 3 mars 2026 », en heure de Paris. */
export const jourLong = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

/** « 3 mars 2026 ». */
export const jourCourt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

/** « 2 participants », « 1 réunion » : accord simple au pluriel. */
export const pluriel = (nombre: number, singulier: string, pluralForm = `${singulier}s`) =>
  `${nombre.toLocaleString("fr-FR")} ${nombre > 1 ? pluralForm : singulier}`;
