"use client";

import { useApiQuery } from "@clair/api-client";
import type { HomepageResponse, HomepageStats } from "@clair/data";
import {
  Button,
  Card,
  Container,
  DossierCard,
  Faq,
  Link,
  ProvenanceLabel,
  SearchInput,
  SectionHeader,
  useNavigation,
} from "@clair/ui";
import { ArrowRight, Building2, Landmark, Lightbulb, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { rechercheHref } from "../recherche/params.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./AccueilScreen.module.css";
import {
  CHIFFRES_CLES,
  type ChiffreCle,
  CONTACT_EMAIL,
  CONTRIBUTION_GUIDE_URL,
  FONCTIONNALITES,
  type Fonctionnalite,
  GITHUB_URL,
  type Morceau,
  QUESTIONS_FREQUENTES,
  THEMES_COMPRENDRE,
} from "./contenu.ts";
import { ProchainementAuParlement } from "./ProchainementAuParlement.tsx";

export type AccueilScreenProps = ScreenProps<HomepageResponse>;

const nombre = new Intl.NumberFormat("fr-FR");
const millions = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const dateMiseAJour = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const heureMiseAJour = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Chiffre abrégé au-delà du million (« 1,2 M »), comme apps/web ; le compte exact reste lu. */
const Valeur = ({ valeur }: { valeur: number | undefined }) => {
  if (valeur === undefined || valeur <= 0) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="clair-visually-hidden">Non disponible</span>
      </>
    );
  }
  if (valeur < 1_000_000) return <>{nombre.format(valeur)}</>;
  return (
    <>
      <span aria-hidden="true">{millions.format(valeur / 1_000_000)} M</span>
      <span className="clair-visually-hidden">{nombre.format(valeur)}</span>
    </>
  );
};

const Chiffre = ({ chiffre, stats }: { chiffre: ChiffreCle; stats?: HomepageStats }) => {
  const { Link: RouterLink } = useNavigation();
  const total = chiffre.cleTotal ? stats?.[chiffre.cleTotal] : undefined;
  return (
    <li>
      <RouterLink href={chiffre.href} className={classes.chiffre}>
        <span className={classes.chiffreValeur}>
          <Valeur valeur={stats?.[chiffre.cle]} />
        </span>
        <span className={classes.chiffreLabel}>{chiffre.label}</span>
        {total !== undefined && total > 0 ? (
          <span className={classes.chiffreTotal}>{nombre.format(total)} au total</span>
        ) : null}
      </RouterLink>
    </li>
  );
};

const ICONES: Record<Fonctionnalite["id"], typeof Landmark> = {
  deputes: Landmark,
  senateurs: Building2,
  groupes: Users,
};

const Paragraphe = ({ morceaux }: { morceaux: Morceau[] }) => (
  <p>
    {morceaux.map((morceau) =>
      typeof morceau === "string" ? (
        morceau
      ) : (
        <Link key={morceau.href} href={morceau.href}>
          {morceau.texte}
        </Link>
      ),
    )}
  </p>
);

/** Recherche de l'accueil : sans JavaScript, le formulaire mène aussi à `/recherche?q=…`. */
const Recherche = () => {
  const { navigate } = useNavigation();
  const [terme, setTerme] = useState("");
  const rechercher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (terme.trim()) navigate(rechercheHref(terme));
  };
  return (
    <search>
      <form action="/recherche" method="get" className={classes.recherche} onSubmit={rechercher}>
        <div className={classes.rechercheChamp}>
          <SearchInput
            aria-label="Rechercher un député, un département, un scrutin"
            placeholder="Député, département, scrutin…"
            name="q"
            value={terme}
            onChange={setTerme}
          />
        </div>
        <Button type="submit" icon={<ArrowRight />} iconPosition="end">
          Rechercher
        </Button>
      </form>
    </search>
  );
};

