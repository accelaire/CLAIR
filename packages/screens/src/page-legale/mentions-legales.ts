/** Mentions légales (reprises de apps/web/app/mentions-legales/page.tsx). */
import { br, externalLink, link, list, paragraph, strong } from "../shared/rich-text/rich-text.ts";
import type { LegalPage } from "./types.ts";

const CONTACT = link("contact@clair.vote", "mailto:contact@clair.vote");
const LICENCE = " (Licence Ouverte / Open Licence)";

export const mentionsLegales: LegalPage = {
  title: "Mentions légales",
  updatedAt: "octobre 2026",
  sections: [
    {
      id: "editeur",
      title: "Éditeur du site",
      blocks: [
        paragraph(
          "Le site CLAIR (clair.vote) est édité par une association déclarée, régie par la loi du 1er juillet 1901, à but non lucratif.",
        ),
        paragraph([
          strong("Dénomination :"),
          " CLAIR - CITOYEN LIBRE, ANALYSE, INFORMATION, RÉPUBLIQUE",
        ]),
        paragraph([strong("Numéro RNA :"), " W751282503"]),
        paragraph([
          strong("Siège social :"),
          " Bâtiment A, 178 rue du Faubourg Saint-Denis, 75010 Paris",
        ]),
        paragraph([strong("Email :"), " ", CONTACT]),
      ],
    },
    {
      id: "directeur-de-la-publication",
      title: "Directeur de la publication",
      blocks: [
        paragraph(
          "Le directeur de la publication est le représentant légal de l'association éditrice du site CLAIR.",
        ),
      ],
    },
    {
      id: "hebergement",
      title: "Hébergement",
      blocks: [
        {
          type: "labelled",
          label: "Frontend (site web) :",
          blocks: [
            paragraph([
              strong("Vercel Inc."),
              br,
              "440 N Barranca Ave #4133",
              br,
              "Covina, CA 91723, États-Unis",
              br,
              externalLink("vercel.com", "https://vercel.com"),
            ]),
            {
              type: "paragraph",
              text: "Migration vers un hébergement européen en cours.",
              tone: "petit",
            },
          ],
        },
        {
          type: "labelled",
          label: "Backend (API, base de données) :",
          blocks: [
            paragraph([
              strong("Railway Corporation"),
              br,
              "Serveurs situés en Europe (EU West)",
              br,
              externalLink("railway.app", "https://railway.app"),
            ]),
          ],
        },
        {
          type: "labelled",
          label: "Mesure d'audience (statistiques de visite et d'usage de l'API) :",
          blocks: [
            paragraph([
              strong("OVH SAS"),
              br,
              "2 rue Kellermann",
              br,
              "59100 Roubaix, France",
              br,
              "Serveur situé à Varsovie (Pologne, Union européenne)",
              br,
              externalLink("ovhcloud.com", "https://www.ovhcloud.com"),
            ]),
          ],
        },
      ],
    },
    {
      id: "propriete-intellectuelle",
      title: "Propriété intellectuelle",
      blocks: [
        paragraph([
          "Le code source de CLAIR est distribué sous licence open source. Il est disponible sur ",
          externalLink("GitHub", "https://github.com/accelaire/CLAIR"),
          ".",
        ]),
        paragraph(
          "Les données présentées sur ce site proviennent de sources publiques (Assemblée nationale, Sénat, HATVP, DILA) et sont réutilisées conformément aux licences de réutilisation des données publiques.",
        ),
        paragraph(
          "La marque CLAIR et le logo associé sont la propriété de l'association éditrice.",
        ),
      ],
    },
    {
      id: "sources-des-donnees",
      title: "Sources des données",
      blocks: [
        paragraph(
          "Les données présentées sur CLAIR proviennent exclusivement de sources officielles et publiques :",
        ),
        list(
          [
            externalLink("Assemblée nationale - Open Data", "https://data.assemblee-nationale.fr"),
            LICENCE,
          ],
          [externalLink("Sénat - Open Data", "https://data.senat.fr"), LICENCE],
          [
            externalLink(
              "Haute Autorité pour la Transparence de la Vie Publique (HATVP)",
              "https://www.hatvp.fr",
            ),
          ],
          [
            externalLink(
              "Direction de l'Information Légale et Administrative (DILA)",
              "https://echanges.dila.gouv.fr/OPENDATA",
            ),
            LICENCE,
          ],
        ),
        paragraph(
          "Conformément à la Licence Ouverte 2.0, la réutilisation de ces données est libre et gratuite, sous réserve de mentionner la source et la date de dernière mise à jour.",
        ),
      ],
    },
    {
      id: "limitation-de-responsabilite",
      title: "Limitation de responsabilité",
      blocks: [
        paragraph(
          "CLAIR s'efforce de fournir des informations exactes et à jour. Toutefois, nous ne pouvons garantir l'exactitude, la complétude ou l'actualité des informations présentées.",
        ),
        paragraph(
          "Les données sont synchronisées quotidiennement depuis les sources officielles. Un délai peut exister entre la publication d'une information par la source et son apparition sur CLAIR.",
        ),
        paragraph(
          "CLAIR décline toute responsabilité en cas d'erreur, d'omission ou de retard dans la mise à jour des données.",
        ),
        paragraph(
          "Les liens vers des sites externes sont fournis à titre informatif. CLAIR n'est pas responsable du contenu de ces sites.",
        ),
      ],
    },
    {
      id: "credits",
      title: "Crédits",
      blocks: [
        paragraph([
          strong("Conception et développement :"),
          " Équipe CLAIR et contributeurs open source",
        ]),
        paragraph([strong("Icônes :"), " ", externalLink("Lucide Icons", "https://lucide.dev")]),
        paragraph([strong("Police :"), " Inter (Google Fonts)"]),
        paragraph([
          strong("Géolocalisation des visites :"),
          " ",
          externalLink("IP Geolocation by DB-IP", "https://db-ip.com"),
          " et ",
          externalLink("GeoNames", "https://www.geonames.org"),
          ", sous licence ",
          externalLink("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.fr"),
        ]),
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        paragraph([
          "Pour toute question concernant ces mentions légales, vous pouvez nous contacter à l'adresse ",
          CONTACT,
          ".",
        ]),
      ],
    },
  ],
};
