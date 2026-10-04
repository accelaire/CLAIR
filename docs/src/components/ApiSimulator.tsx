import React, { useState } from "react";

export interface ApiSimulatorProps {
  defaultEndpoint?: string;
  method?: "GET" | "POST";
  mockResponse?: Record<string, unknown> | Array<unknown>;
  description?: string;
}

export function ApiSimulator({
  defaultEndpoint = "/api/v1/parlementaires?limit=2",
  method = "GET",
  mockResponse = {
    total: 925,
    page: 1,
    limit: 2,
    data: [
      {
        id: "PA795828",
        slug: "yael-braun-pivet",
        nom: "Braun-Pivet",
        prenom: "Yaël",
        chambre: "ASSEMBLEE",
        groupe: "EPR",
        departement: "Yvelines",
      },
      {
        id: "PA721816",
        slug: "gerard-larcher",
        nom: "Larcher",
        prenom: "Gérard",
        chambre: "SENAT",
        groupe: "REP",
        departement: "Yvelines",
      },
    ],
  },
  description,
}: ApiSimulatorProps) {
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [response, setResponse] = useState<string>(JSON.stringify(mockResponse, null, 2));
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(200);

  const handleSend = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const isDev = typeof window !== "undefined" && window.location.hostname === "localhost";
      const url = isDev ? `/api-proxy${cleanPath}` : `https://api.clair.vote${cleanPath}`;

      const res = await fetch(url);
      const data = await res.json();
      setStatus(res.status);
      setResponse(JSON.stringify(data, null, 2));
    } catch {
      // Fallback to mock on CORS or network issues
      setStatus(200);
      setResponse(JSON.stringify(mockResponse, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="not-prose my-6 rounded-lg border border-slate-200 dark:border-[#22262f] bg-slate-900 text-slate-100 overflow-hidden font-mono text-xs">
      {description && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 text-slate-400 text-xs font-sans">
          {description}
        </div>
      )}

      <div className="p-3 bg-slate-950/60 flex items-center gap-2 border-b border-slate-800">
        <span className="px-2 py-1 rounded bg-[#1d70f5] text-white font-bold text-[11px]">
          {method}
        </span>
        <div className="flex-1 flex items-center bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
          <span className="text-slate-500 mr-1 text-xs">https://api.clair.vote</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="flex-1 bg-transparent text-slate-200 outline-none text-xs font-mono"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading}
          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors disabled:opacity-50"
        >
          {isLoading ? "Envoi..." : "Tester"}
        </button>
      </div>

      <div className="p-4 bg-slate-950/90 overflow-x-auto max-h-72">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] text-slate-400">
          <span>RÉPONSE</span>
          {status && (
            <span className={`font-bold ${status >= 200 && status < 300 ? "text-emerald-400" : "text-amber-400"}`}>
              STATUS: {status} OK
            </span>
          )}
        </div>
        <pre className="m-0 text-slate-300 leading-relaxed">{response}</pre>
      </div>
    </div>
  );
}
