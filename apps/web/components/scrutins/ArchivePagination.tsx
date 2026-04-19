import Link from 'next/link';

interface Props {
  basePath: string;
  currentPage: number;
  totalPages: number;
}

function buildHref(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

/**
 * Compact page range (e.g. 1 … 4 5 [6] 7 8 … 20) for server-rendered
 * pagination. Keeps the DOM small even on long archives.
 */
function pageRange(current: number, total: number, span = 2): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  for (let i = 1; i <= span; i++) {
    if (current - i > 1) pages.add(current - i);
    if (current + i < total) pages.add(current + i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
}

export function ArchivePagination({ basePath, currentPage, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const items = pageRange(currentPage, totalPages);
  const prevHref =
    currentPage > 1 ? buildHref(basePath, currentPage - 1) : null;
  const nextHref =
    currentPage < totalPages ? buildHref(basePath, currentPage + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-1 text-sm"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          rel="prev"
          className="rounded border px-3 py-1 hover:border-primary hover:text-foreground"
        >
          ← Précédent
        </Link>
      ) : (
        <span className="rounded border px-3 py-1 text-muted-foreground opacity-50">
          ← Précédent
        </span>
      )}

      <ul className="mx-2 flex items-center gap-1">
        {items.map((item, idx) =>
          item === '…' ? (
            <li
              key={`ellipsis-${idx}`}
              className="px-2 text-muted-foreground"
              aria-hidden="true"
            >
              …
            </li>
          ) : (
            <li key={item}>
              {item === currentPage ? (
                <span
                  aria-current="page"
                  className="rounded border border-primary bg-primary px-3 py-1 text-primary-foreground"
                >
                  {item}
                </span>
              ) : (
                <Link
                  href={buildHref(basePath, item)}
                  className="rounded border px-3 py-1 text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {nextHref ? (
        <Link
          href={nextHref}
          rel="next"
          className="rounded border px-3 py-1 hover:border-primary hover:text-foreground"
        >
          Suivant →
        </Link>
      ) : (
        <span className="rounded border px-3 py-1 text-muted-foreground opacity-50">
          Suivant →
        </span>
      )}
    </nav>
  );
}
