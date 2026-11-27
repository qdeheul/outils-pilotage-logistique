/**
 * DÉMO – Qualité de livraison : imports Decanting / Récep Décanting + menus
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu('📥 Imports')
    .addItem('Consolider Rejet', 'compilerFichiersRejetsSansDoublonsDateHeure')
    .addItem('Consolider Récep 101', 'compilerFichiersRecep')
    .addItem('Importer Decanting', 'importerDecanting')
    .addItem('Importer Récep Décanting', 'importerRecepDecanting')
    .addSeparator()
    .addItem('Réinitialiser la mémoire Récep 101', 'reinitialiserMemoireFichiersRecep')
    .addItem('Vérifier les fichiers en attente (Récep Décanting)', 'verifierFichiersEnAttente')
    .addToUi();

  ui.createMenu('🧹 Maintenance')
    .addItem('Nettoyer les cellules vides (tous les onglets)', 'nettoyerCellulesVides')
    .addToUi();
}

function importerDecanting() {
  executerImportation({
    idDossierSource: "1v4hJasKe-M82CZhzJqNeCJBjUtuR8oBT", // ID du dossier Decanting (démo)
    nomDossierSource: "Decanting",
    nomDossierArchives: "Traités",
    nomOngletCible: "Decanting",
    nbColonnes: 11,       // Colonnes A à K
    maxColonnesOnglet: 15, // Garde jusqu'à la colonne O
    colonneTri: 2,         // Tri sur la colonne B (Date)
    dedoublonnerSurC: true
  });
}

function importerRecepDecanting() {
  // 1. Mettez ici l'ID du dossier principal (où vous déposez les nouveaux fichiers)
  var idDossierSource = "18LusOMhHWqzolzsyWO595Le7XC2Dg7Fg";
  // 2. Mettez ici l'ID du sous-dossier "Traités"
  var idDossierTraites = "1Hd13dRJUsnVmzGGEzmKIZYTwbthasUHM";

  var dossierSource = DriveApp.getFolderById(idDossierSource);
  var dossierTraites = DriveApp.getFolderById(idDossierTraites);
  
  // getFiles() sur un dossier précis ne lit JAMAIS les sous-dossiers ("Traités" est donc ignoré)
  var fichiers = dossierSource.getFiles();
  var ssActif = SpreadsheetApp.getActiveSpreadsheet();
  var feuilleCible = ssActif.getSheetByName("Récep Décanting");
  
  var nouvellesLignes = [];
  var fichiersDeplaces = [];

  while (fichiers.hasNext()) {
    var fichier = fichiers.next();
    
    // On ignore le fichier Google Sheets principal s'il est dans le même dossier
    if (fichier.getId() === ssActif.getId()) continue;

    // On n'ouvre que les fichiers Google Sheets (ou Excel convertis)
    if (fichier.getMimeType() === MimeType.GOOGLE_SHEETS) {
      var tempSs = SpreadsheetApp.open(fichier);
      var tempSheet = tempSs.getSheets()[0]; // Lit le 1er onglet
      var lastRow = tempSheet.getLastRow();
      var lastCol = tempSheet.getLastColumn();
      
      // On lit à partir de la ligne 2 (pour ignorer l'en-tête)
      if (lastRow > 1) {
        var data = tempSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        nouvellesLignes = nouvellesLignes.concat(data);
      }
      
      fichiersDeplaces.push(fichier);
    }
  }

  // Écriture directe à la fin de l'onglet SANS relire tout l'historique (évite l'erreur de taille)
  if (nouvellesLignes.length > 0) {
    // La colonne V (semaine) est une formule : on cherche la dernière ligne sur A:C uniquement
    var startRow = trouverDerniereLigneRapide(feuilleCible) + 1;
    feuilleCible.getRange(startRow, 1, nouvellesLignes.length, nouvellesLignes[0].length).setValues(nouvellesLignes);
  }

  // Déplacement immédiat dans le dossier "Traités"
  for (var i = 0; i < fichiersDeplaces.length; i++) {
    fichiersDeplaces[i].moveTo(dossierTraites);
  }

  SpreadsheetApp.getUi().alert("Import terminé : " + fichiersDeplaces.length + " fichier(s) traité(s) et rangé(s).");
}

function nettoyerCellulesVides() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var feuilles = ss.getSheets();
  var cellulesAvant = 0;
  var cellulesApres = 0;

  for (var s = 0; s < feuilles.length; s++) {
    var f = feuilles[s];
    var maxR = f.getMaxRows();
    var maxC = f.getMaxColumns();
    cellulesAvant += maxR * maxC;

    var lastR = f.getLastRow();
    var lastC = f.getLastColumn();

    // Lit uniquement les 4 premières colonnes pour économiser la mémoire
    if (lastR > 1 && lastC > 0) {
      var vals = f.getRange(1, 1, lastR, Math.min(lastC, 4)).getValues();
      var vraieDerniereLigne = 1;
      for (var r = vals.length - 1; r >= 0; r--) {
        if (vals[r].join("").replace(/[\s\u00A0]/g, "") !== "") {
          vraieDerniereLigne = r + 1;
          break;
        }
      }
      lastR = vraieDerniereLigne;
    }

    var cibleR = Math.max(lastR, 2);
    var cibleC = Math.max(lastC, 1);

    if (maxR > cibleR) {
      f.deleteRows(cibleR + 1, maxR - cibleR);
    }
    if (maxC > cibleC) {
      f.deleteColumns(cibleC + 1, maxC - cibleC);
    }

    cellulesApres += f.getMaxRows() * f.getMaxColumns();
  }

  var gagnees = cellulesAvant - cellulesApres;
  SpreadsheetApp.getUi().alert(
    "Nettoyage terminé !\n" +
    "- Cellules avant : " + cellulesAvant.toLocaleString('fr-FR') + "\n" +
    "- Cellules après : " + cellulesApres.toLocaleString('fr-FR') + "\n" +
    "- Cellules vides libérées : " + Math.max(0, gagnees).toLocaleString('fr-FR')
  );
}

function executerImportation(config) {
  var tempsDebut = Date.now();
  var TEMPS_MAX_MS = 240000;      // Arrêt propre à 4 minutes (évite le timeout de 6 min)
  var LIGNES_MAX_PAR_LOT = 40000; // Maximum de lignes écrites par exécution

  var ssActif = SpreadsheetApp.getActiveSpreadsheet();

  var feuilleCible = ssActif.getSheetByName(config.nomOngletCible);
  if (!feuilleCible) {
    feuilleCible = ssActif.insertSheet(config.nomOngletCible);
  }

  var maxColsActuelles = feuilleCible.getMaxColumns();
  if (maxColsActuelles < config.maxColonnesOnglet) {
    feuilleCible.insertColumnsAfter(maxColsActuelles, config.maxColonnesOnglet - maxColsActuelles);
  } else if (maxColsActuelles > config.maxColonnesOnglet) {
    feuilleCible.deleteColumns(config.maxColonnesOnglet + 1, maxColsActuelles - config.maxColonnesOnglet);
  }

  feuilleCible.getRange("B:C").setNumberFormat("@");

  var derniereLigneCible = trouverDerniereLigneRapide(feuilleCible);
  var besoinEnTete = (derniereLigneCible === 0);
  var enTeteReference = "";
  var clesUniques = new Set();

  if (derniereLigneCible >= 1) {
    var ligne1 = feuilleCible.getRange(1, 1, 1, config.nbColonnes).getValues()[0];
    enTeteReference = normaliserLigne(ligne1);
  }

  if (config.dedoublonnerSurC && derniereLigneCible > 1) {
    var donneesExistantes = feuilleCible.getRange(2, 3, derniereLigneCible - 1, 1).getValues();
    for (var k = 0; k < donneesExistantes.length; k++) {
      var cleExistante = formaterNumeroColis(donneesExistantes[k][0]);
      if (cleExistante !== "") {
        clesUniques.add(cleExistante);
      }
    }
  }

  var dossierSource = null;
  try { dossierSource = DriveApp.getFolderById(config.idDossierSource); } catch (e) {}
  if (!dossierSource) {
    var dossiers = DriveApp.getFoldersByName(config.nomDossierSource);
    if (!dossiers.hasNext()) {
      SpreadsheetApp.getUi().alert("Erreur : Le dossier '" + config.nomDossierSource + "' est introuvable sur votre Drive.");
      return;
    }
    dossierSource = dossiers.next();
  }

  var sousDossiers = dossierSource.getFoldersByName(config.nomDossierArchives);
  var dossierTraites = sousDossiers.hasNext() 
    ? sousDossiers.next() 
    : dossierSource.createFolder(config.nomDossierArchives);

  var iterateurFichiers = dossierSource.getFilesByType(MimeType.GOOGLE_SHEETS);
  var fichiersALire = [];
  while (iterateurFichiers.hasNext()) {
    var f = iterateurFichiers.next();
    if (f.getId() !== ssActif.getId()) {
      fichiersALire.push(f);
    }
  }

  if (fichiersALire.length === 0) {
    SpreadsheetApp.getUi().alert("Aucun nouveau fichier Google Sheets à traiter dans '" + config.nomDossierSource + "'.");
    return;
  }

  var lignesAAjouter = [];
  var fichiersTraites = [];

  for (var fIndex = 0; fIndex < fichiersALire.length; fIndex++) {
    // Pause sécurisée avant de dépasser les limites de Google Apps Script
    if (fichiersTraites.length > 0 && (Date.now() - tempsDebut > TEMPS_MAX_MS || lignesAAjouter.length >= LIGNES_MAX_PAR_LOT)) {
      break;
    }

    var fichier = fichiersALire[fIndex];
    var ssSource = SpreadsheetApp.openById(fichier.getId());
    var feuilleSource = ssSource.getSheets()[0];
    var derniereLigneSource = feuilleSource.getLastRow();

    if (derniereLigneSource < 1) {
      fichiersTraites.push(fichier);
      continue;
    }

    // Lecture unique (sans getDisplayValues) = 2x plus rapide
    var donneesSource = feuilleSource.getRange(1, 1, derniereLigneSource, config.nbColonnes).getValues();

    for (var i = 0; i < donneesSource.length; i++) {
      var ligne = donneesSource[i];

      if (ligne.join("").replace(/[\s\u00A0]/g, "") === "") continue;

      var ligneNorm = normaliserLigne(ligne);
      var colA = String(ligne[0]).replace(/[\s\u00A0]/g, " ").trim();

      if (enTeteReference === "") {
        enTeteReference = ligneNorm;
      }
      if (ligneNorm === enTeteReference || colA.toLowerCase() === "warehouse") {
        if (besoinEnTete) {
          lignesAAjouter.push(ligne);
          besoinEnTete = false;
        }
        continue;
      }

      var colisColB = formaterNumeroColis(ligne[1]);
      var colisColC = formaterNumeroColis(ligne[2]);
      ligne[1] = colisColB;
      ligne[2] = colisColC;

      if (config.dedoublonnerSurC) {
        if (colA === "" || colisColC === "" || colisColC === "0") continue;
        if (!clesUniques.has(colisColC)) {
          clesUniques.add(colisColC);
          lignesAAjouter.push(ligne);
        }
      } else {
        if (colA === "" || colisColB === "" || colisColB === "0") continue;
        lignesAAjouter.push(ligne);
      }
    }

    fichiersTraites.push(fichier);
  }

  // Écriture par blocs de 15 000 lignes pour éviter toute saturation mémoire
  var nbLignesAjoutees = 0;
  if (lignesAAjouter.length > 0) {
    var TAILLE_BLOC = 15000;
    var ligneEcriture = derniereLigneCible + 1;
    for (var start = 0; start < lignesAAjouter.length; start += TAILLE_BLOC) {
      var bloc = lignesAAjouter.slice(start, start + TAILLE_BLOC);
      feuilleCible.getRange(ligneEcriture, 1, bloc.length, config.nbColonnes).setValues(bloc);
      ligneEcriture += bloc.length;
    }
    feuilleCible.getRange("B:C").setNumberFormat("@");
    nbLignesAjoutees = (derniereLigneCible === 0) ? lignesAAjouter.length - 1 : lignesAAjouter.length;
  }

  // Tri par date décroissante
  var derniereLigneFinale = trouverDerniereLigneRapide(feuilleCible);
  if (derniereLigneFinale > 2) {
    feuilleCible.getRange(2, 1, derniereLigneFinale - 1, config.nbColonnes).sort({column: config.colonneTri, ascending: false});
  }

  // Suppression des lignes vides en bas de feuille
  var maxRowsApres = feuilleCible.getMaxRows();
  var cibleRows = Math.max(derniereLigneFinale, 2);
  if (maxRowsApres > cibleRows) {
    feuilleCible.deleteRows(cibleRows + 1, maxRowsApres - cibleRows);
  }

  // Déplacement uniquement des fichiers effectivement traités dans ce lot
  for (var m = 0; m < fichiersTraites.length; m++) {
    fichiersTraites[m].moveTo(dossierTraites);
  }

  var fichiersRestants = fichiersALire.length - fichiersTraites.length;
  var message = "Lot '" + config.nomOngletCible + "' terminé !\n" +
    "- Fichiers traités et archivés : " + fichiersTraites.length + "\n" +
    "- Lignes ajoutées : " + Math.max(0, nbLignesAjoutees);

  if (fichiersRestants > 0) {
    message += "\n\n⚠️ Il reste encore " + fichiersRestants + " fichier(s) dans le dossier. Relancez l'importation pour traiter la suite.";
  }

  SpreadsheetApp.getUi().alert(message);
}

function normaliserLigne(ligne) {
  return ligne.map(function(cell) {
    return String(cell).replace(/[\s\u00A0]/g, " ").trim().toLowerCase();
  }).join("|");
}

function formaterNumeroColis(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  if (typeof valeur === "string") return valeur.replace(/[\s\u00A0]/g, "").trim();
  if (typeof valeur === "number") return valeur.toFixed(0);
  return String(valeur).trim();
}

function trouverDerniereLigneRapide(feuille) {
  var limite = Math.min(feuille.getLastRow(), feuille.getMaxRows());
  if (limite === 0) return 0;
  // Lit uniquement les colonnes A à C pour une exécution quasi instantanée
  var valeurs = feuille.getRange(1, 1, limite, 3).getValues();
  for (var r = valeurs.length - 1; r >= 0; r--) {
    if (valeurs[r].join("").replace(/[\s\u00A0]/g, "") !== "") {
      return r + 1;
    }
  }
  return 0;
}
function verifierFichiersEnAttente() {
  // Remplacez par l'ID de votre dossier principal (celui où arrivent les fichiers)
  var idDossierParent = "18LusOMhHWqzolzsyWO595Le7XC2Dg7Fg"; 
  
  var dossier = DriveApp.getFolderById(idDossierParent);
  var iterateurFichiers = dossier.getFiles();
  var ssActifId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  var nomsFichiers = [];
  
  // Parcourt tous les fichiers présents à la racine du dossier
  while (iterateurFichiers.hasNext()) {
    var fichier = iterateurFichiers.next();
    
    // On exclut le fichier Google Sheets principal lui-même s'il est rangé au même endroit
    if (fichier.getId() !== ssActifId) {
      nomsFichiers.push("📄 " + fichier.getName());
    }
  }
  
  var ui = SpreadsheetApp.getUi();
  
  // Affichage du résultat dans une pop-up
  if (nomsFichiers.length === 0) {
    ui.alert("Audit des fichiers", "✅ Dossier vide ! Tous les fichiers ont été déplacés dans 'Traités'.", ui.ButtonSet.OK);
  } else {
    var message = "Il reste " + nomsFichiers.length + " fichier(s) en attente de traitement :\n\n";
    message += nomsFichiers.join("\n");
    ui.alert("Audit des fichiers", message, ui.ButtonSet.OK);
  }
}

/**
 * DÉMO : chaque expéditeur a son propre catalogue d'articles (60 réf. par entrepôt).
 * Remplace le code ITEM dans les 3 onglets ET dans les fichiers sources (dossiers + "Traités").
 * Le même article d'origine donne toujours le même article par entrepôt : les "articles chauds" restent chauds.
 */
