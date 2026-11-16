import type { MotionCensure, PersonneGouvernement, ProjetLoi, StadeProjet } from "@clair/data";
import { Badge, type BadgeTone, Link, ParlementaireAvatar } from "@clair/ui";
import { scrutinHref } from "../scrutins.ts";
import classes from "./ElementsGouvernement.module.css";
import { dateLongue, LIBELLES_STADE, lienFiche, nomPersonne } from "./gouvernements.ts";

/** Le nom d'un membre du Gouvernement, lié à sa fiche quand il en a une. */
export const NomMembre = ({ personne }: { personne: PersonneGouvernement }) => {
  const fiche = lienFiche(personne);
  const nom = nomPersonne(personne);
  return fiche ? <Link href={fiche}>{nom}</Link> : nom;
};

/**
 * La photo de la fiche quand la personne en a une, ses initiales sinon : les membres sans fiche
 * restent identifiables d'un coup d'œil. Décorative : le nom est toujours écrit à côté.
 */
export const PortraitMembre = ({
  personne,
  size = "sm",
}: {
  personne: PersonneGouvernement;
  size?: "sm" | "md" | "lg" | "xl";
}) => (
  <ParlementaireAvatar
    nom={nomPersonne(personne)}
    photoUrl={personne.parlementaire?.photoUrl ?? null}
    size={size}
    decorative
  />
);

const TON_STADE: Record<StadeProjet, BadgeTone> = {
  promulgue: "succes",
  adopte: "info",
  examine: "avertissement",
  depose: "neutre",
};

/** Le stade atteint par un projet de loi ; le libellé porte le sens, la couleur l'accompagne. */
export const StadeProjetBadge = ({ stade }: { stade: StadeProjet }) => (
  <Badge tone={TON_STADE[stade]} size="sm">
    {LIBELLES_STADE[stade]}
  </Badge>
);

/** Un projet de loi : titre lié au dossier, dépôt, porteur, stade, loi promulguée. */
export const ProjetLigne = ({
  projet,
  porteur,
  role,
}: {
  projet: ProjetLoi;
  porteur?: PersonneGouvernement | null;
  /** Rôle du membre dans le projet, sur la fiche d'un parlementaire. */
  role?: string;
}) => (
  <li className={classes.projet}>
    <Link href={`/dossiers/${projet.dossier.uid}`}>{projet.dossier.titre}</Link>
    <div className={classes.mention}>
      {role ? <span>{role === "chef_de_file" ? "Chef de file" : "Cosignataire"} ·</span> : null}
      <span>
        Déposé {projet.chambreDepot === "senat" ? "au Sénat" : "à l’Assemblée"} le{" "}
        {dateLongue(projet.dateDepot)}
      </span>
      {porteur ? (
        <span>
          · porté par <NomMembre personne={porteur} />
        </span>
      ) : null}
      <StadeProjetBadge stade={projet.stade} />
      {projet.loi ? (
        projet.loi.urlLegifrance ? (
          <Link href={projet.loi.urlLegifrance} external>
            loi n° {projet.loi.numero}
          </Link>
        ) : (
          <span>loi n° {projet.loi.numero}</span>
        )
      ) : null}
    </div>
  </li>
);

/** Une motion de censure : voix, majorité requise, issue et lien vers son scrutin. */
export const MotionLigne = ({ motion }: { motion: MotionCensure }) => (
  <li className={classes.motion} data-adoptee={motion.adoptee || undefined}>
    <span className={classes.fort}>
      {motion.premierSignataire ? `Motion de ${motion.premierSignataire}` : "Motion de censure"}
    </span>
    {" : "}
    {motion.pour.toLocaleString("fr-FR")} voix pour
    {motion.majoriteRequise !== null
      ? `, ${motion.majoriteRequise.toLocaleString("fr-FR")} requises`
      : ""}
    , {motion.adoptee ? <strong>adoptée, le gouvernement est renversé</strong> : "rejetée"}
    {" · "}
    <Link href={scrutinHref(motion.scrutin)}>scrutin du {dateLongue(motion.date)}</Link>
  </li>
);
