import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site CLAIR - Plateforme citoyenne de transparence politique.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">Mentions légales</h1>
        <p className="mt-4 text-muted-foreground">
          Dernière mise à jour : janvier 2026
        </p>

        <div className="mt-12 space-y-12">
          {/* Éditeur */}
          <section>
            <h2 className="text-2xl font-bold">Éditeur du site</h2>
            <div className="mt-4 space-y-2 text-muted-foreground">
              <p>
                Le site CLAIR (clair.vote) est un projet associatif à but non lucratif.
              </p>
              <p>
                <strong className="text-foreground">Nom du projet :</strong> CLAIR
                (Citoyen Libre, Analyse, Information, République)
              </p>
              <p>
                <strong className="text-foreground">Email :</strong>{' '}
                <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
                  contact@clair.vote
                </a>
              </p>
            </div>
          </section>

          {/* Directeur de publication */}
          <section>
            <h2 className="text-2xl font-bold">Directeur de la publication</h2>
            <p className="mt-4 text-muted-foreground">
              Le directeur de la publication est le représentant légal de l&apos;association
              éditrice du site CLAIR.
            </p>
          </section>

          {/* Hébergement */}
          <section>
            <h2 className="text-2xl font-bold">Hébergement</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Frontend (site web) :</p>
                <p className="mt-1">
                  <strong className="text-foreground">Vercel Inc.</strong><br />
                  440 N Barranca Ave #4133<br />
                  Covina, CA 91723, États-Unis<br />
                  <a
                    href="https://vercel.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    vercel.com
                  </a>
                </p>
                <p className="mt-1 text-sm italic">
                  Migration vers un hébergement européen en cours.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Backend (API, base de données) :</p>
                <p className="mt-1">
                  <strong className="text-foreground">Railway Corporation</strong><br />
                  Serveurs situés en Europe (EU West)<br />
                  <a
                    href="https://railway.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    railway.app
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Propriété intellectuelle */}
          <section>
            <h2 className="text-2xl font-bold">Propriété intellectuelle</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Le code source de CLAIR est distribué sous licence open source.
                Il est disponible sur{' '}
                <a
                  href="https://github.com/accelaire/CLAIR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub
                </a>.
              </p>
              <p>
                Les données présentées sur ce site proviennent de sources publiques
                (Assemblée nationale, Sénat, HATVP, DILA) et sont réutilisées
                conformément aux licences de réutilisation des données publiques.
              </p>
              <p>
                La marque CLAIR et le logo associé sont la propriété de l&apos;association
                éditrice.
              </p>
            </div>
          </section>

          {/* Sources des données */}
          <section>
            <h2 className="text-2xl font-bold">Sources des données</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Les données présentées sur CLAIR proviennent exclusivement de sources
                officielles et publiques :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <a
                    href="https://data.assemblee-nationale.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Assemblée nationale - Open Data
                  </a>{' '}
                  (Licence Ouverte / Open Licence)
                </li>
                <li>
                  <a
                    href="https://data.senat.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Sénat - Open Data
                  </a>{' '}
                  (Licence Ouverte / Open Licence)
                </li>
                <li>
                  <a
                    href="https://www.hatvp.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Haute Autorité pour la Transparence de la Vie Publique (HATVP)
                  </a>
                </li>
                <li>
                  <a
                    href="https://echanges.dila.gouv.fr/OPENDATA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Direction de l&apos;Information Légale et Administrative (DILA)
                  </a>{' '}
                  (Licence Ouverte / Open Licence)
                </li>
              </ul>
              <p>
                Conformément à la Licence Ouverte 2.0, la réutilisation de ces données
                est libre et gratuite, sous réserve de mentionner la source et la date
                de dernière mise à jour.
              </p>
            </div>
          </section>

          {/* Limitation de responsabilité */}
          <section>
            <h2 className="text-2xl font-bold">Limitation de responsabilité</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                CLAIR s&apos;efforce de fournir des informations exactes et à jour.
                Toutefois, nous ne pouvons garantir l&apos;exactitude, la complétude
                ou l&apos;actualité des informations présentées.
              </p>
              <p>
                Les données sont synchronisées quotidiennement depuis les sources
                officielles. Un délai peut exister entre la publication d&apos;une
                information par la source et son apparition sur CLAIR.
              </p>
              <p>
                CLAIR décline toute responsabilité en cas d&apos;erreur, d&apos;omission
                ou de retard dans la mise à jour des données.
              </p>
              <p>
                Les liens vers des sites externes sont fournis à titre informatif.
                CLAIR n&apos;est pas responsable du contenu de ces sites.
              </p>
            </div>
          </section>

          {/* Crédits */}
          <section>
            <h2 className="text-2xl font-bold">Crédits</h2>
            <div className="mt-4 space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Conception et développement :</strong>{' '}
                Équipe CLAIR et contributeurs open source
              </p>
              <p>
                <strong className="text-foreground">Icônes :</strong>{' '}
                <a
                  href="https://lucide.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Lucide Icons
                </a>
              </p>
              <p>
                <strong className="text-foreground">Police :</strong>{' '}
                Inter (Google Fonts)
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold">Contact</h2>
            <p className="mt-4 text-muted-foreground">
              Pour toute question concernant ces mentions légales, vous pouvez nous
              contacter à l&apos;adresse{' '}
              <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
                contact@clair.vote
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
