'use client';

import Image from 'next/image';
import Link from 'next/link';
import { nomGroupe, type Sortant } from '../PageClient';

// Une statistique absente s'affiche « — », jamais « 0 » : l'absence de mesure et
// une mesure nulle ne disent pas la même chose du travail d'un parlementaire.
function fmt(v: number | null | undefined, suffixe = '') {
  if (v === null || v === undefined) return '—';
  return `${v.toLocaleString('fr-FR')}${suffixe}`;
}

/**
 * Détail de la candidature, en infobulle.
 *
 * Au scrutin proportionnel, le rang sur la liste vaut d'être dit : un sortant
 * placé en fin de liste ne joue pas la même partie que sa tête de liste. Au
 * scrutin majoritaire, le rang ne veut rien dire et n'est donc pas affiché.
 */
function titreCandidature(candidature: NonNullable<Sortant['candidature']>): string {
  const morceaux: string[] = [];

  if (candidature.libelle) morceaux.push(`Liste « ${candidature.libelle} »`);
  if (candidature.modeScrutin === 'proportionnel') {
    // « 1re » et non « 1e » : la tête de liste est précisément celle dont on
    // parlera le plus.
    morceaux.push(`${candidature.ordre}${candidature.ordre === 1 ? 're' : 'e'} position`);
  }
  if (candidature.role === 'suppleant') morceaux.push('en remplaçant');

  return morceaux.length > 0
    ? morceaux.join(' — ')
    : 'Candidat au renouvellement du 27 septembre';
}

export function SortantCard({
  sortant,
  surbrillance = false,
  candidaturesPubliees = false,
}: {
  sortant: Sortant;
  /**
   * Carte désignée par une sélection faite dans un graphique.
   *
   * Marquée par un anneau plutôt que par un fond : la carte reste lisible, et le
   * repère survit au thème sombre comme au thème clair.
   */
  surbrillance?: boolean;
  /**
   * Les candidatures sont-elles publiées ?
   *
   * Indispensable, et pas seulement commode : sans ce drapeau, une candidature
   * absente est indiscernable d'un fichier pas encore paru, et la carte
   * écrirait « ne se représente pas » sur les 178 sortants pendant les mois qui
   * précèdent le dépôt. La donnée manquante doit rester muette.
   */
  candidaturesPubliees?: boolean;
}) {
  const initials = `${sortant.personne.prenom.charAt(0)}${sortant.personne.nom.charAt(0)}`.toUpperCase();

  return (
    <Link
      href={`/senateurs/${sortant.personne.slug}`}
      data-surbrillance={surbrillance || undefined}
      className={`group block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md ${
        surbrillance ? 'border-primary ring-2 ring-primary/40' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {sortant.personne.photoUrl ? (
          <Image
            src={sortant.personne.photoUrl}
            alt={`${sortant.personne.prenom} ${sortant.personne.nom}`}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:text-primary">
            {sortant.personne.prenom} {sortant.personne.nom}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: sortant.groupe?.couleur || '#888' }}
            />
            <span className="truncate text-sm text-muted-foreground">
              {nomGroupe(sortant.groupe)}
            </span>
          </div>
          {sortant.circonscription && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {sortant.circonscription.nom}
            </p>
          )}
        </div>
      </div>

      {sortant.commissionPermanente && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {sortant.commissionPermanente}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {candidaturesPubliees &&
          (sortant.candidature ? (
            <span
              className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
              title={titreCandidature(sortant.candidature)}
            >
              Se représente
            </span>
          ) : (
            <span className="inline-block rounded border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">
              Ne se représente pas
            </span>
          ))}
        {!sortant.mandat.mandatComplet && (
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            En fonction depuis{' '}
            {new Date(sortant.mandat.dateDebut).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        )}
        {sortant.mandat.interrompu && (
          <span
            className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            title="Mandat exercé en plusieurs périodes, une entrée au gouvernement l'ayant suspendu. Les chiffres ci-dessous couvrent l'ensemble du passage au Sénat."
          >
            Mandat interrompu
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-sm">
        <div>
          <p className="font-medium">{fmt(sortant.bilan.presence, ' %')}</p>
          <p className="text-xs text-muted-foreground">Présence</p>
        </div>
        <div>
          <p className="font-medium">{fmt(sortant.bilan.loyaute, ' %')}</p>
          <p className="text-xs text-muted-foreground">Loyauté</p>
        </div>
        <div>
          <p className="font-medium">{fmt(sortant.bilan.interventions)}</p>
          <p className="text-xs text-muted-foreground">Interventions</p>
        </div>
        <div>
          <p className="font-medium">{fmt(sortant.bilan.amendements)}</p>
          <p className="text-xs text-muted-foreground">Amendements</p>
        </div>
      </div>
    </Link>
  );
}