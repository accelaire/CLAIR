import { Avatar } from "@mantine/core";
import classes from "./ParlementaireAvatar.module.css";

export type ParlementaireAvatarSize = "sm" | "md" | "lg" | "xl";

export type ParlementaireAvatarProps = {
  /** Nom affiché du parlementaire (« Camille Exemple ») : texte alternatif de la photo. */
  nom: string;
  /** Photo officielle (`photoUrl` de l'API). Absente ou en erreur : initiales. */
  photoUrl?: string | null;
  size?: ParlementaireAvatarSize;
  /**
   * Avatar décoratif, quand le nom est écrit juste à côté (carte, liste) :
   * masqué aux lecteurs d'écran pour ne pas lire le nom deux fois.
   */
  decorative?: boolean;
};

/** Initiales d'un nom : première lettre du premier et du dernier mot (« Camille Exemple » → « CE »). */
export const initiales = (nom: string): string => {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const premier = mots[0] ?? "";
  const dernier = mots.length > 1 ? (mots[mots.length - 1] ?? "") : "";
  return `${premier.charAt(0)}${dernier.charAt(0)}`.toUpperCase();
};

/**
 * Photo d'un député ou d'un sénateur, ou ses initiales quand la photo manque.
 * Informatif par défaut (nom accessible = nom du parlementaire) ; `decorative` à côté du nom écrit.
 */
export const ParlementaireAvatar = ({
  nom,
  photoUrl,
  size = "md",
  decorative = false,
}: ParlementaireAvatarProps) => (
  <Avatar
    src={photoUrl ?? null}
    alt=""
    size={size}
    classNames={{ root: classes.root, placeholder: classes.placeholder, image: classes.image }}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : nom}
    aria-hidden={decorative ? true : undefined}
  >
    <span aria-hidden="true">{initiales(nom)}</span>
  </Avatar>
);
