/** Politique de confidentialité (reprise de apps/web/app/confidentialite/page.tsx). */
import {
  code,
  externalLink,
  labelled,
  link,
  list,
  paragraph,
  strong,
} from "../shared/rich-text/rich-text.ts";
import type { LegalPage } from "./types.ts";

const CONTACT = link("contact@clair.vote", "mailto:contact@clair.vote");

export const confidentialite: LegalPage = {
  title: "Politique de confidentialité",
  updatedAt: "octobre 2026",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      blocks: [
        paragraph(
          "CLAIR (« nous », « notre », « nos ») s'engage à protéger la vie privée des utilisateurs de son site web clair.vote (« le Site »).",
        ),
        paragraph(
          "Cette politique de confidentialité explique quelles données nous collectons, pourquoi nous les collectons, et comment nous les utilisons.",
        ),
      ],
    },
    {
      id: "responsable-du-traitement",
      title: "Responsable du traitement",
      blocks: [
        paragraph(
          "Le responsable du traitement des données personnelles est l'association éditrice du site CLAIR.",
        ),
        paragraph([strong("Contact :"), " ", CONTACT]),
      ],
    },
    {
      id: "donnees-collectees",
      title: "Données que nous collectons",
      blocks: [
        {
          type: "labelled",
          label: "Navigation sur le site",
          blocks: [
            paragraph(
              "Si vous naviguez sur CLAIR, nous collectons uniquement des données anonymes, consultées de façon agrégée à des fins statistiques :",
            ),
            list(
              "Pages consultées",
              "Site de provenance et paramètres de campagne (utm) éventuels",
              "Durée des visites",
              "Type d'appareil, navigateur et système d'exploitation",
              "Pays, région et ville, déduits de l'adresse IP, qui n'est pas conservée",
            ),
          ],
        },
        {
          type: "labelled",
          label: "Formulaire de retour",
          blocks: [
            paragraph(
              "Si vous nous écrivez avec le bouton de retour, nous enregistrons votre message, l'appréciation choisie, la page concernée, le type de votre navigateur (user-agent) et, seulement si vous la renseignez, votre adresse e-mail. Le message, la page et l'adresse e-mail sont aussi transmis à l'espace Discord de l'équipe (Discord Inc., États-Unis) pour y être lus.",
            ),
          ],
        },
      ],
    },
    {
      id: "mesure-d-audience",
      title: "Mesure d'audience",
      blocks: [
        paragraph([
          "Nous mesurons l'audience avec ",
          externalLink("Plausible Analytics", "https://github.com/plausible/analytics"),
          " dans sa version libre (Community Edition), installée sur notre propre serveur à Varsovie (Pologne, Union européenne). Aucune donnée de visite n'est transmise à un tiers.",
        ]),
        list(
          labelled(
            "Pas de cookies",
            "aucun cookie ni identifiant n'est déposé sur votre appareil, ce qui dispense de bandeau de consentement",
          ),
          labelled(
            "Adresse IP jamais conservée",
            "elle sert, au moment de la visite, à déduire le pays, la région et la ville, à partir d'une base de géolocalisation installée sur notre serveur, sans interroger de service extérieur",
          ),
          labelled(
            "Pas de suivi d'un jour à l'autre",
            "pour compter les visiteurs uniques, l'adresse IP et le navigateur sont combinés à une valeur aléatoire renouvelée chaque jour, puis hachés. L'ancienne valeur est détruite : un visiteur ne peut plus être reconnu le lendemain",
          ),
          labelled("Pas de tracking cross-site", "Aucun suivi entre différents sites web"),
          labelled("Logiciel libre", "son code source est public et vérifiable"),
        ),
        paragraph([
          strong("Utilisation de l'API."),
          " Chaque appel à l'API publique (api.clair.vote) est compté sur la même instance, dans un tableau de bord séparé : l'adresse appelée sans ses paramètres (par exemple ",
          code("/api/v1/deputes/:slug"),
          "), le code de réponse, le nom du logiciel client (par exemple ",
          code("curl/8.5.0"),
          ") et le site de provenance. L'adresse IP de l'appelant, ou celle du visiteur pour les appels faits par le site, est traitée comme pour une visite : jamais conservée, elle sert seulement à la géolocalisation et au comptage des visiteurs uniques.",
        ]),
        paragraph(
          "Jusqu'au 10 octobre 2026, la mesure d'audience passait par le service hébergé de Plausible (Plausible Insights OÜ, Estonie, serveurs dans l'Union européenne). Ses statistiques agrégées ont été importées sur notre serveur.",
        ),
        paragraph([
          "Pour le détail des données traitées par le script de mesure : ",
          externalLink("plausible.io/data-policy", "https://plausible.io/data-policy"),
        ]),
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      blocks: [
        paragraph([strong("CLAIR n'utilise pas de cookies.")]),
        paragraph(
          "Notre solution de mesure d'audience (Plausible) fonctionne sans cookies. Nous n'utilisons pas de cookies publicitaires, de cookies de traçage, ni de cookies tiers (Google Analytics, Facebook Pixel, etc.).",
        ),
        paragraph(
          "C'est pour cette raison que vous ne voyez pas de bannière de consentement aux cookies sur notre site.",
        ),
        paragraph([
          "Seule exception : la page ",
          link("Soutenir", "/soutenir"),
          " intègre le formulaire de don de HelloAsso. Les données et cookies de ce formulaire relèvent de la ",
          externalLink(
            "politique de confidentialité de HelloAsso",
            "https://www.helloasso.com/confidentialite",
          ),
          ".",
        ]),
      ],
    },
    {
      id: "utilisation-des-donnees",
      title: "Utilisation des données",
      blocks: [
        paragraph("Nous utilisons les données collectées pour :"),
        list(
          [strong("Améliorer le site :"), " comprendre comment le site est utilisé et l'améliorer"],
          [
            strong("Vous répondre :"),
            " traiter vos retours et vous répondre si vous avez laissé une adresse e-mail",
          ],
        ),
        paragraph(
          "Nous ne vendons jamais vos données personnelles. Nous ne les partageons pas avec des tiers à des fins commerciales.",
        ),
      ],
    },
    {
      id: "base-legale",
      title: "Base légale du traitement",
      blocks: [
        paragraph("Nous traitons vos données sur les bases légales suivantes :"),
        list(
          [
            strong("Consentement :"),
            " pour les retours que vous choisissez de nous envoyer, et l'adresse e-mail facultative qui les accompagne",
          ],
          [strong("Intérêt légitime :"), " pour les statistiques anonymes d'utilisation du site"],
        ),
      ],
    },
    {
      id: "conservation",
      title: "Conservation des données",
      blocks: [
        paragraph([
          strong("Statistiques anonymes :"),
          " conservées indéfiniment car elles ne permettent pas d'identification",
        ]),
      ],
    },
    {
      id: "vos-droits",
      title: "Vos droits",
      blocks: [
        paragraph(
          "Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :",
        ),
        list(
          [strong("Droit d'accès :"), " obtenir une copie de vos données"],
          [strong("Droit de rectification :"), " corriger des données inexactes"],
          [strong("Droit à l'effacement :"), " demander la suppression de vos données"],
          [strong("Droit à la portabilité :"), " recevoir vos données dans un format structuré"],
          [strong("Droit d'opposition :"), " vous opposer à certains traitements"],
          [
            strong("Droit de retirer votre consentement :"),
            " à tout moment pour les traitements basés sur le consentement",
          ],
        ),
        paragraph(["Pour exercer ces droits, contactez-nous à ", CONTACT, "."]),
        paragraph(
          "Vous avez également le droit de déposer une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).",
        ),
      ],
    },
    {
      id: "securite",
      title: "Sécurité",
      blocks: [
        paragraph(
          "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :",
        ),
        list(
          "Chiffrement des données en transit (HTTPS)",
          "Accès restreint aux données personnelles",
          "Mises à jour régulières de sécurité",
        ),
      ],
    },
    {
      id: "hebergement",
      title: "Hébergement des données",
      blocks: [
        paragraph([
          "Notre infrastructure backend (API, base de données PostgreSQL, cache Redis) est hébergée par ",
          externalLink("Railway", "https://railway.app"),
          " sur des serveurs situés en ",
          strong("Europe (EU West)"),
          ".",
        ]),
        paragraph(
          "Notre frontend est actuellement hébergé par Vercel. La migration vers un hébergement européen est en cours.",
        ),
        paragraph(
          "Nos statistiques de visite et d'usage de l'API (Plausible Analytics) sont traitées sur notre propre serveur, loué à OVHcloud à Varsovie (Pologne, Union européenne).",
        ),
        paragraph(
          "Les retours envoyés par le formulaire sont enregistrés dans notre base de données (Railway, Europe) et transmis à l'espace Discord de l'équipe (Discord Inc., États-Unis).",
        ),
      ],
    },
    {
      id: "modifications",
      title: "Modifications",
      blocks: [
        paragraph(
          "Nous pouvons modifier cette politique de confidentialité. En cas de modification substantielle, nous vous en informerons par une notification sur le site.",
        ),
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        paragraph([
          "Pour toute question concernant cette politique de confidentialité ou vos données personnelles, contactez-nous à ",
          CONTACT,
          ".",
        ]),
      ],
    },
  ],
};
