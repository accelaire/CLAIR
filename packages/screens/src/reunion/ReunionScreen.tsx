"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { ApiData, AvisCommission, ReunionDetail } from "@clair/data";
import {
  Badge,
  buildHref,
  ChambreBadge,
  Container,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  ParlementaireAvatar,
  parseStatut,
  StatutBadge,
  useNavigation,
} from "@clair/ui";
import {
  libelleDeSeance,
  lienSur,
  pluriel,
  pointsDeLOrdreDuJour,
  urlDuCompteRendu,
} from "../shared/reunions/reunions.ts";
import { parlementaireHref, scrutinHref } from "../shared/scrutins.ts";
import type { ScreenProps } from "../shared/types.ts";
import { DebatDeReunion } from "./DebatDeReunion.tsx";
import {
  ancreDuRang,
  pageDuDebat,
  pageDuRang,
  parseReunionParams,
  reunionParamsOf,
} from "./params.ts";
import classes from "./ReunionScreen.module.css";
import { SommaireDeSeance } from "./SommaireDeSeance.tsx";

export type ReunionScreenProps = ScreenProps<ApiData<ReunionDetail>> & {
  /** Identifiant de la réunion ou de la séance (`RUANR5L17S2026IDC…`). */
  uid: string;
};

const chambreDe = (reunion: ReunionDetail) =>
  reunion.commission?.chambre === "senat" ? "senat" : "assemblee";

/**
 * Titre de la page : « Séance publique » pour une séance (sa pseudo-commission est la chambre
 * elle-même et n'apprend rien), sinon le nom de l'organe réuni.
 */
export const titreDeReunion = (reunion: ReunionDetail) =>
  reunion.type === "seance"
    ? "Séance publique"
    : (reunion.commission?.nom ?? "Réunion de commission");

const colonnesAvis: DataTableColumn<AvisCommission>[] = [
  { key: "numero", header: "N°", cell: (avis) => avis.numero, rowHeader: true },
  { key: "place", header: "Place", cell: (avis) => avis.place || "—" },
  { key: "auteur", header: "Auteur", cell: (avis) => avis.auteur || "—" },
  { key: "groupe", header: "Groupe", cell: (avis) => avis.groupe || "—" },
  {
    key: "position",
    header: "Avis de la commission",
    cell: (avis) => <Badge size="sm">{avis.position}</Badge>,
  },
];

/**
 * Page d'une réunion de commission ou d'une séance publique : ordre du jour, vote suivi (arrivée
 * depuis un scrutin), sommaire, débat page par page avec les votes à leur place, avis de la
 * commission sur les amendements et participants. Le vote suivi et la page du débat vivent dans
 * l'URL (`vote`, `rang`, `debat`).
 */
