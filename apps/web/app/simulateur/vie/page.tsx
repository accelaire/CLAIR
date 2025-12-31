'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Users,
  Wallet,
  Heart,
  Leaf,
  Briefcase,
  Home,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Candidat {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  parti: string;
  photoUrl?: string;
}

interface ProfilUtilisateur {
  age: number;
  situation: 'etudiant' | 'salarie' | 'independant' | 'chomeur' | 'retraite';
  revenus: number;
  logement: 'locataire' | 'proprietaire' | 'heberge';
  ville: string;
  typeVille: 'grande_ville' | 'ville_moyenne' | 'rural';
  voiture: boolean;
  enfants: number;
}

interface ImpactData {
  candidat: {
    slug: string;
    nom: string;
    prenom: string;
    parti: string;
    photoUrl?: string;
  };
  profil: ProfilUtilisateur;
  impacts: {
    pouvoirAchat: {
      salaireActuel: number;
      salaireProjection: number;
      changementSalaire: number;
      loyerActuel: number;
      loyerProjection: number;
      changementLoyer: number | null;
      impotActuel: number;
      impotProjection: number;
      changementImpot: number;
      resteAVivre: { actuel: number; projection: number };
    };
    sante: {
      resteAChargeActuel: number;
      resteAChargeProjection: number;
      changementCharge: number;
      delaiRdvActuel: number;
      delaiRdvProjection: number;
      changementDelai: number;
      explication: string;
    };
    environnement: {
      qualiteAirActuel: string;
      qualiteAirProjection: string;
      ameliorationAir: boolean;
      prixEssenceActuel: number | null;
      prixEssenceProjection: number | null;
      changementEssence: number | null;
      transportCommunActuel: number;
      transportCommunProjection: number;
      changementTransport: number;
      explication: string;
    };
    carriere: {
      tauxChomageActuel: number;
      tauxChomageProjection: number;
      changementChomage: number;
      tauxCDIActuel: number;
      tauxCDIProjection: number;
      changementCDI: number;
      pertinentPour: boolean;
      explication: string;
    };
    logement: {
      prixM2Actuel: number;
      prixM2Projection: number;
      changementPrix: number;
      aideLogement: string;
      construction: string;
      pertinentPour: boolean;
    };
    sources: Array<{ nom: string; url: string | null; description: string }>;
  };
  disclaimer: string;
}

const SITUATIONS = [
  { value: 'etudiant', label: 'Étudiant(e)' },
  { value: 'salarie', label: 'Salarié(e)' },
  { value: 'independant', label: 'Indépendant(e)' },
  { value: 'chomeur', label: 'Demandeur d\'emploi' },
  { value: 'retraite', label: 'Retraité(e)' },
] as const;

const LOGEMENTS = [
  { value: 'locataire', label: 'Locataire' },
  { value: 'proprietaire', label: 'Propriétaire' },
  { value: 'heberge', label: 'Hébergé(e)' },
] as const;

const TYPES_VILLE = [
  { value: 'grande_ville', label: 'Grande ville (>200k hab.)' },
  { value: 'ville_moyenne', label: 'Ville moyenne' },
  { value: 'rural', label: 'Zone rurale' },
] as const;

