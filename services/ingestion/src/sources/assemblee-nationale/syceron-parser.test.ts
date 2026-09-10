import { describe, it, expect } from 'vitest';
import {
  parseCompteRendu,
  normaliserArticle,
  numerosAmendement,
  numeroTexte,
  dateDeSeance,
  decouperNom,
  resultatProclame,
  nettoyer,
  estPresidenceDeSeance,
} from './syceron-parser';

// Reproduit la structure réelle d'un compte rendu : <point> imbriqués sur
// plusieurs niveaux, l'article n'étant déclaré qu'au niveau intermédiaire.
const SEANCE = `<?xml version='1.0' encoding='UTF-8'?>
<compteRendu xmlns="http://schemas.assemblee-nationale.fr/referentiel">
  <uid>CRSANR5L17S2025O1N214</uid>
  <seanceRef>RUANR5L17S2025IDS29400</seanceRef>
  <metadonnees>
    <dateSeance>20250523213000000</dateSeance>
    <legislature>17</legislature>
  </metadonnees>
  <contenu>
    <point nivpoint="2" code_grammaire="DISC_ARTICLES_1_1" bibard=" (n[[o]]&#160;1364)" art="">
      <point nivpoint="3" code_grammaire="DISC_ARTICLES_2_4" art=" 15" valeur=" 15">
        <paragraphe ordre_absolu_seance="331" id_acteur="PA795228" code_grammaire="PAROLE_GENERIQUE" id_syceron="3767287" valeur="">
          <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
          <texte>La parole est à M. Yannick Monnet.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="332" id_acteur="PA793174" code_grammaire="PAROLE_GENERIQUE" id_syceron="3767289" valeur="">
          <orateurs><orateur><nom>M. Yannick Monnet</nom><id>793174</id><qualite/></orateur></orateurs>
          <texte>Cet article n[[o]]&#160;15 mérite un débat.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="333" id_acteur="PA721202" code_grammaire="PAROLE_GENERIQUE" id_syceron="3767290" valeur="">
          <orateurs><orateur><nom>M. Éric Coquerel</nom><id>721202</id><qualite>président de la commission des finances</qualite></orateur></orateurs>
          <texte>Cet amendement pose un vrai problème de recevabilité financière.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="653" id_acteur="PA795228" code_grammaire="SCRUT_PUB_ADT_1_2" id_syceron="3767650" valeur="2407">
          <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
          <texte>Je mets aux voix l'amendement no 2407.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="655" id_acteur="PA795228" code_grammaire="SCRUT_PUB_ADT_1_4" id_syceron="3767652" valeur="">
          <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
          <texte>Voici le résultat du scrutin : Nombre de votants 125 Nombre de suffrages exprimés 125 Majorité absolue 63 Pour l'adoption 37 Contre 88</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="662" id_acteur="PA795228" code_grammaire="SCRUT_ART_PUB_1_6" id_syceron="3767660" valeur=" 15">
          <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
          <texte>Je mets aux voix l'article 15.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="664" id_acteur="PA267797" code_grammaire="SCRUT_ART_PUB_1_8" id_syceron="3767662" valeur="">
          <orateurs><orateur><nom>Mme Catherine Vautrin</nom><id>267797</id><qualite>ministre</qualite></orateur></orateurs>
          <texte>Voici le résultat du scrutin : Nombre de votants 130 Nombre de suffrages exprimés 98 Majorité absolue 50 Pour l'adoption 75 Contre 23</texte>
        </paragraphe>
      </point>
    </point>
  </contenu>
</compteRendu>`;

