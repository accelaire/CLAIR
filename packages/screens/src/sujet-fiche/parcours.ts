import type { SujetDetail, SujetDossier, SujetEtapeLegislative } from "@clair/data";

type Issue = SujetEtapeLegislative["outcome"];

const issueDe = (etat: string | null): Issue => {
  if (etat === "adopte" || etat === "promulgue") return "adopted";
  if (etat === "rejete") return "rejected";
  return null;
};

const statutDe = (etat: string | null): SujetEtapeLegislative["status"] => {
  if (etat === "en_cours") return "active";
  return etat ? "done" : "pending";
};

const scrutinsDe = (dossiers: SujetDossier[]) =>
  `${dossiers.reduce((somme, d) => somme + d.scrutinCount, 0)} scrutins`;

/**
 * Étapes du parcours d'un sujet : celles des actes législatifs officiels d'un dossier (le dossier
 * de l'Assemblée d'abord), sinon des étapes reconstituées à partir de l'état des dossiers
 * (dépôt, examen dans chaque chambre, adoption, promulgation). Reprise de apps/web.
 */
export const etapesDuSujet = (
  dossiers: SujetDossier[],
  sujet: Pick<SujetDetail, "matchMethod" | "scrutinCount" | "dateDernierVote" | "dateFin">,
): SujetEtapeLegislative[] => {
  const officiel =
    dossiers.find((d) => d.uid.startsWith("DLR") && d.legislativeSteps.length > 0) ??
    dossiers.find((d) => d.legislativeSteps.length > 0);
  if (officiel) return officiel.legislativeSteps;

  const an = dossiers.filter((d) => d.chambre === "assemblee");
  const senat = dossiers.filter((d) => d.chambre === "senat");
  const etats = dossiers.map((d) => d.etat).filter((etat) => etat !== null);
  const promulgue = etats.includes("promulgue");
  const adopte = etats.includes("adopte");
  const toutRejete = etats.length > 0 && etats.every((etat) => etat === "rejete");
  const premierDepot = dossiers
    .map((d) => d.dateDepot)
    .filter((date) => date !== null)
    .sort()[0];

  const etapes: SujetEtapeLegislative[] = [
    {
      code: "DEPOT",
      label: "Dépôt",
      chambre: an.length > 0 && senat.length > 0 ? "both" : an.length > 0 ? "assemblee" : "senat",
      status: "done",
      outcome: null,
      date: premierDepot ?? null,
      detail: null,
    },
  ];

  if (sujet.matchMethod === "cross_ref") {
    const etatAn = an[0]?.etat ?? null;
    const etatSenat = senat[0]?.etat ?? null;
    etapes.push(
      {
        code: "AN1",
        label: "Assemblée nationale",
        chambre: "assemblee",
        status: statutDe(etatAn),
        outcome: issueDe(etatAn),
        date: an.find((d) => d.dateAdoption)?.dateAdoption ?? null,
        detail: an.length > 0 ? scrutinsDe(an) : null,
      },
      {
        code: "SN1",
        label: "Sénat",
        chambre: "senat",
        status: statutDe(etatSenat),
        outcome: issueDe(etatSenat),
        date: senat.find((d) => d.dateAdoption)?.dateAdoption ?? null,
        detail: senat.length > 0 ? scrutinsDe(senat) : null,
      },
    );
    if (promulgue || adopte || !toutRejete) {
      const adopteDef = promulgue || adopte;
      etapes.push({
        code: "ADOPT_DEF",
        label: "Adoption définitive",
        chambre: "both",
        status: adopteDef ? "done" : "pending",
        outcome: adopteDef ? "adopted_definitive" : null,
        date: null,
        detail: null,
      });
    }
  } else {
    const chambre = an.length > 0 ? "assemblee" : "senat";
    const etat = dossiers[0]?.etat ?? null;
    const adoption = dossiers.find((d) => d.dateAdoption)?.dateAdoption ?? null;
    const termine = etat !== null && etat !== "en_cours";
    etapes.push({
      code: "EXAM",
      label: "Examen",
      chambre,
      status: termine ? "done" : "active",
      outcome: null,
      date: sujet.dateDernierVote,
      detail: `${sujet.scrutinCount} scrutin${sujet.scrutinCount > 1 ? "s" : ""}`,
    });
    etapes.push(
      etat === "rejete"
        ? {
            code: "REJETE",
            label: "Rejeté",
            chambre,
            status: "done",
            outcome: "rejected",
            date: adoption,
            detail: null,
          }
        : {
            code: "ADOPT",
            label: "Adoption",
            chambre,
            status: termine ? "done" : "pending",
            outcome: termine ? issueDe(etat) : null,
            date: termine ? adoption : null,
            detail: null,
          },
    );
  }

  if (promulgue) {
    const loiNumero = dossiers.find((d) => d.loiNumero)?.loiNumero ?? null;
    etapes.push({
      code: "PROMULGATION",
      label: "Promulgation",
      chambre: "both",
      status: "done",
      outcome: "adopted",
      date: dossiers.find((d) => d.loiDateJO)?.loiDateJO ?? sujet.dateFin,
      detail: loiNumero ? `Loi n° ${loiNumero}` : null,
    });
  } else if (!toutRejete) {
    etapes.push({
      code: "PROMULGATION",
      label: "Promulgation",
      chambre: "both",
      status: "pending",
      outcome: null,
      date: null,
      detail: null,
    });
  }

  return etapes;
};
