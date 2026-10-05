import React from "react";

export interface FeatureCardProps {
  icon?: string;
  title: string;
  description: string;
  badge?: string;
  href?: string;
}

export function FeatureCard({ icon, title, description, badge, href }: FeatureCardProps) {
  const content = (
    <div className="h-full p-5 rounded-lg border border-slate-200 dark:border-[#22262f] bg-slate-50/70 dark:bg-[#12151b] flex flex-col justify-between transition-all hover:border-[#1d70f5]/50 hover:bg-slate-100 dark:hover:bg-[#181c24] hover:shadow-sm">
      <div>
        {icon && <div className="text-2xl mb-2.5">{icon}</div>}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0 tracking-tight">{title}</h3>
          {badge && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 dark:text-[#94969c] m-0 leading-relaxed">
          {description}
        </p>
      </div>
      {href && (
        <div className="mt-4 text-xs font-semibold text-[#1d70f5] dark:text-[#60a5fa] flex items-center gap-1">
          <span>Consulter</span>
          <span>→</span>
        </div>
      )}
    </div>
  );

  if (href) {
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    return (
      <a
        href={href}
        className="no-underline block group"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }

  return content;
}

export function FeatureGrid({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 2
      ? "grid-cols-1 md:grid-cols-2"
      : cols === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 md:grid-cols-3";

  return <div className={`not-prose my-6 grid ${colClass} gap-4`}>{children}</div>;
}

export interface TrackCardProps {
  icon?: string;
  trackNumber?: string | number;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

export function TrackCard({ icon = "🎯", trackNumber, title, badge, children }: TrackCardProps) {
  return (
    <div className="not-prose my-4 p-5 rounded-lg border border-slate-200 dark:border-[#22262f] bg-slate-50/70 dark:bg-[#12151b]">
      <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-200 dark:border-[#22262f]">
        <span className="text-xl">{icon}</span>
        {trackNumber && (
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            #{trackNumber}
          </span>
        )}
        <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">{title}</h4>
        {badge && (
          <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-[#22262f] text-slate-700 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
        {children}
      </div>
    </div>
  );
}
