'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';

/**
 * Extract domain from a website URL for Clearbit Logo API
 */
function extractDomain(siteWeb: string | null | undefined): string | null {
  if (!siteWeb) return null;

  try {
    // Add protocol if missing
    let url = siteWeb;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const parsed = new URL(url);
    // Remove www. prefix for cleaner domain
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try to extract domain directly
    const match = siteWeb.match(/(?:https?:\/\/)?(?:www\.)?([^/\s]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Get logo URL for a domain using Google Favicon API
 */
export function getLogoUrl(siteWeb: string | null | undefined): string | null {
  const domain = extractDomain(siteWeb);
  if (!domain) return null;
  // Google Favicon API - reliable and always available
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

interface LobbyisteLogoProps {
  siteWeb: string | null | undefined;
  nom: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function LobbyisteLogo({ siteWeb, nom, size = 'md', className = '' }: LobbyisteLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getLogoUrl(siteWeb);

  const containerClass = `relative ${sizeClasses[size]} rounded-lg bg-muted flex items-center justify-center overflow-hidden ${className}`;

  // Show fallback icon if no logo URL or if image failed to load
  if (!logoUrl || hasError) {
    return (
      <div className={containerClass}>
        <Building2 className={`${iconSizes[size]} text-muted-foreground`} />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <img
        src={logoUrl}
        alt={`Logo ${nom}`}
        className="h-full w-full object-contain p-1"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
