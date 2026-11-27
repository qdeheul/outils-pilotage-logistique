//début code site
/**
 * DÉMO (données fictives) – RÉCEPTION + SUIVI TRACTION
 */

var NOM_ONGLET_DATA = "Data volumes";
var NOM_ONGLET_LIVE = "Réception live";

/**
 * LECTURE DU DASHBOARD SECTEUR
 */
function getRecepDashboardData(secteur) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLive = ss.getSheetByName(NOM_ONGLET_LIVE);
    var sheetData = ss.getSheetByName(NOM_ONGLET_DATA) || ss.getSheetByName("Data Volumes");
    if (!sheetData) throw new Error("Onglet 'Data volumes' introuvable.");

    var colIndexDataSector;
    var colNumLiveSector;
    switch(String(secteur)) {
      case '87': colIndexDataSector = 6; colNumLiveSector = 6; break;
      case '89': colIndexDataSector = 7; colNumLiveSector = 7; break;
      case '90': colIndexDataSector = 8; colNumLiveSector = 8; break;
      case '86':
      default:   colIndexDataSector = 5; colNumLiveSector = 5; break;
    }

    var totalAReceptionnerLive = 0;
    var enAcheminementLive = 0;
    if (sheetLive && sheetLive.getLastRow() >= 3) {
      var liveVals = sheetLive.getRange(2, colNumLiveSector, 2, 1).getValues();
      totalAReceptionnerLive = Number(liveVals[0][0]) || 0;
      enAcheminementLive = Number(liveVals[1][0]) || 0;
    }

    var data = sheetData.getDataRange().getValues();
    var now = new Date();
    // DÉMO : "aujourd'hui" = dernière date archivée, pour que la démo ne se vide jamais
    var derniereDate = null;
    for (var k = 1; k < data.length; k++) {
      if (data[k][0] instanceof Date && (!derniereDate || data[k][0] > derniereDate)) derniereDate = data[k][0];
    }
    if (derniereDate) now = derniereDate;
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var fiveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 0, 0, 0);
    var tz = Session.getScriptTimeZone();

    var sommeAC_J_a_J5 = 0;
    var rowsResult = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      var rowDate = parseDateValue(row[0]);
      if (!rowDate || rowDate < fiveDaysAgo) continue;
      if (!isRowInSector(row, secteur, colIndexDataSector)) continue;

      var qteAC = Number(row[28]) || 0;
      if (qteAC <= 0) continue;

      sommeAC_J_a_J5 += qteAC;

      var isToday = (rowDate >= todayStart);
      var rowDateStr = Utilities.formatDate(rowDate, tz, "yyyy-MM-dd");

      var traveeW = (row[22] !== undefined && row[22] !== null) ? String(row[22]).trim() : '';
      var traveeX = (row[23] !== undefined && row[23] !== null) ? String(row[23]).trim() : '';
      var traveeFinale = traveeW !== '' ? traveeW : (traveeX !== '' ? traveeX : '-');

      var hPrevueRaw = row[1];
      var hArriveeRaw = row[12];
      var hDechargementRaw = row[18];
      var hHorsPromesseRaw = row[25];

      rowsResult.push({
        rowIndex: i + 1,
        rowDateStr: rowDateStr,
        numExpedition: cleanString(row[2]) || cleanString(row[4]) || '-',
        quantite: qteAC,
        travee: traveeFinale,
        hPrevue: formatTimeOrDateTime(rowDate, hPrevueRaw, isToday),
        hPrevueTime: formatDate(hPrevueRaw),
        hArrivee: formatDate(hArriveeRaw),
        hDechargement: formatDate(hDechargementRaw),
        hHorsPromesse: formatDate(hHorsPromesseRaw),
        sortTimestamp: getCombinedTimestamp(rowDate, hArriveeRaw || hPrevueRaw)
      });
    }

    rowsResult.sort(function(a, b) {
      return a.sortTimestamp - b.sortTimestamp;
    });

    return {
      kpis: {
        totalSecteur: formatNumber(totalAReceptionnerLive),
        receptionnee: formatNumber(sommeAC_J_a_J5),
        restante: formatNumber(enAcheminementLive),
        totalCamions: rowsResult.length
      },
      rows: rowsResult,
      demoNowMs: now.getTime() // DÉMO : heure de référence pour le calcul hors promesse
    };
  } catch (e) {
    Logger.log("Erreur getRecepDashboardData : " + e.toString());
    throw new Error(e.message);
  }
}

function isRowInSector(row, secteurCode, colIdx) {
  var valAtCol = row[colIdx];
  if (valAtCol !== '' && valAtCol !== null && valAtCol !== undefined) {
    if (!isNaN(valAtCol) && Number(valAtCol) > 0) return true;
    if (String(valAtCol).trim() === String(secteurCode)) return true;
  }
  return false;
}

function parseDateValue(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0);
  }
  if (typeof val === 'number') {
    var d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  }
  return null;
}

function formatTimeOrDateTime(rowDate, timeVal, isToday) {
  var timeStr = formatDate(timeVal);
  if (isToday || !rowDate) return timeStr;
  var day = ("0" + rowDate.getDate()).slice(-2);
  var month = ("0" + (rowDate.getMonth() + 1)).slice(-2);
  return day + "/" + month + " " + timeStr;
}