function repartirItemsParEntrepotDemo() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("itemsRepartis") === "ok") { Logger.log("Déjà fait."); return; }
  props.setProperty("itemsRepartis", "ok");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function nouvelItem(item, entrepot) {
    var m = String(entrepot || "").match(/(\d+)/);
    if (!m || !item) return item;
    var h = 0, s = String(item);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return m[1] + ("00000" + (100 + (h % 60) * 37)).slice(-6);
  }
  function remapOnglet(nom, colItem, colEnt) {
    var sh = ss.getSheetByName(nom);
    var last = sh.getLastRow();
    if (last < 2) return;
    var items = sh.getRange(2, colItem, last - 1, 1).getValues();
    var ents = sh.getRange(2, colEnt, last - 1, 1).getValues();
    for (var r = 0; r < items.length; r++) {
      if (items[r][0] === "" || ents[r][0] === "") continue;
      items[r][0] = nouvelItem(items[r][0], ents[r][0]);
    }
    sh.getRange(2, colItem, last - 1, 1).setNumberFormat("@").setValues(items);
  }
  // 1. Onglets consolidés
  var sh = ss.getSheetByName("Decanting");
  var lastD = sh.getLastRow();
  var colisEnt = {};
  if (lastD > 1) {
    var cm = sh.getRange(2, 3, lastD - 1, 11).getValues(); // C..M
    cm.forEach(function (r) { colisEnt[String(r[0]).trim()] = r[10]; });
  }
  remapOnglet("Decanting", 7, 13);          // ITEM G, entrepôt M
  remapOnglet("Récep Décanting", 9, 18);    // ITEM I, EXP_NAME R
  remapOnglet("Récep", 14, 19);             // ITEM N, NOM_FRN S

  // 2. Fichiers sources (dossier + sous-dossier Traités)
  function dossiers(id) {
    var d = DriveApp.getFolderById(id), out = [d], sub = d.getFolders();
    while (sub.hasNext()) out.push(sub.next());
    return out;
  }
  function remapFichiers(idDossier, colItem, entDe) {
    var n = 0;
    dossiers(idDossier).forEach(function (dos) {
      var it = dos.getFilesByType(MimeType.GOOGLE_SHEETS);
      while (it.hasNext()) {
        var f = it.next();
        var fs = SpreadsheetApp.openById(f.getId()).getSheets()[0];
        var last = fs.getLastRow();
        if (last < 2) continue;
        var data = fs.getRange(2, 1, last - 1, fs.getLastColumn()).getValues();
        var col = data.map(function (r) { return [nouvelItem(r[colItem - 1], entDe(r))]; });
        fs.getRange(2, colItem, col.length, 1).setNumberFormat("@").setValues(col);
        n++;
      }
    });
    return n;
  }
  var n1 = remapFichiers("1v4hJasKe-M82CZhzJqNeCJBjUtuR8oBT", 7, function (r) { return colisEnt[String(r[2]).trim()]; });
  var n2 = remapFichiers("18LusOMhHWqzolzsyWO595Le7XC2Dg7Fg", 9, function (r) { return r[17]; });
  var n3 = remapFichiers("1GKzdBNTVYP98hT8y51mGQ10u3G2wmn7B", 14, function (r) { return r[18]; });
  CacheService.getScriptCache().remove("cacheDashboard_meta");
  Logger.log("Fichiers sources mis à jour : Decanting " + n1 + ", Récep 20 " + n2 + ", Récep 101 " + n3);
}
