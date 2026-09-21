import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { OgPage, OG_SIZE, loadFont } from '@/lib/og';
import { SLUGS_DEPARTEMENTS, codeDepuisSlug } from '@/lib/senatoriales/departements';
import {
  circonscriptionDepuisSlug,
  modeDeScrutin,
  pluriel,
} from '@/lib/senatoriales/circonscription';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = OG_SIZE;

/**
 * Aperçu social d'une circonscription.
 *
 * Ces 64 pages n'en avaient aucun : la carte partagée annonçait
 * `summary_large_image` sans image, et les réseaux la dégradaient en lien nu —
 * au moment précis où le scrutin les rend partageables. Le titre et la
 * description disaient déjà les candidats ; l'image, elle, n'existait pas.
 *
 * `generateStaticParams` borne les 64 valeurs connues, mais Next 14 sert les
 * routes d'image de métadonnées à la demande (`[[...__metadata_id__]]`) : la
 * première visite d'un robot la fabrique, `revalidate` la garde ensuite une
 * heure. Les données, elles, sortent du cache de `fetch` que la page a déjà
 * rempli — l'image ne rouvre pas l'API à chaque partage.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return SLUGS_DEPARTEMENTS.map((departement) => ({ departement }));
}

export async function generateImageMetadata({
  params,
}: {
  params: { departement: string };
}) {
  // Le slug seul décide qu'il y a une image, et il se valide hors réseau. Le
  // faire dépendre de l'API annulait le repli écrit plus bas : quand l'API se
  // tait — le cas même qu'il vise — rendre `[]` fait que Next n'émet aucun
  // `og:image`, et la carte de repli n'a plus aucune chance d'être rendue.
  if (!codeDepuisSlug(params.departement)) return [];

  // Les chiffres, eux, ne servent qu'à décrire l'image : leur absence dégrade
  // le texte alternatif, elle ne supprime pas l'aperçu.
  const circo = await circonscriptionDepuisSlug(params.departement);
  return [
    {
      id: params.departement,
      size: OG_SIZE,
      alt: circo
        ? `Sénatoriales 2026 — ${circo.nom} : ${circo.nbSieges} ${pluriel(circo.nbSieges, 'siège')} à pourvoir`
        : 'Sénatoriales 2026',
      contentType: 'image/png',
    },
  ];
}

export default async function Image({ params }: { params: { departement: string } }) {
  // Le slug est validé hors réseau : un segment inventé ne doit pas produire
  // d'image, la page répondant elle-même 404.
  if (!codeDepuisSlug(params.departement)) notFound();

  const [font, circo] = await Promise.all([
    loadFont(),
    circonscriptionDepuisSlug(params.departement),
  ]);

  // API muette : la carte se réduit au repère du scrutin plutôt qu'à une erreur.
  // Un aperçu cassé est bien plus coûteux qu'un aperçu sans chiffres, et c'est
  // en panne que les liens se partagent quand même.
  const scrutin = circo ? modeDeScrutin(circo.nbSieges) : null;
  const nbCandidats = circo?.nbCandidats ?? 0;
  const nbListes = circo?.nbListes ?? 0;
  // Les candidatures ne paraissent qu'une quinzaine de jours avant le scrutin.
  // Avant, l'image ne promet pas une liste qui n'existe pas encore.
  const candidaturesPubliees = nbCandidats > 0;

  const pastilles =
    circo && scrutin
      ? [
          // Les candidats en tête : c'est ce que le lecteur cherche à quelques
          // jours du scrutin, et ce dont l'image ne disait rien.
          ...(candidaturesPubliees
            ? [
                { label: 'Candidats', value: String(nbCandidats) },
                {
                  label: pluriel(nbListes, scrutin.unite === 'liste' ? 'Liste' : 'Candidature'),
                  value: String(nbListes),
                },
              ]
            : []),
          {
            label: `${pluriel(circo.nbSieges, 'Siège')} à pourvoir`,
            value: String(circo.nbSieges),
          },
          { label: 'Scrutin', value: scrutin.bref },
        ]
      : // Repli API muette : les seuls chiffres qu'on tient sans réseau.
        [
          { label: 'Sièges renouvelés', value: '178' },
          { label: 'Circonscriptions', value: '64' },
        ];

  return new ImageResponse(
    (
      <OgPage
        badge="Sénatoriales 2026"
        badgeColor="#f43f5e"
        surtitre="Dimanche 27 septembre 2026"
        titre={circo ? circo.nom : 'Sénatoriales 2026'}
        sousTitre={
          candidaturesPubliees
            ? 'Les candidats en lice, et le bilan des sortants'
            : 'Le bilan de mandature des sénateurs sortants'
        }
        stats={pastilles}
      />
    ),
    { ...OG_SIZE, fonts: [{ name: 'Inter', data: font, weight: 600 }] },
  );
}
