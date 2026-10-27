import {
  Badge,
  Button,
  Card,
  Container,
  Link,
  PageHeader,
  SectionHeader,
  StatCard,
} from "@clair/ui";
import { Code, Database, FileText } from "lucide-react";
import editorial from "../shared/editorial/Editorial.module.css";
import classes from "./ApiPresentationScreen.module.css";
import {
  curlExample,
  DATAGOUV_URL,
  DOCS_URL,
  dataSources,
  endpoints,
  GITHUB_URL,
  PUBLIC_API_URL,
  usageTerms,
} from "./contenu.ts";

/**
 * Page « API ouverte » : pourquoi une API ouverte, ressources disponibles (liens vers des
 * exemples en direct), exemple `curl`, conditions d'utilisation et sources.
 */
export const ApiPresentationScreen = () => (
  <Container className={editorial.page}>
    <PageHeader
      title={
        <>
          L'API ouverte <span className={classes.accent}>CLAIR</span>
        </>
      }
      badges={
        <Badge tone="info" icon={<Database />}>
          Données ouvertes &amp; gratuites
        </Badge>
      }
      description="Accédez librement aux données politiques françaises. Députés, sénateurs, scrutins, lobbying, dossiers législatifs. Tout est documenté, structuré et gratuit."
      actions={
        <>
          <Button href={`${DOCS_URL}/api`} external icon={<FileText />}>
            Documentation de l'API
          </Button>
          <Button
            href={DATAGOUV_URL}
            external
            variant="secondaire"
            icon={<img src="/images/datagouv.svg" alt="" className={classes.logo} />}
          >
            Voir sur data.gouv.fr
          </Button>
        </>
      }
    />

    <section className={editorial.section} aria-labelledby="pourquoi">
      <div className={classes.why}>
        <div className={classes.whyText}>
          <SectionHeader id="pourquoi" title="Pourquoi une API ouverte ?" />
          <div className={editorial.prose}>
            <p>
              Les données politiques sont publiques par nature. Elles proviennent de l'Assemblée
              nationale, du Sénat, de la HATVP et de la DILA. CLAIR les agrège, les structure et les
              enrichit pour les rendre réellement exploitables.
            </p>
            <p>
              Notre API est <strong>gratuite, sans authentification</strong> et sans limite abusive.
              Que vous soyez journaliste, chercheur, développeur ou citoyen curieux, ces données
              vous appartiennent.
            </p>
            <p>
              CLAIR est désormais référencé sur <strong>data.gouv.fr</strong>, la plateforme ouverte
              des données publiques françaises.
            </p>
          </div>
        </div>
        <ul className={classes.figures} aria-label="L'API en chiffres">
          <StatCard as="li" label="endpoints principaux" value={endpoints.length} />
          <StatCard as="li" label="sources officielles" value={dataSources.length} />
          <StatCard as="li" label="gratuit, sans clé API" value="0" unit="€" />
        </ul>
      </div>
    </section>

    <section className={editorial.section} aria-labelledby="ressources">
      <SectionHeader
        id="ressources"
        title="Ce que vous pouvez récupérer"
        description="Chaque ressource est paginée, filtrable et documentée. Cliquez pour voir l'exemple en direct."
      />
      <ul className={editorial.grid} data-columns="3">
        {endpoints.map((endpoint) => {
          const Icon = endpoint.icon;
          return (
            <Card
              key={endpoint.path}
              as="li"
              title={endpoint.title}
              href={`${PUBLIC_API_URL}${endpoint.example}`}
              external
              eyebrow={
                <span className={editorial.cardIcon} aria-hidden="true">
                  <Icon />
                </span>
              }
            >
              <p className={editorial.cardText}>{endpoint.description}</p>
              <code className={classes.path}>{endpoint.path}</code>
            </Card>
          );
        })}
      </ul>
    </section>

    <section className={editorial.section} aria-labelledby="exemple">
      <SectionHeader
        id="exemple"
        title="Prêt en une ligne"
        description={
          <>
            Pas de clé API, pas d'inscription. Un simple{" "}
            <code className={classes.inline}>curl</code> suffit.
          </>
        }
      />
      <figure className={classes.terminal}>
        <figcaption className={classes.terminalCaption}>
          <Code aria-hidden="true" className={classes.terminalIcon} />
          Terminal
        </figcaption>
        <pre className={classes.code}>
          <code>{curlExample}</code>
        </pre>
      </figure>
      <p className={editorial.note}>
        Les réponses sont en JSON. Pagination via <code className={classes.inline}>page</code> et{" "}
        <code className={classes.inline}>limit</code>. Consultez la{" "}
        <Link href={`${DOCS_URL}/api`} external>
          documentation de l'API
        </Link>{" "}
        pour le détail de chaque endpoint, ou testez-les dans le{" "}
        <Link href={`${PUBLIC_API_URL}/docs`} external>
          Swagger
        </Link>
        .
      </p>
    </section>

    <div className={`${editorial.section} ${editorial.grid}`} data-columns="2">
      <Card as="section" title="Conditions d'utilisation" titleAs="h2" padding="lg">
        <ul className={classes.list}>
          {usageTerms.map((term) => (
            <li key={term}>{term}</li>
          ))}
          <li>
            <Link href={GITHUB_URL} external>
              Code source ouvert sur GitHub
            </Link>
          </li>
        </ul>
      </Card>
      <Card as="section" title="Sources des données" titleAs="h2" padding="lg">
        <ul className={classes.list}>
          {dataSources.map((source) => (
            <li key={source.name}>
              <strong>{source.name}</strong> : {source.text}
            </li>
          ))}
        </ul>
      </Card>
    </div>

    <section
      className={`${editorial.section} ${editorial.panel} ${editorial.center}`}
      aria-labelledby="contribuer"
    >
      <h2 id="contribuer" className={classes.ctaTitle}>
        Construisons ensemble la transparence
      </h2>
      <p className={classes.ctaText}>
        Vous avez un projet qui utilise nos données ? Une idée d'amélioration ? Contribuez au code
        ou contactez-nous.
      </p>
      <ul className={editorial.actions}>
        <li>
          <Button href={DOCS_URL} external icon={<FileText />}>
            Explorer la documentation
          </Button>
        </li>
        <li>
          <Button href="/soutenir" variant="secondaire">
            Soutenir CLAIR
          </Button>
        </li>
      </ul>
    </section>
  </Container>
);
