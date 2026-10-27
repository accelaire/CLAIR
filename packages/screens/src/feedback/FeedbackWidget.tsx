"use client";

import { Button, useNavigation } from "@clair/ui";
import { Modal, Radio, Textarea, TextInput } from "@mantine/core";
import { CircleCheck, MessageCircle, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import classes from "./FeedbackWidget.module.css";
import {
  CLES,
  compterAction,
  DUREE_SILENCE_MS,
  doitRelancer,
  EVENEMENT_ACTION_FORTE,
  estPageDeValeur,
} from "./relance.ts";

export type Sentiment = "negatif" | "neutre" | "positif";
export type TypeRetour = "bug" | "idee" | "autre";

/** Corps envoyé à `POST /api/v1/feedback` (schéma Zod `feedbackBodySchema` de apps/api). */
export type RetourVisiteur = {
  sentiment: Sentiment | null;
  type: TypeRetour;
  message?: string;
  email?: string;
  page: string;
  trigger: "passif" | "nudge";
  /** Champ piège : rempli seulement par un robot, l'API rejette alors le retour. */
  website: string;
};

export type FeedbackWidgetProps = {
  /** Envoi du retour ; une promesse rejetée affiche un message d'erreur. */
  envoyer: (retour: RetourVisiteur) => Promise<void>;
};

const SENTIMENTS: { value: Sentiment; emoji: string; label: string }[] = [
  { value: "negatif", emoji: "😞", label: "Pas top" },
  { value: "neutre", emoji: "😐", label: "Moyen" },
  { value: "positif", emoji: "😊", label: "Bien" },
];

const TYPES: { value: TypeRetour; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idee", label: "Idée" },
  { value: "autre", label: "Autre" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Le stockage du navigateur peut être refusé (navigation privée stricte) : la relance s'efface. */
const stockages = () => {
  try {
    return { session: window.sessionStorage, local: window.localStorage };
  } catch {
    return null;
  }
};

/** Relance (« Un retour à nous faire ? ») : visites de fiches, actions fortes, une minute. */
const useRelance = (pathname: string, ouvert: boolean) => {
  const [relance, setRelance] = useState(false);
  const ouvertRef = useRef(ouvert);
  useEffect(() => {
    ouvertRef.current = ouvert;
  }, [ouvert]);

  const verifier = useCallback(() => {
    const s = stockages();
    if (!s || ouvertRef.current) return;
    if (doitRelancer(s.session, s.local, Date.now())) {
      s.session.setItem(CLES.relanceVue, "1");
      setRelance(true);
    }
  }, []);

  // Chaque fiche visitée compte, la page d'arrivée comprise.
  useEffect(() => {
    const s = stockages();
    if (s && estPageDeValeur(pathname)) compterAction(s.session, Date.now());
    verifier();
  }, [pathname, verifier]);

  // La règle de la minute se revérifie toutes les quinze secondes et à chaque action forte.
  useEffect(() => {
    const minuterie = window.setInterval(verifier, 15_000);
    window.addEventListener(EVENEMENT_ACTION_FORTE, verifier);
    return () => {
      window.clearInterval(minuterie);
      window.removeEventListener(EVENEMENT_ACTION_FORTE, verifier);
    };
  }, [verifier]);

  const ignorer = () => {
    stockages()?.local.setItem(CLES.silence, String(Date.now() + DUREE_SILENCE_MS));
    setRelance(false);
  };

  return { relance, masquer: () => setRelance(false), ignorer };
};

/**
 * Bouton flottant « Donner mon avis » et son formulaire de retour, dans une fenêtre modale
 * (focus piégé et rendu au bouton à la fermeture, Échap pour fermer). Un sentiment ou un message
 * suffit ; l'adresse électronique est facultative. À placer une fois, dans le layout du site.
 */
export const FeedbackWidget = ({ envoyer }: FeedbackWidgetProps) => {
  const { pathname } = useNavigation();
  const [ouvert, setOuvert] = useState(false);
  const [declencheur, setDeclencheur] = useState<RetourVisiteur["trigger"]>("passif");
  const { relance, masquer, ignorer } = useRelance(pathname, ouvert);

  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [type, setType] = useState<TypeRetour>("autre");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [erreurs, setErreurs] = useState<{ contenu?: string; email?: string }>({});
  const [envoi, setEnvoi] = useState<"repos" | "en-cours" | "reussi" | "echec">("repos");
  const id = useId();

  const ouvrir = (origine: RetourVisiteur["trigger"]) => {
    setDeclencheur(origine);
    setSentiment(null);
    setType("autre");
    setMessage("");
    setEmail("");
    setWebsite("");
    setErreurs({});
    setEnvoi("repos");
    masquer();
    setOuvert(true);
  };

  const soumettre = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const texte = message.trim();
    const adresse = email.trim();
    const nouvelles = {
      contenu:
        !sentiment && !texte
          ? "Choisissez une appréciation ou écrivez un message avant d'envoyer."
          : undefined,
      email:
        adresse && !EMAIL.test(adresse)
          ? "Adresse électronique invalide. Exemple : prenom.nom@exemple.fr"
          : undefined,
    };
    setErreurs(nouvelles);
    if (nouvelles.contenu || nouvelles.email) return;
    setEnvoi("en-cours");
    try {
      await envoyer({
        sentiment,
        type,
        message: texte || undefined,
        email: adresse || undefined,
        page: pathname,
        trigger: declencheur,
        website,
      });
      stockages()?.local.setItem(CLES.repondu, "1");
      setEnvoi("reussi");
    } catch {
      setEnvoi("echec");
    }
  };

  return (
    <div className={classes.ancre}>
      {relance && !ouvert ? (
        <div className={classes.relance}>
          <p className={classes.relanceTexte}>Un retour à nous faire ?</p>
          <Button size="sm" onClick={() => ouvrir("nudge")}>
            Donner mon avis
          </Button>
          <Button
            size="sm"
            variant="tertiaire"
            icon={<X />}
            aria-label="Ignorer la proposition de donner mon avis"
            onClick={ignorer}
          />
        </div>
      ) : null}
      <Button
        variant="secondaire"
        icon={<MessageCircle />}
        aria-label="Donner mon avis sur CLAIR"
        aria-haspopup="dialog"
        className={classes.declencheur}
        onClick={() => ouvrir("passif")}
      />

      <Modal
        opened={ouvert}
        onClose={() => setOuvert(false)}
        title="Votre avis sur CLAIR"
        closeButtonProps={{ "aria-label": "Fermer le formulaire de retour" }}
        classNames={{ title: classes.titre }}
        returnFocus
        trapFocus
      >
        {envoi === "reussi" ? (
          <div className={classes.succes} role="status">
            <CircleCheck aria-hidden="true" className={classes.succesIcone} />
            <p>Merci pour votre retour.</p>
            <Button variant="secondaire" onClick={() => setOuvert(false)}>
              Fermer
            </Button>
          </div>
        ) : (
          <form className={classes.formulaire} onSubmit={soumettre} noValidate>
            <p className={classes.aide}>
              Une appréciation ou un message suffit. Les autres champs sont facultatifs.
            </p>
            <Radio.Group
              label="Comment trouvez-vous le site ?"
              value={sentiment}
              onChange={(valeur) => {
                const trouve = SENTIMENTS.find((s) => s.value === valeur);
                setSentiment(trouve ? trouve.value : null);
                if (trouve) setErreurs((e) => ({ ...e, contenu: undefined }));
              }}
            >
              <div className={classes.options}>
                {SENTIMENTS.map((s) => (
                  <Radio
                    key={s.value}
                    value={s.value}
                    label={
                      <>
                        <span aria-hidden="true">{s.emoji}</span> {s.label}
                      </>
                    }
                  />
                ))}
              </div>
            </Radio.Group>
            <Radio.Group
              label="Type de retour"
              value={type}
              onChange={(valeur) =>
                setType(TYPES.find((t) => t.value === valeur)?.value ?? "autre")
              }
            >
              <div className={classes.options}>
                {TYPES.map((t) => (
                  <Radio key={t.value} value={t.value} label={t.label} />
                ))}
              </div>
            </Radio.Group>
            <Textarea
              label="Message (facultatif)"
              description="2 000 caractères au plus."
              maxLength={2000}
              rows={4}
              value={message}
              onChange={(event) => {
                setMessage(event.currentTarget.value);
                if (event.currentTarget.value.trim()) {
                  setErreurs((e) => ({ ...e, contenu: undefined }));
                }
              }}
              error={erreurs.contenu}
              errorProps={{ role: "alert" }}
            />
            <TextInput
              type="email"
              label="Adresse électronique (facultatif)"
              description="Seulement si vous souhaitez une réponse. Format : prenom.nom@exemple.fr"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              error={erreurs.email}
              errorProps={{ role: "alert" }}
            />
            <div className={classes.piege} aria-hidden="true">
              <label htmlFor={`${id}-website`}>Ne pas remplir ce champ</label>
              <input
                id={`${id}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.currentTarget.value)}
              />
            </div>
            {envoi === "echec" ? (
              <p className={classes.erreur} role="alert">
                L'envoi a échoué. Vérifiez votre connexion et réessayez.
              </p>
            ) : null}
            <Button type="submit" fullWidth loading={envoi === "en-cours"}>
              {envoi === "en-cours" ? "Envoi en cours…" : "Envoyer"}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
