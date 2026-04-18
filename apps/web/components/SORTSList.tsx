'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const SORTS: { sort: string; label: string; description: string; color: string }[] = [
  // Vert — adopté
  { sort: 'Adopté', label: 'Adopté', description: "L'amendement est intégré au texte de loi.", color: 'bg-green-100 text-green-800' },
  { sort: 'Adopté modifié', label: 'Adopté modifié', description: "L'amendement est adopté avec des modifications apportées par le gouvernement ou la commission.", color: 'bg-green-100 text-green-800' },
  // Rouge — rejeté
  { sort: 'Rejeté', label: 'Rejeté', description: "L'amendement est refusé par la majorité des votants.", color: 'bg-red-100 text-red-800' },
  // Jaune — retiré
  { sort: 'Retiré', label: 'Retiré', description: "L'auteur retire son amendement avant le vote.", color: 'bg-yellow-100 text-yellow-800' },
  { sort: 'Retiré avant publication', label: 'Retiré avant publication', description: "L'auteur retire son amendement avant la publication du texte définitif.", color: 'bg-yellow-100 text-yellow-800' },
  { sort: 'Retiré après publication', label: 'Retiré après publication', description: "L'auteur retire son amendement après la publication du texte, le rendant sans effet.", color: 'bg-yellow-100 text-yellow-800' },
  // Orange — tombé / effacé
  { sort: 'Tombé', label: 'Tombé', description: "L'amendement devient sans objet car l'article visé a été supprimé ou modifié par un autre amendement adopté.", color: 'bg-orange-100 text-orange-800' },
  { sort: 'Effacé', label: 'Effacé', description: "L'amendement a été effacé du débat par décision du président de séance.", color: 'bg-orange-100 text-orange-800' },
  { sort: 'Entonnoir (45)', label: 'Entonnoir (45)', description: "Amendement devenu sans objet car l'article ou le texte qu'il visait a été adopté ou modifié.", color: 'bg-orange-100 text-orange-800' },
  // Ardoise — irrecevable / cavalier
  { sort: 'Irrecevable', label: 'Irrecevable', description: "Déclaré irrecevable par le président de séance (vice de forme, cavalier législatif, etc.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Cavalier (45)', label: 'Cavalier (45)', description: "Amendement sans lien direct avec le texte en discussion (article 45 de la Constitution).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Cavalier budgétaire', label: 'Cavalier budgétaire', description: "Variante du cavalier : amendement budgétairement irrecevable car créant une charge nouvelle sans compensation.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Cavalier social', label: 'Cavalier social', description: "Amendement cavalier portant sur un sujet sociaux et économiques sans lien direct avec le texte.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Irr en première partie', label: 'Irr en première partie', description: "Irrecevable en première lecture du texte.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Irr en seconde partie', label: 'Irr en seconde partie', description: "Irrecevable en seconde lecture du texte.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Autres irr LOLF', label: 'Autres irr LOLF', description: "Irrecevable au regard de la loi organique relative aux lois de finances (LOLF).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Autres irr LOLFSS', label: 'Autres irr LOLFSS', description: "Irrecevable au regard de la loi organique relative aux lois de financement de la sécurité sociale (LOLFSS).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Autre irrecevabilité', label: 'Autre irrecevabilité', description: "Motif d'irrecevabilité non spécifiquement catégorisé (domaine réglementaire, procédure, etc.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Autre irrecevabilité 40', label: 'Autre irrecevabilité 40', description: "Irrecevable pour un motif économique/financier spécifique (art. 40 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: "Champ de l'habilitation (38)", label: "Champ de l'habilitation (38)", description: "Irrecevable car sort du périmètre de l'habilitation législative accordée au gouvernement (art. 38 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Disposition réglementaire (37)', label: 'Disposition réglementaire (37)', description: "Irrecevable : la matière est de nature réglementaire et non législative (art. 37 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Domaine de la loi (41)', label: 'Domaine de la loi (41)', description: "Irrecevable : l'objet relève d'une loi organique ou empiète sur le domaine réservé aux lois organiques (art. 41 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Domaine loi organique (127)', label: 'Domaine loi organique (127)', description: "Irrecevable : l'objet relève du domaine des lois organiques (art. 127 Règl. AN).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Gage', label: 'Gage', description: "Irrecevable budgétairement : l'amendement créerait une charge nouvelle sans indiquer son financement (art. 40).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Crédits', label: 'Crédits', description: "Irrecevable : l'amendement réduirait les recettes ou créerait une dépense sans compenser (art. 40 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Hors champ', label: 'Hors champ', description: "Irrecevable car l'objet de l'amendement sort du périmètre du texte en discussion.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Hors-délais', label: 'Hors-délais', description: "Irrecevable car déposé après la deadline prévue par le règlement de l'assemblée.", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Injonction (20)', label: 'Injonction (20)', description: "Irrecevable : l'amendement porte sur une demande d'information ou d'injonction au gouvernement (art. 20 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Ordre du jour (48)', label: 'Ordre du jour (48)', description: "Irrecevable : l'amendement porte sur un sujet non inscrit à l'ordre du jour de la séance (art. 48 Const.).", color: 'bg-slate-100 text-slate-700' },
  { sort: 'Ratification traité (53)', label: 'Ratification traité (53)', description: "Irrecevable : l'amendement modifierait un traité de ratification (art. 53 Const.).", color: 'bg-slate-100 text-slate-700' },
  // Gris — autre
  { sort: 'Non soutenu', label: 'Non soutenu', description: "L'auteur ne défend pas son amendement lors de la discussion. Il est considéré comme abandonné.", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { sort: 'Satisfait ou inopérant (42)', label: 'Satisfait ou inopérant (42)', description: "L'amendement est sans objet car le texte visé a déjà été adopté dans une version équivalente (art. 42 Règl. AN).", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { sort: 'Doublon', label: 'Doublon', description: "Amendement identique à un autre déjà déposé ou déjà adopté.", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { sort: 'Sous-amendement', label: 'Sous-amendement', description: "Proposition de modification d'un amendement déjà déposé (art. 98 Règl. AN).", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { sort: 'A discuter', label: 'A discuter', description: "Amendement en attente de discussion par le président de séance.", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { sort: 'En traitement', label: 'En traitement', description: "Amendement en cours de traitement par les services de l'assemblée.", color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
];

const INITIAL_VISIBLE = 8;

export function SORTSList() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? SORTS : SORTS.slice(0, INITIAL_VISIBLE);
  const hiddenCount = SORTS.length - INITIAL_VISIBLE;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((item) => (
          <div key={item.sort} className="rounded-lg border bg-card p-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.color}`}>
              {item.label}
            </span>
            <p className="mt-2 text-sm">{item.description}</p>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Masquer
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Voir {hiddenCount} autres sorts
            </>
          )}
        </button>
      )}
    </>
  );
}
