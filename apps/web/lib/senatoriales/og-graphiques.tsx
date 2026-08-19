/**
 * Fabrication des images d'un graphique partageable.
 *
 * Une seule fonction sert deux routes : l'aperçu Open Graph que déroulent les
 * réseaux sociaux, et le PNG que le bouton « Télécharger l'image » remet au
 * lecteur. C'est délibéré — deux rendus séparés finiraient par ne plus se
 * ressembler, et le lecteur enregistrerait autre chose que ce qu'il a partagé.
 *
 * Contraintes de Satori, le moteur de rendu : pas de Tailwind, pas de variables
 * CSS, pas de `prefers-color-scheme`, et tout conteneur à plusieurs enfants doit
 * porter `display: flex`. Les graphiques dont la géométrie ne se laisse pas
 * décrire en boîtes — la carte, les nuages de points — sont passés en SVG dans
 * une balise `<img>` ; les autres sont de simples barres, donc des `div`.
 */

import { ImageResponse } from 'next/og';
import { OgLayout, OG_SIZE, loadFont } from '@/lib/og';
import { fetchFromApi } from '@/lib/api-server';
import type { ApercuSenatoriales, Sortant } from '@/app/senatoriales-2026/PageClient';
import {
  GRAPHIQUES,
  COULEUR_GROUPE_DEFAUT,
  bandesBilan,
  mediane,
  parCommission,
  parFamilleProfession,
  partsRemisesEnJeu,
  pointsActivite,
  pointsDistribution,
  pyramideAges,
  siegesParDepartement,
  type Comptage,
  type SlugGraphique,
} from './graphiques';
import { carteSvg, nuageSvg, siegesHorsCarte, versDataUri } from './svg-graphiques';
import { SENATORIALES_2026 } from '@/lib/senatoriales';

const BADGE = 'Sénatoriales 2026';
const BADGE_COULEUR = '#f43f5e';

const TEXTE_CLAIR = '#f8fafc';
const TEXTE_DOUX = '#94a3b8';
const FOND_BARRE = 'rgba(255,255,255,0.10)';

/** Hauteur utile pour le corps du graphique, une fois le titre et le bandeau posés. */
const HAUTEUR_CORPS = 330;

export async function imageGraphique(slug: SlugGraphique): Promise<ImageResponse> {
  const [font, apercu, sortants] = await Promise.all([
    loadFont(),
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
    fetchFromApi<{ data: Sortant[] }>('/senatoriales/2026/sortants', 3600),
  ]);

  const meta = GRAPHIQUES[slug];
  // L'image doit se fabriquer même API éteinte : c'est au moment où un lien est
  // le plus partagé qu'une panne casserait le plus d'aperçus. Sans données, on
  // sert la carte de titre plutôt qu'une erreur.
  const corps =
    apercu && sortants?.data?.length
      ? corpsGraphique(slug, apercu, sortants.data)
      : null;

  return new ImageResponse(
    (
      <OgLayout badge={BADGE} badgeColor={BADGE_COULEUR}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <span style={{ fontSize: '44px', fontWeight: 700, color: TEXTE_CLAIR }}>
            {meta.titre}
          </span>
          <span style={{ fontSize: '24px', color: TEXTE_DOUX, maxWidth: '1000px' }}>
            {corps ? meta.accroche : meta.sousTitre}
          </span>
          {corps}
        </div>
      </OgLayout>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}

function corpsGraphique(
  slug: SlugGraphique,
  apercu: ApercuSenatoriales,
  sortants: Sortant[],
): JSX.Element {
  switch (slug) {
    case 'carte':
      return <CorpsCarte sortants={sortants} />;
    case 'groupes':
      return <CorpsGroupes apercu={apercu} />;
    case 'presence':
      return <CorpsDistribution sortants={sortants} />;
    case 'activite':
      return <CorpsActivite sortants={sortants} />;
    case 'ages':
      return <CorpsPyramide sortants={sortants} />;
    case 'commissions':
      return <CorpsBarres donnees={parCommission(sortants).slice(0, 6)} total={sortants.length} />;
    case 'professions':
      return (
        <CorpsBarres donnees={parFamilleProfession(sortants).slice(0, 6)} total={sortants.length} />
      );
  }
}

// --- Carte -------------------------------------------------------------------

function CorpsCarte({ sortants }: { sortants: Sortant[] }) {
  const sieges = siegesParDepartement(sortants);
  const horsCarte = siegesHorsCarte(sieges);
  const departementsMetropole = sieges.filter((s) => s.code.length === 2).length;
  const plusGros = [...sieges].sort((a, b) => b.sieges - a.sieges).slice(0, 4);

  return (
    <div style={{ display: 'flex', gap: '36px', alignItems: 'center', marginTop: '4px' }}>
      <img
        src={versDataUri(carteSvg(sieges))}
        width={HAUTEUR_CORPS}
        height={HAUTEUR_CORPS}
        alt=""
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
        {plusGros.map((circo) => (
          <div
            key={circo.code}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '26px' }}
          >
            <span style={{ color: TEXTE_CLAIR, fontWeight: 700, width: '48px' }}>
              {circo.sieges}
            </span>
            <span style={{ color: TEXTE_DOUX }}>{circo.nom}</span>
          </div>
        ))}
        <div style={{ display: 'flex', fontSize: '21px', color: TEXTE_DOUX, marginTop: '6px' }}>
          {departementsMetropole} départements de métropole, plus {horsCarte} sièges outre-mer
          et pour les Français de l’étranger.
        </div>
      </div>
    </div>
  );
}