function getCombinedTimestamp(rowDate, timeVal) {
  var base = rowDate ? rowDate.getTime() : 0;
  var timeMs = normalizeTime(timeVal);
  return base + (timeMs < 9999999999999 ? (timeMs % 86400000) : 0);
}

function cleanString(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') return val.toFixed(0);
  return String(val).trim();
}

function normalizeTime(dateVal) {
  if (!dateVal) return 9999999999999;
  if (typeof dateVal === 'string') {
    var match = dateVal.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      var temp = new Date();
      temp.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
      return temp.getTime();
    }
  }
  if (dateVal instanceof Date) return dateVal.getTime();
  return 9999999999999;
}

function formatDate(val) {
  if (!val && val !== 0) return '-';
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  return String(val);
}

function formatNumber(val) {
  if (val === '' || val === null || val === undefined) return '0';
  if (typeof val === 'number') return Math.round(val).toLocaleString('fr-FR');
  return String(val);
}

function getWeekNumber(d) {
  var target = new Date(d.valueOf());
  var dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  var firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function getFirstEmptyRowInColumn(sheet, columnNumber) {
  var values = sheet.getRange(1, columnNumber, Math.max(sheet.getLastRow(), 1) + 1, 1).getValues();
  for (var i = 2; i < values.length; i++) {
    if (values[i][0] === "" || values[i][0] === null || values[i][0] === undefined) return i + 1;
  }
  return values.length + 1;
}

/**
 * ARCHIVAGE CONTINU (VERSION DEBUG)
 */
function archiverDataVolumes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOM_ONGLET_LIVE);
  if (!sheet) {
    Logger.log("❌ Erreur : Onglet source 'Réception live' introuvable.");
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 3) {
    Logger.log("⚠️ Aucune donnée à traiter dans Réception live.");
    return;
  }

  var archiveSheet = ss.getSheetByName(NOM_ONGLET_DATA);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(NOM_ONGLET_DATA);
    var headers = data[0];
    var archiveHeaders = ["Date archivage"].concat(headers);
    while (archiveHeaders.length < 27) archiveHeaders.push("");
    archiveHeaders[26] = "Semaine";
    archiveSheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]).setFontWeight("bold").setBackground("#F0F4F9");
    Logger.log("✅ Onglet Data volumes créé.");
  }

  var archiveData = archiveSheet.getDataRange().getValues();
  var existingKeysMap = {};
  
  for (var a = 1; a < archiveData.length; a++) {
    var expeKey = String(archiveData[a][2] || '').trim();
    var refKey = String(archiveData[a][4] || '').trim();
    var uniqueKey = expeKey || refKey;
    if (uniqueKey) {
      if (!existingKeysMap[uniqueKey]) {
        existingKeysMap[uniqueKey] = a + 1;
      }
    }
  }

  Logger.log("✅ Démarrage. Camions repérés en archive : " + Object.keys(existingKeysMap).length);
  
  var now = new Date();
  var dateArchivage = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  var numSemaine = getWeekNumber(now);
  var newRowsToAppend = [];
  var targetColCount = Math.max(sheet.getLastColumn() + 1, 27);
  var updateCount = 0;
  var newCount = 0;

  for (var i = 3; i < data.length; i++) {
    var row = data[i];
    
    var isColXChecked = (row[23] === true || String(row[23]).trim().toUpperCase() === 'TRUE');
    if (!isColXChecked) continue;

    var numExpe = String(row[1] || '').trim();
    var refCamion = String(row[3] || '').trim();
    var truckKey = numExpe || refCamion;
    if (!truckKey) continue;

    if (existingKeysMap[truckKey]) {
      var archiveRowIndex = existingKeysMap[truckKey];
      var originalDateArchivage = archiveData[archiveRowIndex - 1][0];
      
      var updatedRow = [originalDateArchivage].concat(row);
      while (updatedRow.length < targetColCount) updatedRow.push("");
      updatedRow[26] = numSemaine;

      archiveSheet.getRange(archiveRowIndex, 1, 1, targetColCount).setValues([updatedRow]);
      
      for (var col = 0; col < targetColCount; col++) {
        if (typeof updatedRow[col] === 'boolean') {
          archiveSheet.getRange(archiveRowIndex, col + 1).insertCheckboxes();
        }
      }
      Logger.log("🔄 Ligne écrasée -> Expe: " + truckKey + " (Ligne " + archiveRowIndex + ")");
      updateCount++;
      continue;
    }

    var newRow = [dateArchivage].concat(row);
    while (newRow.length < targetColCount) newRow.push("");
    newRow[26] = numSemaine;
    newRowsToAppend.push(newRow);
    Logger.log("➕ Nouveau camion préparé -> Expe: " + truckKey);
    newCount++;
  }

  if (newRowsToAppend.length > 0) {
    var startRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(startRow, 1, newRowsToAppend.length, targetColCount).setValues(newRowsToAppend);
    for (var c = 0; c < targetColCount; c++) {
      if (typeof newRowsToAppend[0][c] === 'boolean') {
        archiveSheet.getRange(startRow, c + 1, newRowsToAppend.length, 1).insertCheckboxes();
      }
    }
    Logger.log("✅ " + newCount + " nouveaux camions injectés tout en bas.");
  }
  
  Logger.log("🏁 Fin de l'archivage. Mises à jour : " + updateCount + " | Nouveaux : " + newCount);
}
// fin code site 
/**
 * Calcule le numéro de semaine sous forme de nombre (Dimanche = 1er jour)
 */
