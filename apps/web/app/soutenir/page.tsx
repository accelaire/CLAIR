import { Metadata } from 'next';
import Image from 'next/image';
import { Heart, Shield, Eye, Users, Clock, Code, Server, Megaphone, Linkedin, ExternalLink } from 'lucide-react';
import { HelloAssoWidget } from '@/components/donations/HelloAssoWidget';

export const metadata: Metadata = {
  title: 'Soutenir CLAIR - Transparence Politique',
  description: 'Soutenez CLAIR, la plateforme citoyenne de transparence politique. Un projet 100% indépendant.',
};

// Configuration HelloAsso - À remplacer par les vrais slugs
const HELLOASSO_ORG_SLUG = process.env.NEXT_PUBLIC_HELLOASSO_ORG_SLUG || 'clair-transparence';
const HELLOASSO_FORM_SLUG = process.env.NEXT_PUBLIC_HELLOASSO_FORM_SLUG || 'soutenir-clair';

// Flag pour activer les mentions de défiscalisation (après obtention du rescrit)
const DEFISCALISATION_ACTIVE = false;

export default function SoutenirPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          {/* Badge statut */}
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Clock className="h-4 w-4" />
            Statut d&apos;intérêt général en cours d&apos;obtention
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Soutenez l&apos;indépendance de CLAIR
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            CLAIR est un projet 100% citoyen, sans publicité ni financement politique.
            Votre don nous permet de rester indépendants et de continuer à éclairer le débat démocratique.
          </p>
        </div>
      </section>

      {/* CTA Cagnotte */}
      <section className="py-4 md:py-6 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          {/* Titre avec coeur */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
            <h2 className="text-lg md:text-2xl font-bold">
              Chaque don compte
            </h2>
          </div>

          {/* Bouton CTA */}
          <a
            href="https://www.leetchi.com/fr/c/lancement-de-clair--transparence-politique-citoyenne-1807149"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Participer à la cagnotte de lancement
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Texte explicatif */}
          <div className="mt-4">
            <p className="text-sm md:text-base text-muted-foreground">
              Même un petit don nous aide à maintenir CLAIR gratuit et accessible à tous.
            </p>
            <p className="text-xs italic text-muted-foreground mt-2">
              La totalité des dons sur la cagnotte de lancement sera intégralement reversée sur le compte de l&apos;association quand celle-ci sera active.
            </p>
          </div>
        </div>
      </section>

      {/* Derrière le projet */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Derrière le projet
          </h2>
          <div className="bg-card border rounded-2xl p-8 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-shrink-0">
              <Image
                src="/images/axel.jpg"
                alt="Axel, créateur de CLAIR"
                width={160}
                height={160}
                className="rounded-full object-cover"
                unoptimized
              />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-xl font-semibold mb-2">Axel</h3>
              <p className="text-muted-foreground mb-4">
                Ingénieur et passionné de data
              </p>
              <p className="text-sm leading-relaxed mb-4">
                J&apos;ai créé CLAIR pour donner vie aux données publiques et rendre la vie politique
                française claire et accessible à tous. L&apos;objectif : une plateforme citoyenne qui
                agrège le maximum de sources publiques, sans limitation, pour éclairer le débat
                démocratique.
              </p>
              <a
                href="https://www.linkedin.com/in/axel-robaldo-ensea/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Linkedin className="h-4 w-4" />
                Retrouvez-moi sur LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Pourquoi soutenir CLAIR ?
          </h2>

          <div className="text-center text-muted-foreground mb-8">
            {/* Info défiscalisation à venir */}
          {!DEFISCALISATION_ACTIVE && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xl mx-auto mb-8">
              <p className="text-blue-800 text-sm">
                <strong>Bonne nouvelle !</strong> CLAIR est en cours d&apos;obtention du statut d&apos;association
                d&apos;intérêt général. Une fois obtenu, vos dons seront déductibles à 66% de vos impôts.
              </p>
            </div>
          )}

          {/* Info défiscalisation active */}
          {DEFISCALISATION_ACTIVE && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-xl mx-auto mb-8">
              <p className="text-green-800 text-sm">
                <strong>66% déductible de vos impôts !</strong> Un don de 30€ ne vous coûte que 10,20€ après réduction.
              </p>
            </div>
          )}
          </div>

          <div className="space-y-6 mb-8">
            <Advantage
              icon={Shield}
              title="Indépendance totale"
              description="Aucun financement politique ou publicitaire. Seuls les citoyens financent CLAIR."
            />
            <Advantage
              icon={Eye}
              title="Transparence des données"
              description="Toutes nos sources sont publiques et vérifiables. Notre code est open source."
            />
            <Advantage
              icon={Users}
              title="Outil citoyen"
              description="CLAIR appartient à tous. Chaque don renforce notre démocratie."
            />
            <Advantage
              icon={Code}
              title="Open source"
              description="Le code est disponible sur GitHub. Vous pouvez contribuer ou vérifier notre travail."
            />
          </div>

          {/* À quoi servent les dons */}
          <div className="border rounded-xl p-6 bg-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              À quoi servent vos dons ?
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Server className="h-4 w-4 mt-0.5 text-primary" />
                <span><strong>Hébergement</strong> : Serveurs, base de données, infrastructure</span>
              </li>
              <li className="flex items-start gap-2">
                <Code className="h-4 w-4 mt-0.5 text-primary" />
                <span><strong>Développement</strong> : Nouvelles fonctionnalités, maintenance</span>
              </li>
              <li className="flex items-start gap-2">
                <Eye className="h-4 w-4 mt-0.5 text-primary" />
                <span><strong>Données</strong> : Ingestion et traitement des données publiques</span>
              </li>
            </ul>
          </div>

          {/* Widget HelloAsso - Désactivé en attendant le statut d'association */}
          {/* <div className="bg-card rounded-2xl p-6 shadow-lg border mt-8">
            <HelloAssoWidget
              organizationSlug={HELLOASSO_ORG_SLUG}
              campaignSlug={HELLOASSO_FORM_SLUG}
            />
          </div> */}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Questions fréquentes
          </h2>
          <div className="space-y-4">
            <FAQ
              question="Les dons sont-ils défiscalisables ?"
              answer="Les dons sur la cagnotte de lancement ne sont pas encore défiscalisables. 
              Nous sommes en cours d'obtention du statut d'association d'intérêt général. Une fois ce statut obtenu (prévu début 2026), vos dons seront déductibles à 66% de votre impôt sur le revenu. Les donateurs actuels seront informés dès que la défiscalisation sera active."
            />
            <FAQ
              question="À quoi servent les dons ?"
              answer="Les dons financent l'hébergement des serveurs, le développement de nouvelles fonctionnalités, et permettent de maintenir le projet sur le long terme. Notre budget est transparent et sera publié régulièrement."
            />
            <FAQ
              question="CLAIR est-il vraiment indépendant ?"
              answer="Oui. CLAIR n'accepte aucun financement de partis politiques, d'entreprises ou de lobbies. Seuls les dons citoyens nous financent. Le code est open source et vérifiable sur GitHub."
            />
            <FAQ
              question="Puis-je faire un don récurrent ?"
              answer="Oui ! Quand l'association sera créée, vous pourrez mettre en place un don récurrent directement via le formulaire HelloAsso. Les dons mensuels nous aident à planifier sur le long terme."
            />
            {/* <FAQ
              question="HelloAsso prend-il des frais ?"
              answer="HelloAsso ne prélève aucun frais sur les dons. Seule une contribution volontaire au fonctionnement de HelloAsso vous est proposée (que vous pouvez mettre à 0€)."
            /> */}
          </div>
        </div>
      </section>

    </main>
  );
}

function Advantage({ icon: Icon, title, description }: {
  icon: typeof Heart;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-card border rounded-lg">
      <summary className="flex items-center justify-between p-4 cursor-pointer font-medium">
        {question}
        <span className="text-muted-foreground group-open:rotate-180 transition-transform">
          ▼
        </span>
      </summary>
      <p className="px-4 pb-4 text-muted-foreground text-sm">{answer}</p>
    </details>
  );
}
