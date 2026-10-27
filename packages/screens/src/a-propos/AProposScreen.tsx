import { Button, Card, Container, GithubIcon, PageHeader, SectionHeader } from "@clair/ui";
import { Briefcase, Database, Mail, Users, Vote } from "lucide-react";
import editorial from "../shared/editorial/Editorial.module.css";
import classes from "./AProposScreen.module.css";
import { CONTRIBUTION_GUIDE_URL, offres, valeurs } from "./contenu.ts";

const ICONES = { parlementaires: Users, scrutins: Vote, lobbying: Briefcase, donnees: Database };

/**
 * Page « À propos » : mission, offre, valeurs, projet open source, contact.
 * Modèle des pages éditoriales : `Container` + `PageHeader` (unique `h1`), sections nommées par
 * leur `SectionHeader`, cartes `Card` et actions `Button` ; le CSS module ne fait que la mise en
 * page propre à l'écran.
 */
export const AProposScreen = () => (
  <Container size="etroit" className={editorial.page}>
    <PageHeader
      title={
        <>
          Rendre la politique <span className={classes.accent}>lisible</span>
        </>
      }
      description="CLAIR (Citoyen Libre, Analyse, Information, République) est une plateforme indépendante qui agrège et présente les données publiques de la vie politique française. Pas d'opinion, que des faits."
    />

    <section className={editorial.section} aria-labelledby="mission">
      <SectionHeader id="mission" title="Notre mission" />
      <div className={editorial.prose}>
        <p>
          La transparence politique est un pilier de la démocratie. Pourtant, les données sur
          l'activité de nos élus sont dispersées, difficiles d'accès et souvent incompréhensibles
          pour le citoyen.
        </p>
        <p>
          CLAIR rassemble ces informations publiques en un seul endroit, les structure, et les
          présente de manière claire et accessible. Notre objectif : permettre à chaque citoyen de
          comprendre ce que font ses représentants, comment ils votent, et qui cherche à les
          influencer.
        </p>
        <p>
          Nous ne portons aucun jugement politique. Nous présentons les faits tels qu'ils sont
          publiés par les institutions : Assemblée nationale, Sénat, Haute Autorité pour la
          transparence de la vie publique (HATVP) et Direction de l'information légale et
          administrative (DILA). D'autres sources officielles viendront s'ajouter au fur et à mesure
          de l'avancée du projet.
        </p>
      </div>
    </section>

    <section className={editorial.section} aria-labelledby="offre">
      <SectionHeader id="offre" title="Ce que nous proposons" />
      <ul className={editorial.grid} data-columns="2">
        {offres.map((offre) => {
          const Icone = ICONES[offre.icone];
          return (
            <Card
              key={offre.titre}
              as="li"
              title={offre.titre}
              padding="lg"
              eyebrow={
                <span className={editorial.cardIcon} aria-hidden="true">
                  <Icone />
                </span>
              }
            >
              <p className={editorial.cardText}>{offre.texte}</p>
            </Card>
          );
        })}
      </ul>
    </section>

    <section className={editorial.section} aria-labelledby="valeurs">
      <SectionHeader id="valeurs" title="Nos valeurs" />
      <ul className={editorial.grid} data-columns="3">
        {valeurs.map((valeur) => (
          <Card key={valeur.titre} as="li" title={valeur.titre}>
            <p className={editorial.cardText}>{valeur.texte}</p>
          </Card>
        ))}
      </ul>
    </section>

    <section className={`${editorial.section} ${editorial.panel}`} aria-labelledby="open-source">
      <SectionHeader id="open-source" title="Projet open source" />
      <p className={classes.text}>
        CLAIR est un projet open source. Le code est disponible sur GitHub et les contributions sont
        les bienvenues. Que vous soyez développeur, designer, data analyst ou simplement citoyen
        engagé, vous pouvez participer.
      </p>
      <ul className={editorial.actions}>
        <li>
          <Button href="https://github.com/accelaire/CLAIR" external icon={<GithubIcon />}>
            Voir sur GitHub
          </Button>
        </li>
        <li>
          <Button href={CONTRIBUTION_GUIDE_URL} external variant="secondaire">
            Guide de contribution
          </Button>
        </li>
        <li>
          <Button href="/methodologie" variant="secondaire">
            En savoir plus sur la méthodologie
          </Button>
        </li>
      </ul>
    </section>

    <section className={`${editorial.section} ${editorial.center}`} aria-labelledby="contact">
      <SectionHeader id="contact" title="Nous contacter" />
      <p className={classes.text}>Une question, une suggestion, une erreur à signaler ?</p>
      <div className={editorial.actions}>
        <Button href="/contact" variant="secondaire" icon={<Mail />}>
          Contact
        </Button>
      </div>
    </section>
  </Container>
);