function getSemaineDimanche(d) {
  var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var jan1 = new Date(target.getFullYear(), 0, 1);
  var dayOfWeekJan1 = jan1.getDay(); // 0 = Dimanche
  var dayOfYear = Math.floor((target - jan1) / (24 * 60 * 60 * 1000));
  return Math.floor((dayOfYear + dayOfWeekJan1) / 7) + 1;
}

/**
 * Fonction principale :
 * - Lit les fichiers Excel récents du Drive
 * - Filtre et extrait les données de "Data volumes" (exclusion de préfixes de test)
 * - Gère l'heure d'arrivée (Priorité colonne M de Sheets, secours sur Excel)
 * - Écrit dans "EditReporting" en préservant le calcul automatique de la colonne K
 */
/**
 * =========================================================================
 * CONSOLIDATION GLOBALE : DRIVE (EXCEL) + DATA VOLUMES -> EDITREPORTING
 * =========================================================================
 */
function executerConsolidationExcelSheets() {
  // DÉMO : chargement unique du jeu de données fictif v3 (sept.-nov.)
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('demoV3') !== 'ok') {
    chargerDonneesDemo();
    props.setProperty('demoV3', 'ok');
  }
  if (props.getProperty('demoRaq2') !== 'ok') {
    chargerRaqDemo();
    props.setProperty('demoRaq2', 'ok');
  }
  const DOSSIER_DRIVE_ID = "1vWeQ6C524RsQ6NiD9UrlCxZ0CtD7-EXS"; 

  const FEUILLE_LOCAL_NOM = "Data volumes"; 
  const FEUILLE_CIBLE_NOM = "EditReporting"; 

  // 10 colonnes Google Sheets conservées (C, F, G, H, I, K, AA, R, U, V)
  const INDEX_COLONNES_SHEETS_A_GARDER = [2, 5, 6, 7, 8, 10, 26, 17, 20, 21]; 
  const INDEX_CLE_SHEETS = 2; // Colonne C (Clé d'expédition)
  const INDEX_SECOURS_HEURE_SHEETS = 12; // Colonne M (Heure de secours)

  // Extraction du logiciel de RDV : H (7), BL (63), BM (64), BO (66), B (1), O (14)
  const INDEX_CLES_EXCEL_POSSIBLES = [35, 54]; 
  const INDEX_COLONNES_EXCEL_A_GARDER = [7, 63, 64, 66,1,14]; 
  const POSITION_HEURE_ARRIVEE_EXCEL = 3; 

  const LIGNE_ENTETES_EXCEL = 20;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleLocal = ss.getSheetByName(FEUILLE_LOCAL_NOM);
  
  if (!feuilleLocal) {
    throw new Error("L'onglet source '" + FEUILLE_LOCAL_NOM + "' est introuvable.");
  }

  Logger.log("1. Lecture des fichiers Excel du Drive...");
  const extractionExcel = lireTousLesFichiersExcelDuDossier(DOSSIER_DRIVE_ID, LIGNE_ENTETES_EXCEL);
  const donneesExcelCumulees = extractionExcel.donnees;

  Logger.log("2. Lecture de l'onglet source Data volumes...");
  const donneesSheets = feuilleLocal.getDataRange().getValues();

  if (donneesSheets.length <= 1) {
    Logger.log("Aucune donnée trouvée dans Data volumes.");
    return;
  }

  // En-têtes personnalisés pour EditReporting (Colonnes A à O)
  const entetesConsolidees = [
    "N° d'expédition",
    "Type produit 1",
    "Type produit 2",
    "Type produit 3",
    "Type produit 4",
    "Type produit prioritaire",
    "Semaines",
    "Palettes Annoncées",
    "Palettes Réelles",
    "PAL non-conforme (- de B)",
    "Expéditeur",
    "Contenu",
    "Date prévue",
    "Heure prévue",
    "Heure d'arrivée",
    "Réference camion",
    "Transporteur"
  ];

  // Indexation des données Excel (les fichiers récents priment)
  Logger.log("3. Indexation des correspondances Excel...");
  const hashMapExcel = new Map();
  const timeZone = ss.getSpreadsheetTimeZone();
  
  for (let i = 0; i < donneesExcelCumulees.length; i++) {
    const ligne = donneesExcelCumulees[i];
    const valeursExcelCibles = INDEX_COLONNES_EXCEL_A_GARDER.map(function(idx) {
      return formaterValeurCellule(ligne[idx], timeZone);
    });

    INDEX_CLES_EXCEL_POSSIBLES.forEach(function(idxCle) {
      if (ligne[idxCle] !== undefined && ligne[idxCle] !== null) {
        const cle = String(ligne[idxCle]).replace(/\s+/g, "").toLowerCase().replace(/\.0$/, "");
        if (cle !== "") {
          if (hashMapExcel.has(cle)) {
            const existant = hashMapExcel.get(cle);
            const fusion = valeursExcelCibles.map(function(val, pos) {
              return val !== "" ? val : existant[pos];
            });
            hashMapExcel.set(cle, fusion);
          } else {
            hashMapExcel.set(cle, valeursExcelCibles);
          }
        }
      }
    });
  }

  // Filtrage et constitution des blocs de données
  Logger.log("4. Filtrage et exclusion stricte...");
  const blocSheets = [];
  const blocExcel = [];
  const REGEX_EXCLUSION = /^(17|36|76|81|88|32|890)/;

  let correspondancesTrouvees = 0;

  for (let i = 1; i < donneesSheets.length; i++) {
    const ligneSheets = donneesSheets[i];
    
    // Nettoyage rigoureux de la clé Sheets (colonne C)
    const rawCle = ligneSheets[INDEX_CLE_SHEETS];
    const cleSheets = String(rawCle === undefined || rawCle === null ? "" : rawCle)
      .trim()
      .replace(/\s+/g, "")
      .replace(/\.0$/, "");

    // Exclusion des lignes indésirables
    if (cleSheets === "" || cleSheets === "-" || REGEX_EXCLUSION.test(cleSheets)) {
      continue;
    }

    // Récupération des 10 colonnes Sheets
    const ligneSheetsFiltree = INDEX_COLONNES_SHEETS_A_GARDER.map(function(idx) {
      return formaterValeurCellule(ligneSheets[idx], timeZone);
    });

    // Recherche dans la HashMap Excel (comparaison stricte en minuscules)
    let valeursExcel = new Array(INDEX_COLONNES_EXCEL_A_GARDER.length).fill("");
    const cleRecherche = cleSheets.toLowerCase();

    if (hashMapExcel.has(cleRecherche)) {
      correspondancesTrouvees++;
      valeursExcel = hashMapExcel.get(cleRecherche).slice();
    }

    // Priorité à la colonne M de Sheets pour l'heure d'arrivée
    const heureSheets = formaterValeurCellule(ligneSheets[INDEX_SECOURS_HEURE_SHEETS], timeZone);
    if (heureSheets !== "") {
      valeursExcel[POSITION_HEURE_ARRIVEE_EXCEL] = heureSheets;
    }

    blocSheets.push(ligneSheetsFiltree);
    blocExcel.push(valeursExcel);
  }

  Logger.log("Nombre de lignes retenues : " + blocSheets.length);
  Logger.log("Nombre de correspondances trouvées avec Excel : " + correspondancesTrouvees);
  Logger.log("5. Écriture finale dans EditReporting...");
  ecrireResultatsAvecFormuleK(ss, FEUILLE_CIBLE_NOM, entetesConsolidees, blocSheets, blocExcel);
  Logger.log("Synchronisation terminée avec succès !");
}

