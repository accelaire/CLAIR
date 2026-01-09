import type { Metadata } from 'next';
import { Mail, Github, Twitter, MessageSquare, Bug, Lightbulb } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez l\'équipe CLAIR pour toute question, suggestion ou signalement d\'erreur.',
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Une question, une suggestion, une erreur à signaler ?
          Plusieurs moyens de nous contacter.
        </p>
      </div>

      {/* Contact methods */}
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
        {/* Email */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Mail className="h-5 w-5" />
              Email
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pour les questions générales
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Écrivez-nous pour toute question sur le projet, demande de partenariat,
              ou sujet ne rentrant pas dans les autres catégories.
            </p>
            <a
              href="mailto:contact@clair.vote"
              className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              contact@clair.vote
            </a>
          </div>
        </div>

        {/* Twitter/X */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Twitter className="h-5 w-5" />
              X (Twitter)
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Suivez l&apos;actualité du projet
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Nous publions les mises à jour, les nouvelles fonctionnalités
              et des analyses ponctuelles sur notre compte X.
            </p>
            <br />
            <a
              href="https://x.com/ClairPolitique"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              @ClairPolitique
            </a>
          </div>
        </div>

        {/* GitHub Issues */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Bug className="h-5 w-5" />
              Signaler un bug
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Via GitHub Issues (bug)
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Vous avez trouvé un bug ou une erreur dans les données ?
              Ouvrez une issue sur notre dépôt GitHub pour nous le signaler.
            </p>
            <a
              href="https://github.com/accelaire/CLAIR/issues/new?labels=bug"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <Github className="mr-2 h-4 w-4" />
              Ouvrir une issue
            </a>
          </div>
        </div>

        {/* Feature requests */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Lightbulb className="h-5 w-5" />
              Suggérer une fonctionnalité
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Via GitHub Issues (feature request)
            </p>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Une idée d&apos;amélioration ? Une fonctionnalité qui vous manque ?
              Proposez-la sur GitHub également.
            </p>
            <br />
            <a
              href="https://github.com/accelaire/CLAIR/issues/new?labels=feature-request"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Proposer une idée
            </a>
          </div>
        </div>
      </div>

      {/* Contribute */}
      <div className="mx-auto mt-16 max-w-4xl rounded-xl bg-muted/50 p-8 text-center">
        <h2 className="text-2xl font-bold">Contribuer au projet</h2>
        <p className="mt-4 text-muted-foreground">
          CLAIR est un projet open source. Développeurs, designers, data analysts :
          vos contributions sont les bienvenues !
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <a
            href="https://github.com/accelaire/CLAIR"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Github className="mr-2 h-4 w-4" />
            Voir le code sur GitHub
          </a>
        </div>
      </div>

      {/* Response time */}
      <div className="mx-auto mt-12 max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">
          Nous nous efforçons de répondre à tous les messages dans un délai de 48h.
          Pour les bugs critiques, nous intervenons généralement plus rapidement.
        </p>
      </div>
    </div>
  );
}
