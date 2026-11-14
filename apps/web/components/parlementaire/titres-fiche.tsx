import Link from 'next/link';
import { dateLongue } from '@/lib/gouvernements';

// Titres d'un élu sous son nom (gouvernement, présidence de l'assemblée, d'une
// commission, d'un groupe), dans un seul encadré et une seule présentation pour
// les deux chambres. Ils cohabitaient en deux styles : texte bleu nu pour les
// fonctions parlementaires, encadré pour le gouvernement.

export interface TitreFiche {
  titre: string;
  depuis?: string | null;
  lien?: { href: string; libelle: string } | null;
}

export function TitresFiche({ titres }: { titres: readonly TitreFiche[] }) {
  if (titres.length === 0) return null;
  return (
    <div className="mt-3 inline-flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      {titres.map((t) => (
        <div key={t.titre} className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 md:justify-start">
          <span className="font-semibold">{t.titre}</span>
          {t.depuis && <span className="text-muted-foreground">depuis le {dateLongue(t.depuis)}</span>}
          {t.lien && (
            <Link href={t.lien.href} className="text-primary hover:underline">
              {t.lien.libelle}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** Le poste au gouvernement d'abord, puis les fonctions parlementaires. */
export function titresDeLaFiche(
  gouvernement: {
    titre: string;
    depuis: string;
    gouvernement: { slug: string; nom: string } | null;
  } | null,
  fonctions: readonly { libelle: string; depuis: string | null }[],
): TitreFiche[] {
  const titres: TitreFiche[] = [];
  if (gouvernement) {
    titres.push({
      titre: gouvernement.titre,
      depuis: gouvernement.depuis,
      lien: gouvernement.gouvernement
        ? { href: `/gouvernements/${gouvernement.gouvernement.slug}`, libelle: `Gouvernement ${gouvernement.gouvernement.nom}` }
        : null,
    });
  }
  for (const f of fonctions) titres.push({ titre: f.libelle, depuis: f.depuis });
  return titres;
}