/**
 * Gère l'écriture dans la feuille cible :
 * - Purge toutes les anciennes données sous la ligne 1
 * - Pose les en-têtes
 * - Injecte la formule en K2
 * - Écrit les blocs Sheets (A à J) et Excel (L à O)
 */
function ecrireResultatsAvecFormuleK(ss, nomOnglet, entetes, blocSheets, blocExcel) {
  let feuilleCible = ss.getSheetByName(nomOnglet);
  if (!feuilleCible) {
    feuilleCible = ss.insertSheet(nomOnglet);
  }

  const maxLignes = feuilleCible.getMaxRows();
  const nbLignesDonnees = blocSheets.length;
  // Détecte automatiquement la largeur exacte des données Excel (ici 5 colonnes)
  const nbColExcel = blocExcel.length > 0 ? blocExcel[0].length : 5; 

  // Nettoyage complet sous la ligne 1
  if (maxLignes > 1) {
    feuilleCible.getRange(2, 1, maxLignes - 1, 10).clearContent(); // Colonnes A à J
    if (maxLignes > 2) {
      feuilleCible.getRange(3, 11, maxLignes - 2, 1).clearContent(); // Colonne K sous la formule
    }
    // Nettoie à partir de la colonne 12 (colonne L) sur la largeur exacte
    feuilleCible.getRange(2, 12, maxLignes - 1, nbColExcel).clearContent(); 
  }

  // Écriture des en-têtes
  feuilleCible.getRange(1, 1, 1, entetes.length)
    .setValues([entetes])
    .setFontWeight("bold")
    .setBackground("#e8f0fe");

  // Formule K2
 const formuleK2 = `=MAP(A2:A; LAMBDA(c; IF(c = ""; ""; IF(LEFT(c; 3) = "489"; "ENTREPÔT 7"; SWITCH(LEFT(c; 2); "41"; "ENTREPÔT 1"; "42"; "ENTREPÔT 2"; "43"; "ENTREPÔT 3"; "44"; "ENTREPÔT 4"; "45"; "ENTREPÔT 5"; "46"; "ENTREPÔT 6"; "")))))`;
feuilleCible.getRange("K2").setFormula(formuleK2);

  // Écriture des données
  if (nbLignesDonnees > 0) {
    feuilleCible.getRange(2, 1, nbLignesDonnees, 10).setValues(blocSheets);
    feuilleCible.getRange(2, 12, nbLignesDonnees, nbColExcel).setValues(blocExcel);
  }
}

