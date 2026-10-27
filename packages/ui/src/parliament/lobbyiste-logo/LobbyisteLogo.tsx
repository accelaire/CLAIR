import { Avatar } from "@mantine/core";
import { initiales } from "../parlementaire-avatar/ParlementaireAvatar.tsx";
import classes from "./LobbyisteLogo.module.css";

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
      <span aria-hidden="true">{initiales(nom)}</span>
    </Avatar>
  );
};
