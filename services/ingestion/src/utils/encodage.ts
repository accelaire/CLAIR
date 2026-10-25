/**
 * Décode un export « latin1 » de l'Assemblée ou du Sénat.
 *
 * Ces fichiers sont annoncés en latin1 mais écrits en windows-1252 : dans le
 * CSV des séances de l'Assemblée, l'apostrophe typographique est l'octet 0x92,
 * qui en ISO-8859-1 strict est un caractère de contrôle invisible (U+0092).
 *
 * Le standard Encoding du WHATWG fait de toutes les étiquettes latin1
 * (`latin1`, `iso-8859-1`, `ascii`…) des alias de windows-1252. Node 24 s'y
 * conforme : `new TextDecoder('latin1')` y rend « ’ ». Node 20 décodait encore
 * la plage 0x80-0x9F en latin1 strict, d'où les U+0092 corrigés par la
 * migration `20261025000000_apostrophes_odj_seances_an`. On nomme donc
 * l'encodage réel plutôt qu'une étiquette dont le sens a changé sous nos pieds.
 *
 * Ne vaut pas pour `Buffer#toString('latin1')` ni pour l'option
 * `{ encoding: 'latin1' }` des flux, qui restent de l'ISO-8859-1 strict quelle
 * que soit la version de Node (cf. `decoderCp1252` dans
 * `sources/senat/amendements-client.ts`).
 */
export function decoderWindows1252(donnees: ArrayBuffer | Uint8Array): string {
  return new TextDecoder('windows-1252').decode(donnees);
}
