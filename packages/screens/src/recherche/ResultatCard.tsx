import type { SearchResult } from "@clair/data";
import {
  Badge,
  Card,
  type CardHeading,
  formatDossierTitre,
  GroupeBadge,
  ParlementaireAvatar,
  parseStatut,
  StatutBadge,
} from "@clair/ui";
import classes from "./RechercheScreen.module.css";
import {
  CATEGORIE,
  categorieDe,
  compte,
  libelleAncien,
  libelleTypeCommission,
  lienDe,
} from "./resultats.ts";

const NOM_CHAMBRE = (chambre: string) => (chambre === "senat" ? "Sénat" : "Assemblée nationale");

/** Statut en badge texte, ou l'état brut s'il n'est pas reconnu. */
const Statut = ({ valeur }: { valeur: string | null }) => {
  if (!valeur) return null;
  const statut = parseStatut(valeur);
  return statut ? (
    <StatutBadge statut={statut} size="sm" />
  ) : (
    <Badge tone="neutre" size="sm">
      {valeur}
    </Badge>
  );
};

const Meta = ({ morceaux }: { morceaux: (string | null | false | undefined)[] }) => {
  const visibles = morceaux.filter((morceau): morceau is string => Boolean(morceau));
  return visibles.length > 0 ? <p className={classes.meta}>{visibles.join(" · ")}</p> : null;
};

const titreDe = (resultat: SearchResult) => {
  switch (resultat._type) {
    case "depute":
    case "senateur":
      return resultat.nomComplet || `${resultat.prenom} ${resultat.nom}`;
    case "scrutin":
      return resultat.titre;
    case "lobbyiste":
    case "groupe":
      return resultat.nom;
    case "dossier":
      return formatDossierTitre(resultat.titre, resultat.procedureLibelle);
    case "commission":
      return resultat.nomCourt || resultat.nom;
    case "sujet":
      return resultat.label;
  }
};

const Details = ({ resultat }: { resultat: SearchResult }) => {
  switch (resultat._type) {
    case "depute":
    case "senateur":
      return (
        <div className={classes.parlementaire}>
          <ParlementaireAvatar
            nom={titreDe(resultat)}
            photoUrl={resultat.photoUrl}
            size="md"
            decorative
          />
          <div className={classes.details}>
            {resultat.ancien ? (
              <p className={classes.badges}>
                <Badge tone="neutre" size="sm">
                  {libelleAncien(resultat)}
                </Badge>
              </p>
            ) : null}
            {resultat.groupe ? (
              <p className={classes.badges}>
                <GroupeBadge sigle={resultat.groupe} couleur={resultat.groupeCouleur} size="sm" />
              </p>
            ) : null}
            {resultat.circonscription ? (
              <p className={classes.meta}>
                {resultat.circonscription}
                {resultat.departement ? ` (${resultat.departement})` : null}
              </p>
            ) : null}
          </div>
        </div>
      );
    case "scrutin":
      return (
        <div className={classes.ligne}>
          <span className={classes.meta}>Scrutin n° {resultat.numero}</span>
          <Statut valeur={resultat.sort} />
        </div>
      );
    case "lobbyiste":
      return <Meta morceaux={[resultat.type, resultat.secteur]} />;
    case "dossier":
      return (
        <div className={classes.ligne}>
          <Statut valeur={resultat.etat} />
          {resultat.loiNumero ? (
            <span className={classes.meta}>Loi n° {resultat.loiNumero}</span>
          ) : null}
        </div>
      );
    case "groupe":
      return (
        <Meta
          morceaux={[
            resultat.nomComplet !== resultat.nom ? resultat.nomComplet : null,
            NOM_CHAMBRE(resultat.chambre),
            resultat.statsMembresActifs ? `${resultat.statsMembresActifs} membres` : null,
          ]}
        />
      );
    case "commission":
      return (
        <div className={classes.ligne}>
          {resultat.actif === false ? (
            <Badge tone="neutre" size="sm">
              Dissoute
            </Badge>
          ) : null}
          <Meta
            morceaux={[
              NOM_CHAMBRE(resultat.chambre),
              resultat.type ? libelleTypeCommission(resultat.type) : null,
            ]}
          />
        </div>
      );
    case "sujet":
      return (
        <Meta
          morceaux={[
            resultat.category,
            resultat.scrutinCount > 0 ? compte(resultat.scrutinCount, "scrutin") : null,
            resultat.dossierCount > 0 ? compte(resultat.dossierCount, "dossier") : null,
          ]}
        />
      );
  }
};

/**
 * Résultat de recherche : nature du résultat (texte et icône), nom ou intitulé (unique lien de
 * la carte), puis ce qui l'identifie (groupe, circonscription, sort du vote, état du dossier…).
 * Un statut est toujours écrit, jamais porté par la seule couleur.
 */
export const ResultatCard = ({
  resultat,
  titleAs = "h3",
}: {
  resultat: SearchResult;
  titleAs?: CardHeading;
}) => {
  const { singulier, icone: Icone } = CATEGORIE[categorieDe(resultat)];
  return (
    <Card
      as="li"
      titleAs={titleAs}
      padding="sm"
      href={lienDe(resultat)}
      title={titreDe(resultat)}
      eyebrow={
        <span className={classes.nature}>
          <Icone className={classes.icone} aria-hidden="true" />
          {singulier}
        </span>
      }
    >
      <Details resultat={resultat} />
    </Card>
  );
};