describe('normalisation syceron', () => {
  it('remplace le tiret bas des articles par une espace', () => {
    expect(normaliserArticle(' 15')).toBe('15');
    expect(normaliserArticle('Après_ 9')).toBe('Après 9');
    expect(normaliserArticle('')).toBeNull();
    expect(normaliserArticle(undefined)).toBeNull();
  });

  it('extrait tous les amendements mis aux voix ensemble', () => {
    expect(numerosAmendement(' 74, 1300 et 2598')).toEqual(['74', '1300', '2598']);
    expect(numerosAmendement(' 2407')).toEqual(['2407']);
    expect(numerosAmendement(undefined)).toEqual([]);
  });

  it("ignore la mention de rectification, qui ne fait pas partie du numéro", () => {
    expect(numerosAmendement(' 2066 rectifié')).toEqual(['2066']);
    expect(numerosAmendement(' 262 rectifié, 653 rectifié, 1204 ')).toEqual(['262', '653', '1204']);
  });

  it('lit le numéro de texte sous la notation en exposant', () => {
    expect(numeroTexte(' (n[[o]] 1364)')).toBe('1364');
    expect(numeroTexte(undefined)).toBeNull();
  });

  it('lit la date de séance et son heure', () => {
    const date = dateDeSeance('20250523213000000');
    expect(date?.toISOString()).toBe('2025-05-23T21:30:00.000Z');
    expect(dateDeSeance('pas une date')).toBeNull();
  });

  it('sépare la civilité du nom', () => {
    expect(decouperNom('M. Yannick Monnet')).toEqual({ prenom: 'Yannick', nom: 'Monnet' });
    expect(decouperNom('Mme Catherine Vautrin')).toEqual({ prenom: 'Catherine', nom: 'Vautrin' });
    expect(decouperNom('Mme la présidente')).toEqual({ prenom: 'la', nom: 'présidente' });
  });

  it('rend lisibles les exposants et les insécables', () => {
    expect(nettoyer('article n[[o]] 15')).toBe('article no 15');
  });

  it('reconnaît la présidence de séance à son nom générique', () => {
    // L'AN anonymise systématiquement le perchoir : quel que soit qui préside,
    // le nom reste « le président »/« la présidente » (jamais le nom réel).
    expect(estPresidenceDeSeance('président')).toBe(true);
    expect(estPresidenceDeSeance('présidente')).toBe(true);
  });

  it('ne prend pas un président de commission pour la présidence de séance', () => {
    // Un président de commission qui parle sur le fond est nommé par son nom
    // réel : « qualité » ne doit jamais entrer dans ce calcul, sous peine de
    // faire disparaître ces parlementaires de l'affichage.
    expect(estPresidenceDeSeance('Coquerel')).toBe(false);
    expect(estPresidenceDeSeance('Boudié')).toBe(false);
  });

  it('lit les chiffres proclamés au perchoir', () => {
    expect(
      resultatProclame(
        "Nombre de votants 130 Nombre de suffrages exprimés 98 Majorité absolue 50 Pour l'adoption 75 Contre 23",
      ),
    ).toEqual({ votants: 130, exprimes: 98, pour: 75, contre: 23 });
  });

  it('ne proclame rien quand le texte ne porte pas de résultat', () => {
    expect(resultatProclame('Il est procédé au scrutin.')).toBeNull();
  });
});

