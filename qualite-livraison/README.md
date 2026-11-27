# Qualité de livraison – rejets et colis bombés (démo)

> ⚠️ Données entièrement fictives (sept.–nov. 2026, ~34 000 colis réceptionnés, 7 expéditeurs). Les paramètres de coût et de productivité ont été modifiés.

## Le besoin

À la réception, certains colis posent problème :
- **rejets** à l'entrée du stockage automatisé (étiquette manquante, pas de demande de stockage…) ;
- **colis bombés** qu'il faut reconditionner (« décanting »), ce qui coûte des cartons, du temps et de la place.

Le responsable veut savoir **quels expéditeurs** génèrent le plus d'anomalies, **quels articles** sont en cause et **combien ça coûte**, pour pouvoir remonter les problèmes avec preuves chiffrées.

## Comment ça marche

```
4 dossiers Drive d'extractions                 Onglets du Google Sheets
─────────────────────────────                  ────────────────────────
Extract_rejet (tous les 4 jours)    ──────►    Rejet            (anti-doublon date + heure)
Decanting (1 / semaine)             ──────►    Decanting        (anti-doublon n° de colis, archivage "Traités")
Extract_récep_101 (1 / semaine)     ──────►    Récep            (mémoire des fichiers déjà traités)
Extract_récep_20 (1 / semaine)      ──────►    Récep Décanting  (archivage "Traités")
                                                     │
                     formules : semaine, extraction du code-barres, expéditeur de chaque colis
                                                     ▼
                                   Application web (pré-agrégation + cache)
```

## Règles métier (formules)

- **Extraction du code-barres** dans un texte libre (`REGEXEXTRACT`), puis **recherche de l'expéditeur** : d'abord dans les réceptions (`XLOOKUP`), sinon par le préfixe du code-barres.
- **Semaine ISO** calculée à partir de dates au format AAAAMMJJ.
- **Taux** : rejets / colis réceptionnés, colis bombés / colis réceptionnés, cumul des anomalies.
- **Impacts estimés** : production perdue, places de stockage perdues, coût (cartons + main-d'œuvre).

## Ce que montre le tableau de bord

- Colis réceptionnés, rejets imputables à l'expéditeur, colis bombés, cumul des anomalies (%) ;
- Répartition des causes de rejet ;
- Top 5 des articles les plus bombés ;
- Évolution hebdomadaire / mensuelle / journalière ;
- Filtres par expéditeur, semaine, mois ; interface FR / EN ; tutoriel intégré.

## Captures

_(à ajouter : `captures/qualite.png`)_

## Fichiers

- [`code/apps-script-qualite`](../code/apps-script-qualite) : `Code.gs` (rejets, réceptions 101), `Decanting.gs` (imports, menus), `Dashboard.gs` (agrégation + cache), `DashboardH.html` (application web)
- [`donnees_fictives/qualite-livraison`](../donnees_fictives/qualite-livraison) : un fichier fictif de chaque extraction
- [`scripts/generer_donnees_qualite.py`](../scripts/generer_donnees_qualite.py) : script Python qui a généré les données fictives
