import { LOBBYISTE_TYPE_LIBELLES, type LobbyisteDetail } from "@clair/data";
import { fetchResource } from "@/lib/api-server.ts";
import {
  chargerPourOg,
  imageOg,
  introuvable,
  OG_CONTENT_TYPE,
  OG_COULEURS,
  OG_SIZE,
  OgLayout,
  OgPage,
  OgStat,
  ogNombre,
} from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Représentant d'intérêts — Données HATVP — CLAIR.vote";

/** L'API n'accepte qu'un UUID (400 sinon) : toute autre adresse est une fiche inexistante. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: Record<string, string> = LOBBYISTE_TYPE_LIBELLES;

/** Budget déclaré (par tranches, déclaratif) : « 1,5 M€ », « 250 k€ ». */
const budget = (montant: number) => {
  if (montant >= 1_000_000)
    return `${(montant / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (montant >= 1_000) return `${ogNombre(Math.round(montant / 1_000))} k€`;
  return `${ogNombre(montant)} €`;
};

/** Image d'un représentant d'intérêts : nom, type, secteur et chiffres déclarés (reprise de apps/web). */
const Image = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!UUID.test(id)) return introuvable();
  const reponse = await chargerPourOg(() =>
    fetchResource<{ data: LobbyisteDetail }>(`/lobbying/${id}`),
  );
  if (reponse === "absente") return introuvable();
  if (!reponse) {
    return imageOg(
      <OgPage
        badge="Lobbying"
        badgeColor={OG_COULEURS.lobbying}
        titre="Lobbying"
        sousTitre="Les représentants d'intérêts déclarés à la HATVP : budgets, secteurs, actions menées."
      />,
    );
  }
  const lobbyiste = reponse.data;
  const type = lobbyiste.type ? (TYPES[lobbyiste.type] ?? lobbyiste.type) : null;
  const precisions = [type, lobbyiste.secteur].filter(Boolean).join(" · ");
  return imageOg(
    <OgLayout badge="Lobbying · Données HATVP" badgeColor={OG_COULEURS.lobbying}>
      <span
        style={{
          fontSize: "48px",
          fontWeight: 700,
          lineHeight: 1.15,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {lobbyiste.nom}
      </span>
      {precisions ? (
        <span style={{ fontSize: "26px", color: OG_COULEURS.texte }}>{precisions}</span>
      ) : null}
      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
        {lobbyiste.budgetAnnuel ? (
          <OgStat label="Budget" value={budget(lobbyiste.budgetAnnuel)} />
        ) : null}
        {lobbyiste.actions.length > 0 ? (
          <OgStat label="Actions" value={ogNombre(lobbyiste.actions.length)} />
        ) : null}
        {lobbyiste.nbLobbyistes ? (
          <OgStat label="Lobbyistes" value={ogNombre(lobbyiste.nbLobbyistes)} />
        ) : null}
      </div>
    </OgLayout>,
  );
};

export default Image;
