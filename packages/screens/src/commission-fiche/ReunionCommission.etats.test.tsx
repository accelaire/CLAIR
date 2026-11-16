import type { CommissionReunion } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { reunionExemple } from "./fixtures.ts";
import { OrdreDuJour } from "./OrdreDuJour.tsx";
import { ReunionCommission } from "./ReunionCommission.tsx";

const avant = new Date("2026-01-01T00:00:00.000Z");
const apres = new Date("2026-12-01T00:00:00.000Z");

describe("ReunionCommission : états", () => {
  it("réunion passée : lieu, participants, vidéo et compte rendu", () => {
    const { getByRole, getByText } = renderScreen(
      <ReunionCommission reunion={reunionExemple} maintenant={apres} />,
    );
    expect(getByText("Salle d'exemple")).toBeInTheDocument();
    expect(getByText("7 participants")).toBeInTheDocument();
    expect(getByRole("link", { name: /Vidéo/ })).toBeInTheDocument();
    expect(getByRole("link", { name: /Compte rendu/ })).toBeInTheDocument();
  });

  it("réunion à venir, annulée, sans lieu, vidéo ni participant", () => {
    const reunion: CommissionReunion = {
      ...reunionExemple,
      lieu: null,
      urlVideo: null,
      nbParticipants: undefined,
      dateFin: null,
      etat: "annule",
    };
    const { queryByRole, getByText, queryByText } = renderScreen(
      <ReunionCommission reunion={reunion} maintenant={avant} />,
    );
    expect(queryByRole("link", { name: /Compte rendu|Vidéo/ })).toBeNull();
    expect(queryByText(/participant/)).toBeNull();
    expect(getByText(/· Annulée/)).toBeInTheDocument();
    expect(getByText(/· Annulée/)).not.toHaveTextContent(" à ");
  });

  it("réunion passée sans compte rendu mais avec un participant", () => {
    const reunion: CommissionReunion = {
      ...reunionExemple,
      lieu: null,
      urlVideo: "ftp://exemple.test/video",
      compteRenduRef: null,
      nbParticipants: 1,
    };
    const { getByText, queryByRole } = renderScreen(
      <ReunionCommission reunion={reunion} maintenant={apres} />,
    );
    expect(getByText("1 participant")).toBeInTheDocument();
    expect(queryByRole("link", { name: /Vidéo/ })).toBeNull();
  });

  it("séance de l'hémicycle : scrutins de la séance", () => {
    const reunion: CommissionReunion = {
      ...reunionExemple,
      scrutins: [
        {
          id: "scrutin-exemple-1",
          numero: 12,
          titre: "Scrutin d'exemple sur un texte fictif",
          sort: "adopte",
          chambre: "assemblee",
          session: "2025",
          nombrePour: 10,
          nombreContre: 5,
          nombreAbstention: 0,
          dossier: null,
        },
      ],
    };
    const { getByText } = renderScreen(<ReunionCommission reunion={reunion} maintenant={apres} />);
    expect(getByText(/Scrutin d'exemple sur un texte fictif/)).toBeInTheDocument();
  });
});

describe("OrdreDuJour : états", () => {
  it("rien sans point", () => {
    const { queryByRole } = renderScreen(<OrdreDuJour resume={null} complet={null} />);
    expect(queryByRole("list", { name: "Ordre du jour" })).toBeNull();
  });

  it("un seul point caché, puis réduire", () => {
    const { getByRole } = renderScreen(
      <OrdreDuJour resume={null} complet={reunionExemple.odjComplet} />,
    );
    const bouton = getByRole("button", { name: "Voir l'autre point de l'ordre du jour" });
    fireEvent.click(bouton);
    expect(bouton).toHaveTextContent("Réduire l'ordre du jour");
  });

  it("plusieurs points cachés", () => {
    const { getByRole } = renderScreen(
      <OrdreDuJour resume={null} complet={"- Un\n- Deux\n- Trois\n- Quatre\n- Cinq"} />,
    );
    expect(
      getByRole("button", { name: "Voir les 2 autres points de l'ordre du jour" }),
    ).toBeInTheDocument();
  });
});
