/**
 * DÉMO – Qualité de livraison : agrégation des données pour l'application web
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('DashboardH')
    .setTitle('Qualité de livraison – Démo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Normalise le nom de l'expéditeur (ENTREPÔT 1 à 7) sur les 3 onglets (Decanting, Récep Décanting, Rejet)
 */
function normaliserNomCAC(valeur) {
  if (!valeur) return "";
  var s = String(valeur).toUpperCase().trim();
  var m = s.match(/ENTREP[OÔ]T\s*(\d+)/);
  return m ? "ENTREPÔT " + m[1] : "";
}

/**
 * Extrait "MM/AAAA" depuis un format AAAAMMJJ (ex: 20261114), un objet Date ou JJ/MM/AAAA
 */
function extraireMoisAnnee(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val)) {
    var m = ("0" + (val.getMonth() + 1)).slice(-2);
    return m + "/" + val.getFullYear();
  }
  var s = String(val).trim();
  if (/^\d{8}$/.test(s)) {
    return s.substring(4, 6) + "/" + s.substring(0, 4);
  }
  var matchFR = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchFR) {
    return ("0" + matchFR[2]).slice(-2) + "/" + matchFR[3];
  }
  return "";
}

/**
 * Extrait "AAAA-MM-JJ" depuis un objet Date, un format AAAAMMJJ (ex: 20261114), ISO ou JJ/MM/AAAA
 */
function extraireJour(val) {
  if (!val) return "";
  
  // 1. Si c'est un vrai objet Date Google Sheets
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val)) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  
  var str = String(val).trim();
  
  // 2. Format AAAAMMJJ à 8 chiffres (ex: 20261114)
  if (/^\d{8}$/.test(str)) {
    return str.substring(0, 4) + "-" + str.substring(4, 6) + "-" + str.substring(6, 8);
  }
  
  // 3. Format ISO / Anglais : "2026-11-16" ou "2026/11/16" (avec ou sans heure)
  var matchIso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (matchIso) {
    var m = ("0" + matchIso[2]).slice(-2);
    var d = ("0" + matchIso[3]).slice(-2);
    return matchIso[1] + "-" + m + "-" + d;
  }

  // 4. Format Français : "16/11/2026" ou "6/11/2026" ou "16-11-2026" (avec ou sans heure)
  var matchFr = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (matchFr) {
    var d = ("0" + matchFr[1]).slice(-2);
    var m = ("0" + matchFr[2]).slice(-2);
    return matchFr[3] + "-" + m + "-" + d;
  }

  return "";
}

/**
 * Nettoie le numéro de semaine (ex: 46)
 */
function nettoyerSemaine(val) {
  if (val === null || val === undefined || val === "") return "";
  var s = String(val).replace(/^S/i, "").trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : "";
}

/**
 * Charge et pré-agrège toutes les données pour un affichage instantané dans la Web App
 */
