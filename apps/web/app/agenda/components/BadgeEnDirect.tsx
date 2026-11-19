/**
 * La pastille « En direct », la même sur l'agenda et l'accueil. Avec `href`,
 * elle mène au direct (lien externe) ; sans, elle n'est qu'un signal.
 */
export function BadgeEnDirect({ href, compact = false }: { href?: string; compact?: boolean }) {
  const classes = `inline-flex items-center gap-1.5 rounded font-medium bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 ${
    compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
  }`;
  const contenu = (
    <>
      <span className='relative flex h-2 w-2 shrink-0' aria-hidden>
        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75' />
        <span className='relative inline-flex h-2 w-2 rounded-full bg-red-500' />
      </span>
      En direct
    </>
  );
  if (!href) return <span className={classes}>{contenu}</span>;
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className={`${classes} transition-colors hover:bg-red-100 dark:hover:bg-red-950/60`}
      title='Regarder le direct (nouvel onglet)'
    >
      {contenu}
    </a>
  );
}