/**
 * Lecture, conversion et tri chronologique des extraits Excel stockés dans Drive
 */
function lireTousLesFichiersExcelDuDossier(dossierId, ligneEntetes) {
  const dossier = DriveApp.getFolderById(dossierId);
  const listeFichiers = [];
  // Extractions déjà au format Google Sheets : lues directement (pas besoin du service Drive)
  const fichiersSheets = dossier.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (fichiersSheets.hasNext()) {
    const f = fichiersSheets.next();
    listeFichiers.push({ file: f, dateModif: f.getLastUpdated().getTime(), estSheets: true });
  }
  // Extractions .csv : lues directement
  const fichiersCsv = dossier.getFilesByType(MimeType.CSV);
  while (fichiersCsv.hasNext()) {
    const f = fichiersCsv.next();
    listeFichiers.push({ file: f, dateModif: f.getLastUpdated().getTime(), estCsv: true });
  }
  // Extractions .xlsx : converties via le service Drive (ignorées s'il y a déjà des CSV ou des Google Sheets)
  const fichiers = listeFichiers.length ? { hasNext: function () { return false; } } : dossier.getFilesByType(MimeType.MICROSOFT_EXCEL);
  while (fichiers.hasNext()) {
    const f = fichiers.next();
    listeFichiers.push({ file: f, dateModif: f.getLastUpdated().getTime(), estSheets: false });
  }

  // Tri chronologique : le fichier le plus récent écrase les doublons antérieurs
  listeFichiers.sort(function(a, b) {
    return a.dateModif - b.dateModif;
  });

  let donneesCumulees = [];
  let entetes = [];

  for (let i = 0; i < listeFichiers.length; i++) {
    const fichierExcel = listeFichiers[i].file;

    if (listeFichiers[i].estCsv) {
      const valeursC = Utilities.parseCsv(fichierExcel.getBlob().getDataAsString('UTF-8'));
      if (valeursC.length >= ligneEntetes) {
        if (entetes.length === 0) entetes = valeursC[ligneEntetes - 1];
        donneesCumulees = donneesCumulees.concat(valeursC.slice(ligneEntetes));
      }
      continue;
    }

    if (listeFichiers[i].estSheets) {
      const valeursS = SpreadsheetApp.openById(fichierExcel.getId()).getSheets()[0].getDataRange().getValues();
      if (valeursS.length >= ligneEntetes) {
        if (entetes.length === 0) entetes = valeursS[ligneEntetes - 1];
        donneesCumulees = donneesCumulees.concat(valeursS.slice(ligneEntetes));
      }
      continue;
    }

    const blob = fichierExcel.getBlob();

    const ressourceFichier = {
      title: "temp_convert_" + fichierExcel.getName(),
      mimeType: MimeType.GOOGLE_SHEETS
    };

    let tempFile;
    try {
      // Compatible Drive API v3 et v2
      if (Drive.Files.create) {
        // Syntaxe Drive v3
        tempFile = Drive.Files.create(
          { name: "temp_convert_" + fichierExcel.getName(), mimeType: MimeType.GOOGLE_SHEETS },
          blob
        );
      } else {
        // Syntaxe Drive v2
        tempFile = Drive.Files.insert(
          { title: "temp_convert_" + fichierExcel.getName(), mimeType: MimeType.GOOGLE_SHEETS },
          blob,
          { convert: true }
        );
      }

      const tempSs = SpreadsheetApp.openById(tempFile.id);
      const tempFeuille = tempSs.getSheets()[0];
      const valeurs = tempFeuille.getDataRange().getValues();

      if (valeurs.length >= ligneEntetes) {
        if (entetes.length === 0) {
          entetes = valeurs[ligneEntetes - 1]; // Ligne 20 pour les en-têtes Excel
        }
        const lignesDonnees = valeurs.slice(ligneEntetes); // Données à partir de la ligne 21
        donneesCumulees = donneesCumulees.concat(lignesDonnees);
      }
    } catch (e) {
      Logger.log("Erreur de conversion sur " + fichierExcel.getName() + " : " + e.message);
    } finally {
      if (tempFile && tempFile.id) {
        try {
          if (Drive.Files.remove) {
            Drive.Files.remove(tempFile.id); // v3
          } else if (Drive.Files.trash) {
            Drive.Files.trash(tempFile.id); // v2
          }
        } catch (errSup) {}
      }
    }
  }

  return {
    donnees: donneesCumulees,
    entetes: entetes
  };
}

/**
 * Nettoyage et formatage uniforme des cellules (dates, heures, textes)
 */
/**
 * Nettoyage et formatage uniforme des cellules.
 * Si l'année est 1899 (heure pure), extrait uniquement HH:mm.
 */
