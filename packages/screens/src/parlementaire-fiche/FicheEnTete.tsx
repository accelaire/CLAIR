import type { Chambre, ParlementaireDetail } from "@clair/data";
import {
  Badge,
  Breadcrumb,
  Button,
  ChambreBadge,
  GroupeBadge,
  Link,
  PageHeader,
  ParlementaireAvatar,
  ProvenanceLabel,
} from "@clair/ui";
import { GitCompareArrows } from "lucide-react";
import { CHAMBRE_CONFIG, formatDate, groupeHref } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

const ordinal = (numero: number) => (numero === 1 ? "1re" : `${numero}e`);

/** « 2e circonscription (09) » à l'Assemblée, « Hauts-de-Seine (92) » au Sénat. */
const libelleCirconscription = (
  circonscription: NonNullable<ParlementaireDetail["circonscription"]>,
  chambre: Chambre,
) =>
  chambre === "assemblee" && circonscription.numero > 0
    ? `${ordinal(circonscription.numero)} circonscription (${circonscription.departement})`
    : `${circonscription.nom} (${circonscription.departement})`;

/** Lien X (Twitter) d'un identifiant, avec ou sans « @ ». */
const lienX = (identifiant: string) => `https://x.com/${identifiant.replace(/^@/, "")}`;

/**
 * En-tête de la fiche : fil d'Ariane, photo, nom (unique `h1`), chambre, groupe, mandat terminé,
 * circonscription, profession, contacts, source officielle et accès au comparateur.
 */
export const FicheEnTete = ({
  fiche,
  chambre,
}: {
  fiche: ParlementaireDetail;
  chambre: Chambre;
}) => {
  const config = CHAMBRE_CONFIG[chambre];
  const nom = `${fiche.prenom} ${fiche.nom}`;
  const details = [
    fiche.circonscription ? libelleCirconscription(fiche.circonscription, chambre) : null,
    chambre === "senat" && fiche.serie ? `Série ${fiche.serie}` : null,
    fiche.profession,
    fiche.dateNaissance
      ? `${fiche.sexe === "F" ? "Née" : "Né"} le ${formatDate(fiche.dateNaissance)}${fiche.lieuNaissance ? ` à ${fiche.lieuNaissance}` : ""}`
      : null,
    fiche.commissionPermanente,
  ].filter((detail) => detail !== null && detail !== "");
  const contacts = [
    fiche.email ? { label: "Courriel", href: `mailto:${fiche.email}`, external: false } : null,
    fiche.twitter ? { label: "X (Twitter)", href: lienX(fiche.twitter), external: true } : null,
    fiche.facebook ? { label: "Facebook", href: fiche.facebook, external: true } : null,
    fiche.siteWeb ? { label: "Site web", href: fiche.siteWeb, external: true } : null,
  ].filter((contact) => contact !== null);

  return (
    <div className={classes.entete}>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: config.titre, href: config.chemin },
          { label: nom },
        ]}
      />
      <div className={classes.identite}>
        <ParlementaireAvatar nom={nom} photoUrl={fiche.photoUrl} size="xl" decorative />
        <PageHeader
          title={nom}
          badges={
            <>
              <ChambreBadge chambre={chambre} size="sm" />
              {fiche.actif ? null : (
                <Badge tone="neutre" size="sm">
                  Mandat terminé
                </Badge>
              )}
              {fiche.groupe ? (
                <span className={classes.groupe}>
                  {fiche.actif ? null : <span>Dernier groupe :</span>}
                  <GroupeBadge
                    sigle={fiche.groupe.nom}
                    nom={fiche.groupe.nomComplet}
                    couleur={fiche.groupe.couleur}
                    size="sm"
                  />
                  <Link href={groupeHref(chambre, fiche.groupe.slug)}>
                    {fiche.groupe.nomComplet ?? fiche.groupe.nom}
                  </Link>
                </span>
              ) : null}
            </>
          }
          description={
            <>
              {details.length > 0 ? (
                <ul className={classes.details}>
                  {details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
              {contacts.length > 0 ? (
                <ul className={classes.contacts} aria-label="Contacts">
                  {contacts.map((contact) => (
                    <li key={contact.label}>
                      <Link href={contact.href} external={contact.external}>
                        {contact.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={classes.source}>
                <ProvenanceLabel provenance="officielle" source={config.source.producteur} />
                <Link href={config.source.href} external>
                  {config.source.label}
                </Link>
              </p>
            </>
          }
          actions={
            <Button
              href={`${config.chemin}?compare=${fiche.slug}`}
              variant="secondaire"
              icon={<GitCompareArrows />}
            >
              Comparer avec d'autres {config.pluriel}
            </Button>
          }
        />
      </div>
    </div>
  );
};
