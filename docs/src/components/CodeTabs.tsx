import React, { useState } from "react";

export interface CodeTabItem {
  label: string;
  code: string;
  language?: string;
}

export function CodeTabs({ tabs }: { tabs: CodeTabItem[] }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!tabs || tabs.length === 0) return null;

  return (
    <div className="not-prose my-6 rounded-lg border border-slate-200 dark:border-[#22262f] bg-slate-900 text-slate-100 overflow-hidden text-xs">
      <div className="flex border-b border-slate-800 bg-slate-950/80 px-2 pt-2 gap-1 overflow-x-auto">
        {tabs.map((tab, idx) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`px-3 py-1.5 font-mono text-xs font-semibold rounded-t-md transition-colors ${
              activeTab === idx
                ? "bg-slate-900 text-[#60a5fa] border-t-2 border-[#1d70f5]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4 overflow-x-auto font-mono">
        <pre className="m-0 leading-relaxed text-slate-200">{tabs[activeTab].code}</pre>
      </div>
    </div>
  );
}