function formaterValeurCellule(valeur, timeZone) {
  if (valeur === undefined || valeur === null) {
    return "";
  }

  if (valeur instanceof Date) {
    // Si l'année est 1899 ou 1900, il s'agit d'une heure pure
    if (valeur.getFullYear() <= 1900) {
      return Utilities.formatDate(valeur, timeZone, "HH:mm");
    }
    // Sinon, c'est une vraie date complète
    return Utilities.formatDate(valeur, timeZone, "dd/MM/yyyy HH:mm");
  }

  // Cas où la valeur arrive déjà sous forme de texte brut avec la date 1899
  const texte = String(valeur).trim();
  if (/1899/.test(texte)) {
    const matchHeure = texte.match(/(\d{1,2}:\d{2})/);
    if (matchHeure) {
      return matchHeure[1];
    }
  }

  return texte;
}
// SITE 2
function doGet(e) {
  // ?page=site2 -> Suivi Traction ; sinon -> tableau de bord Réception
  if (e && e.parameter && e.parameter.page === "site2") {
    return HtmlService.createHtmlOutputFromFile('site2')
      .setTitle('Suivi Traction - Démo')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Réception - Démo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("EditReporting");
  if (!sheet) {
    throw new Error("L'onglet 'EditReporting' est introuvable.");
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(h => String(h).trim().toLowerCase());
  // Filtre anti-lignes fantômes
  const rows = data.slice(1).filter(r => r.join("").trim() !== "");

  const findIdx = (terms) => headers.findIndex(h => terms.some(t => h === t.toLowerCase() || h.includes(t.toLowerCase())));

  const idxExp = findIdx(["n° d'expédition", "expédition"]); 
  const idxSem = findIdx(["semaines", "semaine"]); 
  const idxPalAnn = findIdx(["palettes annoncées", "annoncées"]); 
  const idxPalReel = findIdx(["palettes réelles", "réelles"]); 
  const idxPalB = findIdx(["pal non-conforme", "(- de b)"]); 
  const idxCac = findIdx(["expéditeur", "cac"]); 
  const idxDate = findIdx(["date prévue", "date"]); 
  const idxTransporteur = findIdx(["transporteur"]); 
  
  const idxTraction = findIdx(["traction"]); 
  const idxLogiciel = findIdx(["contenu logiciel"]); 
  const idxSlots = findIdx(["traction créneaux", "créneaux", "traction nok (hors slots)", "hors slots"]); 

  const idxR15 = findIdx(["15-45"]); 
  const idxR45 = findIdx(["45-1h30", "45-90"]); 
  const idxR90 = findIdx(["+1h30", "+ 90", "+90"]); 

  // Nouvelles colonnes pour la Pop-up
  const idxHeurePrevue = findIdx(["heure prévue", "heure prevue"]); 
  const idxHeureArrivee = findIdx(["heure d'arrivée", "heure arrivee", "heure arrivée"]); 
  let idxRefCamion = findIdx(["référence camion", "ref camion", "référence"]);
  if (idxRefCamion === -1) idxRefCamion = 15; // Colonne P par défaut

  return rows.map(r => {
    const cac = idxCac !== -1 ? String(r[idxCac]).trim() : 'Inconnu';
    const exp = idxExp !== -1 ? String(r[idxExp]) : '';
    const transporteur = idxTransporteur !== -1 && r[idxTransporteur] ? String(r[idxTransporteur]).trim() : 'Non assigné';

    const rawDate = idxDate !== -1 ? r[idxDate] : '';
    const hasDate = rawDate !== '' && rawDate !== null && rawDate !== undefined && String(rawDate).trim() !== '';

    let dTimestamp = 0;
    let sem = idxSem !== -1 && r[idxSem] !== '' ? String(r[idxSem]).replace(/^s/i, '').trim() : '';
    let mois = '';
    let dateStr = '';

    if (hasDate) {
      let d = null;
      if (rawDate instanceof Date && !isNaN(rawDate)) {
        d = rawDate;
      } else if (typeof rawDate === 'string' && rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
      }

      if (d && !isNaN(d)) {
        dTimestamp = d.getTime();
        mois = d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
        dateStr = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
        if (!sem) {
          const target = new Date(d.valueOf());
          const dayNr = (d.getDay() + 6) % 7;
          target.setDate(target.getDate() - dayNr + 3);
          const firstThu = target.valueOf();
          target.setMonth(0, 1);
          if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
          sem = String(1 + Math.ceil((firstThu - target) / 604800000));
        }
      } else {
        dateStr = String(rawDate);
      }
    }

    // Gestion robuste des heures (convertit les dates, décimales Excel ou Strings en "HH:MM")
    const parseHeure = (rawVal) => {
      if (rawVal instanceof Date && !isNaN(rawVal)) {
        return ("0" + rawVal.getHours()).slice(-2) + ":" + ("0" + rawVal.getMinutes()).slice(-2);
      } else if (typeof rawVal === 'number' && rawVal >= 0 && rawVal <= 1) {
        let totalMins = Math.round(rawVal * 24 * 60);
        let h = Math.floor(totalMins / 60) % 24;
        let m = totalMins % 60;
        return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2);
      } else if (rawVal) {
        let str = String(rawVal).trim();
        if (/^\d{1,2}:\d{2}/.test(str)) return str.substring(0, 5);
        return str;
      }
      return "";
    };

    let heureStr = parseHeure(idxHeurePrevue !== -1 ? r[idxHeurePrevue] : '');
    let heureArriveeStr = parseHeure(idxHeureArrivee !== -1 ? r[idxHeureArrivee] : '');
    let refCamion = String(r[idxRefCamion] || '').trim();

    // Calcul de la durée exacte du retard
    let dureeExacteStr = "";
    if (heureStr && heureArriveeStr && heureStr.includes(':') && heureArriveeStr.includes(':')) {
      const partsP = heureStr.split(':');
      const partsA = heureArriveeStr.split(':');
      if (partsP.length >= 2 && partsA.length >= 2) {
          let minsP = parseInt(partsP[0], 10) * 60 + parseInt(partsP[1], 10);
          let minsA = parseInt(partsA[0], 10) * 60 + parseInt(partsA[1], 10);
          
          if (minsA < minsP) minsA += 24 * 60; // Gère les retards passés minuit
          
          let diff = minsA - minsP;
          if (diff > 0) {
            let diffH = Math.floor(diff / 60);
            let diffM = diff % 60;
            if (diffH > 0) {
              dureeExacteStr = diffH + "h" + ("0" + diffM).slice(-2);
            } else {
              dureeExacteStr = diffM + " min";
            }
          }
      }
    }

    const rawAnn = idxPalAnn !== -1 ? r[idxPalAnn] : '';
    const rawReel = idxPalReel !== -1 ? r[idxPalReel] : '';
    const palAnn = Number(rawAnn) || 0;
    const palReel = Number(rawReel) || 0;
    const isPalReelNotNull = (rawReel !== '' && rawReel !== null && rawReel !== undefined && String(rawReel).trim() !== '');
    const isPalEcart = isPalReelNotNull && (Number(palReel) !== Number(palAnn));
    const palBVal = idxPalB !== -1 ? (Number(r[idxPalB]) || 0) : 0;

    const isR15 = idxR15 !== -1 && Number(r[idxR15]) === 1;
    const isR45 = idxR45 !== -1 && Number(r[idxR45]) === 1;
    const isR90 = idxR90 !== -1 && Number(r[idxR90]) === 1;
    const isRetard = isR15 || isR45 || isR90;

    const parseTractionVal = (val) => {
      if (val === "" || val === null || val === undefined || String(val).trim() === "") return 1; 
      return Number(val);
    };

    const valTraction = idxTraction !== -1 ? parseTractionVal(r[idxTraction]) : 1;
    const valLogiciel = idxLogiciel !== -1 ? parseTractionVal(r[idxLogiciel]) : 1;
    const valSlots = idxSlots !== -1 ? parseTractionVal(r[idxSlots]) : 1;

    const isSlotsNok = (valSlots === 0);
    const isLogicielNok = (valTraction === 0 && valLogiciel === 1);
    const isReelNok = (valTraction === 0 && valLogiciel === 0);

    return {
      cac: cac || 'Inconnu',
      transporteur: transporteur,
      semaine: sem ? 'S' + sem : 'N/A',
      mois: mois || 'N/A',
      dateTimestamp: dTimestamp,
      dateStr: dateStr,
      heureStr: heureStr,
      heureArriveeStr: heureArriveeStr,
      dureeExacteStr: dureeExacteStr,
      refCamion: refCamion,
      expedition: exp,
      hasDate: hasDate,
      palAnn: palAnn,
      palReel: palReel,
      palB: palBVal,
      palEcart: isPalEcart,
      slotsNok: isSlotsNok,
      logicielNok: isLogicielNok,
      reelNok: isReelNok,
      retard15: isR15,
      retard45: isR45,
      retard90: isR90,
      isRetard: isRetard,
      dateTimestamp: dTimestamp,
      dateStr: dateStr,
      jour: extraireJour(rawDate), // <-- LIGNE À AJOUTER
      heureStr: heureStr,
    };
  });
}
function getLogoBase64() {
  // Démo : pas de logo d'entreprise
  return null;
}
function extraireJour(val) {
  if (val === "" || val === null || val === undefined) return "";

  // 1. Cas objet Date natif
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();

  // 2. Cas format brut à 8 chiffres : AAAAMMJJ (ex: 20261123)
  const matchRaw = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (matchRaw) {
    return `${matchRaw[1]}-${matchRaw[2]}-${matchRaw[3]}`;
  }

  // 3. Cas format européen : JJ/MM/AAAA (gère aussi JJ/MM/AAAA HH:MM)
  const matchFR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchFR) {
    return `${matchFR[3]}-${matchFR[2].padStart(2, '0')}-${matchFR[1].padStart(2, '0')}`;
  }

  // 4. Cas format ISO : AAAA-MM-JJ
  const matchISO = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchISO) {
    return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;
  }

  return "";
}
//fin site 2

