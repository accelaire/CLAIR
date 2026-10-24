import { Metadata } from 'next';
import Image from 'next/image';
import {
  Heart,
  BadgeCheck,
  Receipt,
  Repeat,
  ShieldCheck,
  Coins,
  Server,
  Landmark,
  Vote,
  Github,
  MessageCircle,
  Mail,
  Linkedin,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { FAQAccordion } from '@/components/ui/faq-accordion';
import { ShareButton } from '@/components/ShareButton';
import { fetchFromApi } from '@/lib/api-server';

export const metadata: Metadata = {
  title: 'Soutenir CLAIR - Transparence Politique',
  description:
    "Soutenez CLAIR, la plateforme citoyenne et gratuite de transparence politique. Association d'intérêt général : vos dons sont déductibles à 66 % de vos impôts.",
};

const HELLOASSO_URL = 'https://www.helloasso.com/associations/clair-citoyen-libre-analyse-information-republique/formulaires/1';
const HELLOASSO_WIDGET_URL = `${HELLOASSO_URL}/widget`;
const GITHUB_URL = 'https://github.com/accelaire/CLAIR';
const DISCORD_URL = 'https://discord.gg/pxHV4rNWck';
const ROADMAP_URL = 'https://github.com/accelaire/CLAIR/discussions/93';

interface HomepageStats {
  scrutins: number;
  amendements: number;
  interventions: number;
  actionsLobby: number;
}

const faqItems = [
  {
    question: 'Les dons sont-ils déductibles des impôts ?',
    answer: "Oui. CLAIR est une association d'intérêt général à caractère éducatif, ce que l'administration fiscale a confirmé par un rescrit en février 2026. Votre don est déductible à 66 % de votre impôt sur le revenu, dans la limite de 20 % de votre revenu imposable. HelloAsso vous envoie le reçu fiscal automatiquement.",
  },
  {
    question: 'À quoi servent les dons ?',
    answer: "À payer ce qui fait tourner CLAIR : les serveurs, la base de données, la mise à jour de chaque nuit et l'API ouverte à tous. L'équipe est entièrement bénévole : aucun don ne sert à rémunérer qui que ce soit.",
  },
  {
    question: 'CLAIR est-il vraiment indépendant ?',
    answer: "Oui. CLAIR ne reçoit aucun argent de partis politiques, d'entreprises ou de lobbies. L'association vit des cotisations de ses membres et de vos dons. Le code est open source : chacun peut vérifier ce que nous faisons.",
  },
  {
    question: 'Comment faire un don ?',
    answer: "Directement sur cette page, avec le formulaire HelloAsso, en don ponctuel ou mensuel. HelloAsso ne prélève aucun frais sur votre don. Il vous propose une contribution facultative à son propre fonctionnement, que vous pouvez mettre à 0 €.",
  },
];

const formatNombre = (n: number) => n.toLocaleString('fr-FR');

export default async function SoutenirPage() {
  // Les chiffres sont un plus : si l'API ne répond pas, la section disparaît
  // et la page de don reste servie.
  const homepage = await fetchFromApi<{ stats?: HomepageStats }>('/homepage', 3600);
  const stats = homepage?.stats;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            Association d&apos;intérêt général
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            CLAIR reste gratuit grâce à vous
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Pas de publicité, pas de compte, pas un euro de partis ou de lobbies.
            Juste les votes, les débats et le lobbying, ouverts à tous.
            Pour que ça dure, on a besoin de vous.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#don"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <Heart className="h-5 w-5" aria-hidden />
              Faire un don
            </a>
            <a
              href="#aider"
              className="inline-flex items-center justify-center gap-2 border bg-card px-6 py-3 rounded-xl font-medium hover:bg-muted transition-colors"
            >
              Aider autrement
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Déductible à 66 % de vos impôts, reçu fiscal automatique.
          </p>
        </div>
      </section>

      {/* Ce que CLAIR met déjà à disposition */}
      {stats && (
        <section className="py-10 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-center">
              Ce que vous trouvez déjà sur CLAIR
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Mis à jour chaque nuit, depuis les sources officielles.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Chiffre valeur={stats.scrutins} libelle="scrutins analysés" />
              <Chiffre valeur={stats.amendements} libelle="amendements" />
              <Chiffre valeur={stats.interventions} libelle="prises de parole" />
              <Chiffre valeur={stats.actionsLobby} libelle="actions de lobbying" />
            </div>
          </div>
        </section>
      )}

      {/* Ce que votre don finance */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-xl md:text-2xl font-bold mb-8 text-center">
            Ce que votre don rend possible
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Usage
              icon={Server}
              titre="Faire tourner CLAIR"
              description="Les serveurs, la base de données, la mise à jour de chaque nuit et l'API ouverte gratuitement aux journalistes, chercheurs et associations."
            />
            <Usage
              icon={Landmark}
              titre="Suivre le gouvernement"
              description="Les ministres, les 49.3, les motions de censure : c'est notre prochain chantier."
            />
            <Usage
              icon={Vote}
              titre="Éclairer la présidentielle"
              description="Le bilan vérifiable du quinquennat, avant le premier tour du 18 avril 2027."
            />
          </div>
          <p className="mt-6 text-sm text-muted-foreground text-center">
            L&apos;équipe est bénévole : chaque euro va au projet.{' '}
            <a
              href={ROADMAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Notre feuille de route est publique
            </a>
            .
          </p>
        </div>
      </section>

      {/* Don */}
      <section id="don" className="py-10 px-4 scroll-mt-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            {/* Formulaire (en premier sur mobile) */}
            <div className="lg:order-2">
              <div className="flex items-center gap-2 mb-6">
                <Heart className="h-6 w-6 text-red-500" aria-hidden />
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
              <div className="lg:hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-5">
                  Le formulaire s&apos;ouvre sur HelloAsso, la plateforme de paiement des
                  associations.
                </p>
                <a
                  href={HELLOASSO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  <Heart className="h-5 w-5" aria-hidden />
                  Faire un don
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>

            {/* Comment ça marche */}
            <div className="lg:order-1 lg:pt-14">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <h3 className="font-semibold mb-5">Comment ça marche</h3>
                <ul className="space-y-5 text-sm">
                  <Garantie icon={Receipt} titre="66 % déductible de vos impôts">
                    Un don de 30&nbsp;€ ne vous coûte que 10,20&nbsp;€. HelloAsso vous
                    envoie le reçu fiscal automatiquement.
                  </Garantie>
                  <Garantie icon={Repeat} titre="Ponctuel ou mensuel">
                    Un don mensuel, même petit, nous permet de prévoir.
                  </Garantie>
                  <Garantie icon={ShieldCheck} titre="Paiement sécurisé par HelloAsso">
                    La plateforme de paiement utilisée par les associations françaises.
                  </Garantie>
                  <Garantie icon={Coins} titre="Zéro frais sur votre don">
                    HelloAsso vous proposera une contribution facultative à son propre
                    fonctionnement : vous pouvez la mettre à 0&nbsp;€.
                  </Garantie>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aider autrement */}
      <section id="aider" className="py-16 px-4 scroll-mt-20">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-xl md:text-2xl font-bold mb-2 text-center">
            Pas de budget ? Aidez autrement
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Le plus précieux pour nous, c&apos;est que CLAIR soit connu.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-5 flex flex-col">
              <h3 className="font-semibold mb-1">Partagez CLAIR</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Une fiche de député, un scrutin, un dossier : envoyez-le à quelqu&apos;un
                que ça intéresse.
              </p>
              <ShareButton
                url="https://clair.vote"
                title="CLAIR"
                text="Les votes, les débats et le lobbying au Parlement, ouverts à tous."
                variant="button"
                className="mt-auto self-start"
              />
            </div>
            <Piste
              icon={Github}
              titre="Contribuez au code"
              description="Le projet est open source : code, données, documentation, toute aide compte."
              href={GITHUB_URL}
              lien="Voir sur GitHub"
            />
            <Piste
              icon={MessageCircle}
              titre="Rejoignez la communauté"
              description="Discutez des prochaines fonctionnalités et des données avec l'équipe."
              href={DISCORD_URL}
              lien="Rejoindre le Discord"
            />
            <Piste
              icon={Mail}
              titre="Signalez une erreur"
              description="Une donnée fausse, une page qui coince ? Vos retours font progresser CLAIR."
              href="mailto:contact@clair.vote"
              lien="Nous écrire"
            />
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
          <div className="mt-12 text-center">
            <a
              href="#don"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <Heart className="h-5 w-5" aria-hidden />
              Je soutiens CLAIR
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 text-center">
      <p className="text-2xl md:text-3xl font-bold text-primary tabular-nums">
        {formatNombre(valeur)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{libelle}</p>
    </div>
  );
}

function Usage({ icon: Icon, titre, description }: {
  icon: typeof Heart;
  titre: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h3 className="font-semibold mb-1">{titre}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Garantie({ icon: Icon, titre, children }: {
  icon: typeof Heart;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden />
      <div>
        <p className="font-medium">{titre}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function Piste({ icon: Icon, titre, description, href, lien }: {
  icon: typeof Heart;
  titre: string;
  description: string;
  href: string;
  lien: string;
}) {
  const externe = href.startsWith('http');
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col">
      <h3 className="font-semibold mb-1">{titre}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <a
        href={href}
        {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon className="h-4 w-4" aria-hidden />
        {lien}
      </a>
    </div>
  );
}
