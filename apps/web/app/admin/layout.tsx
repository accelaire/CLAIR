'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  ArrowLeft,
  Shield,
  Lock,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/candidats', label: 'Candidats', icon: Users },
  { href: '/admin/validation', label: 'Validation', icon: CheckSquare },
  { href: '/admin/stats', label: 'Statistiques', icon: BarChart3 },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
];

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'clair2024';
const AUTH_KEY = 'clair_admin_auth';

function AdminAuth({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    setIsAuthenticated(stored === 'true');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-lg border p-6 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Lock className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Administration CLAIR</h1>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                  placeholder="Entrez le mot de passe"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
              >
                Accéder
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - render children with logout button available
  return (
    <>
      {children}
      <LogoutButton onLogout={handleLogout} />
    </>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 text-sm"
      title="Déconnexion"
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </button>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AdminAuth>
    <div className="min-h-screen bg-muted/30">
      {/* Admin Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour au site
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Administration CLAIR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
    </AdminAuth>
  );
}
