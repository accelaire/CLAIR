'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface ExpandableTextProps {
  text: string;
  hasMore?: boolean;
  interventionId: string;
  sourceUrl: string | null;
  maxLines?: number;
}

export function ExpandableText({
  text,
  hasMore,
  interventionId,
  sourceUrl,
  maxLines = 5,
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight);
      }
    };
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [text]);

  const handleExpand = useCallback(async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    if (fullText || !hasMore) {
      setIsExpanded(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get(`/scrutins/interventions/${interventionId}`);
      setFullText(res.data.data.contenu);
      setIsExpanded(true);
    } catch {
      setIsExpanded(true);
    } finally {
      setIsLoading(false);
    }
  }, [isExpanded, fullText, hasMore, interventionId]);

  const displayText = isExpanded && fullText ? fullText : text;
  const showButton = hasMore || isTruncated || isExpanded;

  // Dynamic line-clamp class
  const lineClampClass = isExpanded ? '' : `line-clamp-${maxLines}`;

  return (
    <div>
      <p
        ref={textRef}
        className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${lineClampClass}`}
        style={!isExpanded && ![3, 4, 5, 6].includes(maxLines) ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } : undefined}
      >
        {displayText}
        {!isExpanded && hasMore && '\u2026'}
      </p>
      {showButton && (
        <button
          onClick={handleExpand}
          disabled={isLoading}
          className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Chargement&hellip;
            </>
          ) : isExpanded ? (
            'Voir moins'
          ) : (
            'Voir plus'
          )}
        </button>
      )}
      {isExpanded && sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary/70 hover:text-primary hover:underline mt-1 ml-3 inline-flex items-center gap-1"
        >
          Voir sur {sourceUrl.includes('senat.fr') ? 'senat.fr' : 'assemblee-nationale.fr'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