/**
 * Page d'accueil : accroche et recherche, chiffres clés, prochaines réunions au Parlement,
 * derniers dossiers discutés, présentation du projet, guides, questions fréquentes et appel au
 * soutien. Données de `/homepage`, chargées par la route (rechargées ici si l'API n'a pas
 * répondu). Remplace `app/page.tsx` de apps/web.
 */
export const AccueilScreen = ({ initialData }: AccueilScreenProps) => {
  const { data, isPending, isError, refetch } = useApiQuery<HomepageResponse>(
    "/homepage",
    {},
    { initialData },
  );
  const dossiers = data?.trendingDossiers ?? [];
  const miseAJour = data?.lastUpdate ? new Date(data.lastUpdate) : null;

  return (
    <div className={classes.page}>
      <Container as="section" className={classes.hero} aria-labelledby="accueil-titre">
        <h1 id="accueil-titre" className={classes.titre}>
          La politique française, <span className={classes.titreAccent}>en clair</span>
        </h1>
        <p className={classes.accroche}>
          Consultez les votes des députés et sénateurs, suivez le lobbying et explorez les dossiers
          législatifs. Toutes les données publiques, enfin accessibles.
        </p>
        <Recherche />
        <ul className={classes.chiffres} aria-label="Chiffres clés">
          {CHIFFRES_CLES.map((chiffre) => (
            <Chiffre key={chiffre.cle} chiffre={chiffre} stats={data?.stats} />
          ))}
        </ul>
        <p className={classes.provenance}>
          <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />
          <span>Décomptes de la base CLAIR, établis à partir des données officielles.</span>
        </p>
        {miseAJour ? (
          <p className={classes.miseAJour}>
            Données mises à jour le{" "}
            <time dateTime={data?.lastUpdate ?? undefined}>
              {dateMiseAJour.format(miseAJour)} à {heureMiseAJour.format(miseAJour)}
            </time>
          </p>
        ) : null}
      </Container>

      <Container as="section" className={classes.section} aria-labelledby="accueil-agenda">
        <p className={classes.surtitre}>Agenda</p>
        <SectionHeader
          id="accueil-agenda"
          title="Prochainement au Parlement"
          description="Les prochaines séances et réunions confirmées"
          seeAllHref="/agenda"
          seeAllLabel="Voir l'agenda complet"
        />
        <ProchainementAuParlement
          upcoming={data?.upcoming}
          isPending={isPending}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </Container>

      {dossiers.length > 0 ? (
        <Container as="section" className={classes.section} aria-labelledby="accueil-dossiers">
          <p className={classes.surtitre}>Actualités</p>
          <SectionHeader
            id="accueil-dossiers"
            title="Derniers dossiers législatifs discutés"
            description="Quelques-uns des derniers dossiers abordés au Parlement"
            seeAllHref="/dossiers"
            seeAllLabel="Voir tous les dossiers"
          />
          <ul className={classes.grille}>
            {dossiers.map((dossier) => (
              <DossierCard
                key={dossier.id}
                as="li"
                href={`/dossiers/${dossier.uid}`}
                dossier={{
                  titre: dossier.titre,
                  procedureLibelle: dossier.procedureLibelle,
                  etat: dossier.etat,
                  chambre: dossier.chambre,
                  lastScrutinDate: dossier.lastScrutinDate,
                  nbScrutins: dossier.scrutinsCount,
                }}
              />
            ))}
          </ul>
        </Container>
      ) : null}

      <section className={classes.bandeau} aria-labelledby="accueil-open-source">
        <Container className={classes.bandeauContenu}>
          <div>
            <h2 id="accueil-open-source" className={classes.bandeauTitre}>
              CLAIR est un projet 100% open-source
            </h2>
            <p>
              Le code est disponible sur GitHub et les contributions sont les bienvenues. Que vous
              soyez développeur, designer, data analyst ou simplement citoyen engagé, vous pouvez
              participer.
            </p>
          </div>
          <div className={classes.actions}>
            <Button href="/methodologie" variant="secondaire">
              Voir la méthodologie
            </Button>
            <Button href={GITHUB_URL} external>
              Voir sur Github
            </Button>
            <Button href={CONTRIBUTION_GUIDE_URL} external variant="tertiaire">
              Guide de contribution
            </Button>
          </div>
        </Container>
      </section>

      <Container as="section" className={classes.section} aria-labelledby="accueil-usages">
        <p className={classes.surtitre}>À quoi sert CLAIR ?</p>
        <h2 id="accueil-usages" className={classes.sectionTitre}>
          Consultez les votes, facilement
        </h2>
        <p className={classes.intro}>
          Fini les données dispersées et les interfaces illisibles. CLAIR agrège et simplifie
          l'information politique pour vous.
        </p>
        <ul className={classes.grille}>
          {FONCTIONNALITES.map((fonctionnalite) => {
            const Icone = ICONES[fonctionnalite.id];
            return (
              <Card
                key={fonctionnalite.id}
                as="li"
                padding="lg"
                href={fonctionnalite.href}
                title={fonctionnalite.titre}
                eyebrow={
                  <span className={classes.pastille} aria-hidden="true">
                    <Icone />
                  </span>
                }
              >
                <p className={classes.carteTexte}>{fonctionnalite.description}</p>
                <p className={classes.carteAction} aria-hidden="true">
                  {fonctionnalite.action}
                  <ArrowRight className={classes.icone} />
                </p>
              </Card>
            );
          })}
        </ul>
      </Container>

      <Container as="section" className={classes.section} aria-labelledby="accueil-comprendre">
        <div className={classes.comprendre}>
          <div>
            <span className={classes.pastilleDouce} aria-hidden="true">
              <Lightbulb />
            </span>
            <h2 id="accueil-comprendre" className={classes.sectionTitre}>
              Comment ça marche, la politique ?
            </h2>
            <p className={classes.intro}>
              Des guides courts et clairs pour comprendre le Parlement, les scrutins, le lobbying et
              tous les rouages de la démocratie.
            </p>
            <Button href="/guide">Voir les guides pratiques</Button>
          </div>
          <ul className={classes.themes}>
            {THEMES_COMPRENDRE.map((theme) => (
              <li key={theme.href}>
                <h3 className={classes.themeTitre}>{theme.titre}</h3>
                <p className={classes.themeTexte}>{theme.description}</p>
                <Link href={theme.href}>
                  En savoir plus
                  <span className="clair-visually-hidden"> : {theme.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container
        as="section"
        size="etroit"
        className={classes.section}
        aria-labelledby="accueil-faq"
      >
        <h2 id="accueil-faq" className={classes.faqTitre}>
          Questions fréquentes
        </h2>
        <p className={classes.faqIntro}>
          Si la vôtre n'y figure pas, contactez-nous directement à{" "}
          <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
        </p>
        <Faq
          defaultOpened={[0]}
          items={QUESTIONS_FREQUENTES.map(({ question, paragraphes }) => ({
            question,
            answer: (
              <div className={classes.reponse}>
                {paragraphes.map((morceaux) => (
                  <Paragraphe key={JSON.stringify(morceaux)} morceaux={morceaux} />
                ))}
              </div>
            ),
          }))}
        />
      </Container>

      <Container as="section" className={classes.section} aria-labelledby="accueil-soutenir">
        <div className={classes.soutien}>
          <div>
            <h2 id="accueil-soutenir" className={classes.bandeauTitre}>
              Soutenez l'indépendance de CLAIR
            </h2>
            <p>
              CLAIR est un projet 100% citoyen, sans publicité ni financement politique. Votre don
              nous permet de rester indépendants.
            </p>
          </div>
          <Button href="/soutenir">Faire un don</Button>
        </div>
      </Container>
    </div>
  );
};
