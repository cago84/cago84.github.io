# Mes tâches – version PWA

Application web installable (HTML/CSS/JavaScript, sans dépendance ni outil de build).
Mêmes fonctions que l'app iOS : tâches cochables, priorités, catégories, échéances, rappels, filtres, recherche, thème Système/Clair/Sombre, hors-ligne.

## Tester en local
```powershell
cd c:\DATA\cline\TestIOS\PWA
python -m http.server 8080
```
Ouvrez http://localhost:8080 (le service worker fonctionne sur `localhost`).

## Installer sur iPhone
Une PWA doit être servie en **HTTPS** pour fonctionner sur l'iPhone. Hébergez le dossier `PWA/` sur GitHub Pages, Netlify, Cloudflare Pages ou Vercel (gratuit), puis :
1. Ouvrez l'adresse dans **Safari**.
2. Touchez Partager, puis « Sur l'écran d'accueil ».

## Export / Import
Menu **⋯ > Exporter / Importer**.
- **Exporter** crée un fichier `taches-AAAA-MM-JJ.json`. Sur iPhone, la feuille de partage s'ouvre (Enregistrer dans Fichiers, AirDrop, Mail...). Ailleurs, le fichier est téléchargé.
- **Importer** lit un fichier JSON exporté et **fusionne** : les tâches déjà présentes (même identifiant) sont ignorées, rien n'est écrasé ni supprimé. Les données invalides sont nettoyées ou ignorées.
- Utile pour sauvegarder, ou pour copier ses tâches d'un appareil à l'autre.

## Limites
- **Données :** stockées dans le navigateur (`localStorage`), propres à chaque appareil, sans synchronisation.
- **Rappels :** sans serveur, ils ne se déclenchent que lorsque l'app est ouverte ou récemment active. Sur iPhone, les notifications web exigent iOS 16.4 ou plus et que la PWA soit installée sur l'écran d'accueil. Pour des rappels fiables app fermée, il faudrait un serveur Web Push, ou garder l'app native.
- **Widget :** une PWA ne peut pas fournir de widget d'écran d'accueil. Le widget reste réservé à la version SwiftUI.
- **Mise à jour :** après modification des fichiers, changez `CACHE_VERSION` dans `sw.js`.
