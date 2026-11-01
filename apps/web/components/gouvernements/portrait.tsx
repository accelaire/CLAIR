import Image from 'next/image';
import { initiales, nomComplet, type PersonneGouvernement } from '@/lib/gouvernements';

const TAILLES = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-20 w-20 text-xl' } as const;

/**
 * La photo de la fiche quand la personne en a une, ses initiales sinon : les
 * membres sans fiche (166 sur 311) restent identifiables d'un coup d'œil.
 */
export function Portrait({ personne, taille = 'sm' }: { personne: PersonneGouvernement; taille?: keyof typeof TAILLES }) {
  const photo = personne.parlementaire?.photoUrl;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ${TAILLES[taille]}`}
    >
      {photo ? (
        <Image src={photo} alt={nomComplet(personne)} fill className="object-cover" unoptimized />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          {initiales(personne)}
        </span>
      )}
    </div>
  );
}
