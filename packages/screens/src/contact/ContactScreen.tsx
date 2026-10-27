import { Button, Card, Container, GithubIcon, PageHeader, SectionHeader, XIcon } from "@clair/ui";
import { Bug, Lightbulb, Mail, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import editorial from "../shared/editorial/Editorial.module.css";
import classes from "./ContactScreen.module.css";
import { CONTRIBUTION_GUIDE_URL, type ContactChannel, channels, GITHUB_URL } from "./contenu.ts";

/** Icône du titre de chaque canal, et icône de son bouton. */
const ICONS: Record<ContactChannel["id"], { title: ReactNode; action?: ReactNode }> = {
  email: { title: <Mail /> },
  x: { title: <XIcon /> },
  bug: { title: <Bug />, action: <GithubIcon /> },
  idee: { title: <Lightbulb />, action: <MessageSquare /> },
};

/** Page « Contact » : canaux de contact, contribution au projet, délai de réponse. */
export const ContactScreen = () => (
  <Container size="etroit" className={editorial.page}>
    <PageHeader
      title="Contact"
      description="Une question, une suggestion, une erreur à signaler ? Plusieurs moyens de nous contacter."
    />

    <ul className={`${editorial.grid} ${classes.channels}`} data-columns="2">
      {channels.map((channel) => (
        <Card
          key={channel.id}
          as="li"
          title={channel.title}
          titleAs="h2"
          padding="lg"
          eyebrow={
            <span className={editorial.cardIcon} aria-hidden="true">
              {ICONS[channel.id].title}
            </span>
          }
        >
          <div className={classes.body}>
            <p className={classes.subtitle}>{channel.subtitle}</p>
            <p className={editorial.cardText}>{channel.text}</p>
            <div className={classes.action}>
              <Button
                href={channel.href}
                external={channel.external}
                variant="secondaire"
                size="sm"
                icon={ICONS[channel.id].action}
              >
                {channel.action}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </ul>

    <section
      className={`${editorial.section} ${editorial.panel} ${editorial.center}`}
      aria-labelledby="contribuer"
    >
      <SectionHeader id="contribuer" title="Contribuer au projet" />
      <p className={classes.text}>
        CLAIR est un projet open source. Développeurs, designers, data analysts : vos contributions
        sont les bienvenues !
      </p>
      <ul className={editorial.actions}>
        <li>
          <Button href={GITHUB_URL} external icon={<GithubIcon />}>
            Voir le code sur GitHub
          </Button>
        </li>
        <li>
          <Button href={CONTRIBUTION_GUIDE_URL} external variant="secondaire">
            Guide de contribution
          </Button>
        </li>
      </ul>
    </section>

    <p className={`${editorial.note} ${editorial.center} ${classes.response}`}>
      Nous nous efforçons de répondre à tous les messages dans un délai de 48h. Pour les bugs
      critiques, nous intervenons généralement plus rapidement.
    </p>
  </Container>
);
