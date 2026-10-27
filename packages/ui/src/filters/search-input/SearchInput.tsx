"use client";

import { CloseButton, TextInput } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { Search } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import classes from "./SearchInput.module.css";

/** Nom accessible du champ : un libellé visible, ou à défaut un `aria-label`. */
export type SearchInputLabel =
  | {
      /** Libellé visible au-dessus du champ (à privilégier). */ label: string;
      "aria-label"?: never;
    }
  | {
      label?: never /** Nom accessible quand le contexte rend le libellé évident. */;
      "aria-label": string;
    };

export type SearchInputProps = SearchInputLabel & {
  /** Texte recherché (contrôlé : l'écran le lit et l'écrit dans l'URL). */
  value: string;
  /** Appelé à chaque saisie, ou après `debounceMs` millisecondes sans frappe. */
  onChange: (value: string) => void;
  /** Appelé quand la personne valide avec Entrée (la saisie en attente est transmise d'abord). */
  onSubmit?: (value: string) => void;
  /** Délai de regroupement des frappes avant `onChange`, en millisecondes (0 : immédiat). */
  debounceMs?: number;
  /** Exemple de saisie ; ne remplace jamais le libellé. */
  placeholder?: string;
  /** Aide affichée sous le champ (et reliée au champ). */
  description?: string;
  disabled?: boolean;
  /** Nom accessible du bouton d'effacement. */
  clearLabel?: string;
  /** Nom du champ dans un formulaire. */
  name?: string;
};

/**
 * Champ de recherche contrôlé : icône décorative, bouton d'effacement accessible, validation
 * par Entrée, effacement par Échap. Avec `debounceMs`, la saisie reste fluide et `onChange`
 * n'est appelé qu'une fois la frappe arrêtée. Remplace `.search-input` de apps/web.
 */
export const SearchInput = ({
  value,
  onChange,
  onSubmit,
  debounceMs = 0,
  placeholder,
  description,
  disabled = false,
  clearLabel = "Effacer la recherche",
  name,
  label,
  "aria-label": ariaLabel,
}: SearchInputProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [emitted, setEmitted] = useState(value);
  /** Dernière saisie connue : une émission différée qui ne la porte plus est périmée. */
  const latest = useRef(value);

  // La valeur change de l'extérieur (bouton « Réinitialiser », navigation) : on la reprend,
  // sauf s'il s'agit de l'écho de notre propre saisie (la personne a pu continuer à taper).
  // La saisie encore en attente devient périmée : elle ne doit pas rétablir l'ancien filtre.
  if (value !== previous) {
    setPrevious(value);
    if (value !== emitted) {
      setDraft(value);
      setEmitted(value);
      latest.current = value;
    }
  }

  const emit = (next: string) => {
    setEmitted(next);
    onChange(next);
  };
  const debouncedEmit = useDebouncedCallback((next: string) => {
    if (next === latest.current) emit(next);
  }, debounceMs);

  /** Transmet tout de suite la saisie en attente. */
  const emitNow = (next: string) => {
    debouncedEmit.cancel();
    if (next !== emitted) emit(next);
  };

  const change = (next: string) => {
    latest.current = next;
    setDraft(next);
    if (debounceMs > 0) debouncedEmit(next);
    else emit(next);
  };

  const clear = () => {
    latest.current = "";
    setDraft("");
    emitNow("");
    input.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      emitNow(draft);
      if (onSubmit) {
        event.preventDefault();
        onSubmit(draft);
      }
    } else if (event.key === "Escape" && draft !== "") {
      event.preventDefault();
      clear();
    }
  };

  return (
    <TextInput
      ref={input}
      type="search"
      name={name}
      label={label}
      aria-label={ariaLabel}
      description={description}
      placeholder={placeholder}
      disabled={disabled}
      value={draft}
      onChange={(event) => change(event.currentTarget.value)}
      onKeyDown={handleKeyDown}
      autoComplete="off"
      classNames={{ input: classes.input }}
      leftSection={<Search className={classes.icon} aria-hidden="true" />}
      rightSection={
        draft !== "" && !disabled ? (
          <CloseButton size="sm" aria-label={clearLabel} onClick={clear} />
        ) : null
      }
      rightSectionPointerEvents="all"
    />
  );
};
