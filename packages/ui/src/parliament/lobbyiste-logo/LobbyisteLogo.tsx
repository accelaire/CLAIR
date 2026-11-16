import { Avatar } from "@mantine/core";
import classes from "./LobbyisteLogo.module.css";

/**
 * Initiales d'un représentant d'intérêts, sur ses seuls caractères alphanumériques : première
 * lettre du premier et du dernier mot, ou les deux premiers caractères d'un nom en un mot
 * (« 1001PACT » donne « 10 », pas « 1 »).
 */
export const initialesLobbyiste = (nom: string): string => {
  const mots = nom.match(/[\p{L}\p{N}]+/gu) ?? [];
  const premier = mots[0] ?? "";
  const dernier = mots.length > 1 ? (mots[mots.length - 1] ?? "") : "";
  const lettres = dernier ? `${premier.charAt(0)}${dernier.charAt(0)}` : premier.slice(0, 2);
  return lettres.toUpperCase();
};

export type LobbyisteLogoProps = {
  /** Nom du représentant d'intérêts (`nom` dans le répertoire de la HATVP). */
  nom: string;
  /**
   * Adresse du logo, calculée par l'application (le composant n'appelle aucun service tiers).
   * Absente ou en erreur : initiales du nom.
   */
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  /** Logo décoratif, quand le nom est écrit juste à côté. */
  decorative?: boolean;
};

/**
 * Logo d'un représentant d'intérêts, ou ses initiales en repli.
 * Remplace `lobbying/LobbyisteLogo.tsx` de apps/web.
 */
export const LobbyisteLogo = ({
  nom,
  logoUrl,
  size = "md",
  decorative = false,
}: LobbyisteLogoProps) => {
  const libelle = `Logo de ${nom}`;
  return (
    // En span : le logo se place dans un titre (en-tête de la fiche), où une div est invalide.
    <Avatar
      component="span"
      src={logoUrl ?? null}
      alt=""
      size={size}
      radius="md"
      classNames={{ root: classes.root, placeholder: classes.placeholder, image: classes.image }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : libelle}
      aria-hidden={decorative ? true : undefined}
      imageProps={{ loading: "lazy" }}
    >
      <span aria-hidden="true">{initialesLobbyiste(nom)}</span>
    </Avatar>
  );
};
