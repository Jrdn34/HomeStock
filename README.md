# StockMaison V2

Application locale de gestion de stock domestique (FastAPI + SQLite), utilisable depuis le PC et le téléphone.

## Fonctionnalités

- Stock partagé PC / téléphone
- Scan de code-barres et reconnaissance via Open Food Facts (internet requis)
- Consommation / ajout rapide
- Seuil minimum et liste de courses automatique (export PDF)

## Prérequis

- Windows, Python 3.10+
- PC et téléphone sur le même réseau Wi-Fi

## Installation

```powershell
cd "CHEMIN\VERS\StockMaison-V2"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Lancement (HTTP)

```powershell
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

- PC : `http://localhost:8000`
- Téléphone : `http://IP_DU_PC:8000` (trouve l'IP avec `ipconfig`)
- Si le téléphone n'accède pas à la page, autorise le port 8000 dans le pare-feu Windows.

La base `stockmaison.db` est créée automatiquement au premier lancement. C'est elle qui rend le stock commun à tous les appareils.

## Scanner et HTTPS

Les navigateurs bloquent souvent la caméra live en HTTP. En HTTP, utilise "Prendre une photo" ou la saisie manuelle du code.

Pour la caméra live sur téléphone, active le HTTPS local :

1. Installe [mkcert](https://github.com/FiloSottile/mkcert) puis `mkcert -install`
2. Génère ton certificat : `mkcert IP_DU_PC localhost 127.0.0.1`
3. Lance `start_https.ps1` (adapte les noms de fichiers `.pem` si besoin)
4. Installe la CA mkcert sur le téléphone pour que le certificat soit reconnu

Les certificats et la base de données ne sont pas versionnés : chacun génère les siens.

## Sécurité

L'application n'a pas d'authentification. À utiliser uniquement sur un réseau domestique de confiance.