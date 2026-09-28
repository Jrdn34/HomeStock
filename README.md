# StockMaison V2

V2 locale avec **FastAPI + SQLite**.

Fonctions : stock partagé PC/téléphone, scan code-barres, reconnaissance Open Food Facts, consommation/ajout rapide, seuil minimum, liste de courses automatique et PDF.

## Lancement Windows

```powershell
cd "CHEMIN\VERS\StockMaison-V2"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

PC : `http://localhost:8000`


Le fichier `stockmaison.db` est créé automatiquement. C'est lui qui rend le stock commun à tous les appareils.

### Scanner
La caméra directe peut être bloquée sur une adresse HTTP locale par certains navigateurs. La V2 propose donc aussi "Prendre une photo" et la saisie manuelle du code. Pour une caméra live fiable sur téléphone, il faudra ensuite activer HTTPS local.


## V2.2 — Scanner amélioré

Le scanner utilise maintenant `html5-qrcode` à la place de l'API navigateur `BarcodeDetector`.

Avantages :
- meilleure compatibilité Android/iPhone ;
- caméra arrière ;
- EAN-13, EAN-8, UPC-A, UPC-E, Code 128 ;
- scan continu ;
- reconnaissance automatique Open Food Facts après lecture ;
- scan d'une photo en secours ;
- saisie manuelle toujours disponible.

Important : la caméra nécessite toujours HTTPS sur téléphone.
\n\n## V2.3 - scanner 100 % servi localement\n\nLa page ne charge plus html5-qrcode depuis un CDN.\n\n### Premiere installation\n\nDans PowerShell :\n\n```powershell\n.\\setup_scanner.ps1\n```\n\nCette commande telecharge une seule fois `html5-qrcode.min.js` dans `static/`. Le telephone le chargera ensuite directement depuis StockMaison.\n\nVerifier que le fichier existe :\n\n```powershell\ndir .\\static\\html5-qrcode.min.js\n```\n\nIl doit faire environ 375 Ko.\n\n### Demarrage HTTPS simplifie\n\nSi tes fichiers `.pem` mkcert sont dans le dossier StockMaison :\n\n```powershell\n.\\start_https.ps1\n```\n\nLe script verifie automatiquement la bibliotheque, active le venv s'il existe, trouve le certificat et demarre Uvicorn sur le port 8443.\n

## Correction V2.4

La V2.3 téléchargeait `html5-qrcode.min.js` mais `index.html` ne le chargeait pas.
La V2.4 contient maintenant :

```html
<script src="/static/html5-qrcode.min.js"></script>
<script src="/static/app.js"></script>
```

dans cet ordre.

## V2.5 — Diagnostic caméra

La V2.5 :
- appelle `Html5Qrcode.getCameras()` avant le démarrage ;
- liste les caméras disponibles ;
- choisit automatiquement une caméra arrière quand son nom permet de l'identifier ;
- permet de sélectionner manuellement une caméra ;
- démarre le scanner avec l'ID matériel exact de la caméra ;
- affiche l'erreur technique complète si l'ouverture échoue.

Les erreurs affichées peuvent notamment être :
- `NotAllowedError` : permission refusée ;
- `NotFoundError` : aucune caméra disponible ;
- `NotReadableError` : caméra déjà utilisée ou inaccessible ;
- `OverconstrainedError` : paramètres caméra incompatibles ;
- `SecurityError` : contexte HTTPS non reconnu comme sécurisé.


## V2.6 — détection caméra native

La détection ne passe plus par `Html5Qrcode.getCameras()`.

Ordre utilisé :
1. `navigator.mediaDevices.getUserMedia({ video: true })`
2. autorisation réelle accordée par le navigateur
3. `navigator.mediaDevices.enumerateDevices()`
4. filtrage des `videoinput`
5. sélection automatique de la caméra arrière
6. démarrage de `html5-qrcode` avec le `deviceId` exact

Cela permet de savoir précisément si le problème vient :
- de `getUserMedia`
- de `enumerateDevices`
- ou de `html5-qrcode`.


## Correctif V2.6-fixed

Correction de l'erreur JavaScript :

`Cannot set properties of null (setting 'innerHTML')`

Le dialogue Scanner contient maintenant réellement :
- `#cameraSelect`
- `#reader`

Le vieux `<video id="video">` a été supprimé pour éviter le conflit avec `html5-qrcode`.


## V2.7 — lecture code-barres améliorée

Améliorations du scanner :
- EAN-13
- EAN-8
- UPC-A
- UPC-E
- Code 128
- Code 39
- 18 FPS
- zone de lecture plus large
- ratio caméra 16:9
- focus continu demandé quand le navigateur le permet
- BarcodeDetector natif utilisé automatiquement en accélération s'il existe
- `disableFlip` activé pour éviter des erreurs sur les codes linéaires

Conseil : tenir le produit à environ 10–20 cm, code-barres horizontal, lumière suffisante et image nette.


## Correctif V2.7-fixed

Correction de l'erreur :

`'CameraIdOrConfig' object should have exactly 1 key ... found 2 keys`

Cause :
la V2.7 transmettait `deviceId` et `advanced` ensemble dans le premier argument de `Html5Qrcode.start()`.

Correction :
- `cameraId` est maintenant passé directement comme premier argument ;
- les contraintes de focus sont appliquées après le démarrage avec `applyVideoConstraints()` si le navigateur le permet ;
- l'absence de support du focus continu n'empêche plus le scanner de fonctionner.


## V2.8 — Quagga2
Le moteur html5-qrcode a été remplacé par Quagga2 pour le scan des codes-barres linéaires.
Formats activés : EAN-13, EAN-8, UPC-A, UPC-E, Code 128 et Code 39.

Au premier lancement, `start_https.ps1` télécharge automatiquement `static/quagga.min.js` sur le PC. Ensuite le téléphone charge la bibliothèque depuis StockMaison, pas depuis Internet.

Lancer :
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start_https.ps1
```
