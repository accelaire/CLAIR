import type { Metadata } from 'next';
import Link from 'next/link';

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
          Dernière mise à jour : octobre 2026
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
                <p className="font-medium text-foreground">Navigation sur le site</p>
                <p className="mt-2">
                  Si vous naviguez sur CLAIR, nous collectons
                  uniquement des données anonymes, consultées de façon agrégée à des fins
                  statistiques :
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>Pages consultées</li>
                  <li>Site de provenance et paramètres de campagne (utm) éventuels</li>
                  <li>Durée des visites</li>
                  <li>Type d&apos;appareil, navigateur et système d&apos;exploitation</li>
                  <li>
                    Pays, région et ville, déduits de l&apos;adresse IP, qui n&apos;est pas
                    conservée
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Formulaire de retour</p>
                <p className="mt-2">
                  Si vous nous écrivez avec le bouton de retour, nous enregistrons votre
                  message, l&apos;appréciation choisie, la page concernée, le type de votre
                  navigateur (user-agent) et, seulement si vous la renseignez, votre adresse
                  e-mail. Le message, la page et l&apos;adresse e-mail sont aussi transmis à
                  l&apos;espace Discord de l&apos;équipe (Discord Inc., États-Unis) pour y
                  être lus.
                </p>
              </div>
            </div>
          </section>

          {/* Analytics */}
          <section>
            <h2 className="text-2xl font-bold">Mesure d&apos;audience</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Nous mesurons l&apos;audience avec{' '}
                <a
                  href="https://github.com/plausible/analytics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Plausible Analytics
                </a>
                {' '}dans sa version libre (Community Edition), installée sur notre propre
                serveur à Varsovie (Pologne, Union européenne). Aucune donnée de visite
                n&apos;est transmise à un tiers.
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong>Pas de cookies</strong> : aucun cookie ni identifiant n&apos;est
                  déposé sur votre appareil, ce qui dispense de bandeau de consentement
                </li>
                <li>
                  <strong>Adresse IP jamais conservée</strong> : elle sert, au moment de la
                  visite, à déduire le pays, la région et la ville, à partir d&apos;une base
                  de géolocalisation installée sur notre serveur, sans interroger de service
                  extérieur
                </li>
                <li>
                  <strong>Pas de suivi d&apos;un jour à l&apos;autre</strong> : pour compter
                  les visiteurs uniques, l&apos;adresse IP et le navigateur sont combinés à
                  une valeur aléatoire renouvelée chaque jour, puis hachés. L&apos;ancienne
                  valeur est détruite : un visiteur ne peut plus être reconnu le lendemain
                </li>
                <li>
                  <strong>Pas de tracking cross-site</strong> : Aucun suivi entre différents
                  sites web
                </li>
                <li>
                  <strong>Logiciel libre</strong> : son code source est public et
                  vérifiable
                </li>
              </ul>
              <p>
                <strong className="text-foreground">Utilisation de l&apos;API.</strong>{' '}
                Chaque appel à l&apos;API publique (api.clair.vote) est compté sur la même
                instance, dans un tableau de bord séparé : l&apos;adresse appelée sans ses
                paramètres (par exemple <code>/api/v1/deputes/:slug</code>), le code de
                réponse, le nom du logiciel client (par exemple <code>curl/8.5.0</code>) et
                le site de provenance. L&apos;adresse IP de l&apos;appelant, ou celle du
                visiteur pour les appels faits par le site, est traitée comme pour une
                visite : jamais conservée, elle sert seulement à la géolocalisation et au
                comptage des visiteurs uniques.
              </p>
              <p>
                Jusqu&apos;au 10 octobre 2026, la mesure d&apos;audience passait par le
                service hébergé de Plausible (Plausible Insights OÜ, Estonie, serveurs dans
                l&apos;Union européenne). Ses statistiques agrégées ont été importées sur
                notre serveur.
              </p>
              <p>
                Pour le détail des données traitées par le script de mesure :{' '}
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
              <p>
                Seule exception : la page{' '}
                <Link href="/soutenir" className="text-primary hover:underline">
                  Soutenir
                </Link>{' '}
                intègre le formulaire de don de HelloAsso. Les données et cookies de ce
                formulaire relèvent de la{' '}
                <a
                  href="https://www.helloasso.com/confidentialite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  politique de confidentialité de HelloAsso
                </a>
                .
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
                  <strong className="text-foreground">Vous répondre :</strong>{' '}
                  traiter vos retours et vous répondre si vous avez laissé une adresse
                  e-mail
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
                  pour les retours que vous choisissez de nous envoyer, et l&apos;adresse
                  e-mail facultative qui les accompagne
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
                Nos statistiques de visite et d&apos;usage de l&apos;API (Plausible
                Analytics) sont traitées sur notre propre serveur, loué à OVHcloud à
                Varsovie (Pologne, Union européenne).
              </p>
              <p>
                Les retours envoyés par le formulaire sont enregistrés dans notre base de
                données (Railway, Europe) et transmis à l&apos;espace Discord de
                l&apos;équipe (Discord Inc., États-Unis).
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
