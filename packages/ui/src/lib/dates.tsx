/**
 * Dates des composants, en heure de Paris, avec un repli : une date vide ou invalide venue des
 * données affiche « date inconnue » au lieu de lever une exception, qui ferait tomber la page.
 */

const TIME_ZONE = "Europe/Paris";

/** Jour en toutes lettres : « 3 mars 2026 ». */
export const jourParis = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** Mois et année : « mars 2026 ». */
export const moisParis = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export const DATE_INCONNUE = "date inconnue";

/** Jour `YYYY-MM-DD` d'un instant à Paris (et non dans le fuseau du navigateur ou du serveur). */
export const jourAParis = (instant: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(instant);

/** La date ISO est-elle exploitable ? */
export const estDateValide = (iso: string | null | undefined): iso is string =>
  Boolean(iso) && !Number.isNaN(new Date(iso as string).getTime());

/** Date formatée, ou `null` si elle est vide ou invalide. */
export const formatSur = (format: Intl.DateTimeFormat, iso: string | null | undefined) =>
  estDateValide(iso) ? format.format(new Date(iso)) : null;

export type QuandProps = {
  /** Date ISO venue des données. */
  iso: string | null | undefined;
  /** Format d'affichage (par défaut le jour : « 3 mars 2026 »). */
  format?: Intl.DateTimeFormat;
  className?: string;
};

/** `<time>` formaté, ou « date inconnue » en texte quand la donnée est vide ou invalide. */
export const Quand = ({ iso, format = jourParis, className }: QuandProps) => {
  const texte = formatSur(format, iso);
  return texte ? (
    <time className={className} dateTime={iso ?? undefined}>
      {texte}
    </time>
  ) : (
    <span className={className}>{DATE_INCONNUE}</span>
  );
};