/**
 * DÉMO : recharge les données fictives (Data volumes + Réception live) depuis 2 CSV du Drive
 */
function chargerDonneesDemo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conv = function (x) { return x === 'TRUE' ? true : (x === 'FALSE' ? false : x); };
  const lire = function (id) { return Utilities.parseCsv(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8')).map(function (r) { return r.map(conv); }); };

  const dv = ss.getSheetByName('Data volumes');
  const lignesDv = lire('1E9eustRyXz3N1qeBTaOM9JLyO8YhCt6x');
  if (dv.getLastRow() > 1) dv.getRange(2, 1, dv.getLastRow() - 1, 30).clearContent();
  dv.getRange(2, 1, lignesDv.length, 30).setValues(lignesDv);

  const live = ss.getSheetByName('Réception live');
  const lignesLive = lire('1ojsLlSXBQG_AxfQgy-vpjYdeOkKKa172');
  if (live.getLastRow() > 3) live.getRange(4, 1, live.getLastRow() - 3, 25).clearContent();
  live.getRange(4, 1, lignesLive.length, 25).setValues(lignesLive);

  Logger.log('Data volumes : ' + lignesDv.length + ' lignes, Réception live : ' + lignesLive.length + ' lignes');
  SpreadsheetApp.flush();
}


/**
 * RESTE À QUAI : copie la dernière extraction complète de 'RAQ Import' vers 'Reste à quai récep'
 * (l'import se vide pendant chaque mise à jour de l'extraction)
 */
function majResteAQuai() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetImport = ss.getSheetByName('RAQ Import');
  var sheetRecep = ss.getSheetByName('Reste à quai récep');
  if (!sheetImport || !sheetRecep) return;

  var NB_COL = 8; // WAREHOUSE … ITEM
  var dataImport = sheetImport.getDataRange().getValues();
  if (dataImport.length < 2) return;

  var dates = [];
  for (var i = 1; i < dataImport.length; i++) {
    if (dataImport[i][1] !== "") dates.push(dataImport[i][1]);
  }
  if (dates.length === 0) return;
  dates.sort(function (x, y) { return x - y; });
  var derniereDate = dates[dates.length - 1];
  var dateActuelle = sheetRecep.getRange("B2").getValue();
  var cle = function (d) { return d instanceof Date ? d.getTime() : String(d); };

  if (cle(derniereDate) !== cle(dateActuelle)) {
    var dataAColler = dataImport
      .filter(function (row) { return cle(row[1]) === cle(derniereDate); })
      .map(function (row) { return row.slice(0, NB_COL); });
    if (dataAColler.length > 0) {
      var lastRowRecep = sheetRecep.getLastRow();
      if (lastRowRecep > 1) sheetRecep.getRange(2, 1, lastRowRecep - 1, NB_COL).clearContent();
      sheetRecep.getRange(2, 7, dataAColler.length, 2).setNumberFormat('@');
      sheetRecep.getRange(2, 1, dataAColler.length, NB_COL).setValues(dataAColler);
    }
  }
}

