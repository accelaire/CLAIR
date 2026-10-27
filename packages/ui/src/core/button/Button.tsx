"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { useNavigation } from "../../lib/navigation.tsx";
import classes from "./Button.module.css";

export type ButtonVariant = "primaire" | "secondaire" | "tertiaire";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonAppearance = {
  /** Hiérarchie visuelle : une seule action primaire par zone. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône décorative (masquée aux lecteurs d'écran). */
  icon?: ReactNode;
  /** Position de l'icône par rapport au libellé. */
  iconPosition?: "start" | "end";
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
};

/**
 * Contenu : un libellé visible, ou une icône seule. Une icône seule exige un `aria-label`
 * (imposé par le type), sinon le bouton n'aurait pas de nom accessible.
 */
type ButtonContent =
  | { children: ReactNode; "aria-label"?: string }
  | { children?: undefined; icon: ReactNode; "aria-label": string };

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label" | "type"
> & {
  /** Type HTML du bouton (`button` par défaut : jamais de soumission involontaire). */
  type?: "button" | "submit" | "reset";
  /** Action en cours : le bouton reste focalisable mais n'agit plus, et l'annonce. */
  loading?: boolean;
  href?: undefined;
  external?: undefined;
};

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "aria-label"> & {
  /** Adresse : le bouton devient un lien (naviguer n'est pas agir). */
  href: string;
  /** Lien vers un autre site : nouvel onglet, annoncé aux lecteurs d'écran. */
  external?: boolean;
};

export type ButtonProps = ButtonAppearance & ButtonContent & (NativeButtonProps | AnchorProps);

const isLink = (props: ButtonProps): props is ButtonAppearance & ButtonContent & AnchorProps =>
  typeof props.href === "string";

/** Libellé et icône, communs au bouton et au lien. */
const Content = ({
  icon,
  iconPosition,
  loading,
  children,
}: {
  icon?: ReactNode;
  iconPosition: "start" | "end";
  loading: boolean;
  children?: ReactNode;
}) => {
  const visual = loading ? <LoaderCircle className={classes.spinner} /> : icon;
  const iconNode = visual ? (
    <span className={classes.icon} aria-hidden="true">
      {visual}
    </span>
  ) : null;
  return (
    <>
      {iconPosition === "start" ? iconNode : null}
      {children !== undefined ? <span className={classes.label}>{children}</span> : null}
      {iconPosition === "end" ? iconNode : null}
    </>
  );
};

/**
 * Bouton d'action (primaire, secondaire, tertiaire). Avec `href`, il rend un lien au même
 * aspect : interne par le routeur de l'application, externe dans un nouvel onglet annoncé.
 * Une icône seule exige un `aria-label`.
 */
export const Button = (props: ButtonProps) => {
  const { Link: RouterLink } = useNavigation();

  if (isLink(props)) {
    const {
      variant = "primaire",
      size = "md",
      icon,
      iconPosition = "start",
      fullWidth = false,
      external = false,
      href,
      children,
      className,
      "aria-label": ariaLabel,
      ...rest
    } = props;
    const shared = {
      className: [classes.button, className].filter(Boolean).join(" "),
      "data-variant": variant,
      "data-size": size,
      "data-icon-only": children === undefined || undefined,
      "data-full-width": fullWidth || undefined,
    };
    const content = (
      <Content icon={icon} iconPosition={iconPosition} loading={false}>
        {children}
      </Content>
    );
    if (external) {
      return (
        <a
          {...rest}
          {...shared}
          href={href}
          aria-label={ariaLabel ? `${ariaLabel} (nouvelle fenêtre)` : undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
          {children !== undefined ? (
            <>
              <ExternalLink className={classes.externalIcon} aria-hidden="true" />
              <span className="clair-visually-hidden"> (nouvelle fenêtre)</span>
            </>
          ) : null}
        </a>
      );
    }
    return (
      <RouterLink {...rest} {...shared} href={href} aria-label={ariaLabel}>
        {content}
      </RouterLink>
    );
  }

  const {
    variant = "primaire",
    size = "md",
    icon,
    iconPosition = "start",
    fullWidth = false,
    loading = false,
    type = "button",
    children,
    className,
    onClick,
    href: _href,
    external: _external,
    ...rest
  } = props;
  return (
    <button
      {...rest}
      type={type}
      className={[classes.button, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-icon-only={children === undefined || undefined}
      data-full-width={fullWidth || undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <Content icon={icon} iconPosition={iconPosition} loading={loading}>
        {children}
      </Content>
    </button>
  );
};
