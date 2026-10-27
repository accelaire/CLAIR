import type { Sortant } from "@clair/data";
import { type JsonLd, SENATORIALES_2026 } from "@clair/screens";
import { urlAbsolue } from "./_chargement.ts";

/**
 * Données structurées propres à la rubrique, reprises de `components/seo/JsonLd.tsx` et de
 * `app/senatoriales-2026` de apps/web : le scrutin au format `Event`, la FAQ, la liste des
 * sortants. Rendues par `components/JsonLd.tsx` ; elles décrivent un contenu visible.
 */

/**
 * Un scrutin, au format `Event` : `eventAttendanceMode` et `location` sont requis pour que
 * l'événement soit complet. Le lieu par défaut est le pays ; les circonscriptions le précisent.
 */
export const election = ({
  name,
  description,
  url,
  location = "France",
}: {
  name: string;
  description: string;
  url: string;
  location?: string;
}): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Event",
  name,
  description,
  url,
  startDate: SENATORIALES_2026.scrutin,
  endDate: SENATORIALES_2026.scrutin,
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  eventStatus: "https://schema.org/EventScheduled",
  location: {
    "@type": "Place",
    name: location,
    address: { "@type": "PostalAddress", addressCountry: "FR", addressLocality: location },
  },
  organizer: {
    "@type": "GovernmentOrganization",
    name: "Ministère de l’Intérieur",
    url: "https://www.interieur.gouv.fr",
  },
});

export const faq = (items: { question: string; reponse: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.reponse },
  })),
});

/** Les sortants d'une circonscription, en `ItemList` de personnes. */
export const sortantsJsonLd = (nom: string, sortants: Sortant[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: `${nom} — sénateurs sortants de la série 2`,
  numberOfItems: sortants.length,
  itemListElement: sortants.map((sortant, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Person",
      name: `${sortant.personne.prenom} ${sortant.personne.nom}`,
      url: urlAbsolue(`/senateurs/${sortant.personne.slug}`),
      jobTitle: sortant.personne.sexe === "F" ? "Sénatrice" : "Sénateur",
      ...(sortant.groupe
        ? {
            affiliation: {
              "@type": "Organization",
              name: sortant.groupe.nomComplet ?? sortant.groupe.nom,
            },
          }
        : {}),
    },
  })),
});