function ChangeIndicator({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return null;
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;

  if (value === 0) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${
      isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''
    }`}>
      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

function ImpactCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ImpactRow({
  label,
  actuel,
  projection,
  changement,
  unit = '€',
  inverse = false,
}: {
  label: string;
  actuel: number | string;
  projection: number | string;
  changement: number | null;
  unit?: string;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm">
          {typeof actuel === 'number' ? `${actuel}${unit}` : actuel} → <span className="font-medium">{typeof projection === 'number' ? `${projection}${unit}` : projection}</span>
        </span>
        <ChangeIndicator value={changement} inverse={inverse} />
      </div>
    </div>
  );
}

export default function LifeSimulatorPage() {
  const [step, setStep] = useState<'profil' | 'candidat' | 'results'>('profil');
  const [profil, setProfil] = useState<ProfilUtilisateur>({
    age: 30,
    situation: 'salarie',
    revenus: 2000,
    logement: 'locataire',
    ville: 'Paris',
    typeVille: 'grande_ville',
    voiture: false,
    enfants: 0,
  });
  const [selectedCandidat, setSelectedCandidat] = useState<string | null>(null);

  // Fetch candidats
  const { data: candidatsData } = useQuery<{ data: Candidat[] }>({
    queryKey: ['candidats-2027'],
    queryFn: () => api.get('/simulateur/candidats').then(res => res.data),
  });

  // Simulate life impact
  const simulateMutation = useMutation<{ data: ImpactData }, Error, { candidatSlug: string; profil: ProfilUtilisateur }>({
    mutationFn: ({ candidatSlug, profil }) =>
      api.post('/simulateur/vie', { candidatSlug, profil }).then(res => res.data),
    onSuccess: () => setStep('results'),
  });

  const handleProfilSubmit = () => {
    setStep('candidat');
  };

  const handleCandidatSelect = (slug: string) => {
    setSelectedCandidat(slug);
    simulateMutation.mutate({ candidatSlug: slug, profil });
  };

  const handleReset = () => {
    setStep('profil');
    setSelectedCandidat(null);
  };

  const candidats = candidatsData?.data || [];
  const impactData = simulateMutation.data?.data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/simulateur" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour au simulateur
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Simule ta vie en 2032</h1>
        <p className="text-muted-foreground">
          Découvre l&apos;impact concret des politiques de chaque candidat sur ton quotidien
        </p>
      </div>

      {/* Step 1: Profile */}
      {step === 'profil' && (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-6">Ton profil</h2>

            <div className="space-y-6">
              {/* Age */}
              <div>
                <label className="block text-sm font-medium mb-2">Ton âge</label>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={profil.age}
                  onChange={(e) => setProfil(p => ({ ...p, age: parseInt(e.target.value) || 18 }))}
                  className="w-full px-4 py-2 rounded-lg border bg-background"
                />
              </div>

              {/* Situation */}
              <div>
                <label className="block text-sm font-medium mb-2">Ta situation</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SITUATIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setProfil(p => ({ ...p, situation: value }))}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        profil.situation === value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Revenus */}
              <div>
                <label className="block text-sm font-medium mb-2">Tes revenus mensuels nets</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={profil.revenus}
                    onChange={(e) => setProfil(p => ({ ...p, revenus: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 pr-8 rounded-lg border bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>

              {/* Logement */}
              <div>
                <label className="block text-sm font-medium mb-2">Ton logement</label>
                <div className="grid grid-cols-3 gap-2">
                  {LOGEMENTS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setProfil(p => ({ ...p, logement: value }))}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        profil.logement === value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type de ville */}
              <div>
                <label className="block text-sm font-medium mb-2">Où habites-tu ?</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {TYPES_VILLE.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setProfil(p => ({ ...p, typeVille: value }))}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        profil.typeVille === value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voiture */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profil.voiture}
                    onChange={(e) => setProfil(p => ({ ...p, voiture: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">J&apos;ai une voiture</span>
                </label>
              </div>

              {/* Enfants */}
              <div>
                <label className="block text-sm font-medium mb-2">Nombre d&apos;enfants</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setProfil(p => ({ ...p, enfants: n }))}
                      className={`w-12 h-12 rounded-lg border text-sm font-medium transition-colors ${
                        profil.enfants === n
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      {n === 3 ? '3+' : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleProfilSubmit}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Continuer
          </button>
        </div>
      )}

      {/* Step 2: Candidat selection */}
      {step === 'candidat' && (
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg border bg-card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">Choisis un président</h2>
            <p className="text-muted-foreground mb-6">
              Sélectionne le candidat dont tu veux simuler l&apos;impact sur ta vie
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {candidats.map((candidat) => (
                <button
                  key={candidat.id}
                  onClick={() => handleCandidatSelect(candidat.slug)}
                  disabled={simulateMutation.isPending}
                  className={`p-4 rounded-lg border text-left transition-colors hover:border-primary ${
                    selectedCandidat === candidat.slug ? 'border-primary bg-primary/5' : ''
                  } ${simulateMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted mx-auto mb-3">
                    {candidat.photoUrl ? (
                      <Image
                        src={candidat.photoUrl}
                        alt={candidat.nom}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-medium text-center">{candidat.prenom} {candidat.nom}</p>
                  <p className="text-sm text-muted-foreground text-center">{candidat.parti}</p>
                </button>
              ))}
            </div>
          </div>

          {simulateMutation.isPending && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Calcul de la simulation...</p>
            </div>
          )}

          <button
            onClick={() => setStep('profil')}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Modifier mon profil
          </button>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && impactData && (
        <div className="max-w-4xl mx-auto">
          {/* Candidate header */}
          <div className="flex items-center gap-4 mb-8 p-4 rounded-lg bg-primary/5 border border-primary">
            <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
              {impactData.candidat.photoUrl ? (
                <Image
                  src={impactData.candidat.photoUrl}
                  alt={impactData.candidat.nom}
                  fill
                  className="object-cover"
                />
              ) : (
                <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                Ta vie en 2032 — Présidence de {impactData.candidat.prenom} {impactData.candidat.nom}
              </h2>
              <p className="text-muted-foreground">{impactData.candidat.parti}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Pouvoir d'achat */}
            <ImpactCard icon={Wallet} title="Ton pouvoir d'achat">
              <div className="space-y-1">
                {impactData.profil.revenus > 0 && (
                  <ImpactRow
                    label="Salaire net"
                    actuel={impactData.impacts.pouvoirAchat.salaireActuel}
                    projection={impactData.impacts.pouvoirAchat.salaireProjection}
                    changement={impactData.impacts.pouvoirAchat.changementSalaire}
                  />
                )}
                {impactData.profil.logement === 'locataire' && (
                  <ImpactRow
                    label="Loyer moyen"
                    actuel={impactData.impacts.pouvoirAchat.loyerActuel}
                    projection={impactData.impacts.pouvoirAchat.loyerProjection}
                    changement={impactData.impacts.pouvoirAchat.changementLoyer}
                    inverse
                  />
                )}
                {impactData.profil.revenus > 0 && (
                  <ImpactRow
                    label="Impôt mensuel"
                    actuel={impactData.impacts.pouvoirAchat.impotActuel}
                    projection={impactData.impacts.pouvoirAchat.impotProjection}
                    changement={impactData.impacts.pouvoirAchat.changementImpot}
                    inverse
                  />
                )}
                <div className="pt-2 mt-2 border-t">
                  <ImpactRow
                    label="Reste à vivre"
                    actuel={impactData.impacts.pouvoirAchat.resteAVivre.actuel}
                    projection={impactData.impacts.pouvoirAchat.resteAVivre.projection}
                    changement={Math.round(((impactData.impacts.pouvoirAchat.resteAVivre.projection - impactData.impacts.pouvoirAchat.resteAVivre.actuel) / Math.max(1, impactData.impacts.pouvoirAchat.resteAVivre.actuel)) * 100)}
                  />
                </div>
              </div>
            </ImpactCard>

            {/* Santé */}
            <ImpactCard icon={Heart} title="Ta santé">
              <div className="space-y-1">
                <ImpactRow
                  label="Reste à charge médecin"
                  actuel={impactData.impacts.sante.resteAChargeActuel}
                  projection={impactData.impacts.sante.resteAChargeProjection}
                  changement={impactData.impacts.sante.changementCharge}
                  inverse
                />
                <ImpactRow
                  label="Délai RDV spécialiste"
                  actuel={`${impactData.impacts.sante.delaiRdvActuel}j`}
                  projection={`${impactData.impacts.sante.delaiRdvProjection}j`}
                  changement={impactData.impacts.sante.changementDelai}
                  unit=""
                  inverse
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {impactData.impacts.sante.explication}
              </p>
            </ImpactCard>

            {/* Environnement */}
            <ImpactCard icon={Leaf} title="Ton environnement">
              <div className="space-y-1">
                <ImpactRow
                  label="Qualité de l'air"
                  actuel={impactData.impacts.environnement.qualiteAirActuel}
                  projection={impactData.impacts.environnement.qualiteAirProjection}
                  changement={impactData.impacts.environnement.ameliorationAir ? 1 : 0}
                  unit=""
                />
                {impactData.profil.voiture && impactData.impacts.environnement.prixEssenceActuel !== null && (
                  <ImpactRow
                    label="Prix essence"
                    actuel={`${impactData.impacts.environnement.prixEssenceActuel}€/L`}
                    projection={`${impactData.impacts.environnement.prixEssenceProjection}€/L`}
                    changement={impactData.impacts.environnement.changementEssence}
                    unit=""
                    inverse
                  />
                )}
                <ImpactRow
                  label="Transports en commun"
                  actuel={`${impactData.impacts.environnement.transportCommunActuel}€/mois`}
                  projection={`${impactData.impacts.environnement.transportCommunProjection}€/mois`}
                  changement={impactData.impacts.environnement.changementTransport}
                  unit=""
                  inverse
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {impactData.impacts.environnement.explication}
              </p>
            </ImpactCard>

            {/* Carrière */}
            {impactData.impacts.carriere.pertinentPour && (
              <ImpactCard icon={Briefcase} title="Ta carrière">
                <div className="space-y-1">
                  <ImpactRow
                    label="Chômage des jeunes"
                    actuel={`${impactData.impacts.carriere.tauxChomageActuel}%`}
                    projection={`${impactData.impacts.carriere.tauxChomageProjection}%`}
                    changement={impactData.impacts.carriere.changementChomage}
                    unit=""
                    inverse
                  />
                  <ImpactRow
                    label="CDI avant 25 ans"
                    actuel={`${impactData.impacts.carriere.tauxCDIActuel}%`}
                    projection={`${impactData.impacts.carriere.tauxCDIProjection}%`}
                    changement={impactData.impacts.carriere.changementCDI}
                    unit=""
                  />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {impactData.impacts.carriere.explication}
                </p>
              </ImpactCard>
            )}

            {/* Logement */}
            {impactData.impacts.logement.pertinentPour && (
              <ImpactCard icon={Home} title="Le logement">
                <div className="space-y-1">
                  <ImpactRow
                    label="Prix au m²"
                    actuel={impactData.impacts.logement.prixM2Actuel}
                    projection={impactData.impacts.logement.prixM2Projection}
                    changement={impactData.impacts.logement.changementPrix}
                    inverse
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Aides :</span> {impactData.impacts.logement.aideLogement}</p>
                  <p><span className="text-muted-foreground">Construction :</span> {impactData.impacts.logement.construction}</p>
                </div>
              </ImpactCard>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-8 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium mb-1">Important</p>
                <p className="text-sm text-amber-700">{impactData.disclaimer}</p>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div className="mt-6 p-4 rounded-lg border">
            <h3 className="font-medium mb-3">Sources et méthodologie</h3>
            <ul className="space-y-2 text-sm">
              {impactData.impacts.sources.map((source, i) => (
                <li key={i} className="flex items-center gap-2">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {source.nom}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="font-medium">{source.nom}</span>
                  )}
                  <span className="text-muted-foreground">— {source.description}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleReset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Recommencer
            </button>
            <Link
              href="/simulateur/versus"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Comparer les candidats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