/**
 * DÉTAIL : case à cocher en AD de 'Data volumes' -> pop-up avec la liste des colis (colonne cachée AE)
 * À brancher sur un déclencheur installable "Lors d'une modification"
 */
function afficherDetail(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() === 'Data volumes' && e.range.getColumn() === 30 && e.range.getValue() === true) {
    e.range.uncheck();
    try {
      var row = e.range.getRow();
      var listeColis = sheet.getRange(row, 31).getValue();
      if (!listeColis) {
        SpreadsheetApp.getUi().alert("Détail", "Aucun colis trouvé pour ce déchargement.", SpreadsheetApp.getUi().ButtonSet.OK);
        return;
      }
      var htmlContent = '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; padding: 10px;">' +
                        listeColis.toString().split(', ').join('<br>') + '</div>';
      var html = HtmlService.createHtmlOutput(htmlContent).setWidth(300).setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(html, 'Détail des colis restants (Ligne ' + row + ')');
    } catch (erreur) {
      SpreadsheetApp.getUi().alert("Erreur du script", erreur.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

/**
 * DÉMO : crée 'RAQ Import' + 'Reste à quai récep' et charge l'extraction fictive des colis à quai
 */
function chargerRaqDemo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lignes = Utilities.parseCsv(DriveApp.getFileById('1O7cBH-yvdBnlXUrQWHLeZXPkZ8Q0BFNp').getBlob().getDataAsString('UTF-8'));
  ['RAQ Import', 'Reste à quai récep'].forEach(function (nom) {
    var sh = ss.getSheetByName(nom) || ss.insertSheet(nom);
    sh.clearContents();
    sh.getRange(1, 1, 1, 8).setValues([lignes[0]]).setFontWeight('bold').setBackground('#F0F4F9');
  });
  var imp = ss.getSheetByName('RAQ Import');
  imp.getRange(2, 7, lignes.length - 1, 2).setNumberFormat('@');
  imp.getRange(2, 1, lignes.length - 1, 8).setValues(lignes.slice(1));
  SpreadsheetApp.flush();
  majResteAQuai();
  Logger.log('Colis à quai chargés : ' + (lignes.length - 1));
}
