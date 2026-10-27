import type { DeclarationHatvp } from "@clair/data";
import { Card, Link, ProvenanceLabel, SectionHeader } from "@clair/ui";
import { formatDate } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

const TYPES: Record<string, string> = {
  di: "Déclaration d'intérêts",
  dia: "Déclaration d'intérêts et d'activités",
  diam: "Déclaration d'intérêts (modification)",
  dsp: "Déclaration de situation patrimoniale",
  dspm: "Déclaration de situation patrimoniale (modification)",
  dspfm: "Déclaration de situation patrimoniale (fin de mandat)",
};

/** Onglet « Déclarations » : déclarations publiées par la HATVP, avec le lien vers hatvp.fr. */
export const OngletDeclarations = ({ declarations }: { declarations: DeclarationHatvp[] }) => (
  <section className={classes.onglet} aria-labelledby="declarations">
    <SectionHeader
      id="declarations"
      title="Déclarations à la HATVP"
      description={
        <ProvenanceLabel
          provenance="officielle"
          source="Haute Autorité pour la transparence de la vie publique"
        />
      }
    />
    <ul className={classes.grilleDeux}>
      {declarations.map((declaration) => (
        <Card
          key={declaration.id}
          as="li"
          title={TYPES[declaration.typeDocument] ?? declaration.typeDocument}
          footer={
            declaration.urlDossier ? (
              <Link href={declaration.urlDossier} external>
                Consulter sur hatvp.fr
              </Link>
            ) : undefined
          }
        >
          <p className={classes.texte}>
            {declaration.datePublication
              ? `Publiée le ${formatDate(declaration.datePublication)}`
              : (declaration.statut ?? "Publication à venir")}
          </p>
        </Card>
      ))}
    </ul>
  </section>
);
