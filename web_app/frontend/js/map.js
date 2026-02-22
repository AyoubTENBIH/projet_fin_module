// Gestion de la carte Leaflet et des points de collecte

// Configuration : Casablanca, Maroc
const CASABLANCA_CENTER = [33.5731, -7.5898];
const DEFAULT_ZOOM = 13;

// État global
let map;
let points = []; // [{id, lat, lng, nom, volume, priorite, marker, status, isDepot}]
let dechetteries = []; // [{id, lat, lng, nom, capacite_max, types_dechets, horaires, marker, type: "dechetterie"}]
let camions = []; // [{id, capacite, cout_fixe, zones_accessibles}]
let depotPoint = null; // Point sélectionné comme dépôt (référence à un point de points[])
let camionMarkers = [];
let niveau1Result = null;
let niveau2Result = null;
let isSelectingDepot = false; // Mode sélection du dépôt

// Références exposées pour Niveau 3
window.getVillePropreData = function() {
    return { points, camions, depotPoint, dechetteries, niveau2Result };
};

// Initialisation de la carte
function initMap() {
    try {
        // Vérifier que Leaflet est chargé
        if (typeof L === 'undefined') {
            console.error('❌ Leaflet n\'est pas chargé !');
            alert('Erreur : Leaflet n\'est pas chargé. Vérifiez votre connexion internet.');
            return;
        }
        
        // Vérifier que le conteneur existe
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('❌ Le conteneur #map n\'existe pas !');
            alert('Erreur : Le conteneur de la carte n\'existe pas.');
            return;
        }
        
        console.log('✅ Initialisation de la carte...');
        
        // Vider le conteneur au cas où il y aurait du contenu (message de chargement)
        mapContainer.innerHTML = '';
        
        map = L.map('map').setView(CASABLANCA_CENTER, DEFAULT_ZOOM);
        
        // Tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Le dépôt sera un point de collecte sélectionné, pas un marqueur séparé

        // Écouter les clics sur la carte
        map.on('click', onMapClick);
        
        // Forcer le redraw de la carte après un court délai
        setTimeout(() => {
            map.invalidateSize();
            console.log('✅ Carte initialisée avec succès');
            console.log('📍 Centre:', CASABLANCA_CENTER);
            console.log('🔍 Zoom:', DEFAULT_ZOOM);
            
        // Charger les données du niveau 1 (déchetteries)
        loadNiveau1Data();
        
        // Initialiser la liste des déchetteries
        updateDechetteriesList();
        }, 200);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
        alert('Erreur lors de l\'initialisation de la carte : ' + error.message);
    }
}

// Plus besoin de updateDepotMarker() - le dépôt est maintenant un point de collecte avec isDepot = true

// Fonction pour créer un gestionnaire de sélection de dépôt (pour points et déchetteries)
function createDepotSelectionHandler(point) {
    return function(e) {
        e.originalEvent.stopPropagation(); // Empêcher le clic de se propager à la carte
        
        // Désélectionner l'ancien dépôt s'il existe
        if (depotPoint && depotPoint.id !== point.id) {
            depotPoint.isDepot = false;
            // Mettre à jour selon le type
            if (point.type === 'dechetterie') {
                updateDechetterieMarker(depotPoint);
            } else {
                updatePointMarker(depotPoint);
            }
            console.log('🔄 Ancien dépôt désélectionné:', depotPoint.nom);
        }
        
        // Sélectionner ce point/déchetterie comme dépôt
        depotPoint = point;
        depotPoint.isDepot = true;
        
        console.log('📍 Sélection du dépôt via clic sur marqueur:', depotPoint.nom, 'isDepot:', depotPoint.isDepot);
        
        // Mettre à jour le marqueur visuellement selon le type
        if (point.type === 'dechetterie') {
            updateDechetterieMarker(depotPoint);
        } else {
            updatePointMarker(depotPoint);
        }
        updatePointsList();
        
        console.log('✅ Dépôt sélectionné:', depotPoint.nom, 'à', [depotPoint.lat, depotPoint.lng]);
        
        // Mettre à jour les coordonnées x/y pour les calculs
        updateDepotCoords();
        
        // Désactiver le mode sélection
        isSelectingDepot = false;
        const btn = document.getElementById('btn-select-depot');
        if (btn) {
            btn.classList.remove('active');
            btn.textContent = 'Choisir le Dépôt';
        }
        
        // Retirer les gestionnaires de clic des marqueurs
        points.forEach(p => {
            if (p.marker) {
                p.marker.off('click');
            }
        });
        dechetteries.forEach(d => {
            if (d.marker) {
                d.marker.off('click');
            }
        });
        
        // Confirmation visuelle
        alert(`✅ Dépôt sélectionné : ${depotPoint.nom}`);
    };
}

// Mettre à jour les coordonnées x/y du dépôt
function updateDepotCoords() {
    // Utiliser le point dépôt sélectionné
    if (!depotPoint) {
        window.depotXY = { x: '0.00', y: '0.00' }; // Valeur par défaut
        return;
    }
    window.depotXY = { x: depotPoint.x, y: depotPoint.y };
}

// Gestion du clic sur la carte
function onMapClick(e) {
    if (isSelectingDepot) {
        // Mode sélection du dépôt : on doit cliquer directement sur un marqueur de point ou déchetterie
        // Si on clique sur la carte (pas sur un marqueur), afficher un message
        alert('⚠️ Veuillez cliquer directement sur un point de collecte ou une déchetterie existant(e) pour le/la définir comme dépôt.\n\nLes points de collecte sont marqués par des cercles bleus et les déchetteries par des cercles violets sur la carte.');
        return;
    }
    
    // Vérifier quel modal est ouvert
    const modalPoint = document.getElementById('modal-point');
    const modalDechetterie = document.getElementById('modal-dechetterie');
    
    if (modalDechetterie && modalDechetterie.style.display === 'block') {
        // Modal déchetterie ouvert : stocker les coordonnées pour la déchetterie
        window.tempCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        // Afficher un message de confirmation
        alert(`✅ Emplacement sélectionné : ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}\n\nRemplissez le formulaire et cliquez sur "Ajouter".`);
    } else {
        // Par défaut : ouvrir le modal pour ajouter un point
        modalPoint.style.display = 'block';
        // Stocker temporairement les coordonnées
        window.tempCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    }
}

// Ajouter un point de collecte
function addPoint(nom, volume, priorite, lat, lng, customId = null) {
    // Utiliser l'ID personnalisé si fourni, sinon générer automatiquement
    const id = customId !== null ? customId : (window.nextPointId || points.length + 1);
    if (!window.nextPointId || customId !== null) {
        window.nextPointId = Math.max(id + 1, (window.nextPointId || points.length + 2));
    }
    
    // Convertir lat/lng en coordonnées x/y (approximation pour Casablanca)
    // Utiliser une projection simple : 1 degré ≈ 111 km
    const x = (lng - CASABLANCA_CENTER[1]) * 111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180);
    const y = (lat - CASABLANCA_CENTER[0]) * 111;

    const point = {
        id,
        lat,
        lng,
        x: x.toFixed(2),
        y: y.toFixed(2),
        nom,
        volume: parseFloat(volume),
        priorite,
        status: 'en_attente', // en_attente, en_cours, collecte
        isDepot: false // Indique si ce point est le dépôt
    };

    // Créer le marqueur avec statut
    updatePointMarker(point);

    points.push(point);
    
    // Si le mode sélection du dépôt est activé, ajouter le gestionnaire de clic
    if (isSelectingDepot && point.marker) {
        point.marker.on('click', createDepotSelectionHandler(point));
    }
    
    updatePointsList();
    return point;
}

