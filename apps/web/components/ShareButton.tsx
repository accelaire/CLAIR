'use client';

import { useState, useCallback } from 'react';
import { Share2, Check, Link as LinkIcon } from 'lucide-react';
import { signalStrongAction } from '@/components/feedback/FeedbackWidget';

interface ShareButtonProps {
  /** Full URL to share. Defaults to current page URL. */
  url?: string;
  /** Title for Web Share API */
  title?: string;
  /** Text for Web Share API */
  text?: string;
  /** 'icon' = small icon only, 'button' = icon + text */
  variant?: 'icon' | 'button';
  className?: string;
}

export function ShareButton({
  url,
  title,
  text,
  variant = 'icon',
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // Partager = action forte → qualifie pour la sollicitation de feedback
    signalStrongAction();

    const rawUrl = url || window.location.href;
    const shareUrl = rawUrl.startsWith('/') ? `${window.location.origin}${rawUrl}` : rawUrl;

    // Try Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || document.title,
          text,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: prompt
      window.prompt('Copier ce lien :', shareUrl);
    }
  }, [url, title, text]);

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleShare}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-500">Lien copié</span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            <span>Partager</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Partager"
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </button>
  );
}
