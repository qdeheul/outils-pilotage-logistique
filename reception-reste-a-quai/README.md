# Réception – reste à quai (démo)

> ⚠️ Données entièrement fictives (~600 colis à quai, 7 expéditeurs).

## Le besoin

Après le déchargement d'un camion, ses colis doivent être rangés avant une **heure limite de promesse**. Les équipes ont besoin de voir en temps réel :
- quels camions ont encore des **colis à quai** ;
- combien de colis restent par camion, et **lesquels** ;
- quelles **travées** traiter en priorité (celles dont l'échéance arrive le plus vite, et celles déjà **hors promesse**).

## Comment ça marche

```
Extraction "reste à quai" (mise à jour toutes les 20 min, se vide pendant la mise à jour)
      │  script : copie de la dernière extraction complète
      ▼
Reste à quai récep
      │  formules : rattachement de chaque colis au bon camion (fenêtre entre deux archivages)
      ▼
Data volumes : colis restants par camion + liste des colis (pop-up "Détail")
      ▼
Application web : liste des camions, KPI, ordre de priorité des travées
```

## Règles métier

- **Heure limite de promesse** : heure de déchargement + 12 h (déchargé entre 6 h et 13 h), + 18 h (entre 13 h et 22 h), + 16 h sinon.
- **Rattachement des colis** : un colis est compté pour un camion si son heure de réception tombe entre l'archivage du camion précédent et celui du camion (`LET`, `FILTER`, `COUNTUNIQUEIFS`).
- **Priorisation** : les travées sont triées par échéance la plus proche ; celles qui ont dépassé l'échéance passent en rouge.

## Fonctionnalités

- Case **Détail** dans le Google Sheets → pop-up avec la liste des colis restants (déclencheur Apps Script) ;
- Application web : KPI, tableau des camions, bandeau des travées « en promesse » / « hors promesse », validation locale des lignes traitées.
- En démo, « maintenant » est figé sur le dernier archivage pour que l'exemple reste lisible.

## Captures

_(à ajouter : `captures/reception.png`)_

## Fichiers

- [`code/apps-script-traction-reception`](../code/apps-script-traction-reception) : `Code.gs` (fonctions `getRecepDashboardData`, `majResteAQuai`, `afficherDetail`) et `Index.html` (application web)
- [`donnees_fictives/reception/reste_a_quai.csv`](../donnees_fictives/reception) : extraction fictive des colis à quai
