import type { AvisCommission, DebatDeReunionPage, ReunionDetail } from "@clair/data";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { debatExemple, detail, reunionDetailExemple, seanceExemple } from "./fixtures.ts";
import { ReunionScreen, titreDeReunion } from "./ReunionScreen.tsx";

const [avisBase] = reunionDetailExemple.avisCommission;
if (!avisBase) throw new Error("fixture sans avis");
const [scrutinBase] = seanceExemple.scrutins ?? [];
if (!scrutinBase) throw new Error("fixture sans scrutin");

/** Avis FICTIFS : défavorable, autre, sans place ni auteur ni groupe. */
const avis: AvisCommission[] = [
  { ...avisBase, id: "a2", numero: "13", position: "Avis défavorable", sens: "defavorable" },
  {
    ...avisBase,
    id: "a3",
    numero: "14",
    position: "Retiré",
    sens: "autre",
    place: null,
    auteur: null,
    groupe: null,
  },
];

const rendre = (reunion: ReunionDetail, params = {}) =>
  renderScreen(<ReunionScreen uid={reunion.uid} params={params} initialData={detail(reunion)} />, {
    routes: { [`/agenda/${reunion.uid}/debat`]: debatExemple },
    pathname: "/reunions/X",
  });

describe("ReunionScreen, cas limites", () => {
  it("titre une réunion sans commission", () => {
    expect(titreDeReunion({ ...reunionDetailExemple, commission: null })).toBe(
      "Réunion de commission",
    );
  });

  it("présente une réunion du Sénat annulée, sans organe lié ni lien externe", () => {
    const { getByRole, getByText, queryByRole } = rendre({
      ...reunionDetailExemple,
      etat: "annule",
      lieu: null,
      urlVideo: null,
      compteRenduRef: null,
      compteRenduUrl: null,
      odjComplet: null,
      participants: [],
      nbInterventions: 0,
      avisCommission: avis,
      commission: reunionDetailExemple.commission
        ? { ...reunionDetailExemple.commission, slug: "", chambre: "senat" }
        : null,
    });
    expect(getByText("Annulée")).toBeInTheDocument();
    const fil = getByRole("navigation", { name: /fil d'Ariane/i });
    expect(within(fil).getByRole("link", { name: "Commissions" })).toBeInTheDocument();
    expect(within(fil).queryByRole("link", { name: "Commission des jardins partagés" })).toBeNull();
    expect(queryByRole("link", { name: /Voir la vidéo|Compte rendu intégral/ })).toBeNull();
    expect(queryByRole("heading", { name: "Ordre du jour" })).toBeNull();
    expect(queryByRole("heading", { name: /Débat/ })).toBeNull();
    expect(getByRole("link", { name: /data\.senat\.fr/ })).toBeInTheDocument();
    const table = getByRole("table", { name: /Avis de la commission/ });
    expect(within(table).getByText("Avis défavorable")).toBeInTheDocument();
    expect(within(table).getByText("Retiré")).toBeInTheDocument();
    expect(within(table).getAllByText("—")).toHaveLength(3);
  });

  it("donne vidéo et compte rendu en ligne d'une séance, sans rang ni sort reconnu", () => {
    const { getByRole, queryByRole } = rendre(
      {
        ...seanceExemple,
        urlVideo: "https://video.exemple.test/seance",
        scrutins: [{ ...scrutinBase, sort: "sort d'exemple" }],
        sommaire: undefined,
        votesDuJour: undefined,
        nbInterventions: undefined,
      },
      { vote: "scrutin-exemple-1" },
    );
    expect(getByRole("link", { name: /Voir la vidéo/ })).toBeInTheDocument();
    expect(getByRole("link", { name: /Compte rendu intégral/ })).toHaveAttribute(
      "href",
      "https://compte-rendu.exemple.test/seance",
    );
    const suivi = getByRole("complementary", { name: "Vote suivi" });
    expect(within(suivi).queryByRole("link", { name: "Aller à son débat" })).toBeNull();
    expect(within(suivi).getByRole("link", { name: "Revenir au vote" })).toBeInTheDocument();
    expect(queryByRole("heading", { name: /Débat/ })).toBeNull();
  });

  it("ignore un vote suivi inconnu de la séance", () => {
    const { queryByRole } = rendre(seanceExemple, { vote: "inconnu" });
    expect(queryByRole("complementary", { name: "Vote suivi" })).toBeNull();
  });

  it("annonce le chargement du débat et son échec", async () => {
    const enCours = renderScreen(
      <ReunionScreen uid="R1" initialData={detail({ ...reunionDetailExemple, uid: "R1" })} />,
      { routes: { "/agenda/R1/debat": () => new Promise(() => undefined) }, pathname: "/r" },
    );
    expect(enCours.getByText("Chargement du débat…")).toBeInTheDocument();
    enCours.unmount();
    const echec = renderScreen(
      <ReunionScreen uid="R2" initialData={detail({ ...reunionDetailExemple, uid: "R2" })} />,
      { routes: {}, pathname: "/r" },
    );
    expect(await echec.findByText("Le débat n'a pas pu être chargé.")).toBeInTheDocument();
  });

  it("intitule un passage par son seul texte, son numéro ou son seul article", async () => {
    const [p1, p2] = debatExemple.data;
    if (!p1 || !p2) throw new Error("fixture incomplète");
    const debat: DebatDeReunionPage = {
      ...debatExemple,
      data: [
        { ...p1, id: "a", ordre: 1, articleVise: null, amendementsVises: null, hasMore: false },
        {
          ...p1,
          id: "b",
          ordre: 2,
          dossier: null,
          texteNumero: "512",
          articleVise: null,
          amendementsVises: null,
          hasMore: false,
        },
        {
          ...p2,
          id: "c",
          ordre: 3,
          dossier: null,
          articleVise: "4",
          amendementsVises: null,
          scrutinIds: [],
        },
      ],
    };
    const { findByRole, findByText } = renderScreen(
      <ReunionScreen
        uid="R3"
        params={{ rang: "2" }}
        initialData={detail({ ...reunionDetailExemple, uid: "R3", nbInterventions: 3 })}
      />,
      { routes: { "/agenda/R3/debat": debat }, pathname: "/r" },
    );
    expect(await findByRole("link", { name: "Texte d'exemple" })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE9",
    );
    expect(await findByText("Texte n° 512")).toBeInTheDocument();
    expect(await findByText("Article 4")).toBeInTheDocument();
  });
});
