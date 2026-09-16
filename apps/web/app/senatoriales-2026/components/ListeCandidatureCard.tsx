import Link from 'next/link';
import type { ListeCandidature } from '../PageClient';

/**
 * Couleur de la famille politique.
 *
 * Les familles ne sont pas des groupes parlementaires : elles n'ont pas de
 * couleur officielle, et leur en emprunter une donnerait à croire à une
 * équivalence qui n'existe pas. Ces teintes ne servent qu'à distinguer les
 * blocs les uns des autres dans une liste.
 *
 * `null` — la famille que la grille refuse de trancher — reste volontairement
 * gris : ne pas savoir doit se voir.
 */
const COULEUR_FAMILLE: Record<string, string> = {
  gauche: '#d04a4a',
  centre: '#e8a33d',
  droite: '#3d6fb4',
  extreme_droite: '#5b4a8a',
  regionaliste: '#3f9e7c',
  divers: '#8a8a8a',
};

function couleur(famille: string | null): string {
  return (famille && COULEUR_FAMILLE[famille]) || '#9ca3af';
}

/**
 * Une unité de vote : une liste au scrutin proportionnel, un binôme
 * titulaire-remplaçant au scrutin majoritaire.
 *
 * Le même composant sert les deux, parce que c'est bien la même chose du point
 * de vue de l'électeur : ce pour quoi on vote d'un bloc.
 */
export function ListeCandidatureCard({ liste }: { liste: ListeCandidature }) {
  const proportionnel = liste.modeScrutin === 'proportionnel';
  const titulaires = liste.candidats.filter((c) => c.role === 'titulaire');
  const remplacants = liste.candidats.filter((c) => c.role === 'suppleant');

  // Au majoritaire il n'y a pas de libellé de liste : le nom du candidat fait
  // office de titre, comme sur le bulletin.
  const titre =
    liste.libelle ??
    (titulaires[0] ? `${titulaires[0].prenom} ${titulaires[0].nom}` : 'Candidature');

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: couleur(liste.famille) }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{titre}</h3>
          {liste.nuanceLibelle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{liste.nuanceLibelle}</p>
          )}
        </div>
      </div>

      <ol className="mt-3 space-y-1.5 border-t pt-3">
        {titulaires.map((candidat) => (
          <li key={candidat.id} className="flex items-baseline gap-2 text-sm">
            {proportionnel && (
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {candidat.ordre}
              </span>
            )}
            <span className="min-w-0 flex-1">
              {/*
                Le lien n'existe que si le candidat est déjà passé par le
                Parlement. C'est tout l'intérêt de la page : une candidature qui
                renvoie à un historique de votes réel.
              */}
              {candidat.personne ? (
                <Link
                  href={`/${candidat.personne.chambre === 'senat' ? 'senateurs' : 'deputes'}/${candidat.personne.slug}`}
                  className="font-medium text-primary hover:underline"
                >
                  {candidat.prenom} {candidat.nom}
                </Link>
              ) : (
                <span>
                  {candidat.prenom} {candidat.nom}
                </span>
              )}
              {candidat.sortant && (
                <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary">
                  sortant
                </span>
              )}
              {candidat.profession && (
                <span className="block text-xs text-muted-foreground">
                  {candidat.profession}
                  {candidat.anneeNaissance ? ` · né${candidat.sexe === 'F' ? 'e' : ''} en ${candidat.anneeNaissance}` : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {remplacants.length > 0 && (
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Remplaçant{remplacants.length > 1 ? 's' : ''} :{' '}
          {remplacants.map((c) => `${c.prenom} ${c.nom}`).join(', ')}
        </p>
      )}
    </article>
  );
}
