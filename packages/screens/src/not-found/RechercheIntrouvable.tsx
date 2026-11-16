"use client";

import { Button, SearchInput, useNavigation } from "@clair/ui";
import { type FormEvent, useState } from "react";
import { rechercheHref } from "../recherche/params.ts";
import classes from "./NotFoundScreen.module.css";

/**
 * Recherche proposée sur la page introuvable, pour retrouver un élu, un scrutin ou un texte.
 * Formulaire `GET /recherche?q=…` : il fonctionne aussi sans JavaScript ; avec, la navigation
 * passe par le routeur de l'application.
 */
export const RechercheIntrouvable = () => {
  const { navigate } = useNavigation();
  const [q, setQ] = useState("");
  const chercher = (texte: string) => navigate(rechercheHref(texte));
  const soumettre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    chercher(q);
  };
  return (
    <search className={classes.recherche}>
      <form action="/recherche" method="get" className={classes.formulaire} onSubmit={soumettre}>
        <div className={classes.champ}>
          <SearchInput
            label="Rechercher un élu, un scrutin, un texte…"
            name="q"
            value={q}
            onChange={setQ}
            onSubmit={chercher}
          />
        </div>
        <Button type="submit">Rechercher</Button>
      </form>
    </search>
  );
};
