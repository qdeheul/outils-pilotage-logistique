/**
 * DÉMO – Qualité de livraison (données entièrement fictives)
 * Consolidation des rejets et des réceptions process 101
 */
function compilerFichiersRejetsSansDoublonsDateHeure() {
  // --- CONFIGURATION ---
  const ID_OU_NOM_DOSSIER = "1QbkNAV_dmK0QLmmOG0Ru0zdIc7XSCAv3"; // ID du dossier Extract_rejet (démo)
  const NOM_ONGLET_DEST = "Rejet";        // Onglet récepteur
  const LIGNE_DEBUT = 2;                     // Ligne de départ dans les fichiers sources
  // ----------------------

  const classeurDest = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleDest = classeurDest.getSheetByName(NOM_ONGLET_DEST);
  if (!feuilleDest) {
    SpreadsheetApp.getUi().alert("Onglet introuvable : " + NOM_ONGLET_DEST);
    return;
  }

  // 1. Détection de la dernière ligne en colonne B et mémorisation des dates/heures déjà présentes
  const maxLignesFeuille = feuilleDest.getMaxRows();
  // On lit les colonnes B et C de la destination (qui correspondent à Date et Heure)
  const valeursDest = feuilleDest.getRange(1, 2, maxLignesFeuille, 2).getDisplayValues();
  let derniereLigneB = 0;
  const couplesConnus = new Set();

  for (let r = 0; r < valeursDest.length; r++) {
    const dateVal = valeursDest[r][0].trim();
    const heureVal = valeursDest[r][1].trim();

    if (dateVal !== "" || heureVal !== "") {
      derniereLigneB = r + 1;
      // Clé unique : Date_Heure (on ignore la ligne 1 qui contient les en-têtes)
      if (r >= 1 && (dateVal !== "" || heureVal !== "")) {
        couplesConnus.add(dateVal + "_" + heureVal);
      }
    }
  }

  // 2. Accès au dossier Google Drive
  let dossier;
  try {
    dossier = DriveApp.getFolderById(ID_OU_NOM_DOSSIER);
  } catch (e) {
    const dossiers = DriveApp.getFoldersByName(ID_OU_NOM_DOSSIER);
    if (dossiers.hasNext()) dossier = dossiers.next();
  }

  if (!dossier) {
    SpreadsheetApp.getUi().alert("Dossier introuvable : " + ID_OU_NOM_DOSSIER);
    return;
  }

  const fichiers = dossier.getFiles();
  let donneesCumulees = [];
  let enTetes = null;
  let compteurFichiers = 0;
  let compteurDoublons = 0;

  // 3. Lecture brute (texte affiché) des fichiers
  while (fichiers.hasNext()) {
    const fichier = fichiers.next();
    compteurFichiers++;

    let ssSource;
    try {
      ssSource = SpreadsheetApp.openById(fichier.getId());
    } catch (err) {
      Logger.log("Fichier non ouvert : " + fichier.getName());
      continue;
    }

    const feuilleSource = ssSource.getSheets()[0];
    const derniereLigneSource = feuilleSource.getLastRow();
    const nbColonnes = feuilleSource.getLastColumn();

    // Récupération des en-têtes (colonnes A à H)
    if (!enTetes && derniereLigneSource >= 1 && nbColonnes >= 1) {
      const largeur = Math.min(8, nbColonnes);
      enTetes = feuilleSource.getRange(1, 1, 1, largeur).getDisplayValues()[0];
      while (enTetes.length < 8) enTetes.push("");
    }

    if (derniereLigneSource >= LIGNE_DEBUT) {
      const nbLignes = derniereLigneSource - LIGNE_DEBUT + 1;
      // Lecture A:H (colonne 1 sur 8 colonnes) en texte brut
      const valeurs = feuilleSource.getRange(LIGNE_DEBUT, 1, nbLignes, 8).getDisplayValues();

      for (let i = 0; i < valeurs.length; i++) {
        const ligne = valeurs[i];

        // Structure source : Col A = Date, Col B = Heure
        const dateSrc = String(ligne[0] ?? "").trim();
        const heureSrc = String(ligne[1] ?? "").trim();

        // Ligne vide sans date ni heure ignorée
        if (!dateSrc && !heureSrc) continue;

        const cleDateHeure = dateSrc + "_" + heureSrc;

        if (couplesConnus.has(cleDateHeure)) {
          compteurDoublons++;
        } else {
          couplesConnus.add(cleDateHeure);
          donneesCumulees.push(ligne);
        }
      }
    }
  }

  // 4. Écriture des en-têtes si la feuille est vide
  if (enTetes && derniereLigneB === 0) {
    feuilleDest.getRange(1, 2, 1, 8).setNumberFormat("@").setValues([enTetes]);
    derniereLigneB = 1;
  }

  // 5. Écriture des données de B à I
  if (donneesCumulees.length > 0) {
    const ligneInsertion = derniereLigneB + 1;
    const zoneCible = feuilleDest.getRange(ligneInsertion, 2, donneesCumulees.length, 8);
    zoneCible.setNumberFormat("@");
    zoneCible.setValues(donneesCumulees);

    SpreadsheetApp.getUi().alert(
      "Import Rejets terminé !\n\n" +
      "• Fichiers traités : " + compteurFichiers + "\n" +
      "• Lignes ajoutées de B à I : " + donneesCumulees.length + "\n" +
      "• Doublons (même Date + Heure) ignorés : " + compteurDoublons
    );
  } else {
    SpreadsheetApp.getUi().alert(
      "Aucune nouvelle ligne à importer.\n" +
      (compteurDoublons > 0 ? "Toutes les lignes lues partageaient une Date et Heure déjà existantes." : "Aucune donnée trouvée.")
    );
  }
}
function compilerFichiersRecep() {
  const ID_OU_NOM_DOSSIER = "1GKzdBNTVYP98hT8y51mGQ10u3G2wmn7B"; // ID du dossier Extract_récep_101 (démo)
  const NOM_ONGLET_DEST = "Récep";
  const LIGNE_DEBUT = 2;

  const classeurDest = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleDest = classeurDest.getSheetByName(NOM_ONGLET_DEST);
  if (!feuilleDest) {
    afficherAlerte("Onglet introuvable : " + NOM_ONGLET_DEST);
    return;
  }

  const proprietes = PropertiesService.getScriptProperties();
  const derniereLigneDest = feuilleDest.getLastRow();

  // Reset automatique de la mémoire si la feuille a été vidée manuellement
  if (derniereLigneDest <= 1) {
    proprietes.deleteProperty("FICHIERS_RECEP_TRAITES");
  }

  const fichiersTraitesJSON = proprietes.getProperty("FICHIERS_RECEP_TRAITES");
  const fichiersTraites = new Set(fichiersTraitesJSON ? JSON.parse(fichiersTraitesJSON) : []);

  // 1. Mémorisation des identifiants déjà présents en COLONNE C (colonne 3)
  const elementsConnus = new Set();
  let maxCols = feuilleDest.getLastColumn() || 1;

  if (derniereLigneDest >= 2) {
    const existantsC = feuilleDest.getRange(2, 3, derniereLigneDest - 1, 1).getDisplayValues();
    for (let r = 0; r < existantsC.length; r++) {
      const val = existantsC[r][0].trim();
      if (val !== "") elementsConnus.add(val);
    }
  }

  // 2. Accès au dossier Drive
  let dossier;
  try {
    dossier = DriveApp.getFolderById(ID_OU_NOM_DOSSIER);
  } catch (e) {
    const dossiers = DriveApp.getFoldersByName(ID_OU_NOM_DOSSIER);
    if (dossiers.hasNext()) dossier = dossiers.next();
  }

  if (!dossier) {
    afficherAlerte("Dossier introuvable : " + ID_OU_NOM_DOSSIER);
    return;
  }

  const fichiers = dossier.getFiles();
  const nouveauxFichiersIds = [];
  const lignesAInserer = [];
  let compteurNouveauxFichiers = 0;
  let compteurDoublons = 0;
  let enTetes = null;

  // 3. Lecture des fichiers non encore traités
  while (fichiers.hasNext()) {
    const fichier = fichiers.next();
    const fId = fichier.getId();

    if (fichiersTraites.has(fId)) continue;

    let ssSource;
    try {
      ssSource = SpreadsheetApp.openById(fId);
    } catch (err) {
      Logger.log("Fichier non lu : " + fichier.getName());
      continue;
    }

    compteurNouveauxFichiers++;
    nouveauxFichiersIds.push(fId);

    const feuilleSource = ssSource.getSheets()[0];
    const derniereLigneSource = feuilleSource.getLastRow();
    const nbColsSource = feuilleSource.getLastColumn();

    if (!enTetes && derniereLigneDest <= 1 && derniereLigneSource >= 1 && nbColsSource >= 1) {
      enTetes = feuilleSource.getRange(1, 1, 1, nbColsSource).getDisplayValues()[0];
      if (nbColsSource > maxCols) maxCols = nbColsSource;
    }

    // Vérification que le fichier source a bien au moins 3 colonnes pour atteindre la C
    if (derniereLigneSource >= LIGNE_DEBUT && nbColsSource >= 3) {
      if (nbColsSource > maxCols) maxCols = nbColsSource;

      const valeurs = feuilleSource.getRange(LIGNE_DEBUT, 1, derniereLigneSource - LIGNE_DEBUT + 1, nbColsSource).getDisplayValues();

      for (let i = 0; i < valeurs.length; i++) {
        const ligne = valeurs[i];
        const identifiantC = String(ligne[2] ?? "").trim(); // COLONNE C (index 2)

        if (!identifiantC) continue;

        if (elementsConnus.has(identifiantC)) {
          compteurDoublons++;
        } else {
          elementsConnus.add(identifiantC);
          lignesAInserer.push(ligne);
        }
      }
    }
  }

  if (compteurNouveauxFichiers === 0) {
    afficherAlerte("Tous les fichiers du dossier ont déjà été traités. Aucun nouvel import requis.");
    return;
  }

  // 4. Écriture des en-têtes si la feuille est vierge
  if (enTetes && derniereLigneDest <= 1) {
    while (enTetes.length < maxCols) enTetes.push("");
    feuilleDest.getRange(1, 1, 1, maxCols).setNumberFormat("@").setValues([enTetes]);
  }

  // 5. Écriture des nouvelles lignes uniques à la suite
  if (lignesAInserer.length > 0) {
    const matriceEcriture = lignesAInserer.map(row => {
      while (row.length < maxCols) row.push("");
      return row;
    });

    const debutEcriture = feuilleDest.getLastRow() + 1;
    const plageDest = feuilleDest.getRange(debutEcriture, 1, matriceEcriture.length, maxCols);
    plageDest.setNumberFormat("@");
    plageDest.setValues(matriceEcriture);
  }

  // 6. Sauvegarde des identifiants des fichiers traités
  nouveauxFichiersIds.forEach(id => fichiersTraites.add(id));
  proprietes.setProperty("FICHIERS_RECEP_TRAITES", JSON.stringify(Array.from(fichiersTraites)));

  afficherAlerte(
    "Import Récep terminé !\n\n" +
    "• Nouveaux fichiers traités : " + compteurNouveauxFichiers + "\n" +
    "• Nouvelles lignes ajoutées : " + lignesAInserer.length + "\n" +
    "• Doublons (colonne C) ignorés : " + compteurDoublons
  );
}
// ========================================================
// 3. UTILITAIRE D'ALERTE
// ========================================================
function afficherAlerte(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(message);
  }
}
function reinitialiserMemoireFichiersRecep() {
  PropertiesService.getScriptProperties().deleteProperty("FICHIERS_RECEP_TRAITES");
  afficherAlerte("Mémoire réinitialisée : tous les fichiers du dossier Extract_récep seront relus au prochain clic.");
}
