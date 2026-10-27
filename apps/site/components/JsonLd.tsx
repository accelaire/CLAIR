import { type JsonLd as Donnees, serialiserJsonLd } from "@clair/screens";

/**
 * Données structurées schema.org d'une page, construites par les fonctions `…JsonLd` de
 * `@clair/screens`. Le JSON est échappé (`serialiserJsonLd`) : aucune donnée ne peut fermer la
 * balise `<script>`.
 */
export const JsonLd = ({ data }: { data: Donnees[] }) =>
  data.map((bloc) => (
    <script
      key={String(bloc["@type"])}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiserJsonLd(bloc) }}
    />
  ));
