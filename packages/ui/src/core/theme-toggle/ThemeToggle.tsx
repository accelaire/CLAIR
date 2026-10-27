"use client";

import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { Moon, Sun } from "lucide-react";
import classes from "./ThemeToggle.module.css";

/** Bascule entre les thèmes clair et sombre ; le choix est mémorisé par Mantine. */
export const ThemeToggle = () => {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const dark = scheme === "dark";
  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      className={classes.toggle}
      onClick={() => setColorScheme(dark ? "light" : "dark")}
      aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </ActionIcon>
  );
};
