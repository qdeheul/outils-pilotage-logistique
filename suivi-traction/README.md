# Suivi traction – respect des RDV transporteurs (démo)

> ⚠️ Données entièrement fictives (sept.–nov. 2026, ~1 000 camions, 7 expéditeurs, 11 transporteurs).

## Le besoin

Chaque camion qui arrive au centre de distribution a réservé un **créneau** (heure + type de contenu) dans un logiciel de prise de rendez-vous. Le responsable veut savoir, chaque semaine :
- quels camions arrivent **hors créneau** ou **en retard** (15-45 min, 45-90 min, +90 min) ;
- quels camions déclarent un **contenu faux** (le contenu réel, recalculé à partir des quantités, ne correspond pas au créneau réservé) ;
- quels **transporteurs** et quels **expéditeurs** posent problème.

## Comment ça marche

```
Réception live (camions du jour)
      │  archivage automatique
      ▼
Data volumes (historique)  +  Extractions du logiciel RDV (1 fichier / semaine, Drive)
      │                              │
      └──────── consolidation Apps Script (jointure sur le n° d'expédition) ───────┐
                                                                                   ▼
                     EditReporting : formules de contrôle (créneau, contenu, retards)
                                                                                   ▼
                     Application web : KPI, retards par transporteur, évolution hebdo / mensuelle
```

## Règles métier (formules Google Sheets)

- **Contenu réel** : recalculé à partir des quantités par type de produit (`MAP` + `LAMBDA`), car l'expéditeur se trompe parfois dans sa déclaration.
- **Créneau respecté** : on retrouve le rang du camion dans la journée (A, B, C…) et on vérifie qu'il correspond à la grille des créneaux de son expéditeur (`LET`, `SUMPRODUCT`, `INDEX` / `MATCH`, `SEARCH`).
- **Hors slot** : contrôle de la capacité du créneau horaire (camions co-chargés compris).
- **Tranches de retard** : écart entre heure prévue et heure d'arrivée.

## Ce que montre le tableau de bord

- Nombre de camions, palettes non conformes, écarts de palettes ;
- Taux de retard et répartition par tranche ;
- Tractions NOK (hors slot / contenu déclaré / contenu réel) ;
- Classement des transporteurs (taux de retard, alerte au-delà de 15 %) ;
- Évolution hebdomadaire et mensuelle ; filtres par expéditeur, semaine, mois ; interface FR / EN / ES.


## Fichiers

- [`code/apps-script-traction-reception/Code.gs`](../code/apps-script-traction-reception) : archivage, consolidation des extractions, données de l'application web
- `code/apps-script-traction-reception/site2.html` : tableau de bord « Suivi traction »
- [`donnees_fictives/suivi-traction`](../donnees_fictives/suivi-traction) : extrait de l'historique et une extraction hebdomadaire
