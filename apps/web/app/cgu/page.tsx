import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation',
  description: 'Conditions générales d\'utilisation du site CLAIR - Plateforme citoyenne de transparence politique.',
};

export default function CGUPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="mt-4 text-muted-foreground">
          Dernière mise à jour : janvier 2026
        </p>

        <div className="mt-12 space-y-12">
          {/* Objet */}
          <section>
            <h2 className="text-2xl font-bold">Article 1 - Objet</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Les présentes Conditions Générales d&apos;Utilisation (« CGU ») ont pour
                objet de définir les conditions d&apos;accès et d&apos;utilisation du site
                web clair.vote (« le Site ») édité par l&apos;association CLAIR.
              </p>
              <p>
                L&apos;utilisation du Site implique l&apos;acceptation pleine et entière
                des présentes CGU. Si vous n&apos;acceptez pas ces conditions, veuillez
                ne pas utiliser le Site.
              </p>
            </div>
          </section>

          {/* Description du service */}
          <section>
            <h2 className="text-2xl font-bold">Article 2 - Description du service</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                CLAIR est une plateforme citoyenne de transparence politique qui propose :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  La consultation de données publiques sur les parlementaires français
                  (députés et sénateurs)
                </li>
                <li>
                  L&apos;accès aux scrutins publics, votes individuels et interventions des parlementaires
                </li>
                <li>
                  La visualisation des activités de lobbying déclarées à la HATVP
                </li>
                {/* <li>
                  Un simulateur politique permettant de comparer ses opinions avec
                  les positions des candidats
                </li>
                <li>
                  Des fonctionnalités de compte utilisateur (favoris, alertes)
                </li> */}
              </ul>
              <p>
                Le service est fourni gratuitement et sans publicité.
              </p>
            </div>
          </section>

          {/* Accès au site */}
          <section>
            <h2 className="text-2xl font-bold">Article 3 - Accès au site</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Le Site est accessible gratuitement à tout utilisateur disposant
                d&apos;un accès à Internet.
              </p>
              {/* <p>
                Certaines fonctionnalités (favoris, alertes) nécessitent la création
                d&apos;un compte utilisateur.
              </p> */}
              <p>
                CLAIR se réserve le droit d&apos;interrompre temporairement l&apos;accès
                au Site pour des raisons de maintenance, de mise à jour ou pour
                toute autre raison technique.
              </p>
            </div>
          </section>

          {/* Création de compte */}
          {/* <section>
            <h2 className="text-2xl font-bold">Article 4 - Compte utilisateur</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Pour créer un compte, vous devez fournir une adresse email valide
                et choisir un mot de passe sécurisé.
              </p>
              <p>
                Vous êtes responsable de la confidentialité de vos identifiants
                de connexion et de toutes les activités effectuées depuis votre compte.
              </p>
              <p>
                En cas de suspicion d&apos;utilisation non autorisée de votre compte,
                vous devez nous en informer immédiatement à{' '}
                <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
                  contact@clair.vote
                </a>.
              </p>
              <p>
                Nous nous réservons le droit de suspendre ou supprimer un compte
                en cas de violation des présentes CGU.
              </p>
            </div>
          </section> */}

          {/* Utilisation acceptable */}
          <section>
            <h2 className="text-2xl font-bold">Article 4 - Utilisation acceptable</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Vous vous engagez à utiliser le Site de manière conforme aux lois
                en vigueur et aux présentes CGU.
              </p>
              <p>Il est interdit de :</p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  Utiliser le Site à des fins illégales ou frauduleuses
                </li>
                <li>
                  Tenter d&apos;accéder de manière non autorisée aux systèmes ou données
                </li>
                <li>
                  Perturber le fonctionnement du Site (attaques DDoS, spam, etc.)
                </li>
                <li>
                  Collecter des données personnelles d&apos;autres utilisateurs
                </li>
                <li>
                  Utiliser des robots ou scripts automatisés de manière abusive
                </li>
                {/* <li>
                  Publier du contenu diffamatoire, injurieux ou discriminatoire
                </li> */}
              </ul>
            </div>
          </section>

          {/* Données */}
          <section>
            <h2 className="text-2xl font-bold">Article 5 - Données et contenu</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Les données présentées sur CLAIR proviennent de sources officielles
                publiques (actuellement les 4 sources sont: Assemblée nationale, Sénat, HATVP, DILA).
              </p>
              <p>
                CLAIR ne produit pas d&apos;opinion politique et se limite à présenter
                les données telles qu&apos;elles sont publiées par les sources.
              </p>
              <p>
                Les statistiques calculées (taux de présence, loyauté, etc.) sont
                dérivées des données brutes selon une méthodologie documentée.
                Ces calculs sont effectués par CLAIR et peuvent différer de
                statistiques publiées par d&apos;autres sources.
              </p>
              <p>
                Vous êtes libre de réutiliser les données conformément aux licences
                des sources d&apos;origine (généralement Licence Ouverte 2.0).
              </p>
            </div>
          </section>

          {/* Simulateur */}
          {/* <section>
            <h2 className="text-2xl font-bold">Article 6 - Simulateur politique</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Le simulateur politique est un outil indicatif destiné à aider
                les citoyens à se situer par rapport aux positions des candidats.
              </p>
              <p>
                Les résultats du simulateur :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  Sont calculés algorithmiquement à partir de vos réponses et des
                  positions connues des candidats
                </li>
                <li>
                  Ne constituent pas une recommandation de vote
                </li>
                <li>
                  Peuvent comporter des approximations ou des données incomplètes
                </li>
                <li>
                  Ne sauraient remplacer une réflexion personnelle approfondie
                </li>
              </ul>
              <p>
                CLAIR décline toute responsabilité quant aux décisions prises
                sur la base des résultats du simulateur.
              </p>
            </div>
          </section> */}

          {/* Propriété intellectuelle */}
          <section>
            <h2 className="text-2xl font-bold">Article 6 - Propriété intellectuelle</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Le code source de CLAIR est distribué sous licence open source
                et disponible sur{' '}
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
                La marque CLAIR, le logo et le design du Site sont protégés par
                le droit de la propriété intellectuelle.
              </p>
              <p>
                Les données publiques sont réutilisables selon les termes de leurs
                licences d&apos;origine respectives.
              </p>
            </div>
          </section>

          {/* Limitation de responsabilité */}
          <section>
            <h2 className="text-2xl font-bold">Article 7 - Limitation de responsabilité</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                CLAIR s&apos;efforce de fournir des informations exactes et à jour,
                mais ne peut garantir l&apos;absence d&apos;erreurs ou d&apos;omissions.
              </p>
              <p>
                CLAIR ne saurait être tenu responsable :
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  Des erreurs, inexactitudes ou retards dans les données
                </li>
                <li>
                  Des interruptions de service ou dysfonctionnements techniques
                </li>
                <li>
                  Des dommages directs ou indirects résultant de l&apos;utilisation
                  du Site
                </li>
                <li>
                  Du contenu des sites tiers vers lesquels le Site peut rediriger
                </li>
              </ul>
            </div>
          </section>

          {/* Protection des données */}
          <section>
            <h2 className="text-2xl font-bold">Article 8 - Protection des données</h2>
            <p className="mt-4 text-muted-foreground">
              Le traitement de vos données personnelles est régi par notre{' '}
              <Link href="/confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>,
              que vous acceptez en utilisant le Site.
            </p>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-bold">Article 9 - Modifications des CGU</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Nous nous réservons le droit de modifier les présentes CGU à tout moment.
              </p>
              <p>
                En cas de modification substantielle, nous vous en informerons par
                une notification sur le Site ou par email si vous avez un compte.
              </p>
              <p>
                La poursuite de l&apos;utilisation du Site après modification des CGU
                vaut acceptation des nouvelles conditions.
              </p>
            </div>
          </section>

          {/* Droit applicable */}
          <section>
            <h2 className="text-2xl font-bold">Article 10 - Droit applicable</h2>
            <div className="mt-4 space-y-4 text-muted-foreground">
              <p>
                Les présentes CGU sont régies par le droit français.
              </p>
              <p>
                En cas de litige, les parties s&apos;engagent à rechercher une solution
                amiable avant toute action judiciaire.
              </p>
              <p>
                À défaut d&apos;accord amiable, les tribunaux français de Paris (75) seront seuls
                compétents.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold">Article 11 - Contact</h2>
            <p className="mt-4 text-muted-foreground">
              Pour toute question concernant les présentes CGU, vous pouvez nous
              contacter à{' '}
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