// --- Groupes -----------------------------------------------------------------

function CorpsGroupes({ apercu }: { apercu: ApercuSenatoriales }) {
  const parts = partsRemisesEnJeu(apercu.sortants.parGroupe);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
      {parts.map((groupe) => (
        <div key={groupe.slug} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              display: 'flex',
              width: '260px',
              fontSize: '24px',
              color: TEXTE_CLAIR,
              overflow: 'hidden',
            }}
          >
            {groupe.nom}
          </span>
          <div
            style={{
              display: 'flex',
              flex: 1,
              height: '22px',
              borderRadius: '11px',
              backgroundColor: FOND_BARRE,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${Math.max(groupe.part, 2)}%`,
                borderRadius: '11px',
                backgroundColor: groupe.couleur || COULEUR_GROUPE_DEFAUT,
              }}
            />
          </div>
          <span
            style={{
              display: 'flex',
              width: '190px',
              fontSize: '23px',
              color: TEXTE_DOUX,
              justifyContent: 'flex-end',
            }}
          >
            {groupe.sieges}/{groupe.siegesSenat} · {Math.round(groupe.part)} %
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Distribution ------------------------------------------------------------

function CorpsDistribution({ sortants }: { sortants: Sortant[] }) {
  const bandes = bandesBilan(sortants, 'presence');
  const points = pointsDistribution(sortants, 'presence');
  const valeurMediane = mediane(points.map((p) => p.valeur));
  const max = Math.max(...bandes.map((b) => b.effectif), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '4px' }}>
      {bandes.map((bande) => (
        <div key={bande.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              display: 'flex',
              width: '210px',
              fontSize: '22px',
              color: TEXTE_DOUX,
              justifyContent: 'flex-end',
            }}
          >
            {bande.label}
          </span>
          <div style={{ display: 'flex', flex: 1, height: '22px', backgroundColor: FOND_BARRE }}>
            <div
              style={{
                display: 'flex',
                width: `${(bande.effectif / max) * 100}%`,
                backgroundColor: '#3b82f6',
              }}
            />
          </div>
          <span
            style={{
              display: 'flex',
              width: '56px',
              fontSize: '22px',
              color: TEXTE_CLAIR,
              justifyContent: 'flex-end',
            }}
          >
            {bande.effectif}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', fontSize: '21px', color: TEXTE_DOUX, marginTop: '4px' }}>
        {points.length} sortants mesurés · médiane{' '}
        {valeurMediane !== null ? Math.round(valeurMediane) : '—'} %
      </div>
    </div>
  );
}

// --- Activité ----------------------------------------------------------------

function CorpsActivite({ sortants }: { sortants: Sortant[] }) {
  const points = pointsActivite(sortants);
  const hauteur = 260;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      <img src={versDataUri(nuageSvg(points, { hauteur }))} width={1072} height={hauteur} alt="" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', color: TEXTE_DOUX }}>
        <span>↑ Amendements par mois</span>
        <span>Interventions par mois → · {points.length} sortants</span>
      </div>
    </div>
  );
}

// --- Pyramide ----------------------------------------------------------------

function CorpsPyramide({ sortants }: { sortants: Sortant[] }) {
  const tranches = pyramideAges(sortants, new Date(`${SENATORIALES_2026.scrutin}T00:00:00Z`));
  const maxCote = tranches.reduce((max, t) => Math.max(max, t.hommes, t.femmes + t.autres), 0) || 1;
  const totaux = tranches.reduce(
    (acc, t) => ({
      hommes: acc.hommes + t.hommes,
      femmes: acc.femmes + t.femmes,
      autres: acc.autres + t.autres,
    }),
    { hommes: 0, femmes: 0, autres: 0 },
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
      {tranches.map((tranche) => (
        <div key={tranche.debut} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}>
            <div
              style={{
                display: 'flex',
                width: `${(tranche.hommes / maxCote) * 100}%`,
                height: '20px',
                backgroundColor: '#3b82f6',
              }}
            />
          </div>
          <span
            style={{
              display: 'flex',
              width: '92px',
              justifyContent: 'center',
              fontSize: '20px',
              color: TEXTE_DOUX,
            }}
          >
            {tranche.label}
          </span>
          {/* Le sexe non renseigné a son propre segment, comme sur la page.
              Empilé dans la barre des femmes, il gonflait un décompte que le
              pied de l'image contredisait ensuite. */}
          <div style={{ display: 'flex', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                width: `${(tranche.femmes / maxCote) * 100}%`,
                height: '20px',
                backgroundColor: '#f43f5e',
              }}
            />
            {tranche.autres > 0 && (
              <div
                style={{
                  display: 'flex',
                  width: `${(tranche.autres / maxCote) * 100}%`,
                  height: '20px',
                  backgroundColor: '#64748b',
                }}
              />
            )}
          </div>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '22px',
          color: TEXTE_DOUX,
          marginTop: '6px',
        }}
      >
        <span style={{ color: '#3b82f6' }}>{totaux.hommes} hommes</span>
        <span>Âge au 27 septembre 2026</span>
        <span style={{ display: 'flex', gap: '12px' }}>
          <span style={{ color: '#f43f5e' }}>{totaux.femmes} femmes</span>
          {totaux.autres > 0 && <span>· {totaux.autres} non renseigné</span>}
        </span>
      </div>
    </div>
  );
}

// --- Barres génériques -------------------------------------------------------

function CorpsBarres({ donnees, total }: { donnees: Comptage[]; total: number }) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
      {donnees.map((entree) => (
        <div key={entree.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              display: 'flex',
              width: '420px',
              fontSize: '23px',
              color: TEXTE_CLAIR,
              overflow: 'hidden',
            }}
          >
            {/* Les intitulés officiels des commissions dépassent la ligne : la
                coupe est faite ici, pas par le moteur, qui replierait le texte
                et déformerait la hauteur des barres. */}
            {entree.label.length > 42 ? `${entree.label.slice(0, 41)}…` : entree.label}
          </span>
          <div
            style={{
              display: 'flex',
              flex: 1,
              height: '26px',
              borderRadius: '13px',
              backgroundColor: FOND_BARRE,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${(entree.valeur / max) * 100}%`,
                borderRadius: '13px',
                backgroundColor: '#3b82f6',
              }}
            />
          </div>
          <span
            style={{
              display: 'flex',
              width: '120px',
              fontSize: '23px',
              color: TEXTE_DOUX,
              justifyContent: 'flex-end',
            }}
          >
            {entree.valeur} · {Math.round((entree.valeur / total) * 100)} %
          </span>
        </div>
      ))}
    </div>
  );
}