export const ReunionScreen = ({ uid, params: rawParams, initialData }: ReunionScreenProps) => {
  const { pathname } = useNavigation();
  const params = parseReunionParams(rawParams);
  const query = useApiQuery<ApiData<ReunionDetail>>(
    `/agenda/${encodeURIComponent(uid)}`,
    {},
    { initialData },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement de la réunion…" variant="skeleton" lines={6} />
      </Container>
    );
  }
  if (query.isError) {
    return (
      <Container className={classes.page}>
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState
            title="Réunion introuvable"
            description="Cette réunion n'existe pas ou n'est plus référencée."
            action={<Link href="/agenda">Consulter l'agenda parlementaire</Link>}
          />
        ) : (
          <ErrorState
            message="La réunion n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        )}
      </Container>
    );
  }

  const reunion = query.data.data;
  const seance = reunion.type === "seance";
  const quand = libelleDeSeance(reunion.dateDebut);
  const compteRendu = urlDuCompteRendu(reunion.compteRenduRef) ?? lienSur(reunion.compteRenduUrl);
  const video = lienSur(reunion.urlVideo);
  const points = pointsDeLOrdreDuJour(reunion.odjResume, reunion.odjComplet);
  const scrutins = reunion.scrutins ?? [];
  const voteSuivi = params.vote ? (scrutins.find((s) => s.id === params.vote) ?? null) : null;
  const pageDebat = pageDuDebat(params);

  const hrefDebat = (page: number) =>
    buildHref(pathname, reunionParamsOf({ ...params, debat: page }));
  const hrefDuRang = (rang: number) =>
    `${buildHref(pathname, reunionParamsOf({ ...params, debat: pageDuRang(rang) }))}#${ancreDuRang(rang)}`;

  const statutSuivi = voteSuivi ? parseStatut(voteSuivi.sort) : null;

  return (
    <Container className={classes.page} size="etroit">
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          ...(seance
            ? [{ label: "Agenda", href: "/agenda" }]
            : [
                { label: "Commissions", href: "/commissions" },
                ...(reunion.commission?.slug
                  ? [
                      {
                        label: reunion.commission.nom,
                        href: `/commissions/${reunion.commission.slug}`,
                      },
                    ]
                  : []),
              ]),
          { label: quand },
        ]}
        title={titreDeReunion(reunion)}
        badges={
          <>
            <ChambreBadge chambre={chambreDe(reunion)} />
            {reunion.etat === "annule" ? <Badge tone="avertissement">Annulée</Badge> : null}
          </>
        }
        description={
          <>
            <p className={classes.quand}>
              <time dateTime={reunion.dateDebut} className={classes.capitale}>
                {quand}
              </time>
              {reunion.lieu ? <> · {reunion.lieu}</> : null}
              {reunion.participants.length > 0
                ? ` · ${pluriel(reunion.participants.length, "participant")}`
                : null}
            </p>
            {video || compteRendu ? (
              <p className={classes.liens}>
                {video ? (
                  <Link href={video} external>
                    Voir la vidéo
                  </Link>
                ) : null}
                {compteRendu ? (
                  <Link href={compteRendu} external>
                    Compte rendu intégral
                  </Link>
                ) : null}
              </p>
            ) : null}
          </>
        }
      />

      {points.length > 0 ? (
        <section className={classes.section} aria-labelledby="ordre-du-jour">
          <h2 id="ordre-du-jour" className={classes.titreSection}>
            Ordre du jour
          </h2>
          <ul className={classes.odj}>
            {points.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {voteSuivi ? (
        <aside className={classes.suivi} aria-label="Vote suivi">
          <p className={classes.suiviEntete}>
            Vous suivez le scrutin n° {voteSuivi.numero}
            {statutSuivi ? <StatutBadge statut={statutSuivi} size="sm" /> : null}
          </p>
          <p className={classes.voteTitre}>{voteSuivi.titre}</p>
          <p className={classes.liens}>
            {params.rang !== null ? (
              <Link href={hrefDuRang(params.rang)}>Aller à son débat</Link>
            ) : null}
            <Link href={scrutinHref(voteSuivi)}>Revenir au vote</Link>
          </p>
        </aside>
      ) : null}

      <SommaireDeSeance
        entrees={reunion.sommaire ?? []}
        votesDuJour={reunion.votesDuJour ?? false}
        hrefDuRang={hrefDuRang}
      />

      <DebatDeReunion
        uid={reunion.uid}
        total={reunion.nbInterventions ?? 0}
        scrutins={scrutins}
        page={pageDebat}
        hrefFor={hrefDebat}
        voteSuivi={voteSuivi?.id ?? null}
        rangCible={params.debat === null ? params.rang : null}
      />

      {reunion.avisCommission.length > 0 ? (
        <section className={classes.section} aria-labelledby="avis">
          <h2 id="avis" className={classes.titreSection}>
            Avis sur les amendements ({reunion.avisCommission.length})
          </h2>
          <p className={classes.aide}>
            Examinés en application de l'article 88 du Règlement : la commission annonce ce qu'elle
            recommandera en séance, sans pouvoir rejeter elle-même l'amendement. Les libellés sont
            ceux du compte rendu : « Accepté » et « Avis favorable » veulent dire la même chose.
          </p>
          <DataTable
            caption="Avis de la commission sur les amendements"
            hideCaption
            columns={colonnesAvis}
            rows={reunion.avisCommission}
            getRowKey={(avis) => avis.id}
          />
        </section>
      ) : null}

      {reunion.participants.length > 0 ? (
        <section className={classes.section} aria-labelledby="participants">
          <h2 id="participants" className={classes.titreSection}>
            Participants ({reunion.participants.length})
          </h2>
          <ul className={classes.participants}>
            {reunion.participants.map(({ parlementaire }) => (
              <li key={parlementaire.id}>
                <Link
                  href={parlementaireHref(parlementaire.chambre, parlementaire.slug)}
                  className={classes.participant}
                >
                  <ParlementaireAvatar
                    nom={`${parlementaire.prenom} ${parlementaire.nom}`}
                    photoUrl={parlementaire.photoUrl}
                    size="sm"
                    decorative
                  />
                  {parlementaire.prenom} {parlementaire.nom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className={classes.source}>
        Source :{" "}
        {chambreDe(reunion) === "senat" ? (
          <Link href="https://data.senat.fr" external>
            data.senat.fr
          </Link>
        ) : (
          <Link href="https://data.assemblee-nationale.fr" external>
            data.assemblee-nationale.fr
          </Link>
        )}{" "}
        (donnée officielle).
      </p>
    </Container>
  );
};
