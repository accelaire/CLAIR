import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles sur CLAIR.',
};

export default function ConfidentialitePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-4 text-muted-foreground">
          Dernière mise à jour : janvier 2026
        </p>

        <div className="mt-12 space-y-12">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold">Introduction</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                CLAIR (« nous », « notre », « nos ») s&apos;engage à protéger la vie privée
                des utilisateurs de son site web clair.vote (« le Site »).
              </p>
              <p>
                Cette politique de confidentialité explique quelles données nous collectons,
                pourquoi nous les collectons, et comment nous les utilisons.
              </p>
            </div>
          </section>

          {/* Responsable du traitement */}
          <section>
            <h2 className="text-2xl font-bold">Responsable du traitement</h2>
            <div className="mt-4 space-y-2 text-muted-foreground">
              <p>
                Le responsable du traitement des données personnelles est l&apos;association
                éditrice du site CLAIR.
              </p>
              <p>
                <strong className="text-foreground">Contact :</strong>{' '}
                <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
                  contact@clair.vote
                </a>
              </p>
            </div>
          </section>

          {/* Données collectées */}
          <section>
            <h2 className="text-2xl font-bold">Données que nous collectons</h2>
            <div className="mt-4 space-y-6 text-muted-foreground">
              <div>
                <p className="mt-2">
                  Si vous naviguez sur CLAIR, nous collectons
                  uniquement des données anonymes et agrégées à des fins statistiques :
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>Pages consultées</li>
                  <li>Durée des visites</li>
                  <li>Type d&apos;appareil et navigateur (anonymisé)</li>
                  <li>Pays d&apos;origine (sans géolocalisation précise)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Analytics */}
          <section>
            <h2 className="text-2xl font-bold">Mesure d&apos;audience</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Nous utilisons{' '}
                <a
                  href="https://plausible.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Plausible Analytics
                </a>
                , une solution de mesure d&apos;audience respectueuse de la vie privée.
              </p>
              <p>
                <strong className="text-foreground">Pourquoi Plausible ?</strong>
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong>Pas de cookies</strong> : Plausible ne dépose aucun cookie sur votre
                  appareil et ne nécessite donc pas de bandeau de consentement
                </li>
                <li>
                  <strong>Hébergé en Europe</strong> : Les données sont traitées sur des
                  serveurs situés dans l&apos;Union européenne
                </li>
                <li>
                  <strong>Conforme au RGPD</strong> : Plausible est exempt de consentement
                  car il ne collecte aucune donnée personnelle identifiable
                </li>
                <li>
                  <strong>Pas de tracking cross-site</strong> : Aucun suivi entre différents
                  sites web
                </li>
                <li>
                  <strong>Données anonymes</strong> : Impossible d&apos;identifier un
                  visiteur individuel
                </li>
              </ul>
              <p>
                Pour en savoir plus sur leur politique de données :{' '}
                <a
                  href="https://plausible.io/data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  plausible.io/data-policy
                </a>
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold">Cookies</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                <strong className="text-foreground">CLAIR n&apos;utilise pas de cookies.</strong>
              </p>
              <p>
                Notre solution de mesure d&apos;audience (Plausible) fonctionne sans cookies.
                Nous n&apos;utilisons pas de cookies publicitaires, de cookies de traçage,
                ni de cookies tiers (Google Analytics, Facebook Pixel, etc.).
              </p>
              <p>
                C&apos;est pour cette raison que vous ne voyez pas de bannière de
                consentement aux cookies sur notre site.
              </p>
            </div>
          </section>

          {/* Utilisation des données */}
          <section>
            <h2 className="text-2xl font-bold">Utilisation des données</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>Nous utilisons les données collectées pour :</p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong className="text-foreground">Améliorer le site :</strong>{' '}
                  comprendre comment le site est utilisé et l&apos;améliorer
                </li>
                <li>
                  <strong className="text-foreground">Communiquer :</strong>{' '}
                  répondre à vos questions et vous informer des nouveautés
                </li>
              </ul>
              <p>
                Nous ne vendons jamais vos données personnelles. Nous ne les partageons
                pas avec des tiers à des fins commerciales.
              </p>
            </div>
          </section>

          {/* Base légale */}
          <section>
            <h2 className="text-2xl font-bold">Base légale du traitement</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>Nous traitons vos données sur les bases légales suivantes :</p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong className="text-foreground">Consentement :</strong>{' '}
                  pour l&apos;envoi de newsletters et communications optionnelles
                </li>
                <li>
                  <strong className="text-foreground">Intérêt légitime :</strong>{' '}
                  pour les statistiques anonymes d&apos;utilisation du site
                </li>
              </ul>
            </div>
          </section>

          {/* Conservation */}
          <section>
            <h2 className="text-2xl font-bold">Conservation des données</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                <strong className="text-foreground">Statistiques anonymes :</strong>{' '}
                conservées indéfiniment car elles ne permettent pas d&apos;identification
              </p>
            </div>
          </section>

          {/* Vos droits */}
          <section>
            <h2 className="text-2xl font-bold">Vos droits</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Conformément au RGPD, vous disposez des droits suivants sur vos
                données personnelles :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong className="text-foreground">Droit d&apos;accès :</strong>{' '}
                  obtenir une copie de vos données
                </li>
                <li>
                  <strong className="text-foreground">Droit de rectification :</strong>{' '}
                  corriger des données inexactes
                </li>
                <li>
                  <strong className="text-foreground">Droit à l&apos;effacement :</strong>{' '}
                  demander la suppression de vos données
                </li>
                <li>
                  <strong className="text-foreground">Droit à la portabilité :</strong>{' '}
                  recevoir vos données dans un format structuré
                </li>
                <li>
                  <strong className="text-foreground">Droit d&apos;opposition :</strong>{' '}
                  vous opposer à certains traitements
                </li>
                <li>
                  <strong className="text-foreground">Droit de retirer votre consentement :</strong>{' '}
                  à tout moment pour les traitements basés sur le consentement
                </li>
              </ul>
              <p>
                Pour exercer ces droits, contactez-nous à{' '}
                <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
                  contact@clair.vote
                </a>.
              </p>
              <p>
                Vous avez également le droit de déposer une réclamation auprès de la
                CNIL (Commission Nationale de l&apos;Informatique et des Libertés).
              </p>
            </div>
          </section>

          {/* Sécurité */}
          <section>
            <h2 className="text-2xl font-bold">Sécurité</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Nous mettons en œuvre des mesures techniques et organisationnelles
                appropriées pour protéger vos données :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>Chiffrement des données en transit (HTTPS)</li>
                <li>Accès restreint aux données personnelles</li>
                <li>Mises à jour régulières de sécurité</li>
              </ul>
            </div>
          </section>

          {/* Hébergement et transferts */}
          <section>
            <h2 className="text-2xl font-bold">Hébergement des données</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Notre infrastructure backend (API, base de données PostgreSQL, cache Redis)
                est hébergée par{' '}
                <a
                  href="https://railway.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Railway
                </a>
                {' '}sur des serveurs situés en <strong className="text-foreground">Europe (EU West)</strong>.
              </p>
              <p>
                Notre frontend est actuellement hébergé par Vercel. La migration vers
                un hébergement européen est en cours.
              </p>
              <p>
                Nos statistiques de visite (Plausible Analytics) sont traitées
                exclusivement sur des serveurs situés dans l&apos;Union européenne.
              </p>
            </div>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-bold">Modifications</h2>
            <p className="mt-4 text-muted-foreground">
              Nous pouvons modifier cette politique de confidentialité. En cas de
              modification substantielle, nous vous en informerons par une notification
              sur le site.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold">Contact</h2>
            <p className="mt-4 text-muted-foreground">
              Pour toute question concernant cette politique de confidentialité ou
              vos données personnelles, contactez-nous à{' '}
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
