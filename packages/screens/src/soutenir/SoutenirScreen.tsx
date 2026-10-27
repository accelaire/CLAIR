import {
  Badge,
  Button,
  Card,
  Container,
  Faq,
  GithubIcon,
  Link,
  PageHeader,
  SectionHeader,
  ShareButton,
  StatCard,
} from "@clair/ui";
import { ArrowRight, BadgeCheck, Heart } from "lucide-react";
import editorial from "../shared/editorial/Editorial.module.css";
import type { ScreenProps } from "../shared/types.ts";
import {
  CONTACT_EMAIL,
  faq,
  figures,
  guarantees,
  HELLOASSO_URL,
  HELLOASSO_WIDGET_URL,
  helpTracks,
  ROADMAP_URL,
  type SoutenirStats,
  team,
  uses,
} from "./contenu.ts";
import classes from "./SoutenirScreen.module.css";

export type SoutenirScreenProps = ScreenProps<SoutenirStats>;

/**
 * Page « Soutenir » : appel au don (formulaire HelloAsso intégré sur grand écran, lien direct en
 * mobile), chiffres de CLAIR, autres façons d'aider, équipe et questions fréquentes.
 * Les chiffres (`initialData`, chargés par la route) sont un plus : sans eux, la section
 * disparaît et la page de don reste servie.
 */
