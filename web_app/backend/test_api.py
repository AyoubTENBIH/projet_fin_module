# -*- coding: utf-8 -*-
"""
Script de test pour vérifier que l'API fonctionne correctement
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_health():
    """Test du endpoint health"""
    print("🔍 Test du endpoint /api/health...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"✅ Status: {response.status_code}")
        print(f"   Réponse: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def test_niveau1():
    """Test du endpoint niveau 1"""
    print("\n🔍 Test du endpoint /api/niveau1/calculer-distances...")
    
    data = {
        "points": [
            {"id": 0, "x": 0, "y": 0, "nom": "Depot"},
            {"id": 1, "x": 2.5, "y": 3.1, "nom": "Point 1"},
            {"id": 2, "x": 5.2, "y": 4.8, "nom": "Point 2"}
        ],
        "connexions": [
            {"depart": 0, "arrivee": 1, "distance": None},
            {"depart": 1, "arrivee": 2, "distance": None}
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/niveau1/calculer-distances",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"   Matrice: {len(result.get('matrice_distances', []))}x{len(result.get('matrice_distances', [])[0] if result.get('matrice_distances') else [])}")
        print(f"   Chemins calculés: {len(result.get('chemins_calcules', []))}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def test_niveau2():
    """Test du endpoint niveau 2"""
    print("\n🔍 Test du endpoint /api/niveau2/optimiser...")
    
    data = {
        "points": [
            {"id": 0, "x": 0, "y": 0, "nom": "Depot"},
            {"id": 1, "x": 2.5, "y": 3.1, "nom": "Point 1"},
            {"id": 2, "x": 5.2, "y": 4.8, "nom": "Point 2"}
        ],
        "connexions": [
            {"depart": 0, "arrivee": 1, "distance": None},
            {"depart": 1, "arrivee": 2, "distance": None}
        ],
        "camions": [
            {
                "id": 1,
                "capacite": 5000,
                "cout_fixe": 200,
                "zones_accessibles": [1, 2],
                "position_initiale": {"x": 0, "y": 0}
            }
        ],
        "zones": [
            {
                "id": 1,
                "points": [1],
                "volume_moyen": 1200,
                "centre": {"x": 2.5, "y": 3.1},
                "priorite": "haute"
            },
            {
                "id": 2,
                "points": [2],
                "volume_moyen": 800,
                "centre": {"x": 5.2, "y": 4.8},
                "priorite": "normale"
            }
        ],
        "zones_incompatibles": []
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/niveau2/optimiser",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        print(f"   Affectations: {len(result.get('affectation', []))}")
        print(f"   Statistiques: {result.get('statistiques', {})}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 Tests de l'API VillePropre")
    print("=" * 60)
    print("\n⚠️  Assurez-vous que le serveur Flask est démarré (python app.py)")
    print("=" * 60)
    
    results = []
    results.append(test_health())
    results.append(test_niveau1())
    results.append(test_niveau2())
    
    print("\n" + "=" * 60)
    if all(results):
        print("✅ Tous les tests sont passés !")
    else:
        print("❌ Certains tests ont échoué")
    print("=" * 60)