// Mettre à jour le marqueur d'un point selon son statut
function updatePointMarker(point) {
    if (!point) {
        console.error('❌ updatePointMarker appelé avec point null/undefined');
        return;
    }
    
    if (point.marker) {
        map.removeLayer(point.marker);
        point.marker = null;
    }
    
    let bgColor, icon, statusText;
    
    // Si c'est le dépôt, utiliser la couleur rouge
    if (point.isDepot) {
        bgColor = '#dc3545'; // Rouge pour le dépôt
        icon = '🏭';
        statusText = 'Dépôt';
        console.log('🎨 Mise à jour marqueur DÉPÔT:', point.nom, 'couleur:', bgColor);
    } else {
        // Sinon, utiliser la couleur selon le statut
        switch(point.status) {
            case 'en_attente':
                bgColor = '#667eea';
                icon = '🗑️';
                statusText = 'En attente';
                break;
            case 'en_cours':
                bgColor = '#ffc107';
                icon = '⏳';
                statusText = 'En cours';
                break;
            case 'collecte':
                bgColor = '#28a745';
                icon = '✅';
                statusText = 'Collecté';
                break;
            default:
                bgColor = '#667eea';
                icon = '🗑️';
                statusText = 'En attente';
        }
    }
    
    const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
            className: 'point-icon',
            html: `<div style="background: ${bgColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 16px;">${icon}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]  // ✅ Centre exact du div 30x30
        })
    }).addTo(map);
    
    point.marker = marker;

    const popupContent = point.isDepot 
        ? `<b>🏭 ${point.nom}</b><br><b>DÉPÔT</b><br>Volume: ${point.volume || 0} kg<br>Priorité: ${point.priorite || 'N/A'}`
        : `<b>${point.nom}</b><br>Volume: ${point.volume || 0} kg<br>Priorité: ${point.priorite || 'N/A'}<br><b>Statut: ${statusText}</b>`;
    marker.bindPopup(popupContent);
    
    // Ajouter un popup au survol (hover) pour les points de collecte
    if (!point.isDepot) {
        const hoverPopup = L.popup({
            className: 'point-hover-popup',
            closeButton: false,
            autoClose: false,
            closeOnClick: false,
            offset: [0, -35]
        });
        
        const hoverContent = `
            <div class="point-hover-info">
                <strong>${point.nom}</strong><br>
                <span>Volume: ${point.volume} kg</span><br>
                <span>Priorité: ${point.priorite}</span><br>
                <span>ID: ${point.id}</span>
            </div>
        `;
        hoverPopup.setContent(hoverContent);
        
        // Utiliser les événements DOM directement sur l'élément du marqueur
        marker.on('add', function() {
            const iconElement = marker._icon;
            if (iconElement) {
                iconElement.style.cursor = 'pointer';
                
                iconElement.addEventListener('mouseenter', function(e) {
                    const latlng = marker.getLatLng();
                    hoverPopup.setLatLng(latlng).openOn(map);
                });
                
                iconElement.addEventListener('mouseleave', function(e) {
                    // Petit délai pour permettre de passer la souris sur le popup
                    setTimeout(() => {
                        if (!hoverPopup._container || !hoverPopup._container.matches(':hover')) {
                            map.closePopup(hoverPopup);
                        }
                    }, 100);
                });
            }
        });
        
        // Garder le popup ouvert si la souris est dessus
        hoverPopup.on('add', function() {
            const container = hoverPopup._container;
            if (container) {
                container.addEventListener('mouseenter', function() {
                    // Le popup reste ouvert
                });
                container.addEventListener('mouseleave', function() {
                    map.closePopup(hoverPopup);
                });
            }
        });
    }
    
    // Le gestionnaire de clic pour la sélection du dépôt sera ajouté dynamiquement
    // quand le mode sélection est activé (voir btn-select-depot event listener)
    
    point.marker = marker;
    
    // Forcer le redraw de la carte pour s'assurer que le marqueur est visible
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
    
    console.log('✅ Marqueur mis à jour pour:', point.nom, 'isDepot:', point.isDepot, 'couleur:', bgColor);
}

// Mettre à jour la liste des points dans le panneau
function updatePointsList() {
    const list = document.getElementById('points-list');
    list.innerHTML = '';
    
    points.forEach(p => {
        const item = document.createElement('div');
        item.className = 'point-item';
        
        // Ajouter un indicateur visuel si c'est le dépôt
        const depotBadge = p.isDepot ? '<span style="color: #dc3545; font-weight: bold; margin-right: 5px;">🏭 DÉPÔT</span>' : '';
        
        let statusBadge = '';
        switch(p.status) {
            case 'en_attente':
                statusBadge = '<span style="color: #667eea;">⏳</span>';
                break;
            case 'en_cours':
                statusBadge = '<span style="color: #ffc107;">⏳</span>';
                break;
            case 'collecte':
                statusBadge = '<span style="color: #28a745;">✅</span>';
                break;
        }
        
        item.innerHTML = `
            <span>${depotBadge}${statusBadge} ${p.nom}</span>
            <span>${p.volume} kg</span>
        `;
        list.appendChild(item);
    });
}

// Ajouter un camion
function addCamion(id, capacite, cout_fixe, zones_accessibles) {
    // Parser les zones accessibles (peut être vide pour permettre l'accès à toutes les zones)
    let zonesList = [];
    if (zones_accessibles && zones_accessibles.trim() !== '') {
        zonesList = zones_accessibles.split(',').map(z => parseInt(z.trim())).filter(z => !isNaN(z));
    }
    // Si zonesList est vide, le camion peut accéder à toutes les zones (universel)
    
    const camion = {
        id: parseInt(id),
        capacite: parseFloat(capacite),
        cout_fixe: parseFloat(cout_fixe),
        zones_accessibles: zonesList // Vide = accès universel, sinon liste des IDs de zones
    };
    
    camions.push(camion);
    updateCamionsList();
    
    // Afficher un message informatif
    if (zonesList.length === 0) {
        console.log(`✅ Camion ${camion.id} ajouté avec accès universel (toutes les zones)`);
    } else {
        console.log(`✅ Camion ${camion.id} ajouté avec accès aux zones: ${zonesList.join(', ')}`);
    }
    
    return camion;
}

// Mettre à jour la liste des camions
function updateCamionsList() {
    const list = document.getElementById('camions-list');
    list.innerHTML = '';
    
    camions.forEach(c => {
        const item = document.createElement('div');
        item.className = 'camion-item';
        const zonesInfo = c.zones_accessibles && c.zones_accessibles.length > 0 
            ? `Zones: ${c.zones_accessibles.join(', ')}`
            : 'Zones: Toutes (universel)';
        item.innerHTML = `
            <span><strong>Camion ${c.id}</strong></span>
            <span>${c.capacite} kg</span>
            <small style="display: block; color: #666; font-size: 0.85em; margin-top: 3px;">${zonesInfo}</small>
        `;
        list.appendChild(item);
    });
}

// Calculer les connexions automatiques entre points proches
function generateConnections() {
    const connexions = [];
    
    if (!depotPoint) {
        console.warn('⚠️ Pas de dépôt défini pour générer les connexions');
        return connexions;
    }
    
    const allPoints = [
        {id: 0, x: parseFloat(depotPoint.x), y: parseFloat(depotPoint.y), nom: depotPoint.nom || "Depot"}, 
        ...points.map(p => ({
            id: p.id,
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            nom: p.nom
        }))
    ];

    // Connexions depuis le dépôt vers les 3 premiers points
    for (let i = 1; i <= Math.min(3, points.length); i++) {
        connexions.push({ depart: 0, arrivee: i, distance: null });
    }

    // Connexions entre points proches (distance < 5 km)
    for (let i = 1; i < allPoints.length; i++) {
        for (let j = i + 1; j < allPoints.length; j++) {
            const dx = allPoints[i].x - allPoints[j].x;
            const dy = allPoints[i].y - allPoints[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5) { // 5 km
                connexions.push({ depart: i, arrivee: j, distance: null });
            }
        }
    }

    return connexions;
}

// Connexions pour Niveau 3 (inclut déchetteries, comme Niveau 1/2)
function buildConnexionsForNiveau3() {
    const connexions = generateConnections();
    if (typeof dechetteries !== 'undefined') {
        dechetteries.forEach(d => {
            connexions.push({ depart: 0, arrivee: d.id, distance: null });
            points.forEach(p => {
                const dx = parseFloat(d.x) - parseFloat(p.x);
                const dy = parseFloat(d.y) - parseFloat(p.y);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 5) connexions.push({ depart: p.id, arrivee: d.id, distance: null });
            });
        });
    }
    return connexions;
}
window.buildConnexionsForNiveau3 = buildConnexionsForNiveau3;

// Mettre à jour le marqueur d'une déchetterie
function updateDechetterieMarker(dechetterie) {
    if (!dechetterie) {
        console.error('❌ updateDechetterieMarker appelé avec déchetterie null/undefined');
        return;
    }
    
    if (dechetterie.marker) {
        map.removeLayer(dechetterie.marker);
        dechetterie.marker = null;
    }
    
    let bgColor, icon;
    
    // Si c'est le dépôt, utiliser la couleur rouge
    if (dechetterie.isDepot) {
        bgColor = '#dc3545'; // Rouge pour le dépôt
        icon = '🏭';
        console.log('🎨 Mise à jour marqueur DÉCHETTERIE DÉPÔT:', dechetterie.nom, 'couleur:', bgColor);
    } else {
        // Sinon, utiliser la couleur violette pour les déchetteries
        bgColor = '#9b59b6'; // Violet pour les déchetteries
        icon = '🏭';
    }
    
    const marker = L.marker([dechetterie.lat, dechetterie.lng], {
        icon: L.divIcon({
            className: 'dechetterie-icon',
            html: `<div style="background: ${bgColor}; width: 35px; height: 35px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 18px;">${icon}</div>`,
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
        })
    }).addTo(map);
    
    const typesText = dechetterie.types_dechets && dechetterie.types_dechets.length > 0 
        ? dechetterie.types_dechets.join(', ') 
        : 'Tous types';
    const capaciteText = dechetterie.capacite_max > 0 
        ? `${dechetterie.capacite_max} kg` 
        : 'Capacité illimitée';
    
    const popupContent = dechetterie.isDepot
        ? `<b>🏭 ${dechetterie.nom}</b><br><b>DÉPÔT</b><br>Capacité: ${capaciteText}<br>Types acceptés: ${typesText}`
        : `<b>🏭 ${dechetterie.nom}</b><br><b>DÉCHETTERIE</b><br><small>Centre de traitement</small><br>Capacité: ${capaciteText}<br>Types acceptés: ${typesText}<br><small>Les camions y déposent les déchets collectés</small>`;
    marker.bindPopup(popupContent);
    
    dechetterie.marker = marker;
}

// Ajouter une déchetterie sur la carte
function addDechetterie(dechetterieData) {
    // Convertir x/y en lat/lng (inverse de la conversion dans addPoint)
    const lat = CASABLANCA_CENTER[0] + (parseFloat(dechetterieData.y) / 111);
    const lng = CASABLANCA_CENTER[1] + (parseFloat(dechetterieData.x) / (111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180)));
    
    const dechetterie = {
        id: dechetterieData.id,
        lat,
        lng,
        x: dechetterieData.x,
        y: dechetterieData.y,
        nom: dechetterieData.nom || `Déchetterie ${dechetterieData.id}`,
        capacite_max: dechetterieData.capacite_max || 0,
        types_dechets: dechetterieData.types_dechets || [],
        horaires: dechetterieData.horaires || {},
        type: "dechetterie",
        isDepot: false
    };
    
    // Créer le marqueur avec updateDechetterieMarker
    updateDechetterieMarker(dechetterie);
    
    // Si le mode sélection du dépôt est activé, ajouter le gestionnaire de clic
    if (isSelectingDepot && dechetterie.marker) {
        dechetterie.marker.on('click', createDepotSelectionHandler(dechetterie));
    }
    
    dechetteries.push(dechetterie);
    updateDechetteriesList();
    
    return dechetterie;
}

// Mettre à jour la liste des déchetteries dans l'interface
function updateDechetteriesList() {
    const list = document.getElementById('dechetteries-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (dechetteries.length === 0) {
        list.innerHTML = '<div style="color: #666; font-size: 12px; padding: 5px;">Aucune déchetterie</div>';
        return;
    }
    
    dechetteries.forEach(d => {
        const item = document.createElement('div');
        item.className = 'point-item';
        
        const depotBadge = d.isDepot ? '<span style="color: #dc3545; font-weight: bold; margin-right: 5px;">🏭 DÉPÔT</span>' : '';
        const capaciteText = d.capacite_max > 0 ? `${d.capacite_max} kg` : 'Illimitée';
        const typesText = d.types_dechets && d.types_dechets.length > 0 
            ? d.types_dechets.join(', ') 
            : 'Tous types';
        
        item.innerHTML = `
            <span>${depotBadge}🏭 ${d.nom}</span>
            <span style="font-size: 11px; color: #666;">Cap: ${capaciteText}</span>
        `;
        list.appendChild(item);
    });
}

// Charger les déchetteries depuis les données JSON
function loadDechetteries(dechetteriesData) {
    if (!dechetteriesData || !Array.isArray(dechetteriesData)) {
        return;
    }
    
    // Nettoyer les anciennes déchetteries
    dechetteries.forEach(d => {
        if (d.marker) {
            map.removeLayer(d.marker);
        }
    });
    dechetteries = [];
    
    // Ajouter les nouvelles déchetteries
    dechetteriesData.forEach(d => {
        addDechetterie(d);
    });
    updateDechetteriesList();
}

// Charger les données depuis input_niveau1.json
async function loadNiveau1Data() {
    try {
        const response = await fetch('/niveau1/data/input_niveau1.json');
        if (!response.ok) {
            console.warn('⚠️ Impossible de charger input_niveau1.json');
            return;
        }
        const data = await response.json();
        
        // Charger les déchetteries si présentes
        if (data.dechetteries && Array.isArray(data.dechetteries)) {
            loadDechetteries(data.dechetteries);
            console.log(`✅ ${data.dechetteries.length} déchetterie(s) chargée(s)`);
        }
    } catch (error) {
        console.warn('⚠️ Erreur lors du chargement des données niveau 1:', error);
    }
}

// Lancer l'optimisation Niveau 1
async function runNiveau1() {
    if (points.length === 0) {
        alert('Veuillez ajouter au moins un point de collecte');
        return;
    }
    
    if (!depotPoint) {
        alert('Veuillez sélectionner un point de collecte ou une déchetterie comme dépôt');
        return;
    }

    const allPoints = [
        { id: 0, x: parseFloat(depotPoint.x), y: parseFloat(depotPoint.y), nom: depotPoint.nom || "Depot" },
        ...points.map(p => ({
            id: p.id,
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            nom: p.nom
        }))
    ];
    
    // Inclure les déchetteries dans les points pour le calcul des distances
    const dechetteriesPoints = dechetteries.map(d => ({
        id: d.id,
        x: parseFloat(d.x),
        y: parseFloat(d.y),
        nom: d.nom
    }));

    const connexions = generateConnections();
    
    // Ajouter les connexions vers les déchetteries
    dechetteries.forEach(d => {
        // Connecter chaque déchetterie au dépôt
        connexions.push({ depart: 0, arrivee: d.id, distance: null });
        // Connecter aux points proches (distance < 5 km)
        points.forEach(p => {
            const dx = parseFloat(d.x) - parseFloat(p.x);
            const dy = parseFloat(d.y) - parseFloat(p.y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5) {
                connexions.push({ depart: p.id, arrivee: d.id, distance: null });
            }
        });
    });

    try {
        const response = await fetch('/api/niveau1/calculer-distances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                points: allPoints, 
                connexions,
                dechetteries: dechetteries.map(d => ({
                    id: d.id,
                    x: parseFloat(d.x),
                    y: parseFloat(d.y),
                    nom: d.nom,
                    capacite_max: d.capacite_max,
                    types_dechets: d.types_dechets,
                    horaires: d.horaires
                }))
            })
        });

        const result = await response.json();
        niveau1Result = result;

        // Enrichir les chemins avec les vraies distances OSRM
        // Créer un mapping des points pour obtenir les coordonnées lat/lng
        const allPointsMap = new Map();
        allPointsMap.set(0, { lat: depotPoint.lat, lng: depotPoint.lng });
        points.forEach(p => allPointsMap.set(p.id, { lat: p.lat, lng: p.lng }));
        dechetteries.forEach(d => allPointsMap.set(d.id, { lat: d.lat, lng: d.lng }));

        // Enrichir chaque chemin avec la vraie distance OSRM
        const routePromises = result.chemins_calcules.map(async (chemin) => {
            // Obtenir les coordonnées des points du chemin
            const cheminPoints = chemin.chemin.map(id => {
                const point = allPointsMap.get(id);
                return point ? { lat: point.lat, lng: point.lng } : null;
            }).filter(p => p !== null);

            if (cheminPoints.length >= 2) {
                try {
                    // Obtenir la route réelle via OSRM
                    const route = await getFullRoute(cheminPoints);
                    if (route && route.totalDistance !== null) {
                        // Mettre à jour la distance avec la vraie distance OSRM
                        chemin.distance = route.totalDistance;
                    }
                } catch (error) {
                    console.warn(`Erreur lors de l'enrichissement de la distance pour le chemin ${chemin.depart} → ${chemin.arrivee}:`, error);
                    // Garder la distance originale si OSRM échoue
                }
            }
            return chemin;
        });

        // Limiter les requêtes parallèles pour éviter le rate limiting
        const enrichedChemins = await batchRouteRequests(routePromises, 3);

        // Mettre à jour le résultat avec les chemins enrichis
        niveau1Result.chemins_calcules = enrichedChemins;

        // Sauvegarder le cache OSRM après les calculs
        if (typeof saveOSRMCache === 'function') {
            saveOSRMCache();
        }

        // Afficher les chemins sur la carte
        displayPaths(niveau1Result.chemins_calcules);
        
        alert(`Niveau 1 terminé ! ${niveau1Result.chemins_calcules.length} chemins calculés avec distances réelles.\n\nLes routes OSRM ont été mises en cache pour éviter de les recalculer.`);
    } catch (error) {
        alert('Erreur lors du calcul des distances: ' + error.message);
    }
}

