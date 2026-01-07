// =============================================================================
// Client HATVP - Récupération des données de lobbying
// Répertoire des représentants d'intérêts
// Source: https://www.hatvp.fr/open-data-repertoire/
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { parse } from 'csv-parse/sync';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES - Structure des données HATVP
// =============================================================================

export interface HATVPRepresentant {
  identifiantNational: string;
  denomination: string;
  formeJuridique?: string;
  categorieOrganisation?: string;
  typeIdentifiantNational?: string;
  // L'identifiant national peut être le SIREN
  adresse?: {
    numero?: string;
    voie?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
  };
  lienSiteWeb?: string;
  lienPageTwitter?: string;
  lienPageFacebook?: string;
  activites?: HATVPActivite[];
  actionsRepresentationInteret?: HATVPActivite[];
  exercices?: HATVPExercice[];
  dirigeants?: HATVPResponsable[];
  collaborateurs?: HATVPResponsable[];
  domainesIntervention?: Array<{ label?: string }>;
  listSecteursActivites?: Array<{ label?: string }>;
  clients?: HATVPClient[];
}

export interface HATVPActivite {
  id?: string;
  typeAction?: string;
  objet?: string; // Description de l'action
  description?: string;
  dateDebut?: string;
  dateFin?: string;
  cadreIntervention?: string;
  decisions?: HATVPDecision[];
  decisionsConcernees?: HATVPDecision[];
  responsablesPublicsVises?: HATVPResponsablePublic[];
  reponsablesPublics?: HATVPResponsablePublic[]; // Note: typo dans l'API HATVP
}

export interface HATVPDecision {
  type?: string;
  intitule?: string;
  url?: string;
}

export interface HATVPResponsablePublic {
  nom?: string;
  prenom?: string;
  fonction?: string;
  categorie?: string;
}

export interface HATVPExercice {
  exerciceId?: string;
  annee?: number;
  chiffreAffaires?: number;
  montantDepense?: number; // Dépenses de lobbying
  depensesLobbying?: number;
  nombrePersonnes?: number;
  nombreSalaries?: number;
  nombreActivite?: number;
  tempsConsacre?: string;
}

export interface HATVPResponsable {
  nom?: string;
  prenom?: string;
  fonction?: string;
}

export interface HATVPClient {
  denomination?: string;
  siren?: string;
  activites?: HATVPActivite[];
}

export interface HATVPOpenData {
  publications: HATVPRepresentant[];
}

// =============================================================================
// CLIENT
// =============================================================================