describe('parseCompteRendu', () => {
  const seance = parseCompteRendu(SEANCE);

  it('lit les métadonnées de la séance', () => {
    expect(seance).not.toBeNull();
    expect(seance?.uid).toBe('CRSANR5L17S2025O1N214');
    expect(seance?.seanceRef).toBe('RUANR5L17S2025IDS29400');
    expect(seance?.legislature).toBe(17);
    expect(seance?.date.toISOString()).toBe('2025-05-23T21:30:00.000Z');
  });

  it("fait hériter l'article et le texte des <point> englobants", () => {
    // `art` est porté par le point de niveau 3, `bibard` par celui de niveau 2 :
    // sans héritage, un paragraphe n'aurait ni l'un ni l'autre.
    const monnet = seance?.prises.find((p) => p.orateurRef === 'PA793174');
    expect(monnet?.articleVise).toBe('15');
    expect(monnet?.texteNumero).toBe('1364');
  });

  it("identifie l'orateur par son identifiant, jamais par son nom", () => {
    const monnet = seance?.prises.find((p) => p.ordreAbsolu === 332);
    expect(monnet?.orateurRef).toBe('PA793174');
    expect(monnet?.orateurPrenom).toBe('Yannick');
    expect(monnet?.orateurNom).toBe('Monnet');
  });

  it('distingue la mécanique de séance des prises de parole de fond', () => {
    const presidence = seance?.prises.filter((p) => p.estPresidence) ?? [];
    const fond = seance?.prises.filter((p) => !p.estPresidence) ?? [];
    expect(presidence.length).toBeGreaterThan(0);
    expect(fond.map((p) => p.orateurNom)).toContain('Monnet');
    expect(fond.map((p) => p.orateurNom)).not.toContain('présidente');
  });

  it('ne marque pas un président de commission comme présidence de séance', () => {
    // Éric Coquerel parle sur le fond (recevabilité financière) avec sa
    // qualité de président de la commission des finances : ce n'est pas de la
    // mécanique de séance et il doit rester affiché comme n'importe quelle
    // autre prise de parole de fond.
    const coquerel = seance?.prises.find((p) => p.orateurRef === 'PA721202');
    expect(coquerel?.orateurNom).toBe('Coquerel');
    expect(coquerel?.orateurQualite).toBe('président de la commission des finances');
    expect(coquerel?.estPresidence).toBe(false);
  });

  it('lit la qualité déclarée plutôt que de la deviner dans le nom', () => {
    const ministre = seance?.prises.find((p) => p.orateurRef === 'PA267797');
    expect(ministre?.orateurQualite).toBe('ministre');
    expect(ministre?.orateurNom).toBe('Vautrin');
  });

  it('relève les deux mises aux voix avec leur cible', () => {
    expect(seance?.votes).toHaveLength(2);
    const [amendement, article] = seance!.votes;
    expect(amendement?.cible).toBe('amendement');
    expect(amendement?.numeros).toEqual(['2407']);
    expect(article?.cible).toBe('article');
    expect(article?.numeros).toEqual(['15']);
  });

  it('rattache à chaque annonce la proclamation qui la suit', () => {
    const [amendement, article] = seance!.votes;
    expect(amendement?.resultat).toEqual({ votants: 125, exprimes: 125, pour: 37, contre: 88 });
    expect(article?.resultat).toEqual({ votants: 130, exprimes: 98, pour: 75, contre: 23 });
  });

  it('situe chaque vote dans son article et son texte', () => {
    expect(seance?.votes.every((v) => v.articleVise === '15')).toBe(true);
    expect(seance?.votes.every((v) => v.texteNumero === '1364')).toBe(true);
  });

  it('refuse un document sans métadonnées exploitables', () => {
    expect(parseCompteRendu('<compteRendu><contenu/></compteRendu>')).toBeNull();
  });
});

