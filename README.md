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


