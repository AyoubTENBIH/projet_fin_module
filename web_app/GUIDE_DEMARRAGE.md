# 🚀 Guide de Démarrage Rapide - Application Web VillePropre

## 📋 Prérequis

- Python 3.10+
- Navigateur moderne (Chrome, Firefox, Edge)
- Connexion Internet (pour charger Leaflet.js et Chart.js depuis CDN)

## ⚡ Démarrage Rapide

### 1. Installer les dépendances backend

```powershell
cd web_app\backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Lancer le serveur Flask

```powershell
python app.py
```

Le serveur démarre sur **http://localhost:5000**

### 3. Ouvrir l'application

Ouvrir un navigateur et aller sur : **http://localhost:5000**

## 🎯 Utilisation

### Étape 1 : Ajouter des Points de Collecte

1. Cliquer sur **"Ajouter un Point"**
2. Cliquer sur la carte à l'emplacement souhaité
3. Remplir le formulaire :
   - Nom du point (ex: "Quartier Nord")
   - Volume estimé en kg (ex: 1200)
   - Priorité (haute/normale/basse)
4. Cliquer sur **"Ajouter"**

### Étape 2 : Ajouter des Camions

1. Cliquer sur **"Ajouter un Camion"**
2. Remplir le formulaire :
   - ID Camion (ex: 1)
   - Capacité en kg (ex: 5000)
   - Coût fixe en € (ex: 200)
   - Zones accessibles (IDs séparés par virgule, ex: "1,2,3")
3. Cliquer sur **"Ajouter"**

### Étape 3 : Lancer l'Optimisation Niveau 1

1. Cliquer sur **"Niveau 1 : Calculer Distances"**
2. Les chemins optimaux s'affichent sur la carte en bleu

### Étape 4 : Lancer l'Optimisation Niveau 2

1. Cliquer sur **"Niveau 2 : Affecter Zones"**
2. Les affectations camion ↔ zones s'affichent avec des couleurs différentes
3. Le dashboard affiche les statistiques

### Étape 5 : Simuler

1. Cliquer sur **"▶️ Simuler"**
2. Les camions se déplacent animés sur leurs trajets

## 🗺️ Carte

- **Point rouge** : Dépôt (centre de traitement)
- **Points bleus numérotés** : Points de collecte
- **Lignes colorées** : Trajets des camions après optimisation

## 📊 Dashboard

Affiche :
- Distance totale parcourue
- Coût total estimé
- Nombre de camions utilisés
- Taux d'utilisation moyen
- Graphique de répartition des charges

## 🔧 Dépannage

### Le serveur ne démarre pas

- Vérifier que le port 5000 n'est pas utilisé
- Vérifier que Flask est installé : `pip install Flask Flask-CORS`

### Les points ne s'affichent pas sur la carte

- Vérifier la console du navigateur (F12) pour les erreurs
- Vérifier que le serveur Flask est bien démarré

### L'API retourne une erreur

- Vérifier que les modules niveau1 et niveau2 sont accessibles
- Vérifier les chemins dans `api/niveau1_api.py` et `api/niveau2_api.py`

## 📝 Notes

- La carte utilise **Casablanca, Maroc** comme centre par défaut
- Les coordonnées sont converties automatiquement (lat/lng → x/y)
- Les connexions entre points sont générées automatiquement (points proches < 5 km)

## 🎨 Personnalisation

Pour changer la ville :
1. Modifier `CASABLANCA_CENTER` dans `frontend/js/map.js`
2. Ajuster le zoom initial si nécessaire
