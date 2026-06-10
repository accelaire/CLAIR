'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const SILENCE_DURATION_MS = 45 * 24 * 60 * 60 * 1000; // 45 jours en millisecondes

/**
 * Vérifie si le chemin courant correspond à une page de détail (action à valeur).
 */
function isValuePage(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  const base = segments[0];
  const sub = segments[1];
  if (!['deputes', 'senateurs', 'scrutins', 'dossiers', 'sujets', 'lobbying'].includes(base)) {
    return false;
  }
  if (['comparer', 'actions'].includes(sub)) {
    return false;
  }
  return true;
}

/**
 * Appelée depuis d'autres composants (ShareButton, comparateur, …) pour signaler une action forte.
 * Met à jour sessionStorage et dispatch un événement écouté par le widget.
 */
export function signalStrongAction() {
  if (typeof window === 'undefined') return;
  const current = parseInt(sessionStorage.getItem('clair_fb_actions') || '0', 10);
  sessionStorage.setItem('clair_fb_strong', '1');
  sessionStorage.setItem('clair_fb_actions', (current + 1).toString());
  if (!sessionStorage.getItem('clair_fb_start')) {
    sessionStorage.setItem('clair_fb_start', Date.now().toString());
  }
  window.dispatchEvent(new Event('clair-fb-strong'));
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [shouldNudge, setShouldNudge] = useState(false);
  const [trigger, setTrigger] = useState<'passif' | 'nudge'>('passif');

  // États du formulaire
  const [sentiment, setSentiment] = useState<'negatif' | 'neutre' | 'positif' | null>(null);
  const [type, setType] = useState<'bug' | 'idee' | 'autre'>('autre');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const panelOpenRef = useRef(panelOpen);
  const prevPathname = useRef<string | null>(null);
  const firstEmojiRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Garder la ref panelOpen à jour pour les callbacks asynchrones
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  /** Vérifie si les conditions d'affichage du nudge sont remplies. */
  const checkNudgeConditions = useCallback((isPanelOpen: boolean): boolean => {
    if (typeof window === 'undefined') return false;
    if (isPanelOpen) return false;
    const answered = localStorage.getItem('clair_fb_answered');
    if (answered === '1') return false;
    const silenced = localStorage.getItem('clair_fb_silenced_until');
    if (silenced && parseInt(silenced, 10) > Date.now()) return false;
    const nudgeSeen = sessionStorage.getItem('clair_fb_nudge_displayed');
    if (nudgeSeen === '1') return false;
    const actions = parseInt(sessionStorage.getItem('clair_fb_actions') || '0', 10);
    const strong = sessionStorage.getItem('clair_fb_strong') === '1';
    const start = parseInt(sessionStorage.getItem('clair_fb_start') || '0', 10);
    const now = Date.now();
    if (actions >= 2) return true;
    if (strong && start && (now - start) >= 60000) return true;
    if (actions >= 1 && start && (now - start) >= 60000) return true;
    return false;
  }, []);

  // Initialisation et écouteurs
  useEffect(() => {
    setMounted(true);
    setShouldNudge(checkNudgeConditions(false));

    // Re-vérification toutes les 15s pour la règle des 60s
    const interval = setInterval(() => {
      setShouldNudge(prev => {
        if (!prev) {
          return checkNudgeConditions(panelOpenRef.current);
        }
        return prev;
      });
    }, 15000);

    const handleStrong = () => {
      setShouldNudge(prev => {
        if (!prev) {
          return checkNudgeConditions(panelOpenRef.current);
        }
        return prev;
      });
    };
    window.addEventListener('clair-fb-strong', handleStrong);

    return () => {
      clearInterval(interval);
      window.removeEventListener('clair-fb-strong', handleStrong);
    };
  }, [checkNudgeConditions]);

  // Marquer le nudge comme affiché pour cette session
  useEffect(() => {
    if (shouldNudge && typeof window !== 'undefined') {
      sessionStorage.setItem('clair_fb_nudge_displayed', '1');
    }
  }, [shouldNudge]);

  // Suivi des changements de page : incrémente le compteur d'actions sur les pages à valeur
  useEffect(() => {
    if (!mounted) return;
    // Compte aussi la page d'atterrissage (arrivée directe sur une fiche)
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (isValuePage(pathname)) {
      const current = parseInt(sessionStorage.getItem('clair_fb_actions') || '0', 10);
      sessionStorage.setItem('clair_fb_actions', (current + 1).toString());
      if (!sessionStorage.getItem('clair_fb_start')) {
        sessionStorage.setItem('clair_fb_start', Date.now().toString());
      }
    }
    // Ne jamais masquer un nudge déjà affiché lors d'une navigation
    setShouldNudge((prev) => prev || checkNudgeConditions(panelOpen));
  }, [pathname, mounted, panelOpen, checkNudgeConditions]);

  // Fermeture du panneau via la touche Échap
  useEffect(() => {
    if (!panelOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen]);

  // Focus sur le premier bouton du formulaire à l'ouverture
  useEffect(() => {
    if (panelOpen && firstEmojiRef.current) {
      firstEmojiRef.current.focus();
    }
  }, [panelOpen]);

  const dismissNudge = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('clair_fb_silenced_until', (Date.now() + SILENCE_DURATION_MS).toString());
    setShouldNudge(false);
  }, []);

  const openPanel = useCallback((triggerType: 'passif' | 'nudge') => {
    setTrigger(triggerType);
    setPanelOpen(true);
    setShouldNudge(false);
    // Réinitialisation du formulaire
    setSentiment(null);
    setType('autre');
    setMessage('');
    setEmail('');
    setWebsite('');
    setSubmitting(false);
    setSubmitSuccess(false);
    setSubmitError(null);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentiment && !message.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.post('/feedback', {
        sentiment,
        type,
        message: message.trim() || undefined,
        email: email.trim() || undefined,
        page: pathname,
        trigger,
        website,
      });
      setSubmitSuccess(true);
      localStorage.setItem('clair_fb_answered', '1');
      setTimeout(() => {
        closePanel();
      }, 2500);
    } catch (err) {
      console.error('Erreur feedback', err);
      setSubmitError('Une erreur est survenue, réessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [sentiment, type, message, email, website, pathname, trigger, closePanel]);

  const isSubmitDisabled = !sentiment && !message.trim();

  if (!mounted) {
    return null; // Évite toute erreur d'hydratation
  }

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {panelOpen ? (
        /* Panneau formulaire */
        <div
          role="dialog"
          aria-label="Formulaire de feedback"
          className="w-80 sm:w-96 rounded-xl border bg-background shadow-lg p-4 space-y-4"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Votre avis sur CLAIR</h2>
            <button
              type="button"
              onClick={closePanel}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Check className="h-8 w-8 text-emerald-500" />
              <p className="text-center text-sm font-medium">Merci pour votre retour 🙏</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sentiment */}
              <div>
                <label className="block text-sm font-medium mb-2">Comment trouvez-vous le site ?</label>
                <div className="flex gap-2">
                  {([
                    { value: 'negatif', emoji: '😞', label: 'Pas top' },
                    { value: 'neutre', emoji: '😐', label: 'Moyen' },
                    { value: 'positif', emoji: '😊', label: 'Bien' },
                  ] as const).map((item, index) => (
                    <button
                      key={item.value}
                      type="button"
                      ref={index === 0 ? firstEmojiRef : null}
                      onClick={() => setSentiment(item.value)}
                      className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                        sentiment === item.value
                          ? 'bg-muted border-foreground/20 ring-1 ring-foreground/10'
                          : 'bg-transparent border-border hover:bg-muted/50'
                      }`}
                      aria-label={item.label}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type de retour */}
              <div>
                <label className="block text-sm font-medium mb-2">Type de retour</label>
                <div className="flex gap-2">
                  {([
                    { value: 'bug', label: 'Bug' },
                    { value: 'idee', label: 'Idée' },
                    { value: 'autre', label: 'Autre' },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setType(item.value)}
                      className={`flex-1 py-1.5 px-3 text-sm rounded-md border transition-colors ${
                        type === item.value
                          ? 'bg-muted border-foreground/20 ring-1 ring-foreground/10'
                          : 'bg-transparent border-border hover:bg-muted/50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message (optionnel) */}
              <textarea
                placeholder="Un mot de plus ? (optionnel)"
                maxLength={2000}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />

              {/* Email (optionnel) */}
              <input
                type="email"
                placeholder="Email si vous voulez une réponse (optionnel)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {/* Honeypot caché */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <label htmlFor="website-hp">Website (honeypot)</label>
                <input
                  type="text"
                  id="website-hp"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-500">{submitError}</p>
              )}

              {/* Bouton d'envoi */}
              <button
                type="submit"
                disabled={isSubmitDisabled || submitting}
                className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Bouton passif + nudge */
        <div className="relative">
          <button
            type="button"
            onClick={() => openPanel('passif')}
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm text-muted-foreground hover:text-foreground hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Donner mon avis"
          >
            <MessageCircle className="h-5 w-5" />
            {shouldNudge && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Nudge proactif */}
          <div
            onClick={() => openPanel('nudge')}
            className={`absolute bottom-full right-0 mb-2 w-64 bg-background border shadow-lg rounded-lg p-3 text-sm text-foreground transition-all duration-300 ${
              shouldNudge
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
            }`}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-muted-foreground">Un retour à nous faire ?</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismissNudge(); }}
                className="flex-shrink-0 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Ignorer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}