function getDashboardData(forceRefresh) {
  var cache = CacheService.getScriptCache();
  
  // 1. LECTURE DU CACHE (S'il n'est pas forcé)
  if (!forceRefresh) {
    var numChunksStr = cache.get("cacheDashboard_meta");
    if (numChunksStr) {
      var numChunks = parseInt(numChunksStr, 10);
      var fullJson = "";
      var cacheValid = true;
      
      for (var i = 0; i < numChunks; i++) {
        var chunk = cache.get("cacheDashboard_" + i);
        if (!chunk) { cacheValid = false; break; }
        fullJson += chunk;
      }
      
      if (cacheValid && fullJson !== "") {
        return fullJson;
      }
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDec = ss.getSheetByName("Decanting");
  var sheetRec = ss.getSheetByName("Récep Décanting");
  var sheetRej = ss.getSheetByName("Rejet");

  var buckets = {};       // Clé: "CAC|Semaine|Mois|Jour"
  var recepSets = {};     // Clé: "CAC|Semaine|Mois|Jour" -> Set de PARCEL uniques
  var itemsMap = {};      // Clé: "CAC|Semaine|Mois|Item" -> nb colis
  var setCAC = new Set();
  var setSemaines = new Set();
  var setMois = new Set();

  function getBucket(cac, sem, mois, jour) {
    var k = cac + "|" + sem + "|" + mois + "|" + jour;
    if (!buckets[k]) {
      buckets[k] = {
        cac: cac,
        sem: sem,
        mois: mois,
        jour: jour,
        recep: 0,
        dec: 0,
        rej_wms: 0,
        rej_noreq: 0,
        rej_dcfault: 0,
        rej_autres: 0
      };
    }
    return buckets[k];
  }

  // 1. RÉCEP DÉCANTING : Count unique Col B (index 1) par CAC Col R (17), Semaine Col V (21), Mois & Jour Col K (10)
  if (sheetRec && sheetRec.getLastRow() > 1) {
    var lastRec = sheetRec.getLastRow();
    var dataRec = sheetRec.getRange(2, 1, lastRec - 1, 22).getValues();
    for (var i = 0; i < dataRec.length; i++) {
      var parcel = String(dataRec[i][1] || "").trim();
      var cacRec = normaliserNomCAC(dataRec[i][17]);
      if (!parcel || !cacRec) continue;

      var semRec = nettoyerSemaine(dataRec[i][21]);
      var moisRec = extraireMoisAnnee(dataRec[i][10]);
      var jourRec = extraireJour(dataRec[i][10]);
      if (!semRec && !moisRec) continue;

      setCAC.add(cacRec);
      if (semRec) setSemaines.add(semRec);
      if (moisRec) setMois.add(moisRec);

      var kRec = cacRec + "|" + semRec + "|" + moisRec + "|" + jourRec;
      if (!recepSets[kRec]) recepSets[kRec] = new Set();
      recepSets[kRec].add(parcel);
      getBucket(cacRec, semRec, moisRec, jourRec);
    }
    for (var k in recepSets) {
      if (buckets[k]) buckets[k].recep = recepSets[k].size;
    }
  }

  // 2. DECANTING : Nb lignes (colis) par CAC Col M (12), Semaine Col L (11), Mois & Jour Col B (1), Item Col G (6)
  if (sheetDec && sheetDec.getLastRow() > 1) {
    var lastDec = sheetDec.getLastRow();
    var dataDec = sheetDec.getRange(2, 1, lastDec - 1, 13).getValues();
    for (var j = 0; j < dataDec.length; j++) {
      var cacDec = normaliserNomCAC(dataDec[j][12]);
      var cacKey = cacDec !== "" ? cacDec : "NON_IDENTIFIE"; 

      var semDec = nettoyerSemaine(dataDec[j][11]);
      var moisDec = extraireMoisAnnee(dataDec[j][1]);
      var jourDec = extraireJour(dataDec[j][1]);
      var item = String(dataDec[j][6] || "").trim();

      if (cacDec !== "") setCAC.add(cacDec);
      if (semDec) setSemaines.add(semDec);
      if (moisDec) setMois.add(moisDec);

      var bDec = getBucket(cacKey, semDec, moisDec, jourDec);
      bDec.dec += 1;

      if (item) {
        var kItem = cacKey + "|" + semDec + "|" + moisDec + "|" + item;
        itemsMap[kItem] = (itemsMap[kItem] || 0) + 1;
      }
    }
  }

  // 3. REJET : Semaine Col A (0), Date Col B (1), Cause Col H (7), Provenance Col L (11)
  if (sheetRej && sheetRej.getLastRow() > 1) {
    var lastRej = sheetRej.getLastRow();
    var dataRej = sheetRej.getRange(2, 1, lastRej - 1, 12).getValues();
    for (var r = 0; r < dataRej.length; r++) {
      var causeBrute = String(dataRej[r][7] || "").trim();
      var semRej = nettoyerSemaine(dataRej[r][0]);
      var moisRej = extraireMoisAnnee(dataRej[r][1]);
      var jourRej = extraireJour(dataRej[r][1]);
      if (!causeBrute && !semRej && !moisRej) continue;

      var cacRej = normaliserNomCAC(dataRej[r][11]);
      var cacKey = cacRej !== "" ? cacRej : "NON_IDENTIFIE";

      if (cacRej !== "") setCAC.add(cacRej);
      if (semRej) setSemaines.add(semRej);
      if (moisRej) setMois.add(moisRej);

      var bRej = getBucket(cacKey, semRej, moisRej, jourRej);
      var causeUpper = causeBrute.toUpperCase();

      if (causeUpper === "WMS BARCODE MISSING") {
        bRej.rej_wms += 1;
      } else if (causeUpper === "NO STORAGE REQUEST") {
        bRej.rej_noreq += 1;
      } else if (causeUpper === "WCS BARCODE MISSING") {
        bRej.rej_dcfault += 1;
      } else {
        bRej.rej_autres += 1;
      }
    }
  }

  // Conversion en tableaux légers pour le navigateur
  var listeBuckets = [];
  for (var keyB in buckets) {
    listeBuckets.push(buckets[keyB]);
  }

  var listeItems = [];
  for (var keyI in itemsMap) {
    var p = keyI.split("|");
    listeItems.push({
      cac: p[0],
      sem: p[1],
      mois: p[2],
      item: p.slice(3).join("|"),
      qty: itemsMap[keyI]
    });
  }

  var cacsTries = Array.from(setCAC).sort();
  var semainesTriees = Array.from(setSemaines).sort(function(a, b) { return Number(a) - Number(b); });
  var moisTries = Array.from(setMois).sort(function(a, b) {
    var pa = a.split("/"), pb = b.split("/");
    return (pa[1] + pa[0]).localeCompare(pb[1] + pb[0]);
  });

  var resultatFinal = {
    cacs: cacsTries,
    semaines: semainesTriees,
    mois: moisTries,
    buckets: listeBuckets,
    items: listeItems,
    maj: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
  };

  // 2. SAUVEGARDE DANS LE CACHE (En découpant en morceaux de 90 Ko pour contourner la limite de Google)
  var jsonString = JSON.stringify(resultatFinal);

  try {
    var chunkSize = 90000; 
    var numChunks = Math.ceil(jsonString.length / chunkSize);
    
    cache.put("cacheDashboard_meta", String(numChunks), 1800);
    
    for (var i = 0; i < numChunks; i++) {
      cache.put("cacheDashboard_" + i, jsonString.substring(i * chunkSize, (i + 1) * chunkSize), 1800);
    }
  } catch(e) {}

  return jsonString;
}
