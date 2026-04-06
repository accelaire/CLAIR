import { Metadata } from 'next';
import Image from 'next/image';
import { Heart, Shield, Eye, Users, CheckCircle2, Code, Server, Megaphone, Linkedin, ExternalLink } from 'lucide-react';
import { FAQAccordion } from '@/components/ui/faq-accordion';

export const metadata: Metadata = {
  title: 'Soutenir CLAIR - Transparence Politique',
  description: 'Soutenez CLAIR, la plateforme citoyenne de transparence politique. Vos dons sont déductibles à 66% de vos impôts.',
};

const HELLOASSO_URL = 'https://www.helloasso.com/associations/clair-citoyen-libre-analyse-information-republique/formulaires/1';
const HELLOASSO_WIDGET_URL = `${HELLOASSO_URL}/widget`;

const DEFISCALISATION_ACTIVE = true;

const faqItems = [
  {
    question: 'Les dons sont-ils défiscalisables ?',
    answer: 'Oui ! CLAIR est une association reconnue d\'intérêt général. Vos dons sont déductibles à 66% de votre impôt sur le revenu (dans la limite de 20% du revenu imposable). Un reçu fiscal vous est envoyé automatiquement après chaque don.',
  },
  {
    question: 'À quoi servent les dons ?',
    answer: 'Les dons financent l\'hébergement des serveurs, le développement de nouvelles fonctionnalités, et permettent de maintenir le projet sur le long terme. Notre budget est transparent et sera publié régulièrement.',
  },
  {
    question: 'CLAIR est-il vraiment indépendant ?',
    answer: 'Oui. CLAIR n\'accepte aucun financement de partis politiques, d\'entreprises ou de lobbies. Seuls les dons citoyens nous financent. Le code est open source et vérifiable sur GitHub.',
  },
  {
    question: 'Comment contribuer financièrement ?',
    answer: 'Vous pouvez faire un don directement depuis cette page via le formulaire HelloAsso intégré. Le paiement est sécurisé, 0% de frais sont prélevés sur votre don, et votre reçu fiscal est généré automatiquement.',
  },
];

export default function SoutenirPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          {/* Badge statut */}
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <CheckCircle2 className="h-4 w-4" />
            Association reconnue d&apos;intérêt général
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

      {/* Don + Pourquoi soutenir — two columns */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            {/* Colonne gauche — Pourquoi soutenir */}
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-6">
                Pourquoi soutenir CLAIR ?
              </h2>

              {DEFISCALISATION_ACTIVE && (
                <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-xl p-4 mb-6">
                  <p className="text-green-800 dark:text-green-300 text-sm font-medium mb-3">
                    66% déductible de vos impôts !
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-900 dark:text-green-200">10&thinsp;&euro;</p>
                      <p className="text-xs text-green-700 dark:text-green-400">= 3,40&thinsp;&euro; après impôts</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-900 dark:text-green-200">30&thinsp;&euro;</p>
                      <p className="text-xs text-green-700 dark:text-green-400">= 10,20&thinsp;&euro; après impôts</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-900 dark:text-green-200">50&thinsp;&euro;</p>
                      <p className="text-xs text-green-700 dark:text-green-400">= 17&thinsp;&euro; après impôts</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-5 mb-6">
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
              <div className="border rounded-xl p-5 bg-muted/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  À quoi servent vos dons ?
                </h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
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
            </div>

            {/* Colonne droite — Formulaire de don */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Heart className="h-6 w-6 text-red-500" />
                <h2 className="text-xl md:text-2xl font-bold">Faire un don</h2>
              </div>

              {/* Desktop : widget intégré */}
              <div className="hidden lg:block rounded-2xl border bg-card overflow-hidden">
                <iframe
                  id="haWidget"
                  src={HELLOASSO_WIDGET_URL}
                  style={{ width: '100%', height: '750px', border: 'none' }}
                  allow="payment"
                  title="Formulaire de don HelloAsso"
                />
              </div>

              {/* Mobile : lien direct */}
              <div className="lg:hidden rounded-2xl border bg-card p-8 text-center">
                <p className="text-lg font-semibold mb-2">Soutenez CLAIR</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Faites un don sécurisé via HelloAsso. 0% de frais, reçu fiscal automatique.
                </p>
                <a
                  href={HELLOASSO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  <Heart className="h-5 w-5" />
                  Faire un don
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Derrière le projet */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Derrière le projet
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Axel */}
            <div className="bg-card border rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden mb-4 flex-shrink-0">
                <Image
                  src="/images/axel.jpg"
                  alt="Axel, créateur de CLAIR"
                  width={120}
                  height={120}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <h3 className="text-lg font-semibold mb-1">Axel</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Ingénieur et passionné de data
              </p>
              <p className="text-sm leading-relaxed mb-4">
                J&apos;ai créé CLAIR pour donner vie aux données publiques et rendre la vie politique
                française claire et accessible à tous.
              </p>
              <a
                href="https://www.linkedin.com/in/axel-robaldo-ensea/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-auto"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </div>

            {/* Ruben */}
            <div className="bg-card border rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden mb-4 flex-shrink-0">
                <Image
                  src="/images/ruben.jpg"
                  alt="Ruben, ingénieur-chercheur en IA"
                  width={120}
                  height={120}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <h3 className="text-lg font-semibold mb-1">Ruben</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Ingénieur-chercheur en IA
              </p>
              <p className="text-sm leading-relaxed mb-4">
                J&apos;ai rejoint CLAIR pour aider nos institutions dans leur devoir de transparence
                à notre égard. Je souhaite proposer une plateforme neutre et intuitive comme
                support au débat entre citoyens.
              </p>
              <a
                href="https://www.linkedin.com/in/rubenwleon/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-auto"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </div>

            {/* Paul */}
            <div className="bg-card border rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden mb-4 flex-shrink-0">
                <Image
                  src="/images/paul.jpg"
                  alt="Paul, contributeur CLAIR"
                  width={120}
                  height={120}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <h3 className="text-lg font-semibold mb-1">Paul</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Designer UX/UI
              </p>
              <p className="text-sm leading-relaxed mb-4">
                Avec CLAIR, je souhaite rendre la politique institutionnelle lisible au plus grand nombre.
              </p>
              <a
                href="https://www.linkedin.com/in/paul-albagli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-auto"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="border-t border-border mb-12" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center">
            Questions fréquentes
          </h2>
          <p className="text-muted-foreground text-center mb-10">
            Une question ? Écrivez-nous à{' '}
            <a href="mailto:contact@clair.vote" className="text-primary hover:underline">
              contact@clair.vote
            </a>
          </p>
          <FAQAccordion items={faqItems} defaultOpenIndex={0} />
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
