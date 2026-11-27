# Outils de pilotage logistique – Démos (données fictives)

Trois tableaux de bord que j'ai conçus pendant mon expérience d'assistant responsable logistique dans un **centre de distribution** (réception des camions, respect des créneaux transporteurs, qualité des livraisons).

> ⚠️ **Toutes les données de ce dépôt sont fictives.** Elles ont été générées par un script pour reproduire la structure et les ordres de grandeur des vrais fichiers, sans aucune donnée réelle. Les noms de sites, d'expéditeurs (ENTREPÔT 1 à 7) et de transporteurs (TRANSPORTEUR 1 à 11) sont inventés. Les règles métier et les paramètres de calcul ont été adaptés.

## Les 3 projets

| Projet | Problème métier | Ce que fait l'outil |
|---|---|---|
| [Suivi traction](./suivi-traction) | Les camions arrivent-ils dans leur créneau, avec le bon contenu, à l'heure ? | Croise les réceptions avec les extractions du logiciel de prise de RDV, contrôle chaque camion et classe les retards par transporteur |
| [Réception – reste à quai](./reception-reste-a-quai) | Quels colis attendent encore d'être rangés, et lesquels vont dépasser le délai promis ? | Liste les camions avec des colis restants, calcule l'heure limite de promesse et priorise les travées |
| [Qualité de livraison](./qualite-livraison) | Quels expéditeurs envoient des colis non conformes (rejets, colis bombés) et combien ça coûte ? | Consolide 4 extractions, retrouve l'expéditeur de chaque colis et calcule taux d'anomalies, coûts et top articles |

## Ce que ces projets montrent

- **Comprendre un besoin terrain** et le traduire en indicateurs (KPI) utiles aux équipes et aux managers.
- **Construire un pipeline de données** : extractions → consolidation sans doublons → enrichissement par formules → tableau de bord.
- **Formules Google Sheets avancées** : `LET`, `MAP` / `LAMBDA`, `ARRAYFORMULA`, `XLOOKUP` (`RECHERCHEX`), `REGEXEXTRACT`, `COUNTUNIQUEIFS`.
- **Automatisation** avec Google Apps Script (imports de fichiers Drive, archivage, déclencheurs) et **applications web** (HTML, Tailwind CSS, Chart.js).

## Méthode

J'ai défini le besoin, les règles métier, la structure des données et les formules Google Sheets. Le code Apps Script et HTML a été écrit **avec l'aide de l'IA**, que j'ai guidée, testée et corrigée jusqu'au déploiement auprès des équipes.

## Organisation du dépôt

```
├── suivi-traction/              README du projet 1
├── reception-reste-a-quai/      README du projet 2
├── qualite-livraison/           README du projet 3
├── code/
│   ├── apps-script-traction-reception/   projets 1 et 2 (même fichier Google Sheets)
│   └── apps-script-qualite/              projet 3
├── donnees_fictives/            échantillons des données générées
├── scripts/                     génération des données fictives (Python)
└── captures/                    captures d'écran des tableaux de bord
```

## Stack

Google Sheets · Google Apps Script · HTML / Tailwind CSS · Chart.js · Python (génération des données fictives)

---
Quentin Deheul – en recherche d'alternance **Data Analyst** à partir de septembre 2027 (partout en France).