export const SoutenirScreen = ({ initialData }: SoutenirScreenProps) => (
  <Container className={editorial.page}>
    <div className={classes.hero}>
      <PageHeader
        title="CLAIR reste gratuit grâce à vous"
        badges={
          <Badge tone="succes" icon={<BadgeCheck />}>
            Association d'intérêt général
          </Badge>
        }
        description="Pas de publicité, pas de compte, pas un euro de partis ou de lobbies. Juste les votes, les débats et le lobbying, ouverts à tous. Pour que ça dure, on a besoin de vous."
      />
      <ul className={editorial.actions}>
        <li>
          <Button href="#don" size="lg" icon={<Heart />}>
            Faire un don
          </Button>
        </li>
        <li>
          <Button href="#aider" size="lg" variant="secondaire">
            Aider autrement
          </Button>
        </li>
      </ul>
      <p className={editorial.note}>Déductible à 66 % de vos impôts, reçu fiscal automatique.</p>
    </div>

    {initialData ? (
      <section className={editorial.section} aria-labelledby="chiffres">
        <SectionHeader
          id="chiffres"
          title="Ce que vous trouvez déjà sur CLAIR"
          description="Mis à jour chaque nuit, depuis les sources officielles."
        />
        <ul className={editorial.grid} data-columns="4">
          {figures.map((figure) => (
            <StatCard
              key={figure.key}
              as="li"
              label={figure.label}
              value={initialData[figure.key]}
            />
          ))}
        </ul>
      </section>
    ) : null}

    <section className={editorial.section} aria-labelledby="usages">
      <SectionHeader id="usages" title="Ce que votre don rend possible" />
      <ul className={editorial.grid} data-columns="3">
        {uses.map((use) => {
          const Icon = use.icon;
          return (
            <Card
              key={use.title}
              as="li"
              title={use.title}
              padding="lg"
              eyebrow={
                <span className={editorial.cardIcon} aria-hidden="true">
                  <Icon />
                </span>
              }
            >
              <p className={editorial.cardText}>{use.text}</p>
            </Card>
          );
        })}
      </ul>
      <p className={`${editorial.note} ${editorial.center}`}>
        L'équipe est bénévole : chaque euro va au projet.{" "}
        <Link href={ROADMAP_URL} external>
          Notre feuille de route est publique
        </Link>
        .
      </p>
    </section>

    <section
      id="don"
      className={`${editorial.section} ${classes.donation}`}
      aria-labelledby="don-titre"
    >
      <div className={classes.form}>
        <h2 id="don-titre" className={classes.donationTitle}>
          <Heart aria-hidden="true" className={classes.heart} />
          Faire un don
        </h2>
        <div className={classes.widget}>
          <iframe
            src={HELLOASSO_WIDGET_URL}
            title="Formulaire de don HelloAsso"
            allow="payment"
            loading="lazy"
            className={classes.iframe}
          />
        </div>
        <div className={classes.mobileDonation}>
          <p className={editorial.note}>
            Le formulaire s'ouvre sur HelloAsso, la plateforme de paiement des associations.
          </p>
          <Button href={HELLOASSO_URL} external icon={<Heart />} fullWidth>
            Faire un don
          </Button>
        </div>
      </div>

      <div className={classes.howTo}>
        <h3 className={classes.howToTitle}>Comment ça marche</h3>
        <ul className={classes.guarantees}>
          {guarantees.map((guarantee) => {
            const Icon = guarantee.icon;
            return (
              <li key={guarantee.title} className={classes.guarantee}>
                <Icon aria-hidden="true" className={classes.guaranteeIcon} />
                <div>
                  <p className={classes.guaranteeTitle}>{guarantee.title}</p>
                  <p className={classes.guaranteeText}>{guarantee.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>

    <section id="aider" className={editorial.section} aria-labelledby="aider-titre">
      <SectionHeader
        id="aider-titre"
        title="Pas de budget ? Aidez autrement"
        description="Le plus précieux pour nous, c'est que CLAIR soit connu."
      />
      <ul className={editorial.grid} data-columns="4">
        <Card as="li" title="Partagez CLAIR">
          <div className={classes.track}>
            <p className={editorial.cardText}>
              Une fiche de député, un scrutin, un dossier : envoyez-le à quelqu'un que ça intéresse.
            </p>
            <ShareButton
              url="https://clair.vote"
              title="CLAIR"
              text="Les votes, les débats et le lobbying au Parlement, ouverts à tous."
            />
          </div>
        </Card>
        {helpTracks.map((track) => {
          const Icon = track.icon;
          return (
            <Card key={track.id} as="li" title={track.title}>
              <div className={classes.track}>
                <p className={editorial.cardText}>{track.text}</p>
                <Button
                  href={track.href}
                  external={track.href.startsWith("http")}
                  variant="tertiaire"
                  size="sm"
                  icon={Icon ? <Icon /> : <GithubIcon />}
                >
                  {track.label}
                </Button>
              </div>
            </Card>
          );
        })}
      </ul>
    </section>

    <section className={`${editorial.section} ${editorial.panel}`} aria-labelledby="equipe">
      <SectionHeader id="equipe" title="Derrière le projet" />
      <ul className={editorial.grid} data-columns="3">
        {team.map((member) => (
          <Card
            key={member.name}
            as="li"
            title={member.name}
            padding="lg"
            className={classes.member}
            eyebrow={
              <img
                src={member.photo}
                alt={member.alt}
                width={120}
                height={120}
                className={classes.photo}
              />
            }
          >
            <p className={classes.role}>{member.role}</p>
            <p className={classes.quote}>{member.quote}</p>
            <Link href={member.linkedin} external>
              LinkedIn<span className="clair-visually-hidden"> de {member.name}</span>
            </Link>
          </Card>
        ))}
      </ul>
    </section>

    <section className={`${editorial.section} ${classes.faq}`} aria-labelledby="faq">
      <SectionHeader
        id="faq"
        title="Questions fréquentes"
        description={
          <>
            Une question ? Écrivez-nous à{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
          </>
        }
      />
      <Faq items={faq} defaultOpened={[0]} />
      <div className={`${editorial.actions} ${classes.finalAction}`}>
        <Button href="#don" size="lg" icon={<ArrowRight />} iconPosition="end">
          <Heart aria-hidden="true" className={classes.inlineHeart} />
          Je soutiens CLAIR
        </Button>
      </div>
    </section>
  </Container>
);
