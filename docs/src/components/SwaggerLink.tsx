import { useLocation } from "zudoku/router";

const SWAGGER_UI_URL = "https://api.clair.vote/docs";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

/**
 * Lien vers le Swagger UI servi par l'API, affiché en tête des pages de
 * l'explorateur (`/api`). Les deux lisent la même spec, générée par le code de
 * l'API : celui-ci reste l'outil de test habituel des développeurs.
 */
export function SwaggerLink() {
  const { pathname } = useLocation();
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return null;

  return (
    <div className="not-prose flex justify-end pt-6" data-pagefind-ignore="all">
      <a
        href={SWAGGER_UI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Ouvrir le Swagger UI
        <ExternalLinkIcon className="h-4 w-4" />
      </a>
    </div>
  );
}
