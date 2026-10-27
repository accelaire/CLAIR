"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { LobbyisteDetail } from "@clair/data";
import {
  Badge,
  buildHref,
  Container,
  DateRangePicker,
  ErrorState,
  Link,
  LoadingState,
  LobbyisteLogo,
  PageHeader,
  ProvenanceLabel,
  useNavigation,
} from "@clair/ui";
import { typeLibelle } from "../lobbying-liste/format.ts";
import { NotFoundScreen } from "../not-found/NotFoundScreen.tsx";
import type { ScreenProps } from "../shared/types.ts";
import { ActionsLobbyiste } from "./ActionsLobbyiste.tsx";
import { ChiffresLobbyiste } from "./ChiffresLobbyiste.tsx";
import classes from "./LobbyisteFicheScreen.module.css";
import {
  type LobbyisteFicheParams,
  lobbyisteFicheParamsOf,
  parseLobbyisteFicheParams,
} from "./params.ts";

export type LobbyisteFicheScreenProps = ScreenProps<{ data: LobbyisteDetail }> & { id: string };

/** Adresse du site déclaré, en http(s) seulement ; `null` si elle n'est pas exploitable. */
export const siteWebHref = (siteWeb: string | null) => {
  if (!siteWeb) return null;
  const adresse = /^https?:\/\//i.test(siteWeb) ? siteWeb : `https://${siteWeb}`;
  try {
    const url = new URL(adresse);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * Fiche d'un représentant d'intérêts (répertoire de la HATVP) : identité, coordonnées,
 * chiffres déclarés et actions de lobbying, filtrables par période (`dateFrom`, `dateTo` dans
 * l'URL, comme apps/web). Remplace `app/lobbying/[id]/PageClient.tsx` de apps/web.
 */
export const LobbyisteFicheScreen = ({ id, params, initialData }: LobbyisteFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const periode = parseLobbyisteFicheParams(params);
  const query = useApiQuery<{ data: LobbyisteDetail }>(
    `/lobbying/${encodeURIComponent(id)}`,
    {},
    { initialData },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du représentant d'intérêts…" />
      </Container>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundScreen />;
    return (
      <Container className={classes.page}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Container>
    );
  }

  const lobbyiste = query.data.data;
  const type = typeLibelle(lobbyiste.type);
  const site = siteWebHref(lobbyiste.siteWeb);
  const secteurs =
    lobbyiste.secteursList.length > 0
      ? lobbyiste.secteursList.map((secteur) => secteur.label)
      : lobbyiste.secteur
        ? [lobbyiste.secteur]
        : [];
  const changerPeriode = (patch: Partial<LobbyisteFicheParams>) =>
    navigate(buildHref(pathname, lobbyisteFicheParamsOf({ ...periode, ...patch })));

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Lobbying", href: "/lobbying" },
          { label: lobbyiste.nom },
        ]}
        title={
          <span className={classes.titre}>
            <LobbyisteLogo nom={lobbyiste.nom} size="lg" decorative />
            <span>{lobbyiste.nom}</span>
          </span>
        }
        badges={
          type || secteurs.length > 0 ? (
            <>
              {type ? <Badge tone="info">{type}</Badge> : null}
              {secteurs.map((secteur) => (
                <Badge key={secteur} size="sm">
                  {secteur}
                </Badge>
              ))}
            </>
          ) : undefined
        }
        description={
          <div className={classes.provenance}>
            <ProvenanceLabel
              provenance="officielle"
              source="répertoire de la HATVP (déclarations)"
              methodologyHref="/methodologie#hatvp"
              size="sm"
            />
          </div>
        }
      />

      {lobbyiste.adresse || lobbyiste.ville || site || lobbyiste.siren ? (
        <section aria-labelledby="lobbyiste-informations" className={classes.section}>
          <h2 id="lobbyiste-informations" className={classes.titreSection}>
            Informations
          </h2>
          <dl className={classes.informations}>
            {lobbyiste.adresse || lobbyiste.ville ? (
              <div>
                <dt>Adresse</dt>
                <dd className={classes.adresse}>
                  {[
                    lobbyiste.adresse,
                    [lobbyiste.codePostal, lobbyiste.ville].filter(Boolean).join(" "),
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </dd>
              </div>
            ) : null}
            {site && lobbyiste.siteWeb ? (
              <div>
                <dt>Site web</dt>
                <dd>
                  <Link href={site} external>
                    {lobbyiste.siteWeb}
                  </Link>
                </dd>
              </div>
            ) : null}
            {lobbyiste.siren ? (
              <div>
                <dt>SIREN</dt>
                <dd className="clair-chiffres">{lobbyiste.siren}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <ChiffresLobbyiste lobbyiste={lobbyiste} />

      <section aria-labelledby="lobbyiste-actions" className={classes.section}>
        <ActionsLobbyiste
          titreId="lobbyiste-actions"
          actions={lobbyiste.actions}
          periode={periode}
          filtre={
            <DateRangePicker
              label="Période"
              placeholder="Filtrer par période"
              value={{ from: periode.dateFrom || null, to: periode.dateTo || null }}
              onChange={({ from, to }) =>
                changerPeriode({ dateFrom: from ?? "", dateTo: to ?? "" })
              }
            />
          }
          onReset={() => changerPeriode({ dateFrom: "", dateTo: "" })}
        />
      </section>
    </Container>
  );
};
