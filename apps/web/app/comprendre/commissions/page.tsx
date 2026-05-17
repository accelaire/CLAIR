import type { Metadata } from 'next';
import Link from 'next/link';
import { Building, ArrowRight, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Les commissions parlementaires',
  description:
    'Comprendre les commissions parlementaires : permanentes, spéciales et d\u2019enquête.',
};

const commissionsAN = [
  'Affaires culturelles et éducation',
  'Affaires économiques',
  'Affaires étrangères',
  'Affaires sociales',
  'Défense nationale et forces armées',
  'Développement durable et aménagement du territoire',
  'Finances, économie générale et contrôle budgétaire',
  'Lois constitutionnelles, législation et administration générale',
];

const commissionsSenat = [
  'Affaires économiques',
  'Affaires étrangères, défense et forces armées',
  'Affaires sociales',
  'Aménagement du territoire et développement durable',
  'Culture, éducation, communication et sport',
  'Finances',
  'Lois constitutionnelles, législation, suffrage universel, Règlement et administration générale',
];

export default function CommissionsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <Building className="h-8 w-8 text-primary" />
          Les commissions parlementaires
        </h1>

        {/* CTA données en direct */}
        <div className="mt-8 rounded-lg border bg-primary/5 border-primary/20 p-5">
          <p className="text-sm font-medium text-foreground mb-3">
            Explorez les données en temps réel sur CLAIR
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/commissions"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Building className="h-4 w-4" />
              Voir les commissions
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/agenda"
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Consulter l&apos;agenda
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Commissions permanentes */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Les commissions permanentes</h2>
          <p className="mt-4 text-muted-foreground">
            Chaque chambre dispose de commissions permanentes qui examinent les textes de loi
            avant leur passage en séance publique. C&apos;est en commission que se fait l&apos;essentiel
            du travail législatif de fond.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Assemblée nationale (8 commissions)</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {commissionsAN.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Sénat (7 commissions)</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {commissionsSenat.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Rôle */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Le rôle des commissions</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Examen des textes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Avant la séance publique, la commission examine le texte article par article,
                auditionne les parties prenantes et adopte des amendements.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Auditions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les commissions auditionnent régulièrement des ministres, experts, représentants
                de la société civile et acteurs concernés par les textes.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Rapports</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Un rapporteur est désigné pour chaque texte. Il rédige un rapport qui présente
                le texte, les modifications proposées et les conclusions de la commission.
              </p>
            </div>
          </div>
        </section>

        {/* Saisine au fond / pour avis */}
        <section id="saisine" className="mt-10 scroll-mt-24">
          <h2 className="text-2xl font-bold">Saisine au fond et pour avis</h2>
          <p className="mt-4 text-muted-foreground">
            Lorsqu&apos;un texte de loi est déposé, il est renvoyé à une ou plusieurs commissions
            pour examen. Deux types de saisine existent :
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  Saisie au fond
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                La commission saisie <strong>au fond</strong> est la commission principale qui examine
                le texte. Elle désigne un rapporteur, organise les auditions, examine les articles
                un par un et adopte des amendements. C&apos;est elle qui produit le texte soumis
                à la séance publique.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                  Saisie pour avis
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Une commission saisie <strong>pour avis</strong> donne un avis consultatif
                sur les aspects du texte qui relèvent de son domaine de compétence. Son avis
                n&apos;est pas contraignant mais peut influencer le débat en séance publique.
                Plusieurs commissions peuvent être saisies pour avis sur un même texte.
              </p>
            </div>
          </div>
        </section>

        {/* Spéciales et d'enquête */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Commissions spéciales et d&apos;enquête</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Commissions spéciales</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Créées pour examiner un texte spécifique qui ne relève pas clairement d&apos;une
                seule commission permanente. Elles sont dissoutes une fois le texte adopté.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Commissions d&apos;enquête</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Créées pour enquêter sur un sujet précis. Durée limitée à 6 mois. Elles disposent
                de pouvoirs d&apos;investigation renforcés : convocations, auditions sous serment,
                accès aux documents.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/dossiers"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explorer les dossiers législatifs
          </Link>
        </div>
      </div>
    </div>
  );
}