export class HATVPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://www.hatvp.fr/agora/opendata';
    logger.info('HATVPClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading HATVP file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 300000, // 5 minutes pour gros fichiers
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        Accept: 'application/octet-stream, application/json, */*',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.debug({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });
    await execAsync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
      maxBuffer: 1024 * 1024 * 100,
    });
  }

  // ===========================================================================
  // GET DATA FROM CSV (More detailed than JSON)
  // ===========================================================================

  async getDataFromCSV(limit?: number): Promise<{
    lobbyistes: Array<{
      id: string;
      denomination: string;
      identifiantNational: string;
      typeIdentifiant: string;
      categorie: string;
      adresse: string | null;
      codePostal: string | null;
      ville: string | null;
      siteWeb: string | null;
      secteurs: string[];
      nbCollaborateurs: number;
    }>;
    activites: Array<{
      activiteId: string;
      exerciceId: string;
      lobbyisteId: string;
      objet: string;
      datePublication: string | null;
      domaines: string[];
    }>;
    exercices: Array<{
      exerciceId: string;
      lobbyisteId: string;
      dateDebut: string | null;
      dateFin: string | null;
      montantDepense: number | null;
      nombreActivite: number;
      nombreSalaries: number | null;
    }>;
    actionDetails: Array<{
      activiteId: string;
      actionId: string;
      typeActions: string[];
      cibles: Array<{ type: string; nom: string | null }>;
      decisions: string[];
    }>;
  }> {
    const csvUrl = `${this.baseUrl}/csv/Vues_Separees_CSV.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-hatvp-csv');
    const zipPath = path.join(tempDir, 'hatvp_csv.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      logger.info({ url: csvUrl }, 'Downloading HATVP CSV archive...');
      await this.downloadFile(csvUrl, zipPath);

      // Extract
      logger.info('Extracting CSV archive...');
      await this.extractZip(zipPath, extractDir);

      // Parse CSV files
      const csvDir = path.join(extractDir, 'Vues_Separees');

      // 1. Informations générales (lobbyistes)
      logger.info('Parsing informations_generales.csv...');
      const lobbyistesContent = await fs.promises.readFile(
        path.join(csvDir, '1_informations_generales.csv'),
        'utf-8'
      );
      const lobbyistesRaw = parse(lobbyistesContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const lobbyisteIds = new Set(lobbyistesRaw.slice(0, limit || undefined).map((r: any) => r.representants_id));

      // 2. Parse secteurs d'activité
      logger.info('Parsing secteurs_activites.csv...');
      const secteursContent = await fs.promises.readFile(
        path.join(csvDir, '9_secteurs_activites.csv'),
        'utf-8'
      );
      const secteursRaw = parse(secteursContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      // Group secteurs by lobbyiste
      const secteursByLobbyiste = new Map<string, string[]>();
      for (const row of secteursRaw) {
        if (!lobbyisteIds.has(row.representants_id)) continue;
        const list = secteursByLobbyiste.get(row.representants_id) || [];
        if (row.secteur_activite) list.push(row.secteur_activite);
        secteursByLobbyiste.set(row.representants_id, list);
      }

      // 3. Parse collaborateurs (pour compter nb lobbyistes)
      logger.info('Parsing collaborateurs.csv...');
      const collabContent = await fs.promises.readFile(
        path.join(csvDir, '3_collaborateurs.csv'),
        'utf-8'
      );
      const collabRaw = parse(collabContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      // Count collaborateurs by lobbyiste
      const collabCountByLobbyiste = new Map<string, number>();
      for (const row of collabRaw) {
        if (!lobbyisteIds.has(row.representants_id)) continue;
        const count = collabCountByLobbyiste.get(row.representants_id) || 0;
        collabCountByLobbyiste.set(row.representants_id, count + 1);
      }

      // Build lobbyistes with enriched data
      const lobbyistes = lobbyistesRaw
        .filter((row: any) => lobbyisteIds.has(row.representants_id))
        .map((row: any) => ({
          id: row.representants_id,
          denomination: row.denomination,
          identifiantNational: row.identifiant_national,
          typeIdentifiant: row.type_identifiant_national,
          categorie: row.label_categorie_organisation || 'Autre',
          adresse: row.adresse || null,
          codePostal: row.code_postal || null,
          ville: row.ville || null,
          siteWeb: row.site_web || null,
          secteurs: secteursByLobbyiste.get(row.representants_id) || [],
          nbCollaborateurs: collabCountByLobbyiste.get(row.representants_id) || 0,
        }));

      logger.info({ count: lobbyistes.length }, 'Lobbyistes loaded from CSV');

      // 4. Exercices
      logger.info('Parsing exercices.csv...');
      const exercicesContent = await fs.promises.readFile(
        path.join(csvDir, '15_exercices.csv'),
        'utf-8'
      );
      const exercicesRaw = parse(exercicesContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const exercices = exercicesRaw
        .filter((row: any) => lobbyisteIds.has(row.representants_id))
        .map((row: any) => {
          // Le budget est en fourchette: utiliser la borne inférieure (montant_depense_inf)
          // ou parser le texte "≥ X € et < Y €"
          let montantDepense: number | null = null;
          if (row.montant_depense_inf && !isNaN(parseFloat(row.montant_depense_inf))) {
            montantDepense = parseFloat(row.montant_depense_inf);
          } else if (row.montant_depense && typeof row.montant_depense === 'string') {
            // Try to extract first number from text like "≥ 75 000 € et < 100 000 €"
            const match = row.montant_depense.replace(/\s/g, '').match(/(\d+)/);
            if (match) montantDepense = parseInt(match[1], 10);
          }

          // Nombre de salariés peut être un float comme "1.0"
          let nombreSalaries: number | null = null;
          if (row.nombre_salaries) {
            nombreSalaries = Math.round(parseFloat(row.nombre_salaries));
          }

          return {
            exerciceId: row.exercices_id,
            lobbyisteId: row.representants_id,
            dateDebut: row.date_debut || null,
            dateFin: row.date_fin || null,
            montantDepense,
            nombreActivite: parseInt(row.nombre_activites || '0', 10),
            nombreSalaries,
          };
        });

      logger.info({ count: exercices.length }, 'Exercices loaded from CSV');

      // Create maps for linking
      const exerciceToLobbyiste = new Map<string, string>();
      for (const ex of exercices) {
        exerciceToLobbyiste.set(ex.exerciceId, ex.lobbyisteId);
      }
      const exerciceIds = new Set(exercices.map((e) => e.exerciceId));

      // 5. Objets d'activités
      logger.info('Parsing objets_activites.csv...');
      const activitesContent = await fs.promises.readFile(
        path.join(csvDir, '8_objets_activites.csv'),
        'utf-8'
      );
      const activitesRaw = parse(activitesContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      // 6. Domaines d'intervention par activité
      logger.info('Parsing domaines_intervention.csv...');
      const domainesContent = await fs.promises.readFile(
        path.join(csvDir, '7_domaines_intervention.csv'),
        'utf-8'
      );
      const domainesRaw = parse(domainesContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const domainesByActivite = new Map<string, string[]>();
      for (const row of domainesRaw) {
        const list = domainesByActivite.get(row.activite_id) || [];
        if (row.domaines_intervention_actions_menees) {
          list.push(row.domaines_intervention_actions_menees);
        }
        domainesByActivite.set(row.activite_id, list);
      }

      const activites = activitesRaw
        .filter((row: any) => exerciceIds.has(row.exercices_id))
        .map((row: any) => ({
          activiteId: row.activite_id,
          exerciceId: row.exercices_id,
          lobbyisteId: exerciceToLobbyiste.get(row.exercices_id) || '',
          objet: row.objet_activite || '',
          datePublication: row.date_publication_activite || null,
          domaines: domainesByActivite.get(row.activite_id) || [],
        }));

      logger.info({ count: activites.length }, 'Activites loaded from CSV');

      // 7. Observations (link between activite_id and action_representation_interet_id)
      logger.info('Parsing observations.csv...');
      const obsContent = await fs.promises.readFile(
        path.join(csvDir, '14_observations.csv'),
        'utf-8'
      );
      const obsRaw = parse(obsContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      // Map action_id -> activite_id(s)
      const actionToActivite = new Map<string, string>();
      const activiteToAction = new Map<string, string>();
      for (const row of obsRaw) {
        if (row.action_representation_interet_id && row.activite_id) {
          actionToActivite.set(row.action_representation_interet_id, row.activite_id);
          activiteToAction.set(row.activite_id, row.action_representation_interet_id);
        }
      }

      // 8. Actions menées (types d'actions)
      logger.info('Parsing actions_menees.csv...');
      const actionsMeneesContent = await fs.promises.readFile(
        path.join(csvDir, '10_actions_menees.csv'),
        'utf-8'
      );
      const actionsMeneesRaw = parse(actionsMeneesContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const typeActionsByActionId = new Map<string, string[]>();
      for (const row of actionsMeneesRaw) {
        const actionId = row.action_representation_interet_id;
        const list = typeActionsByActionId.get(actionId) || [];
        if (row.action_menee) list.push(row.action_menee);
        typeActionsByActionId.set(actionId, list);
      }

      // 9. Ministères/responsables publics (cibles)
      logger.info('Parsing ministeres_aai_api.csv...');
      const ministeresContent = await fs.promises.readFile(
        path.join(csvDir, '13_ministeres_aai_api.csv'),
        'utf-8'
      );
      const ministeresRaw = parse(ministeresContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const ciblesByActionId = new Map<string, Array<{ type: string; nom: string | null }>>();
      for (const row of ministeresRaw) {
        const actionId = row.action_representation_interet_id;
        const list = ciblesByActionId.get(actionId) || [];
        if (row.responsable_public || row.departement_ministeriel) {
          list.push({
            type: row.responsable_public || row.departement_ministeriel,
            nom: row.responsable_public_ou_dpt_ministeriel_autre || null,
          });
        }
        ciblesByActionId.set(actionId, list);
      }

      // 10. Décisions concernées
      logger.info('Parsing decisions_concernees.csv...');
      const decisionsContent = await fs.promises.readFile(
        path.join(csvDir, '12_decisions_concernees.csv'),
        'utf-8'
      );
      const decisionsRaw = parse(decisionsContent, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as any[];

      const decisionsByActionId = new Map<string, string[]>();
      for (const row of decisionsRaw) {
        const actionId = row.action_representation_interet_id;
        const list = decisionsByActionId.get(actionId) || [];
        if (row.decision_concernee) list.push(row.decision_concernee);
        decisionsByActionId.set(actionId, list);
      }

      // Build action details
      const activiteIds = new Set(activites.map((a) => a.activiteId));
      const actionDetails: Array<{
        activiteId: string;
        actionId: string;
        typeActions: string[];
        cibles: Array<{ type: string; nom: string | null }>;
        decisions: string[];
      }> = [];

      for (const [activiteId, actionId] of activiteToAction) {
        if (!activiteIds.has(activiteId)) continue;
        actionDetails.push({
          activiteId,
          actionId,
          typeActions: typeActionsByActionId.get(actionId) || [],
          cibles: ciblesByActionId.get(actionId) || [],
          decisions: decisionsByActionId.get(actionId) || [],
        });
      }

      logger.info({ count: actionDetails.length }, 'Action details loaded from CSV');

      return { lobbyistes, activites, exercices, actionDetails };
    } finally {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    }
  }

  // ===========================================================================
  // GET REPRESENTANTS
  // ===========================================================================

  async getRepresentants(limit?: number): Promise<HATVPRepresentant[]> {
    const jsonUrl = `${this.baseUrl}/agora_repertoire_opendata.json`;
    const tempDir = path.join(os.tmpdir(), 'clair-hatvp');
    const jsonPath = path.join(tempDir, 'hatvp_data.json');

    try {
      // Clean up previous temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      logger.info({ url: jsonUrl }, 'Downloading HATVP data...');
      await this.downloadFile(jsonUrl, jsonPath);

      // Check file size
      const stats = await fs.promises.stat(jsonPath);
      logger.info(
        { sizeBytes: stats.size, sizeMB: (stats.size / 1024 / 1024).toFixed(2) },
        'HATVP data downloaded'
      );

      // Parse JSON (streaming would be better for 80MB but this should work)
      logger.info('Parsing HATVP JSON...');
      const content = await fs.promises.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content) as HATVPOpenData;

      let representants = data.publications || [];
      logger.info({ total: representants.length }, 'Representants loaded');

      // Apply limit if specified
      if (limit && limit > 0) {
        representants = representants.slice(0, limit);
      }

      return representants;
    } finally {
      // Cleanup temp files
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // ===========================================================================
  // TRANSFORM TO DB FORMAT
  // ===========================================================================

  transformLobbyiste(raw: HATVPRepresentant): {
    sourceId: string;
    siren: string | null;
    nom: string;
    type: string;
    secteur: string | null;
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    budgetAnnuel: number | null;
    nbLobbyistes: number | null;
    siteWeb: string | null;
    sourceData: any;
  } {
    // Déterminer le type basé sur la catégorie
    const categorieMap: Record<string, string> = {
      'Société commerciale': 'entreprise',
      'Association': 'association',
      'Cabinet de conseil': 'cabinet',
      'Syndicat professionnel': 'syndicat',
      'Organisation professionnelle': 'organisation_pro',
      'Fondation': 'association',
      'Groupement d\'intérêt': 'organisation_pro',
      'Etablissement public': 'organisation_pro',
      'Fédération': 'organisation_pro',
      'Chambre consulaire': 'organisation_pro',
      'Avocat': 'cabinet',
      'Autre': 'entreprise',
    };

    const type = categorieMap[raw.categorieOrganisation || ''] || 'entreprise';

    // Calculer le budget et nombre de lobbyistes depuis le dernier exercice
    const exercices = Array.isArray(raw.exercices) ? raw.exercices : [];
    const dernierExercice = exercices
      .sort((a, b) => (b.annee || 0) - (a.annee || 0))[0];

    // Extraire les secteurs d'activité
    const secteurs = raw.listSecteursActivites || raw.domainesIntervention || [];
    const secteur = secteurs
      .map((s) => (typeof s === 'string' ? s : s?.label))
      .filter(Boolean)
      .join(', ') || null;

    // Construire l'adresse
    const adresse = raw.adresse
      ? [raw.adresse.numero, raw.adresse.voie].filter(Boolean).join(' ') || null
      : null;

    // Extraire le SIREN si le type d'identifiant est SIREN
    const siren = raw.typeIdentifiantNational === 'SIREN' ? raw.identifiantNational : null;

    return {
      sourceId: raw.identifiantNational,
      siren,
      nom: raw.denomination,
      type,
      secteur: secteur?.substring(0, 500) || null, // Limiter la taille
      adresse,
      codePostal: raw.adresse?.codePostal || null,
      ville: raw.adresse?.ville || null,
      budgetAnnuel: dernierExercice?.montantDepense || dernierExercice?.depensesLobbying || null,
      nbLobbyistes: dernierExercice?.nombreSalaries || dernierExercice?.nombrePersonnes || null,
      siteWeb: raw.lienSiteWeb || null,
      sourceData: raw,
    };
  }

  transformActions(
    raw: HATVPRepresentant,
    lobbyisteId: string
  ): Array<{
    lobbyisteId: string;
    cible: string | null;
    cibleNom: string | null;
    description: string;
    dateDebut: Date;
    dateFin: Date | null;
    texteVise: string | null;
    texteViseNom: string | null;
    sourceUrl: string | null;
  }> {
    const actions: Array<{
      lobbyisteId: string;
      cible: string | null;
      cibleNom: string | null;
      description: string;
      dateDebut: Date;
      dateFin: Date | null;
      texteVise: string | null;
      texteViseNom: string | null;
      sourceUrl: string | null;
    }> = [];

    // Helper pour s'assurer qu'on a un tableau
    const ensureArray = <T>(val: T | T[] | undefined | null): T[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    };

    // Extraire les activités depuis différentes sources possibles
    const activites = [
      ...ensureArray(raw.activites),
      ...ensureArray(raw.actionsRepresentationInteret),
    ];

    // Aussi extraire les activités des clients (pour les cabinets de conseil)
    const clients = ensureArray(raw.clients);
    const clientActivites = clients.flatMap((c) => [
      ...ensureArray(c?.activites),
    ]);

    for (const activite of [...activites, ...clientActivites]) {
      // Utiliser objet ou description comme description
      const descriptionBase = activite.objet || activite.description || activite.typeAction;
      if (!descriptionBase) continue;

      // Déterminer la cible - chercher dans les deux champs possibles
      let cible: string | null = null;
      let cibleNom: string | null = null;

      const responsables = activite.responsablesPublicsVises || activite.reponsablesPublics || [];
      const responsable = responsables[0];
      if (responsable) {
        const categorie = (responsable.categorie || responsable.fonction || '').toLowerCase();
        if (categorie.includes('député') || categorie.includes('assemblee') || categorie.includes('assemblée')) {
          cible = 'depute';
        } else if (categorie.includes('ministre') || categorie.includes('cabinet') || categorie.includes('gouvernement')) {
          cible = 'ministre';
        } else if (categorie.includes('sénat') || categorie.includes('senat')) {
          cible = 'senateur';
        } else {
          cible = 'administration';
        }
        cibleNom = [responsable.prenom, responsable.nom].filter(Boolean).join(' ') || null;
      }

      // Extraire les décisions visées - chercher dans les deux champs possibles
      const allDecisions = [...(activite.decisions || []), ...(activite.decisionsConcernees || [])];
      const decision = allDecisions[0];
      const texteVise = decision?.intitule || null;
      const texteViseNom = decision?.type || null;
      const sourceUrl = decision?.url || null;

      // Dates
      const dateDebut = activite.dateDebut ? new Date(activite.dateDebut) : new Date();
      const dateFin = activite.dateFin ? new Date(activite.dateFin) : null;

      // Vérifier que la date est valide
      if (isNaN(dateDebut.getTime())) continue;

      const description =
        descriptionBase ||
        [activite.typeAction, activite.cadreIntervention].filter(Boolean).join(' - ') ||
        'Action de représentation';

      actions.push({
        lobbyisteId,
        cible,
        cibleNom,
        description: description.substring(0, 2000), // Limiter la taille
        dateDebut,
        dateFin: dateFin && !isNaN(dateFin.getTime()) ? dateFin : null,
        texteVise: texteVise?.substring(0, 500) || null,
        texteViseNom: texteViseNom?.substring(0, 200) || null,
        sourceUrl,
      });
    }

    return actions;
  }
}

export default HATVPClient;
