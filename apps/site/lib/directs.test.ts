import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cartesDirectSenat,
  directsDuJour,
  ordreSeanceAssemblee,
  seanceSenatDuSlug,
  type VideoAssemblee,
} from "./directs.ts";

// Réponses fictives, à la forme de celles des chaînes vidéo des chambres.
const JOUR = "2026-11-12";
const midiUnix = String(Date.parse(`${JOUR}T12:00:00Z`) / 1000);
const veilleUnix = String(Date.parse("2026-11-11T12:00:00Z") / 1000);

const video = (patch: Partial<VideoAssemblee>): VideoAssemblee => ({
  date: midiUnix,
  url: "/video.123456.abc",
  video_type: "",
  commission: null,
  title: "",
  published: true,
  ...patch,
});

describe("directs : lecture des sources", () => {
  it("lit le rang d'une séance de l'Assemblée", () => {
    assert.equal(ordreSeanceAssemblee("2ème séance du jeudi 12 novembre"), 2);
    assert.equal(ordreSeanceAssemblee("1ère séance du jeudi"), 1);
    assert.equal(ordreSeanceAssemblee("Questions au Gouvernement"), null);
  });

  it("lit le jour et le moment d'une séance du Sénat", () => {
    assert.deepEqual(seanceSenatDuSlug("seance-publique-du-5-novembre-2026-apres-midi"), {
      isoDate: "2026-11-05",
      order: 2,
    });
    assert.equal(seanceSenatDuSlug("seance-publique-du-5-brumaire-2026-soir"), null);
  });

  it("lit les cartes « en direct » de la page du Sénat", () => {
    const html =
      '<div class="card-live"><a href="video.1_ab12.seance-publique-du-12-novembre-2026-soir">' +
      '<p class="card-subtitle">Séance publique</p></a></div><div class="card-live">sans lien</div>';
    assert.deepEqual(cartesDirectSenat(html), [
      {
        href: "video.1_ab12.seance-publique-du-12-novembre-2026-soir",
        subtitle: "Séance publique",
      },
    ]);
  });
});

describe("directsDuJour", () => {
  it("garde les vidéos du jour, publiées, reliées à un organe ou à un rang de séance", () => {
    const directs = directsDuJour(
      {
        commissionsAssemblee: [
          video({ commission: "CION_FIN;autre", url: "/video.1.fin" }),
          video({ commission: "CODE_INCONNU" }),
          video({ commission: "CION_LOIS", date: veilleUnix }),
          video({ commission: "CION_DEF", published: false }),
        ],
        seancesAssemblee: [
          video({ title: "2ème séance du jeudi", url: "/video.2.seance" }),
          video({ title: "Hommage" }),
        ],
        senat: [
          {
            href: "video.9_ab.seance-publique-du-12-novembre-2026-matin",
            subtitle: "Séance publique",
          },
          { href: "video.9_cd.audition", subtitle: "Commission des finances" },
        ],
      },
      JOUR,
    );
    assert.deepEqual(directs, {
      commissions: [
        {
          organeRef: "PO59048",
          directUrl: "https://videos.assemblee-nationale.fr/direct.video.1.fin",
          chambre: "assemblee",
        },
      ],
      seances: [
        {
          isoDate: JOUR,
          order: 2,
          directUrl: "https://videos.assemblee-nationale.fr/direct.video.2.seance",
          chambre: "assemblee",
        },
        {
          isoDate: JOUR,
          order: 1,
          directUrl: "https://videos.senat.fr/video.9_ab.seance-publique-du-12-novembre-2026-matin",
          chambre: "senat",
        },
      ],
    });
  });
});