// Cache pour stocker les routes déjà calculées
// Le cache est maintenant géré par template.js avec localStorage
if (!window.routeCache) {
    window.routeCache = {};
}

// Stockage des routes optimisées avec déchetteries
let routesOptimiseesResult = null;

// Lancer l'optimisation des routes avec déchetteries
async function runRoutesOptimisees() {
    if (points.length === 0) {
        alert('Veuillez ajouter au moins un point de collecte');
        return;
    }
    
    if (!depotPoint) {
        alert('Veuillez sélectionner un point de collecte ou une déchetterie comme dépôt');
        return;
    }
    
    if (camions.length === 0) {
        alert('Veuillez ajouter au moins un camion');
        return;
    }
    
    if (dechetteries.length === 0) {
        alert('⚠️ Aucune déchetterie configurée !\n\nLes déchetteries sont essentielles pour cette optimisation.\nAjoutez au moins une déchetterie pour que les camions puissent y déposer leurs déchets.');
        return;
    }
    
    // Préparer les données du dépôt
    const depotData = {
        id: 0,
        x: parseFloat(depotPoint.x),
        y: parseFloat(depotPoint.y),
        nom: depotPoint.nom || "Dépôt"
    };
    
    // Préparer les points de collecte (exclure le dépôt)
    const pointsDeCollecte = points.filter(p => !p.isDepot);
    const pointsData = pointsDeCollecte.map(p => ({
        id: p.id,
        x: parseFloat(p.x),
        y: parseFloat(p.y),
        nom: p.nom,
        volume: p.volume || 0,
        priorite: p.priorite || 'normale'
    }));
    
    // Préparer les déchetteries
    const dechetteriesData = dechetteries.map(d => ({
        id: d.id,
        x: parseFloat(d.x),
        y: parseFloat(d.y),
        nom: d.nom,
        capacite_max: d.capacite_max || 0
    }));
    
    // Préparer les camions
    const camionsData = camions.map(c => ({
        id: c.id,
        capacite: c.capacite,
        cout_fixe: c.cout_fixe,
        zones_accessibles: c.zones_accessibles || []
    }));
    
    console.log('📤 Envoi de la requête d\'optimisation des routes...');
    console.log('- Dépôt:', depotData);
    console.log('- Points de collecte:', pointsData.length);
    console.log('- Déchetteries:', dechetteriesData.length);
    console.log('- Camions:', camionsData.length);
    
    // Afficher un message de chargement (overlay + popup)
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-routes-optimisees';
    loadingOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    loadingOverlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center; min-width: 320px;">
            <div style="font-size: 48px; margin-bottom: 15px;">⏳</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Optimisation en cours...</div>
            <div style="color: #666; font-size: 14px;">
                Nearest Neighbor → 2-opt → 3-opt → Or-opt → Recuit simulé<br>
                <em>Veuillez patienter (5-30 sec)</em>
            </div>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Sécurité : retirer l'overlay après 90s max (évite blocage permanent)
    const safetyTimeout = setTimeout(() => {
        const el = document.getElementById('loading-routes-optimisees');
        if (el) {
            el.remove();
            alert('Le chargement prend plus de temps que prévu. Vérifiez la console (F12) ou désactivez "Utiliser OSRM" pour accélérer.');
        }
    }, 90000);
    
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 300000);
        const response = await fetch('/api/routes/optimiser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                depot: depotData,
                points: pointsData,
                dechetteries: dechetteriesData,
                camions: camionsData,
                use_osrm: document.getElementById('use-osrm-routes')?.checked ?? false
            })
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        console.log('✅ Résultat de l\'optimisation:', result);
        routesOptimiseesResult = result;
        
        // Afficher les routes sur la carte
        await displayRoutesOptimisees(result);
        
        // Mettre à jour le dashboard avec les statistiques
        updateDashboardRoutesOptimisees(result.statistiques);
        
        // Activer le bouton de simulation
        document.getElementById('btn-simuler').disabled = false;
        
        // Afficher le bouton d'animation
        const btnAnimate = document.getElementById('btn-animate-routes');
        if (btnAnimate) {
            btnAnimate.style.display = 'inline-block';
        }
        
        // Préparer le résumé
        const stats = result.statistiques;
        const nbVisitesDech = result.routes.reduce((sum, r) => sum + r.nb_visites_dechetterie, 0);
        
        let msg = `✅ Optimisation terminée !\n\n📊 Statistiques :\n` +
            `• Distance totale : ${stats.distance_totale.toFixed(2)} km\n` +
            `• Volume collecté : ${stats.volume_total_collecte.toFixed(0)} kg\n` +
            `• Camions utilisés : ${stats.nb_camions_utilises}\n` +
            `• Visites aux déchetteries : ${nbVisitesDech}\n`;
        if (stats.borne_inferieure_km != null) {
            msg += `• Borne inférieure (MST) : ${stats.borne_inferieure_km.toFixed(2)} km\n`;
            msg += `• Gap qualité : ${stats.gap_pourcent != null ? stats.gap_pourcent : '-'}%\n`;
        }
        msg += (stats.use_osrm ? '\n🗺️ Distances OSRM (routières réelles)\n' : '') +
            `\n🎬 Voulez-vous voir l'animation progressive des routes ?`;
        
        const userWantsAnimation = confirm(msg);
        
        if (userWantsAnimation && typeof animateRoutesFromResult === 'function') {
            // Lancer l'animation
            animateRoutesFromResult(result);
        }
        
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('❌ Erreur lors de l\'optimisation des routes:', error);
        const msg = error.name === 'AbortError' 
            ? 'Le serveur met trop de temps à répondre (timeout 5 min). Décochez OSRM ou réduisez le nombre de points.' 
            : error.message;
        alert('Erreur lors de l\'optimisation des routes: ' + msg);
    } finally {
        clearTimeout(safetyTimeout); // Annuler le safety timeout
        // Retirer le message de chargement
        const loadingElement = document.getElementById('loading-routes-optimisees');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Afficher les routes optimisées sur la carte
async function displayRoutesOptimisees(result) {
    // Nettoyer les anciens chemins
    if (window.routesOptimiseesLayers) {
        window.routesOptimiseesLayers.forEach(layer => map.removeLayer(layer));
    }
    window.routesOptimiseesLayers = [];
    
    // Nettoyer aussi les autres couches de routes
    if (window.pathLayers) {
        window.pathLayers.forEach(layer => map.removeLayer(layer));
    }
    if (window.affectationLayers) {
        window.affectationLayers.forEach(layer => map.removeLayer(layer));
    }
    
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#ff9a8b', '#a8edea', '#fed6e3'];
    
    // Afficher un message de chargement
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-display-routes';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<div style="font-size: 18px; margin-bottom: 10px;">🗺️</div><div>Chargement des routes OSRM...</div>';
    document.body.appendChild(loadingMsg);
    
    try {
        for (let idx = 0; idx < result.routes.length; idx++) {
            const route = result.routes[idx];
            const color = colors[idx % colors.length];
            
            // Construire le tableau de waypoints avec lat/lng
            const waypointsLatLng = route.waypoints.map(wp => {
                // Convertir x/y en lat/lng
                const lat = CASABLANCA_CENTER[0] + (wp.y / 111);
                const lng = CASABLANCA_CENTER[1] + (wp.x / (111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180)));
                return { lat, lng, ...wp };
            });
            
            if (waypointsLatLng.length < 2) continue;
            
            // Obtenir la route réelle via OSRM
            const osrmRoute = await getFullRoute(waypointsLatLng.map(p => ({ lat: p.lat, lng: p.lng })));
            
            if (osrmRoute && osrmRoute.coordinates && osrmRoute.coordinates.length >= 2) {
                // Tracer la polyline avec les vraies coordonnées OSRM
                const polyline = L.polyline(osrmRoute.coordinates, {
                    color: color,
                    weight: 5,
                    opacity: 0.85
                }).addTo(map);
                
                // Construire le popup avec les détails des étapes
                const etapesHtml = route.details_etapes.map((etape, i) => {
                    let icon = '📍';
                    let actionText = etape.action;
                    let bgColor = '#f0f0f0';
                    
                    if (etape.type === 'depot') {
                        icon = '🏭';
                        bgColor = '#ffe0e0';
                    } else if (etape.type === 'collecte') {
                        icon = '🗑️';
                        bgColor = '#e0f0ff';
                        actionText = `COLLECTE +${etape.volume_action} kg`;
                    } else if (etape.type === 'dechetterie') {
                        icon = '🏭';
                        bgColor = '#e0ffe0';
                        actionText = `DÉCHARGE -${etape.volume_action} kg`;
                    }
                    
                    return `<div style="background: ${bgColor}; padding: 5px 8px; margin: 2px 0; border-radius: 4px; font-size: 12px;">
                        ${i + 1}. ${icon} ${etape.point_nom} - <strong>${actionText}</strong>
                        <span style="color: #666;">(Charge: ${etape.charge_apres} kg)</span>
                    </div>`;
                }).join('');
                
                const distanceText = osrmRoute.totalDistance !== null 
                    ? `${osrmRoute.totalDistance.toFixed(2)} km`
                    : `${route.distance_totale.toFixed(2)} km (estimé)`;
                const durationText = osrmRoute.totalDuration !== null 
                    ? `${Math.round(osrmRoute.totalDuration)} min`
                    : 'Non disponible';
                
                polyline.bindPopup(`
                    <div style="min-width: 280px; max-height: 400px; overflow-y: auto;">
                        <b style="font-size: 16px;">🚛 Camion ${route.camion_id}</b>
                        <hr style="margin: 8px 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                            <div><strong>Distance :</strong> ${distanceText}</div>
                            <div><strong>Durée :</strong> ${durationText}</div>
                            <div><strong>Volume :</strong> ${route.volume_total_collecte} kg</div>
                            <div><strong>Déchetteries :</strong> ${route.nb_visites_dechetterie}x</div>
                        </div>
                        <div style="border-top: 1px solid #ddd; padding-top: 8px;">
                            <strong>📋 Étapes du parcours :</strong>
                            <div style="margin-top: 5px;">${etapesHtml}</div>
                        </div>
                    </div>
                `);
                
                window.routesOptimiseesLayers.push(polyline);
            }
            
            // Ajouter des marqueurs pour les visites de déchetterie
            for (const wp of waypointsLatLng) {
                if (wp.type === 'dechetterie') {
                    const dechetterieMarker = L.marker([wp.lat, wp.lng], {
                        icon: L.divIcon({
                            className: 'dechetterie-visit-icon',
                            html: `<div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px;">♻️</div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(map);
                    
                    dechetterieMarker.bindPopup(`
                        <b>♻️ Arrêt Déchetterie</b><br>
                        ${wp.nom}<br>
                        <small>Camion ${route.camion_id} décharge ici</small>
                    `);
                    
                    window.routesOptimiseesLayers.push(dechetterieMarker);
                }
            }
        }
        
        // Sauvegarder le cache OSRM
        if (typeof saveOSRMCache === 'function') {
            saveOSRMCache();
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'affichage des routes:', error);
    } finally {
        // Retirer le message de chargement
        const loadingElement = document.getElementById('loading-display-routes');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Mettre à jour le dashboard avec les statistiques des routes optimisées
function updateDashboardRoutesOptimisees(stats) {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'block';
    }
    
    // Mettre à jour les valeurs
    const statDistance = document.getElementById('stat-distance');
    if (statDistance) {
        statDistance.textContent = `${stats.distance_totale.toFixed(2)} km`;
    }
    
    const statCamions = document.getElementById('stat-camions');
    if (statCamions) {
        statCamions.textContent = `${stats.nb_camions_utilises}`;
    }
    
    // Calculer un coût estimé (basé sur la distance)
    const coutEstime = stats.distance_totale * 0.5 + stats.volume_total_collecte * 0.1;
    const statCout = document.getElementById('stat-cout');
    if (statCout) {
        statCout.textContent = `${coutEstime.toFixed(2)} €`;
    }
    
    // Taux d'utilisation / Visites
    const statTaux = document.getElementById('stat-taux');
    if (statTaux) {
        let txt = `${stats.nb_total_visites_dechetteries} visites déch.`;
        if (stats.gap_pourcent != null) {
            txt += ` | Gap ${stats.gap_pourcent}%`;
        }
        statTaux.textContent = txt;
    }
}

// Fonction utilitaire pour obtenir une route réelle entre deux points via OSRM
async function getRealRoute(pointA, pointB) {
    // Créer une clé de cache
    const cacheKey = `${pointA.lat},${pointA.lng}→${pointB.lat},${pointB.lng}`;
    const cacheKeyReverse = `${pointB.lat},${pointB.lng}→${pointA.lat},${pointA.lng}`;
    
    // Vérifier le cache
    if (window.routeCache[cacheKey]) {
        return window.routeCache[cacheKey];
    }
    if (window.routeCache[cacheKeyReverse]) {
        // Pour une route inverse, inverser les coordonnées
        const cached = window.routeCache[cacheKeyReverse];
        return {
            coordinates: [...cached.coordinates].reverse(),
            distance: cached.distance,
            duration: cached.duration
        };
    }
    
    try {
        // OSRM utilise l'ordre (longitude, latitude) dans l'URL
        const url = `https://router.project-osrm.org/route/v1/driving/${pointA.lng},${pointA.lat};${pointB.lng},${pointB.lat}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        const route = data.routes[0];
        
        // Convertir les coordonnées de [lng, lat] (OSRM) vers [lat, lng] (Leaflet)
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        const result = {
            coordinates: coordinates,
            distance: route.distance / 1000, // Convertir mètres en km
            duration: route.duration // En secondes
        };
        
        // Mettre en cache
        window.routeCache[cacheKey] = result;
        
        return result;
    } catch (error) {
        console.warn(`⚠️ Erreur OSRM pour ${pointA.lat},${pointA.lng} → ${pointB.lat},${pointB.lng}:`, error);
        // Fallback : ligne droite
        return {
            coordinates: [[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]],
            distance: null,
            duration: null
        };
    }
}

// Fonction pour obtenir une route complète avec plusieurs waypoints
async function getFullRoute(pointsArray) {
    if (pointsArray.length < 2) {
        return {
            coordinates: pointsArray.map(p => [p.lat, p.lng]),
            totalDistance: 0,
            totalDuration: 0
        };
    }
    
    // Créer une clé de cache pour la route complète
    const cacheKey = pointsArray.map(p => `${p.lat},${p.lng}`).join('→');
    
    if (window.routeCache[cacheKey]) {
        return window.routeCache[cacheKey];
    }
    
    try {
        // Construire l'URL OSRM avec tous les waypoints
        // Format: {lng1},{lat1};{lng2},{lat2};...
        const waypoints = pointsArray.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
        
        // Timeout 15s pour éviter le blocage si OSRM est lent ou rate-limited
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        const route = data.routes[0];
        
        // Convertir les coordonnées de [lng, lat] (OSRM) vers [lat, lng] (Leaflet)
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        const result = {
            coordinates: coordinates,
            totalDistance: route.distance / 1000, // Convertir mètres en km
            totalDuration: route.duration / 60 // Convertir secondes en minutes
        };
        
        // Mettre en cache (sauvegarde automatique dans localStorage via template.js)
        if (typeof cacheOSRMRoute === 'function') {
            cacheOSRMRoute(cacheKey, result);
        } else {
            window.routeCache[cacheKey] = result;
        }
        
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`⚠️ OSRM timeout (15s) - utilisation des lignes droites`);
        } else {
            console.warn(`⚠️ Erreur OSRM pour route multi-stops:`, error);
        }
        // Fallback : lignes droites entre les points (évite le blocage)
        const coordinates = pointsArray.map(p => [p.lat, p.lng]);
        return {
            coordinates: coordinates,
            totalDistance: null,
            totalDuration: null
        };
    }
}

// Fonction pour limiter les requêtes parallèles (rate limiting)
async function batchRouteRequests(routePromises, maxConcurrent = 3) {
    const results = [];
    for (let i = 0; i < routePromises.length; i += maxConcurrent) {
        const batch = routePromises.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
        
        // Délai de 100ms entre les batches pour éviter le rate limiting
        if (i + maxConcurrent < routePromises.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return results;
}

// Afficher les chemins sur la carte
async function displayPaths(chemins) {
    // Nettoyer les anciens chemins
    if (window.pathLayers) {
        window.pathLayers.forEach(layer => map.removeLayer(layer));
    }
    window.pathLayers = [];

    // Vérifier que le dépôt est défini avant d'ajouter aux points
    if (!depotPoint) {
        alert('Erreur : Le dépôt n\'est pas défini. Veuillez choisir un point de collecte comme dépôt.');
        return;
    }
    const allPoints = [{id: 0, lat: depotPoint.lat, lng: depotPoint.lng}, ...points];

    // Afficher un message de chargement
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-routes';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<div style="font-size: 18px; margin-bottom: 10px;">🔄</div><div>Chargement des routes réelles...</div>';
    document.body.appendChild(loadingMsg);

    try {
        // Préparer les promesses pour toutes les routes
        const routePromises = chemins.map(async (chemin) => {
            const pointsArray = chemin.chemin.map(id => {
                const p = allPoints.find(pp => pp.id === id);
                return p ? { lat: p.lat, lng: p.lng, id: id } : null;
            }).filter(p => p !== null);

            if (pointsArray.length < 2) {
                return { chemin, route: null };
            }

            // Obtenir la route réelle via OSRM
            const route = await getFullRoute(pointsArray.map(p => ({ lat: p.lat, lng: p.lng })));
            return { chemin, route, pointsArray };
        });

        // Limiter les requêtes parallèles
        const results = await batchRouteRequests(routePromises, 3);

        // Afficher les routes sur la carte
        results.forEach(({ chemin, route, pointsArray }) => {
            if (!route || !route.coordinates || route.coordinates.length < 2) {
                // Fallback : ligne droite
                if (pointsArray && pointsArray.length > 1) {
                    const points_coords = pointsArray.map(p => [p.lat, p.lng]);
                    const polyline = L.polyline(points_coords, {
                        color: '#667eea',
                        weight: 4,
                        opacity: 0.85
                    }).addTo(map);
                    window.pathLayers.push(polyline);
                }
                return;
            }

            // Tracer la polyline avec les vraies coordonnées OSRM
            const polyline = L.polyline(route.coordinates, {
                color: '#667eea',
                weight: 4,
                opacity: 0.85
            }).addTo(map);

            // Ajouter un popup avec les informations de la route
            const distanceText = route.totalDistance !== null 
                ? `${route.totalDistance.toFixed(2)} km` 
                : 'Distance non disponible';
            const durationText = route.totalDuration !== null 
                ? `${Math.round(route.totalDuration)} min` 
                : 'Durée non disponible';
            
            polyline.bindPopup(`
                <div style="min-width: 200px;">
                    <b>📍 Route calculée</b><br>
                    <hr style="margin: 5px 0;">
                    <b>Distance :</b> ${distanceText}<br>
                    <b>Durée estimée :</b> ${durationText}<br>
                    <b>Points :</b> ${pointsArray.map(p => p.id).join(' → ')}
                </div>
            `);

            window.pathLayers.push(polyline);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des routes:', error);
        alert('Erreur lors du chargement des routes réelles. Affichage des lignes droites.');
    } finally {
        // Retirer le message de chargement
        const loadingElement = document.getElementById('loading-routes');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Lancer l'optimisation Niveau 2
async function runNiveau2() {
    if (camions.length === 0) {
        alert('Veuillez ajouter au moins un camion');
        return;
    }

    if (!depotPoint) {
        alert('Veuillez sélectionner un point de collecte ou une déchetterie comme dépôt');
        return;
    }

    // Vérifier qu'il y a au moins un point de collecte (en excluant le dépôt)
    const pointsDeCollecte = points.filter(p => !p.isDepot);
    if (pointsDeCollecte.length === 0) {
        alert('Veuillez ajouter au moins un point de collecte (en plus du dépôt)');
        return;
    }

    const allPoints = [
        { id: 0, x: parseFloat(depotPoint.x), y: parseFloat(depotPoint.y), nom: depotPoint.nom || "Depot" },
        ...pointsDeCollecte.map(p => ({
            id: p.id,
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            nom: p.nom
        }))
    ];

    const connexions = generateConnections();

    // Créer les zones depuis les points (EXCLURE le dépôt)
    // Le dépôt ne doit pas être une zone à collecter, seulement un point de départ/arrivée
    const zones = pointsDeCollecte.map(p => ({
        id: p.id,
        points: [p.id],
        volume_moyen: p.volume,
        centre: { x: parseFloat(p.x), y: parseFloat(p.y) },
        priorite: p.priorite
    }));

    const camions_data = camions.map(c => ({
        id: c.id,
        capacite: c.capacite,
        cout_fixe: c.cout_fixe,
        zones_accessibles: c.zones_accessibles,
        position_initiale: { x: 0, y: 0 }
    }));

    // Ajouter les connexions vers les déchetteries
    dechetteries.forEach(d => {
        // Connecter chaque déchetterie au dépôt
        connexions.push({ depart: 0, arrivee: d.id, distance: null });
        // Connecter aux points proches (distance < 5 km)
        pointsDeCollecte.forEach(p => {
            const dx = parseFloat(d.x) - parseFloat(p.x);
            const dy = parseFloat(d.y) - parseFloat(p.y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5) {
                connexions.push({ depart: p.id, arrivee: d.id, distance: null });
            }
        });
    });

    // Log pour déboguer les données envoyées
    console.log('Données envoyées au backend niveau 2:');
    console.log('- Camions:', camions_data);
    console.log('- Zones:', zones);
    console.log('- Points:', allPoints);
    console.log('- Connexions:', connexions);
    console.log('- Déchetteries:', dechetteries.length);

    try {
        const requestBody = {
            camions: camions_data,
            zones,
            zones_incompatibles: [],
            points: allPoints,
            connexions,
            dechetteries: dechetteries.map(d => ({
                id: d.id,
                x: parseFloat(d.x),
                y: parseFloat(d.y),
                nom: d.nom,
                capacite_max: d.capacite_max,
                types_dechets: d.types_dechets,
                horaires: d.horaires
            }))
        };
        
        console.log('Corps de la requête:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('/api/niveau2/optimiser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        // Vérifier que la réponse HTTP est OK
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erreur HTTP:', response.status, errorText);
            alert(`Erreur HTTP ${response.status} : ${errorText}`);
            return;
        }

        const result = await response.json();
        
        // Log pour déboguer
        console.log('Réponse du backend niveau 2:', result);
        console.log('Type de result:', typeof result);
        console.log('result.affectation:', result.affectation);
        console.log('Est un tableau?', Array.isArray(result.affectation));
        
        // Vérifier si le backend a retourné une erreur
        if (result.error) {
            console.error('Erreur du backend:', result.error);
            alert(`Erreur du backend : ${result.error}`);
            return;
        }
        
        niveau2Result = result;

        // Vérifier que result.affectation existe avant de l'utiliser
        if (!result.affectation) {
            console.error('Erreur : result.affectation est undefined');
            console.error('Structure complète de result:', JSON.stringify(result, null, 2));
            alert('Erreur : Les données d\'affectation sont invalides. Vérifiez la console pour plus de détails.');
            return;
        }
        
        if (!Array.isArray(result.affectation)) {
            console.error('Erreur : result.affectation n\'est pas un tableau');
            console.error('Type de result.affectation:', typeof result.affectation);
            console.error('Valeur de result.affectation:', result.affectation);
            alert('Erreur : Les données d\'affectation ne sont pas au bon format. Vérifiez la console pour plus de détails.');
            return;
        }
        
        // Vérifier si le tableau est vide (cas valide mais à signaler)
        if (result.affectation.length === 0) {
            console.warn('Avertissement : Aucune affectation trouvée');
            alert('Aucune affectation n\'a été trouvée. Vérifiez que vous avez ajouté des camions et des zones.');
            return;
        }

        // Vérifier les contraintes et afficher des messages d'avertissement
        let warnings = [];
        result.affectation.forEach(aff => {
            if (!aff || !aff.camion_id) {
                console.warn('Affectation invalide ignorée:', aff);
                return;
            }
            
            const camion = camions.find(c => c.id === aff.camion_id);
            if (!camion) return;
            
            // Vérifier la capacité
            if (aff.charge_totale > camion.capacite) {
                warnings.push(`⚠️ Camion ${aff.camion_id} : Charge (${aff.charge_totale} kg) dépasse la capacité (${camion.capacite} kg)`);
            }
            
            // Vérifier les zones accessibles
            if (aff.zones_affectees && Array.isArray(aff.zones_affectees)) {
                aff.zones_affectees.forEach(zoneId => {
                    if (camion.zones_accessibles && camion.zones_accessibles.length > 0) {
                        if (!camion.zones_accessibles.includes(zoneId)) {
                            warnings.push(`⚠️ Camion ${aff.camion_id} : Zone ${zoneId} n'est pas dans ses zones accessibles (${camion.zones_accessibles.join(',')})`);
                        }
                    }
                });
            }
        });
        
        if (warnings.length > 0) {
            console.warn('Contraintes non respectées:', warnings);
            alert('⚠️ Attention : Certaines contraintes ne sont pas respectées.\n\n' + warnings.join('\n') + '\n\nVérifiez la console pour plus de détails.');
        }

        // Afficher l'affectation sur la carte (vérification déjà faite plus haut)
        await displayAffectation(result.affectation);
        
        // Mettre à jour le dashboard
        updateDashboard(result.statistiques);
        
        // Afficher le panneau de présentation visuelle
        if (typeof showPresentation === 'function') {
            showPresentation(result.affectation, result);
            // Afficher le panneau (il était en display: none)
            const panel = document.getElementById('presentation-panel');
            if (panel) {
                panel.style.display = 'flex';
            }
        }
        
        // Activer le bouton de simulation et le bouton de présentation
        document.getElementById('btn-simuler').disabled = false;
        const btnShowPresentation = document.getElementById('btn-show-presentation');
        if (btnShowPresentation) {
            btnShowPresentation.style.display = 'inline-block';
        }
        
        const successMsg = warnings.length > 0 
            ? `Niveau 2 terminé avec ${warnings.length} avertissement(s). ${result.affectation.length} camions affectés.`
            : `Niveau 2 terminé ! ${result.affectation.length} camions affectés. Toutes les contraintes sont respectées.`;
        alert(successMsg);
    } catch (error) {
        alert('Erreur lors de l\'optimisation: ' + error.message);
    }
}

// Afficher l'affectation sur la carte
async function displayAffectation(affectation) {
    // Vérifier que affectation est valide
    if (!affectation || !Array.isArray(affectation)) {
        console.error('Erreur : affectation est undefined ou n\'est pas un tableau');
        alert('Erreur : Les données d\'affectation sont invalides.');
        return;
    }
    
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    
    // Nettoyer les anciens chemins
    if (window.affectationLayers) {
        window.affectationLayers.forEach(layer => map.removeLayer(layer));
    }
    window.affectationLayers = [];

    // Vérifier que le dépôt est défini avant d'ajouter aux points
    if (!depotPoint) {
        alert('Erreur : Le dépôt n\'est pas défini. Veuillez choisir un point de collecte comme dépôt.');
        return;
    }
    const allPoints = [{id: 0, lat: depotPoint.lat, lng: depotPoint.lng}, ...points];

    // Afficher un message de chargement
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-affectation-routes';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<div style="font-size: 18px; margin-bottom: 10px;">🔄</div><div>Chargement des routes des camions...</div>';
    document.body.appendChild(loadingMsg);

    try {
        // Préparer les promesses pour toutes les routes des camions
        const routePromises = affectation.map(async (aff, idx) => {
            // Vérifier que aff a les propriétés nécessaires
            if (!aff || !aff.camion_id) {
                console.warn('Affectation invalide ignorée:', aff);
                return null;
            }
            
            const color = colors[idx % colors.length];
            const camion = camions.find(c => c.id === aff.camion_id);
            
            // Vérifier que zones_affectees existe et est un tableau
            const zonesAffectees = aff.zones_affectees || [];
            if (!Array.isArray(zonesAffectees)) {
                console.warn(`zones_affectees n'est pas un tableau pour le camion ${aff.camion_id}`);
                return null;
            }
            
            // Construire le tableau de waypoints : [dépôt, zone1, zone2, ..., dépôt]
            const zoneIds = [0, ...zonesAffectees, 0]; // Dépôt + zones + retour au dépôt
            const waypoints = zoneIds.map(id => {
                const p = allPoints.find(pp => pp.id === id);
                return p ? { lat: p.lat, lng: p.lng, id: id } : null;
            }).filter(p => p !== null);

            if (waypoints.length < 2) {
                return { aff, route: null, color, camion };
            }

            // Obtenir la route réelle via OSRM
            const route = await getFullRoute(waypoints.map(p => ({ lat: p.lat, lng: p.lng })));
            return { aff, route, waypoints, color, camion };
        });

        // Limiter les requêtes parallèles
        const results = await batchRouteRequests(routePromises, 3);

        // Filtrer les résultats null/undefined et afficher les routes sur la carte
        if (!results || !Array.isArray(results)) {
            console.error('Erreur : results est undefined ou n\'est pas un tableau');
            throw new Error('Erreur lors du chargement des routes');
        }
        
        results.filter(r => r !== null && r !== undefined).forEach(({ aff, route, waypoints, color, camion }) => {
            // Vérifier que les propriétés nécessaires existent
            if (!aff || !color) {
                console.warn('Données incomplètes pour une route, ignorée');
                return;
            }
            if (!route || !route.coordinates || route.coordinates.length < 2) {
                // Fallback : ligne droite
                if (waypoints && waypoints.length > 1) {
                    const coords = waypoints.map(p => [p.lat, p.lng]);
                    const polyline = L.polyline(coords, {
                        color: color,
                        weight: 4,
                        opacity: 0.85
                    }).addTo(map);
                    
                    const zonesText = (aff.zones_affectees && Array.isArray(aff.zones_affectees)) 
                        ? aff.zones_affectees.join(', ') 
                        : 'Aucune';
                    polyline.bindPopup(`<b>Camion ${aff.camion_id}</b><br>Zones: ${zonesText}<br>Charge: ${aff.charge_totale || 0} kg`);
                    window.affectationLayers.push(polyline);
                }
                return;
            }

            // Tracer la polyline avec les vraies coordonnées OSRM
            const polyline = L.polyline(route.coordinates, {
                color: color,
                weight: 4,
                opacity: 0.85
            }).addTo(map);
            
            // Ajouter un popup avec les informations complètes
            const distanceText = route.totalDistance !== null 
                ? `${route.totalDistance.toFixed(2)} km` 
                : 'Distance non disponible';
            const durationText = route.totalDuration !== null 
                ? `${Math.round(route.totalDuration)} min` 
                : 'Durée non disponible';
            
            const zonesText = (aff.zones_affectees && Array.isArray(aff.zones_affectees)) 
                ? aff.zones_affectees.join(', ') 
                : 'Aucune';
            
            polyline.bindPopup(`
                <div style="min-width: 200px;">
                    <b>🚛 Camion ${aff.camion_id}</b><br>
                    <hr style="margin: 5px 0;">
                    <b>Distance totale :</b> ${distanceText}<br>
                    <b>Durée estimée :</b> ${durationText}<br>
                    <b>Zones desservies :</b> ${zonesText}<br>
                    <b>Charge totale :</b> ${aff.charge_totale || 0} kg
                </div>
            `);
            
            window.affectationLayers.push(polyline);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des routes d\'affectation:', error);
        alert('Erreur lors du chargement des routes réelles. Affichage des lignes droites.');
    } finally {
        // Retirer le message de chargement
        const loadingElement = document.getElementById('loading-affectation-routes');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation de l\'application...');
    
    // Vérifier que tous les éléments nécessaires existent
    const requiredElements = ['map', 'btn-add-point', 'btn-select-depot', 'btn-niveau1', 'btn-niveau2'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('❌ Éléments manquants:', missingElements);
        alert('Erreur : Certains éléments de l\'interface sont manquants. Vérifiez le HTML.');
        return;
    }
    
    // Initialiser la carte
    initMap();
    
    // Initialiser les coordonnées du dépôt (sera mis à jour quand un dépôt sera sélectionné)
    updateDepotCoords();
    
    // Initialiser le système de templates et charger le cache OSRM
    if (typeof initTemplateHandlers === 'function') {
        initTemplateHandlers();
    }
    
    // Événements des boutons
    document.getElementById('btn-add-point').addEventListener('click', () => {
        document.getElementById('modal-point').style.display = 'block';
    });
    
    document.getElementById('btn-select-depot').addEventListener('click', () => {
        isSelectingDepot = !isSelectingDepot;
        const btn = document.getElementById('btn-select-depot');
        if (isSelectingDepot) {
            btn.classList.add('active');
            btn.textContent = 'Cliquer sur un point ou déchetterie';
            console.log('Mode sélection du dépôt activé. Cliquez sur un point de collecte ou une déchetterie existant(e) pour le/la définir comme dépôt.');
            
            // Ajouter un gestionnaire de clic à tous les marqueurs de points existants
            points.forEach(point => {
                if (point.marker) {
                    // Supprimer les anciens gestionnaires pour éviter les doublons
                    point.marker.off('click');
                    
                    // Ajouter le nouveau gestionnaire de sélection de dépôt
                    point.marker.on('click', createDepotSelectionHandler(point));
                }
            });
            
            // Ajouter un gestionnaire de clic à toutes les déchetteries existantes
            dechetteries.forEach(dechetterie => {
                if (dechetterie.marker) {
                    // Supprimer les anciens gestionnaires pour éviter les doublons
                    dechetterie.marker.off('click');
                    
                    // Ajouter le nouveau gestionnaire de sélection de dépôt
                    dechetterie.marker.on('click', createDepotSelectionHandler(dechetterie));
                }
            });
        } else {
            btn.classList.remove('active');
            btn.textContent = 'Choisir le Dépôt';
            
            // Retirer les gestionnaires de clic des marqueurs de points
            points.forEach(point => {
                if (point.marker) {
                    point.marker.off('click');
                }
            });
            
            // Retirer les gestionnaires de clic des déchetteries
            dechetteries.forEach(dechetterie => {
                if (dechetterie.marker) {
                    dechetterie.marker.off('click');
                }
            });
        }
    });
    
    document.getElementById('btn-add-camion').addEventListener('click', () => {
        document.getElementById('modal-camion').style.display = 'block';
    });
    
    document.getElementById('btn-add-dechetterie').addEventListener('click', () => {
        document.getElementById('modal-dechetterie').style.display = 'block';
        alert('Cliquez sur la carte pour choisir l\'emplacement de la déchetterie.');
    });
    
    document.getElementById('btn-clear-points').addEventListener('click', () => {
        if (confirm('Effacer tous les points ?')) {
            points.forEach(p => {
                if (p.marker) {
                    map.removeLayer(p.marker);
                }
            });
            points = [];
            depotPoint = null; // Réinitialiser le dépôt aussi
            updatePointsList();
            updateDepotCoords();
            if (window.pathLayers) {
                window.pathLayers.forEach(l => map.removeLayer(l));
            }
        }
    });
    
    document.getElementById('btn-niveau1').addEventListener('click', runNiveau1);
    document.getElementById('btn-niveau2').addEventListener('click', runNiveau2);
    document.getElementById('btn-routes-optimisees').addEventListener('click', runRoutesOptimisees);
    
    // Bouton d'animation des routes
    document.getElementById('btn-animate-routes')?.addEventListener('click', () => {
        if (routesOptimiseesResult && routesOptimiseesResult.routes) {
            if (typeof animateRoutesFromResult === 'function') {
                animateRoutesFromResult(routesOptimiseesResult);
            } else {
                alert('Module d\'animation non chargé');
            }
        } else {
            alert('Veuillez d\'abord calculer les routes optimisées');
        }
    });
    document.getElementById('btn-simuler').addEventListener('click', () => {
        // Vérifier que le dépôt est défini
        if (!depotPoint) {
            alert('Veuillez d\'abord choisir un dépôt sur la carte (bouton "Choisir le Dépôt")');
            return;
        }
        
        // Priorité aux routes optimisées avec déchetteries
        if (routesOptimiseesResult && routesOptimiseesResult.routes && routesOptimiseesResult.routes.length > 0) {
            console.log('🚀 Simulation avec routes optimisées (avec déchetteries)');
            startSimulationRoutesOptimisees(routesOptimiseesResult);
            return;
        }
        
        // Sinon, utiliser l'affectation niveau 2
        if (!niveau2Result) {
            alert('Veuillez d\'abord lancer l\'optimisation (Niveau 2 ou Routes Optimisées)');
            return;
        }
        
        startSimulation(niveau2Result.affectation);
    });
    
    document.getElementById('btn-stop-sim').addEventListener('click', () => {
        stopSimulation();
    });
    
    // Fermer les modals
    document.querySelectorAll('.close').forEach(close => {
        close.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
    });
    
    // Afficher/masquer le panneau de présentation
    const btnShowPresentation = document.getElementById('btn-show-presentation');
    if (btnShowPresentation) {
        btnShowPresentation.addEventListener('click', () => {
            const panel = document.getElementById('presentation-panel');
            if (panel) {
                if (panel.style.display === 'none' || !panel.style.display) {
                    // Réafficher la présentation si elle existe déjà
                    if (niveau2Result && niveau2Result.affectation) {
                        if (typeof showPresentation === 'function') {
                            showPresentation(niveau2Result.affectation, niveau2Result);
                            panel.style.display = 'flex';
                        }
                    } else {
                        alert('Veuillez d\'abord lancer le Niveau 2 pour voir la présentation.');
                    }
                } else {
                    if (typeof closePresentation === 'function') {
                        closePresentation();
                    }
                }
            }
        });
    }
});
    
    // Formulaires
    document.getElementById('form-point').addEventListener('submit', (e) => {
        e.preventDefault();
        if (window.tempCoords) {
            const nom = document.getElementById('point-nom').value;
            const volume = document.getElementById('point-volume').value;
            const priorite = document.getElementById('point-priorite').value;
            addPoint(nom, volume, priorite, window.tempCoords.lat, window.tempCoords.lng);
            document.getElementById('modal-point').style.display = 'none';
            document.getElementById('form-point').reset();
            window.tempCoords = null;
        }
    });
    
    document.getElementById('form-camion').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('camion-id').value;
        const capacite = document.getElementById('camion-capacite').value;
        const cout = document.getElementById('camion-cout').value;
        const zones = document.getElementById('camion-zones').value;
        addCamion(id, capacite, cout, zones);
        document.getElementById('modal-camion').style.display = 'none';
        document.getElementById('form-camion').reset();
    });
    
    document.getElementById('form-dechetterie').addEventListener('submit', (e) => {
        e.preventDefault();
        if (window.tempCoords) {
            const id = parseInt(document.getElementById('dechetterie-id').value);
            const nom = document.getElementById('dechetterie-nom').value;
            const capacite = parseFloat(document.getElementById('dechetterie-capacite').value) || 0;
            const typesText = document.getElementById('dechetterie-types').value;
            const types = typesText ? typesText.split(',').map(t => t.trim()).filter(t => t) : [];
            
            // Convertir lat/lng en x/y
            const x = ((window.tempCoords.lng - CASABLANCA_CENTER[1]) * 111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180)).toFixed(2);
            const y = ((window.tempCoords.lat - CASABLANCA_CENTER[0]) * 111).toFixed(2);
            
            const dechetterieData = {
                id: id,
                x: parseFloat(x),
                y: parseFloat(y),
                nom: nom,
                capacite_max: capacite,
                types_dechets: types,
                horaires: {}
            };
            
            addDechetterie(dechetterieData);
            document.getElementById('modal-dechetterie').style.display = 'none';
            document.getElementById('form-dechetterie').reset();
            window.tempCoords = null;
            updateDechetteriesList();
        } else {
            alert('Veuillez d\'abord cliquer sur la carte pour choisir l\'emplacement de la déchetterie.');
        }
    });
    
    // Fermer le panneau de présentation
    const btnClosePresentation = document.getElementById('btn-close-presentation');
    if (btnClosePresentation) {
        btnClosePresentation.addEventListener('click', () => {
            if (typeof closePresentation === 'function') {
                closePresentation();
            }
        });
    }
    
    // Afficher/masquer le panneau de présentation
    const btnShowPresentation = document.getElementById('btn-show-presentation');
    if (btnShowPresentation) {
        btnShowPresentation.addEventListener('click', () => {
            const panel = document.getElementById('presentation-panel');
            if (panel) {
                if (panel.style.display === 'none' || !panel.style.display) {
                    // Réafficher la présentation si elle existe déjà
                    if (niveau2Result && niveau2Result.affectation) {
                        if (typeof showPresentation === 'function') {
                            showPresentation(niveau2Result.affectation, niveau2Result);
                            panel.style.display = 'flex';
                        }
                    } else {
                        alert('Veuillez d\'abord lancer le Niveau 2 pour voir la présentation.');
                    }
                } else {
                    if (typeof closePresentation === 'function') {
                        closePresentation();
                    }
                }
            }
        });
    }
});
