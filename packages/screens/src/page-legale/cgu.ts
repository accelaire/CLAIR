/** Conditions générales d'utilisation (reprises de apps/web/app/cgu/page.tsx). */
import { externalLink, link, list, paragraph } from "../shared/rich-text/rich-text.ts";
import type { LegalPage } from "./types.ts";

export const cgu: LegalPage = {
  title: "Conditions Générales d'Utilisation",
  updatedAt: "janvier 2026",
  sections: [
    {
      id: "objet",
      title: "Article 1 - Objet",
      blocks: [
        paragraph(
          "Les présentes Conditions Générales d'Utilisation (« CGU ») ont pour objet de définir les conditions d'accès et d'utilisation du site web clair.vote (« le Site ») édité par l'association CLAIR.",
        ),
        paragraph(
          "L'utilisation du Site implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le Site.",
        ),
      ],
    },
    {
      id: "description-du-service",
      title: "Article 2 - Description du service",
      blocks: [
        paragraph("CLAIR est une plateforme citoyenne de transparence politique qui propose :"),
        list(
          "La consultation de données publiques sur les parlementaires français (députés et sénateurs)",
          "L'accès aux scrutins publics, votes individuels et interventions des parlementaires",
          "La visualisation des activités de lobbying déclarées à la HATVP",
        ),
        paragraph("Le service est fourni gratuitement et sans publicité."),
      ],
    },
    {
      id: "acces-au-site",
      title: "Article 3 - Accès au site",
      blocks: [
        paragraph(
          "Le Site est accessible gratuitement à tout utilisateur disposant d'un accès à Internet.",
        ),
        paragraph(
          "CLAIR se réserve le droit d'interrompre temporairement l'accès au Site pour des raisons de maintenance, de mise à jour ou pour toute autre raison technique.",
        ),
      ],
    },
    {
      id: "utilisation-acceptable",
      title: "Article 4 - Utilisation acceptable",
      blocks: [
        paragraph(
          "Vous vous engagez à utiliser le Site de manière conforme aux lois en vigueur et aux présentes CGU.",
        ),
        paragraph("Il est interdit de :"),
        list(
          "Utiliser le Site à des fins illégales ou frauduleuses",
          "Tenter d'accéder de manière non autorisée aux systèmes ou données",
          "Perturber le fonctionnement du Site (attaques DDoS, spam, etc.)",
          "Collecter des données personnelles d'autres utilisateurs",
          "Utiliser des robots ou scripts automatisés de manière abusive",
        ),
      ],
    },
    {
      id: "donnees-et-contenu",
      title: "Article 5 - Données et contenu",
      blocks: [
        paragraph(
          "Les données présentées sur CLAIR proviennent de sources officielles publiques (actuellement les 4 sources sont: Assemblée nationale, Sénat, HATVP, DILA).",
        ),
        paragraph(
          "CLAIR ne produit pas d'opinion politique et se limite à présenter les données telles qu'elles sont publiées par les sources.",
        ),
        paragraph(
          "Les statistiques calculées (taux de présence, loyauté, etc.) sont dérivées des données brutes selon une méthodologie documentée. Ces calculs sont effectués par CLAIR et peuvent différer de statistiques publiées par d'autres sources.",
        ),
        paragraph(
          "Vous êtes libre de réutiliser les données conformément aux licences des sources d'origine (généralement Licence Ouverte 2.0).",
        ),
      ],
    },
    {
      id: "propriete-intellectuelle",
      title: "Article 6 - Propriété intellectuelle",
      blocks: [
        paragraph([
          "Le code source de CLAIR est distribué sous licence open source et disponible sur ",
          externalLink("GitHub", "https://github.com/accelaire/CLAIR"),
          ".",
        ]),
        paragraph(
          "La marque CLAIR, le logo et le design du Site sont protégés par le droit de la propriété intellectuelle.",
        ),
        paragraph(
          "Les données publiques sont réutilisables selon les termes de leurs licences d'origine respectives.",
        ),
      ],
    },
    {
      id: "limitation-de-responsabilite",
      title: "Article 7 - Limitation de responsabilité",
      blocks: [
        paragraph(
          "CLAIR s'efforce de fournir des informations exactes et à jour, mais ne peut garantir l'absence d'erreurs ou d'omissions.",
        ),
        paragraph("CLAIR ne saurait être tenu responsable :"),
        list(
          "Des erreurs, inexactitudes ou retards dans les données",
          "Des interruptions de service ou dysfonctionnements techniques",
          "Des dommages directs ou indirects résultant de l'utilisation du Site",
          "Du contenu des sites tiers vers lesquels le Site peut rediriger",
        ),
      ],
    },
    {
      id: "protection-des-donnees",
      title: "Article 8 - Protection des données",
      blocks: [
        paragraph([
          "Le traitement de vos données personnelles est régi par notre ",
          link("Politique de confidentialité", "/confidentialite"),
          ", que vous acceptez en utilisant le Site.",
        ]),
      ],
    },
    {
      id: "modifications",
      title: "Article 9 - Modifications des CGU",
      blocks: [
        paragraph("Nous nous réservons le droit de modifier les présentes CGU à tout moment."),
        paragraph(
          "En cas de modification substantielle, nous vous en informerons par une notification sur le Site ou par email si vous avez un compte.",
        ),
        paragraph(
          "La poursuite de l'utilisation du Site après modification des CGU vaut acceptation des nouvelles conditions.",
        ),
      ],
    },
    {
      id: "droit-applicable",
      title: "Article 10 - Droit applicable",
      blocks: [
        paragraph("Les présentes CGU sont régies par le droit français."),
        paragraph(
          "En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute action judiciaire.",
        ),
        paragraph(
          "À défaut d'accord amiable, les tribunaux français de Paris (75) seront seuls compétents.",
        ),
      ],
    },
    {
      id: "contact",
      title: "Article 11 - Contact",
      blocks: [
        paragraph([
          "Pour toute question concernant les présentes CGU, vous pouvez nous contacter à ",
          link("contact@clair.vote", "mailto:contact@clair.vote"),
          ".",
        ]),
      ],
    },
  ],
};
