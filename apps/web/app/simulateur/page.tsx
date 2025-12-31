'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ChevronRight,
  ChevronLeft,
  Vote,
  Users,
  Loader2,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';

type Step = 'intro' | 'profil' | 'quiz' | 'loading' | 'results';

interface Question {
  id: string;
  ordre: number;
  type: 'dilemme' | 'curseur' | 'classement' | 'citation';
  texte: string;
  contexte?: string;
  optionA?: string;
  optionB?: string;
  labelGauche?: string;
  labelDroite?: string;
  options?: string[];
  citation?: string;
}

interface ProfilData {
  trancheAge?: string;
  situation?: string;
  localisation?: string;
  habitat?: string;
}

interface SessionData {
  sessionId: string;
  sessionToken: string;
  questions: Question[];
  totalQuestions: number;
}

interface ResultCandidat {
  candidat: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    parti: string;
    photoUrl?: string;
    coherenceScore: number;
  };
  matchScore: number;
  scoresDetail: Record<string, number>;
  pointsForts: string[];
  divergences: string[];
}

interface Results {
  profilPolitique: string;
  scoresAxes: Record<string, number>;
  axesLabels: Record<string, string>;
  resultats: ResultCandidat[];
}

export default function SimulateurPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [profil, setProfil] = useState<ProfilData>({});
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<Results | null>(null);

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: (profilData: ProfilData) =>
      api.post('/simulateur/start', { profil: profilData }).then(res => res.data),
    onSuccess: (data) => {
      setSession(data);
      setStep('quiz');
    },
  });

  // Save answer mutation
  const answerMutation = useMutation({
    mutationFn: ({ questionId, reponse }: { questionId: string; reponse: any }) =>
      api.post('/simulateur/reponse', {
        sessionToken: session?.sessionToken,
        questionId,
        reponse,
      }),
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: () =>
      api.post('/simulateur/complete', {
        sessionToken: session?.sessionToken,
      }).then(res => res.data),
    onSuccess: (data) => {
      setResults(data);
      setStep('results');
    },
  });

  const handleStartQuiz = () => {
    startMutation.mutate(profil);
  };

  const handleAnswer = useCallback((questionId: string, reponse: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: reponse }));
    answerMutation.mutate({ questionId, reponse });
  }, [answerMutation]);

  const handleNext = () => {
    if (!session) return;

    if (currentQuestion < session.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setStep('loading');
      completeMutation.mutate();
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const currentQ = session?.questions[currentQuestion];
  const hasAnswered = currentQ && answers[currentQ.id] !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Intro */}
      {step === 'intro' && (
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8">
              <Vote className="h-5 w-5" />
              <span className="font-medium">Mon 2027</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Ils promettent tous la même chose.
              <br />
              <span className="text-primary">Mais votent-ils pareil ?</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8">
              En 15 minutes, découvre quel candidat correspond vraiment à tes valeurs
              — basé sur ce qu&apos;ils ont fait, pas ce qu&apos;ils promettent.
            </p>

            <button
              onClick={() => setStep('profil')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors"
            >
              Commencer
              <ArrowRight className="h-5 w-5" />
            </button>

            <p className="mt-6 text-sm text-muted-foreground">
              Déjà <strong>847,293</strong> simulations réalisées
            </p>
          </div>
        </div>
      )}

      {/* Profil */}
      {step === 'profil' && (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">Personnalise tes résultats</h2>
            <p className="text-muted-foreground mb-8">
              Ces infos restent privées et servent uniquement à te montrer
              l&apos;impact concret des politiques sur TA vie.
            </p>

            <div className="space-y-6">
              {/* Age */}
              <div>
                <label className="block text-sm font-medium mb-2">Ton âge</label>
                <div className="grid grid-cols-4 gap-2">
                  {['18-24', '25-34', '35-44', '45+'].map(age => (
                    <button
                      key={age}
                      onClick={() => setProfil(p => ({ ...p, trancheAge: age }))}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                        profil.trancheAge === age
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:border-primary'
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              {/* Situation */}
              <div>
                <label className="block text-sm font-medium mb-2">Ta situation</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'etudiant', label: 'Étudiant' },
                    { value: 'salarie', label: 'Salarié' },
                    { value: 'independant', label: 'Indépendant' },
                    { value: 'chomage', label: 'En recherche' },
                    { value: 'retraite', label: 'Retraité' },
                    { value: 'autre', label: 'Autre' },
                  ].map(s => (
                    <button
                      key={s.value}
                      onClick={() => setProfil(p => ({ ...p, situation: s.value }))}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                        profil.situation === s.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:border-primary'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Localisation */}
              <div>
                <label className="block text-sm font-medium mb-2">Ton lieu de vie</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'grande_ville', label: 'Grande ville' },
                    { value: 'ville_moyenne', label: 'Ville moyenne' },
                    { value: 'rural', label: 'Rural' },
                  ].map(l => (
                    <button
                      key={l.value}
                      onClick={() => setProfil(p => ({ ...p, localisation: l.value }))}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                        profil.localisation === l.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:border-primary'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleStartQuiz}
                disabled={startMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
              <button
                onClick={handleStartQuiz}
                disabled={startMutation.isPending}
                className="px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
              >
                Passer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz */}
      {step === 'quiz' && session && currentQ && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Question {currentQuestion + 1} sur {session.totalQuestions}</span>
                <span>{Math.round(((currentQuestion + 1) / session.totalQuestions) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / session.totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="bg-card rounded-xl border p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">{currentQ.texte}</h2>
              {currentQ.contexte && (
                <p className="text-muted-foreground mb-6">{currentQ.contexte}</p>
              )}

              {/* Dilemme */}
              {currentQ.type === 'dilemme' && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleAnswer(currentQ.id, { choix: 'A' })}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      answers[currentQ.id]?.choix === 'A'
                        ? 'border-primary bg-primary/10'
                        : 'hover:border-primary'
                    }`}
                  >
                    {currentQ.optionA}
                  </button>
                  <button
                    onClick={() => handleAnswer(currentQ.id, { choix: 'B' })}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      answers[currentQ.id]?.choix === 'B'
                        ? 'border-primary bg-primary/10'
                        : 'hover:border-primary'
                    }`}
                  >
                    {currentQ.optionB}
                  </button>
                  <button
                    onClick={() => handleAnswer(currentQ.id, { choix: 'NSP' })}
                    className={`w-full p-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors ${
                      answers[currentQ.id]?.choix === 'NSP' ? 'text-primary' : ''
                    }`}
                  >
                    Je ne sais pas
                  </button>
                </div>
              )}

              {/* Curseur */}
              {currentQ.type === 'curseur' && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>{currentQ.labelGauche}</span>
                    <span>{currentQ.labelDroite}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={answers[currentQ.id]?.valeur ?? 50}
                    onChange={(e) => handleAnswer(currentQ.id, { valeur: parseInt(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="text-center text-sm text-muted-foreground">
                    Position: {answers[currentQ.id]?.valeur ?? 50}
                  </div>
                </div>
              )}

              {/* Citation */}
              {currentQ.type === 'citation' && currentQ.citation && (
                <div className="space-y-4">
                  <blockquote className="p-4 bg-muted rounded-lg italic border-l-4 border-primary">
                    &ldquo;{currentQ.citation}&rdquo;
                  </blockquote>
                  <p className="text-sm text-muted-foreground text-center">
                    Tu découvriras qui a dit ça dans tes résultats
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleAnswer(currentQ.id, { accord: 'oui' })}
                      className={`p-3 rounded-lg border transition-colors ${
                        answers[currentQ.id]?.accord === 'oui'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'hover:border-green-500'
                      }`}
                    >
                      👍 D&apos;accord
                    </button>
                    <button
                      onClick={() => handleAnswer(currentQ.id, { accord: 'non' })}
                      className={`p-3 rounded-lg border transition-colors ${
                        answers[currentQ.id]?.accord === 'non'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'hover:border-red-500'
                      }`}
                    >
                      👎 Pas d&apos;accord
                    </button>
                    <button
                      onClick={() => handleAnswer(currentQ.id, { accord: 'nsp' })}
                      className={`p-3 rounded-lg border transition-colors ${
                        answers[currentQ.id]?.accord === 'nsp'
                          ? 'border-primary bg-primary/10'
                          : 'hover:border-muted-foreground'
                      }`}
                    >
                      🤷 Je ne sais pas
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={handlePrev}
                disabled={currentQuestion === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                Précédent
              </button>
              <button
                onClick={handleNext}
                disabled={!hasAnswered}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {currentQuestion === session.questions.length - 1 ? 'Terminer' : 'Suivant'}
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Calcul de tes résultats...</h2>
            <p className="text-muted-foreground">
              On analyse tes réponses et on les compare avec les votes réels des candidats.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {step === 'results' && results && (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            {/* Profile */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-2">Ton profil politique</h2>
              <div className="inline-block px-6 py-2 rounded-full bg-primary text-primary-foreground text-xl font-semibold">
                {results.profilPolitique}
              </div>
            </div>

            {/* Radar / Axes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {Object.entries(results.scoresAxes).map(([axe, score]) => (
                <div key={axe} className="rounded-lg border bg-card p-4 text-center">
                  <div className="text-sm text-muted-foreground mb-1">
                    {results.axesLabels[axe] || axe}
                  </div>
                  <div className={`text-2xl font-bold ${score < 0 ? 'text-blue-600' : score > 0 ? 'text-amber-600' : ''}`}>
                    {score > 0 ? '+' : ''}{score}
                  </div>
                </div>
              ))}
            </div>

            {/* Top matches */}
            <h3 className="text-2xl font-bold mb-6">Tes matchs candidats</h3>
            <p className="text-muted-foreground mb-6">
              Basé sur leurs VOTES et ACTES, pas leurs promesses
            </p>

            <div className="space-y-4">
              {results.resultats.slice(0, 5).map((result, index) => (
                <div
                  key={result.candidat.id}
                  className="rounded-xl border bg-card p-6 hover:border-primary transition-colors cursor-pointer"
                  onClick={() => router.push(`/simulateur/candidats/${result.candidat.slug}`)}
                >
                  <div className="flex items-center gap-4">
                    {/* Medal */}
                    <div className="text-3xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>

                    {/* Photo */}
                    <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {result.candidat.photoUrl ? (
                        <Image
                          src={result.candidat.photoUrl}
                          alt={`${result.candidat.prenom} ${result.candidat.nom}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg">
                        {result.candidat.prenom} {result.candidat.nom}
                      </h4>
                      <p className="text-sm text-muted-foreground">{result.candidat.parti}</p>

                      {/* Points forts / Divergences */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.pointsForts.slice(0, 2).map(pf => (
                          <span key={pf} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            ✓ {results.axesLabels[pf] || pf}
                          </span>
                        ))}
                        {result.divergences.slice(0, 1).map(d => (
                          <span key={d} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                            ⚠ {results.axesLabels[d] || d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">{result.matchScore}%</div>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${result.matchScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <button
                onClick={() => router.push('/simulateur/versus')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
              >
                ⚔️ Comparer les candidats
              </button>
              <button
                onClick={() => router.push('/simulateur/vie')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
              >
                Simule ta vie en 2032
              </button>
              <button
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Partager mes résultats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
