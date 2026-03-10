import type { Metadata } from 'next';
import Link from 'next/link';
import { Building } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Les commissions parlementaires | CLAIR',
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
