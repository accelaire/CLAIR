import Image from 'next/image';
import { creditPhoto, initiales, nomComplet, photoDe, type PersonneGouvernement } from '@/lib/gouvernements';

const TAILLES = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-20 w-20 text-xl', xl: 'h-48 w-48 text-5xl' } as const;

/**
 * La photo de la fiche quand la personne en a une, sinon celle de Wikidata,
 * sinon ses initiales : les membres sans photo restent identifiables d'un coup
 * d'œil. Une photo de Wikimedia Commons porte son crédit en infobulle ; la
 * page du membre l'affiche en toutes lettres.
 */
export function Portrait({ personne, taille = 'sm' }: { personne: PersonneGouvernement; taille?: keyof typeof TAILLES }) {
  const photo = photoDe(personne);
  const credit = !personne.parlementaire?.photoUrl && personne.photo ? creditPhoto(personne.photo) : undefined;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ${TAILLES[taille]}`}
      title={credit}
    >
      {photo ? (
        // Les portraits de Commons sont plus hauts que larges (127 sur 149) :
        // un recadrage centré coupe la tête. On cadre sur le haut de l'image.
        <Image src={photo} alt={nomComplet(personne)} fill className="object-cover object-[50%_20%]" unoptimized />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          {initiales(personne)}
        </span>
      )}
    </div>
  );
}
