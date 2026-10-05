import { Moon, Sun } from "lucide-react";
import { useTheme } from "zudoku/hooks";

/**
 * Fin du header sur grand écran, à l'identique de clair.vote
 * (apps/web/components/layout/header.tsx) : sélecteur de thème PUIS bouton
 * « Nous soutenir ». Zudoku place toujours son propre sélecteur après la
 * navigation : il est masqué sur grand écran (zudoku.theme.css) et reste dans le
 * menu mobile, avec le lien « Nous soutenir » de `header.navigation`.
 */
export function HeaderActions() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex items-center space-x-3">
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Basculer le mode sombre"
      >
        <Sun className="h-5 w-5 hidden dark:block" />
        <Moon className="h-5 w-5 block dark:hidden" />
      </button>
      <a
        href="https://clair.vote/soutenir"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-sm font-medium transition-colors"
      >
        Nous soutenir
      </a>
    </div>
  );
}