// Reproduit la discussion d'un amendement puis une séquence d'explications de
// vote : deux contextes que rien ne signale sur le paragraphe lui-même.
const SEANCE_AMENDEMENT_ET_EXPLICATIONS = `<?xml version='1.0' encoding='UTF-8'?>
<compteRendu xmlns="http://schemas.assemblee-nationale.fr/referentiel">
  <uid>CRSANR5L17S2025E1N003</uid>
  <metadonnees>
    <dateSeance>20250115150000000</dateSeance>
    <legislature>17</legislature>
  </metadonnees>
  <contenu>
    <point nivpoint="3" code_grammaire="DISC_ARTICLES_2_4" art=" 1er" bibard=" (n[[o]]&#160;1640)">
      <point nivpoint="4" code_grammaire="DISC_ARTICLES_3_1" art=" 1er" adt=" 13">
        <paragraphe ordre_absolu_seance="520" id_acteur="PA795228" code_grammaire="PAROLE_GENERIQUE" id_syceron="1">
          <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
          <texte>La parole est à M. Antoine Léaument, pour soutenir l'amendement no 13.</texte>
        </paragraphe>
        <paragraphe ordre_absolu_seance="521" id_acteur="PA794022" code_grammaire="PAROLE_GENERIQUE" id_syceron="2" adt=" 13">
          <orateurs><orateur><nom>M. Antoine Léaument</nom><id>794022</id><qualite/></orateur></orateurs>
          <texte>Cet amendement vise à rétablir une garantie essentielle pour les justiciables.</texte>
        </paragraphe>
      </point>
    </point>
    <point nivpoint="2" code_grammaire="MOTION_RP_1_1" bibard=" (n[[o]]&#160;1640)">
      <paragraphe ordre_absolu_seance="600" id_acteur="PA795228" code_grammaire="PAROLE_GENERIQUE" id_syceron="3">
        <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
        <texte>Dans les explications de vote, la parole est à M. Alexandre Portier.</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="601" id_acteur="PA794994" code_grammaire="PAROLE_GENERIQUE" id_syceron="4">
        <orateurs><orateur><nom>M. Alexandre Portier</nom><id>794994</id><qualite/></orateur></orateurs>
        <texte>Notre groupe votera contre cette motion, et voici pourquoi.</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="602" id_acteur="PA700000" code_grammaire="INTERRUPTION_1_10" id_syceron="5">
        <orateurs><orateur><nom>Mme Andrée Taurinya</nom><id>700000</id><qualite/></orateur></orateurs>
        <texte>On en a connu d'autres, des discours comme celui-là !</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="603" id_acteur="PA795228" code_grammaire="PAROLE_GENERIQUE" id_syceron="6">
        <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
        <texte>La parole est à Mme Géraldine Bannier.</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="604" id_acteur="PA794995" code_grammaire="PAROLE_GENERIQUE" id_syceron="7">
        <orateurs><orateur><nom>Mme Géraldine Bannier</nom><id>794995</id><qualite/></orateur></orateurs>
        <texte>Le groupe Les Démocrates ne votera pas cette motion de rejet.</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="605" id_acteur="PA795228" code_grammaire="SCR_MRJ_1_4" id_syceron="8">
        <orateurs><orateur><nom>Mme la présidente</nom><id>795228</id><qualite/></orateur></orateurs>
        <texte>Voici le résultat du scrutin : Nombre de votants 561 Nombre de suffrages exprimés 504 Majorité absolue 253 Pour l'adoption 199 Contre 305</texte>
      </paragraphe>
      <paragraphe ordre_absolu_seance="606" id_acteur="PA794996" code_grammaire="PAROLE_GENERIQUE" id_syceron="9">
        <orateurs><orateur><nom>M. Charles Rodwell</nom><id>794996</id><qualite/></orateur></orateurs>
        <texte>J'en viens maintenant au fond du texte que nous examinons.</texte>
      </paragraphe>
    </point>
  </contenu>
</compteRendu>`;

describe('amendements visés', () => {
  const seance = parseCompteRendu(SEANCE_AMENDEMENT_ET_EXPLICATIONS);

  it("lit le numéro sur l'attribut `adt` du paragraphe", () => {
    const soutien = seance?.prises.find((p) => p.ordreAbsolu === 521);
    expect(soutien?.amendementsVises).toEqual(['13']);
  });

  it("n'hérite pas l'amendement du <point> englobant", () => {
    // Le <point> déclare adt=" 13", mais la distribution de parole qui l'ouvre
    // ne le déclare pas : un point couvre la discussion commune de plusieurs
    // amendements, et hériter prêterait à l'un ce qui se dit d'un autre.
    const annonce = seance?.prises.find((p) => p.ordreAbsolu === 520);
    expect(annonce?.amendementsVises).toEqual([]);
  });

  it("ne prête aucun amendement aux prises de parole hors d'une discussion d'amendement", () => {
    const explication = seance?.prises.find((p) => p.ordreAbsolu === 601);
    expect(explication?.amendementsVises).toEqual([]);
  });
});

describe('séquences d’explications de vote', () => {
  const seance = parseCompteRendu(SEANCE_AMENDEMENT_ET_EXPLICATIONS);
  const marque = (ordre: number): boolean | undefined =>
    seance?.prises.find((p) => p.ordreAbsolu === ordre)?.dansExplicationDeVote;

  it("marque l'orateur appelé par l'annonce", () => {
    expect(marque(601)).toBe(true);
  });

  it('marque les orateurs suivants, que la présidence appelle sans le redire', () => {
    expect(marque(604)).toBe(true);
  });

  it("ne marque pas la mécanique de séance, qui n'explique aucun vote", () => {
    expect(marque(600)).toBe(false);
    expect(marque(603)).toBe(false);
  });

  it('ferme la séquence au scrutin', () => {
    expect(marque(606)).toBe(false);
  });

  it("ne marque rien avant l'annonce", () => {
    expect(marque(521)).toBe(false);
  });
});
