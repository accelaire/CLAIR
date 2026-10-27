import { Callout, Card, Container, Link, PageHeader, SectionHeader } from "@clair/ui";
import editorial from "../shared/editorial/Editorial.module.css";
import { Blocks } from "../shared/rich-text/RichText.tsx";
import {
  aiTechnology,
  collectProcess,
  complementarySources,
  dataModel,
  enrichedData,
  hatvpNote,
  limitations,
  reliabilityGuarantees,
  sources,
  stack,
  updateFrequency,
} from "./contenu.ts";
import classes from "./MethodologieScreen.module.css";

/**
 * Page « Méthodologie » : sources officielles, synchronisation, enrichissement par IA (donnée
 * générée, distinguée de la donnée officielle), modèle de données, stack et limites.
 * Les ancres `#hatvp` et `#enrichissement-ia` sont citées par d'autres pages.
 */
export const MethodologieScreen = () => (
  <Container size="etroit" className={editorial.page}>
    <PageHeader
      title="Méthodologie"
      description="CLAIR agrège des données publiques provenant de sources officielles. Cette page explique comment nous collectons, structurons et présentons ces informations."
    />

    <section className={editorial.section} aria-labelledby="sources">
      <SectionHeader
        id="sources"
        title="Sources de données"
        description="Toutes nos données proviennent de sources officielles et publiques. Aucune donnée n'est inventée ou estimée."
      />
      <div className={classes.stack}>
        {sources.map((source) => (
          <Card
            key={source.title}
            as="article"
            title={source.title}
            padding="lg"
            footer={
              <Link href={source.url} external>
                {source.urlLabel}
              </Link>
            }
          >
            <div id={source.id} className={classes.anchor}>
              <Blocks
                blocks={[
                  { type: "paragraph", text: source.intro, tone: "mention" },
                  {
                    type: "labelled",
                    label: "Données collectées :",
                    blocks: [{ type: "list", items: source.collected }],
                  },
                  ...(source.format
                    ? [
                        {
                          type: "paragraph" as const,
                          text: [{ strong: "Format :" }, ` ${source.format}`],
                        },
                      ]
                    : []),
                ]}
              />
              {source.id === "hatvp" ? (
                <div className={classes.note}>
                  <Callout tone="avertissement" title="Note sur le comptage" titleAs="h4">
                    <Blocks blocks={hatvpNote} />
                  </Callout>
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </section>

    <section className={editorial.section} aria-labelledby="synchronisation">
      <SectionHeader
        id="synchronisation"
        title="Synchronisation des données"
        description="Notre système d'ingestion récupère et met à jour les données de manière automatique et régulière."
      />
      <div className={classes.stack}>
        <Card title="Processus de collecte" padding="lg">
          <Blocks blocks={[collectProcess]} />
        </Card>
        <Card title="Fréquence des mises à jour" padding="lg">
          <Blocks blocks={[updateFrequency]} />
        </Card>
      </div>
    </section>

    <section id="enrichissement-ia" className={editorial.section} aria-labelledby="ia">
      <SectionHeader
        id="ia"
        title="Enrichissement par intelligence artificielle"
        description="Pour rendre les données parlementaires plus accessibles, CLAIR utilise l'intelligence artificielle pour générer des résumés et des analyses complémentaires."
      />
      <div className={classes.stack}>
        <Card title="Technologie utilisée" padding="lg">
          <Blocks blocks={[aiTechnology]} />
        </Card>
        <Card title="Sources complémentaires" padding="lg">
          <Blocks blocks={complementarySources} />
        </Card>
        <Card title="Données enrichies" padding="lg">
          <Blocks blocks={[enrichedData]} />
        </Card>
        <Callout tone="info" title="Garanties de fiabilité" titleAs="h3">
          <Blocks blocks={[reliabilityGuarantees]} />
        </Callout>
      </div>
    </section>

    <section className={editorial.section} aria-labelledby="modele">
      <SectionHeader
        id="modele"
        title="Modèle de données"
        description="Les données sont structurées autour des entités principales suivantes :"
      />
      <ul className={editorial.grid} data-columns="2">
        {dataModel.map((entity) => (
          <Card key={entity.title} as="li" title={entity.title}>
            <p className={editorial.cardText}>{entity.text}</p>
          </Card>
        ))}
      </ul>
    </section>

    <section className={editorial.section} aria-labelledby="stack">
      <SectionHeader
        id="stack"
        title="Stack technique"
        description="CLAIR est construit avec des technologies modernes et open source :"
      />
      <ul className={editorial.grid} data-columns="3">
        {stack.map((part) => (
          <Card key={part.title} as="li" title={part.title}>
            <ul className={classes.plainList}>
              {part.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </ul>
    </section>

    <section className={`${editorial.section} ${editorial.panel}`} aria-labelledby="limitations">
      <SectionHeader id="limitations" title="Limitations et transparence" />
      <div className={classes.limitations}>
        <Blocks blocks={[limitations]} />
      </div>
    </section>
  </Container>
);
