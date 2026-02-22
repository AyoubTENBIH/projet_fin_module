// Simulation animée des trajets des camions avec statuts et capacité

let simulationInterval = null;
let simulationMarkers = [];
let simulationRunning = false;

async function startSimulation(affectation) {
    if (simulationRunning) {
        stopSimulation();
    }
    
    // Vérifier que le dépôt est défini
    console.log('🔍 Vérification du dépôt avant simulation...');
    console.log('depotPoint:', depotPoint);
    console.log('points:', points);
    console.log('Points avec isDepot:', points.filter(p => p.isDepot));
    console.log('Déchetteries:', dechetteries);
    
    if (!depotPoint) {
        // Vérifier s'il y a un point ou une déchetterie avec isDepot = true
        const depotInPoints = points.find(p => p.isDepot === true);
        const depotInDechetteries = dechetteries.find(d => d.isDepot === true);
        const depotFound = depotInPoints || depotInDechetteries;
        
        if (depotFound) {
            console.log('⚠️ depotPoint est null mais un point/déchetterie avec isDepot=true existe, correction...');
            depotPoint = depotFound;
            updateDepotCoords();
        } else {
            alert('Erreur : Le dépôt n\'est pas défini. Veuillez choisir un point de collecte ou une déchetterie comme dépôt avant de simuler.\n\nCliquez sur "Choisir le Dépôt" puis cliquez sur un point de collecte ou une déchetterie existant(e).');
            return;
        }
    }
    
    console.log('✅ Dépôt vérifié:', depotPoint.nom, 'à', [depotPoint.lat, depotPoint.lng]);
    
    // Réinitialiser tous les statuts des points (sauf le dépôt)
    points.forEach(p => {
        if (!p.isDepot) { // Ne pas réinitialiser le statut du dépôt
            p.status = 'en_attente';
            updatePointMarker(p);
        }
    });
    updatePointsList();
    
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    
    // Créer la liste des points pour la simulation (dépôt + points de collecte)
    const pointsDeCollecte = points.filter(p => !p.isDepot);
    const allPoints = [
        {id: 0, lat: depotPoint.lat, lng: depotPoint.lng, nom: depotPoint.nom || "Depot"},
        ...pointsDeCollecte
    ];
    
    console.log('Dépôt:', depotPoint);
    console.log('Points:', points);
    console.log('AllPoints:', allPoints);
    
    simulationMarkers = [];
    simulationRunning = true;
    
    // Fonction pour convertir un ID de point en coordonnées lat/lng
    function idToCoords(pointId) {
        if (pointId === 0) {
            return [depotPoint.lat, depotPoint.lng];
        }
        // Chercher dans les points de collecte (exclure le dépôt)
        const point = pointsDeCollecte.find(p => p.id === pointId);
        if (point) {
            return [point.lat, point.lng];
        }
        console.error(`Point ${pointId} non trouvé`);
        return null;
    }
    
    // Afficher un loader pendant le chargement des routes
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-simulation-routes';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<div style="font-size: 18px; margin-bottom: 10px;">🔄</div><div>Chargement des routes réelles pour la simulation...</div>';
    document.body.appendChild(loadingMsg);
    
    try {
        // Préparer les promesses pour charger les routes OSRM pour chaque camion
        const routePromises = affectation.map(async (aff, idx) => {
            const color = colors[idx % colors.length];
            const camion = camions.find(c => c.id === aff.camion_id);
            
            if (!camion) {
                console.error(`Camion ${aff.camion_id} non trouvé`);
                return null;
            }
            
            // Construire le tableau de waypoints : [dépôt, zone1, zone2, ..., dépôt]
            const zoneIds = [0, ...aff.zones_affectees, 0]; // Dépôt + zones + retour au dépôt
            const waypoints = zoneIds.map(id => {
                const coords = idToCoords(id);
                return coords ? { lat: coords[0], lng: coords[1], id: id } : null;
            }).filter(p => p !== null);
            
            if (waypoints.length < 2) {
                console.error(`Pas assez de waypoints pour le camion ${aff.camion_id}`);
                return null;
            }
            
            // Obtenir la route réelle via OSRM
            const route = await getFullRoute(waypoints.map(p => ({ lat: p.lat, lng: p.lng })));
            
            return {
                aff,
                route,
                waypoints,
                color,
                camion
            };
        });
        
        // Limiter les requêtes parallèles
        const results = await batchRouteRequests(routePromises.filter(p => p !== null), 3);
        
        // Créer les marqueurs et préparer les données de simulation
        results.forEach(({ aff, route, waypoints, color, camion }) => {
            if (!route || !route.coordinates || route.coordinates.length < 2) {
                // Fallback : utiliser les waypoints directs
                const fallbackCoords = waypoints.map(p => [p.lat, p.lng]);
                console.warn(`⚠️ Route OSRM non disponible pour camion ${aff.camion_id}, utilisation de lignes droites`);
                
                const camionMarker = L.marker([depotPoint.lat, depotPoint.lng], {
                    icon: L.divIcon({
                        className: 'camion-animated',
                        html: createCamionIcon(color, aff.camion_id, 0, camion.capacite),
                        iconSize: [50, 50],
                        iconAnchor: [25, 25]
                    })
                }).addTo(map);
                
                camionMarker.bindPopup(createCamionPopup(aff.camion_id, 0, camion.capacite, aff.zones_affectees));
                
                simulationMarkers.push({
                    marker: camionMarker,
                    coords: fallbackCoords,
                    trajetIds: waypoints.map(p => p.id),
                    currentIndex: 0,
                    camionId: aff.camion_id,
                    charge: 0,
                    capacite: camion.capacite,
                    zonesAffectees: aff.zones_affectees,
                    color: color,
                    waypointIndices: waypoints.map((_, idx) => idx), // Indices des waypoints dans les coords
                    lastProcessedWaypoint: -1 // Dernier waypoint traité
                });
                return;
            }
            
            // Utiliser les coordonnées OSRM réelles
            const routeCoords = route.coordinates;
            
            // Créer un mapping des waypoints vers les indices dans routeCoords
            // Trouver l'index le plus proche de chaque waypoint dans les coordonnées de la route
            const waypointIndices = waypoints.map(waypoint => {
                let minDist = Infinity;
                let bestIndex = 0;
                
                routeCoords.forEach((coord, idx) => {
                    const dist = Math.sqrt(
                        Math.pow(coord[0] - waypoint.lat, 2) + 
                        Math.pow(coord[1] - waypoint.lng, 2)
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        bestIndex = idx;
                    }
                });
                
                return bestIndex;
            });
            
            // Créer le marqueur du camion AU DÉPÔT (première position)
            const camionMarker = L.marker([depotPoint.lat, depotPoint.lng], {
                icon: L.divIcon({
                    className: 'camion-animated',
                    html: createCamionIcon(color, aff.camion_id, 0, camion.capacite),
                    iconSize: [50, 50],
                    iconAnchor: [25, 25]
                })
            }).addTo(map);
            
            camionMarker.bindPopup(createCamionPopup(aff.camion_id, 0, camion.capacite, aff.zones_affectees));
            
            simulationMarkers.push({
                marker: camionMarker,
                coords: routeCoords, // Coordonnées OSRM complètes avec tous les points intermédiaires
                trajetIds: waypoints.map(p => p.id), // IDs des waypoints (dépôt, zones, dépôt)
                currentIndex: 0, // Commence au dépôt (index 0 dans routeCoords)
                camionId: aff.camion_id,
                charge: 0,
                capacite: camion.capacite,
                zonesAffectees: aff.zones_affectees,
                color: color,
                waypointIndices: waypointIndices, // Indices des waypoints dans routeCoords
                lastProcessedWaypoint: -1 // Dernier waypoint traité
            });
            
            console.log(`✅ Camion ${aff.camion_id} créé avec route OSRM (${routeCoords.length} points)`);
        });
    
    } catch (error) {
        console.error('Erreur lors du chargement des routes pour la simulation:', error);
        alert('Erreur lors du chargement des routes réelles. La simulation utilisera des lignes droites.');
    } finally {
        // Retirer le message de chargement
        const loadingElement = document.getElementById('loading-simulation-routes');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
    
    if (simulationMarkers.length === 0) {
        console.error('Aucun marqueur de simulation créé');
        simulationRunning = false;
        return;
    }
    
    // Afficher/masquer les boutons
    document.getElementById('btn-simuler').style.display = 'none';
    document.getElementById('btn-stop-sim').style.display = 'inline-block';
    
    // Animer les camions
    let step = 0;
    const STEPS_PER_SEGMENT = 30;
    
    simulationInterval = setInterval(() => {
        simulationMarkers.forEach(sim => {
            // Vérifier qu'on n'a pas atteint la fin du trajet
            if (sim.currentIndex < sim.coords.length - 1) {
                const segmentStep = step % STEPS_PER_SEGMENT;
                const progress = segmentStep / STEPS_PER_SEGMENT;
                
                const start = sim.coords[sim.currentIndex];
                const end = sim.coords[sim.currentIndex + 1];
                
                const lat = start[0] + (end[0] - start[0]) * progress;
                const lng = start[1] + (end[1] - start[1]) * progress;
                
                sim.marker.setLatLng([lat, lng]);
                
                // Quand le camion arrive à un point (fin du segment)
                if (segmentStep === STEPS_PER_SEGMENT - 1) {
                    // On vient d'arriver au point suivant (sim.currentIndex + 1)
                    const nextIndex = sim.currentIndex + 1;
                    
                    // Vérifier si on a atteint la fin du trajet
                    if (nextIndex >= sim.coords.length) {
                        // Fin du trajet, retour au début (dépôt)
                        sim.currentIndex = 0;
                        sim.charge = 0; // Réinitialiser la charge au dépôt
                        sim.lastProcessedWaypoint = -1; // Réinitialiser le dernier waypoint traité
                    } else {
                        // Vérifier si on arrive à un waypoint (dépôt ou zone)
                        // waypointIndices contient les indices des waypoints dans sim.coords
                        if (sim.waypointIndices && sim.waypointIndices.length > 0) {
                            // Trouver le waypoint le plus proche de nextIndex
                            let closestWaypointIdx = -1;
                            let minDist = Infinity;
                            
                            sim.waypointIndices.forEach((wpIdx, trajetIdx) => {
                                const dist = Math.abs(wpIdx - nextIndex);
                                if (dist < minDist && dist <= 2) { // Tolérance de 2 points
                                    minDist = dist;
                                    closestWaypointIdx = trajetIdx;
                                }
                            });
                            
                            // Vérifier si on vient de passer un waypoint (on était avant, maintenant on est après ou égal)
                            if (closestWaypointIdx >= 0 && closestWaypointIdx < sim.trajetIds.length) {
                                // Vérifier qu'on n'a pas déjà traité ce waypoint
                                const lastProcessedWaypoint = sim.lastProcessedWaypoint || -1;
                                if (closestWaypointIdx > lastProcessedWaypoint) {
                                    sim.lastProcessedWaypoint = closestWaypointIdx;
                                    const pointIdArrive = sim.trajetIds[closestWaypointIdx];
                                    
                                    // Si on arrive au dépôt (ID = 0), réinitialiser la charge
                                    if (pointIdArrive === 0) {
                                        sim.charge = 0;
                                    } else {
                                        // Vérifier si ce point est une zone affectée à ce camion
                                        if (sim.zonesAffectees.includes(pointIdArrive)) {
                                            const point = pointsDeCollecte.find(p => p.id === pointIdArrive);
                                            
                                            if (point && point.status === 'en_attente') {
                                                point.status = 'en_cours';
                                                updatePointMarker(point);
                                                updatePointsList();
                                                
                                                // Simuler la collecte (1.5 secondes)
                                                setTimeout(() => {
                                                    if (point.status === 'en_cours') {
                                                        point.status = 'collecte';
                                                        updatePointMarker(point);
                                                        updatePointsList();
                                                        
                                                        // Ajouter le volume à la charge du camion
                                                        sim.charge += point.volume;
                                                        if (sim.charge > sim.capacite) {
                                                            sim.charge = sim.capacite; // Limiter à la capacité
                                                        }
                                                    }
                                                }, 1500);
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // Fallback pour les routes sans waypointIndices (lignes droites)
                            // Utiliser la logique originale basée sur trajetIds
                            if (nextIndex < sim.trajetIds.length) {
                                const pointIdArrive = sim.trajetIds[nextIndex];
                                
                                if (pointIdArrive === 0) {
                                    sim.charge = 0;
                                } else if (sim.zonesAffectees.includes(pointIdArrive)) {
                                    const point = pointsDeCollecte.find(p => p.id === pointIdArrive);
                                    
                                    if (point && point.status === 'en_attente') {
                                        point.status = 'en_cours';
                                        updatePointMarker(point);
                                        updatePointsList();
                                        
                                        setTimeout(() => {
                                            if (point.status === 'en_cours') {
                                                point.status = 'collecte';
                                                updatePointMarker(point);
                                                updatePointsList();
                                                
                                                sim.charge += point.volume;
                                                if (sim.charge > sim.capacite) {
                                                    sim.charge = sim.capacite;
                                                }
                                            }
                                        }, 1500);
                                    }
                                }
                            }
                        }
                        
                        // Passer au point suivant pour la prochaine itération
                        sim.currentIndex = nextIndex;
                    }
                }
                
                // Mettre à jour l'icône avec la charge actuelle
                const chargePercent = (sim.charge / sim.capacite) * 100;
                sim.marker.setIcon(L.divIcon({
                    className: 'camion-animated',
                    html: createCamionIcon(sim.color, sim.camionId, chargePercent, sim.capacite),
                    iconSize: [50, 50],
                    iconAnchor: [25, 25]  // ✅ Centre exact du div 50x50
                }));
                
                // Mettre à jour la popup
                sim.marker.setPopupContent(createCamionPopup(
                    sim.camionId, 
                    sim.charge, 
                    sim.capacite, 
                    sim.zonesAffectees
                ));
            }
        });
        
        step++;
    }, 100); // Mise à jour toutes les 100ms
}

function createCamionIcon(color, camionId, chargePercent, capacite) {
    const chargeBar = chargePercent > 0 ? `
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${Math.min(chargePercent, 100)}%; 
                    background: ${chargePercent > 80 ? '#dc3545' : chargePercent > 50 ? '#ffc107' : '#28a745'}; 
                    border-radius: 0 0 25px 25px; transition: all 0.3s;"></div>
    ` : '';
    
    return `
        <div style="position: relative; background: ${color}; width: 50px; height: 50px; 
                    border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
                    display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <div style="position: relative; z-index: 2; font-size: 24px;">🚛</div>
            <div style="position: absolute; bottom: 2px; left: 2px; right: 2px; font-size: 10px; 
                        color: white; font-weight: bold; text-align: center; z-index: 3;">
                ${Math.round(chargePercent)}%
            </div>
            ${chargeBar}
        </div>
    `;
}

function createCamionPopup(camionId, charge, capacite, zonesAffectees) {
    const chargePercent = (charge / capacite) * 100;
    const status = chargePercent > 80 ? '🔴 Plein' : chargePercent > 50 ? '🟡 Moyen' : '🟢 Disponible';
    
    return `
        <div style="min-width: 200px;">
            <b>🚛 Camion ${camionId}</b><br>
            <hr style="margin: 5px 0;">
            <b>Charge:</b> ${charge.toFixed(0)} / ${capacite} kg<br>
            <b>Utilisation:</b> ${chargePercent.toFixed(1)}%<br>
            <b>Statut:</b> ${status}<br>
            <hr style="margin: 5px 0;">
            <b>Zones:</b> ${zonesAffectees.join(', ')}<br>
            <div style="margin-top: 5px; height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden;">
                <div style="height: 100%; width: ${chargePercent}%; 
                            background: ${chargePercent > 80 ? '#dc3545' : chargePercent > 50 ? '#ffc107' : '#28a745'}; 
                            transition: width 0.3s;"></div>
            </div>
        </div>
    `;
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    
    simulationMarkers.forEach(sim => {
        map.removeLayer(sim.marker);
    });
    
    simulationMarkers = [];
    simulationRunning = false;
    
    // Arrêter aussi l'animation de présentation si elle est active
    if (typeof stopPresentationAnimation === 'function') {
        stopPresentationAnimation();
    }
    
    // Réinitialiser les statuts (sauf le dépôt)
    points.forEach(p => {
        if (!p.isDepot && p.status !== 'collecte') {
            p.status = 'en_attente';
            updatePointMarker(p);
        }
    });
    updatePointsList();
    
    // Afficher/masquer les boutons
    document.getElementById('btn-simuler').style.display = 'inline-block';
    document.getElementById('btn-stop-sim').style.display = 'none';
}

// Simulation pour les routes optimisées avec déchetteries
async function startSimulationRoutesOptimisees(routesResult) {
    if (simulationRunning) {
        stopSimulation();
    }
    
    if (!depotPoint) {
        alert('Erreur : Le dépôt n\'est pas défini.');
        return;
    }
    
    if (!routesResult || !routesResult.routes || routesResult.routes.length === 0) {
        alert('Erreur : Aucune route optimisée disponible.');
        return;
    }
    
    console.log('🚀 Démarrage de la simulation avec routes optimisées...');
    
    // Réinitialiser tous les statuts des points
    points.forEach(p => {
        if (!p.isDepot) {
            p.status = 'en_attente';
            updatePointMarker(p);
        }
    });
    updatePointsList();
    
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#ff9a8b', '#a8edea', '#fed6e3'];
    
    simulationMarkers = [];
    simulationRunning = true;
    
    // Afficher un loader
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-sim-routes-opt';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<div style="font-size: 18px; margin-bottom: 10px;">🗺️</div><div>Préparation de la simulation...</div>';
    document.body.appendChild(loadingMsg);
    
    try {
        for (let idx = 0; idx < routesResult.routes.length; idx++) {
            const route = routesResult.routes[idx];
            const color = colors[idx % colors.length];
            
            // Convertir les waypoints x/y en lat/lng
            const waypointsLatLng = route.waypoints.map(wp => {
                const lat = CASABLANCA_CENTER[0] + (wp.y / 111);
                const lng = CASABLANCA_CENTER[1] + (wp.x / (111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180)));
                return { lat, lng, ...wp };
            });
            
            if (waypointsLatLng.length < 2) continue;
            
            // Obtenir la route OSRM
            const osrmRoute = await getFullRoute(waypointsLatLng.map(p => ({ lat: p.lat, lng: p.lng })));
            
            let routeCoords, waypointIndices;
            
            if (osrmRoute && osrmRoute.coordinates && osrmRoute.coordinates.length >= 2) {
                routeCoords = osrmRoute.coordinates;
                
                // Mapper les waypoints aux indices de routeCoords
                waypointIndices = waypointsLatLng.map(waypoint => {
                    let minDist = Infinity;
                    let bestIndex = 0;
                    
                    routeCoords.forEach((coord, idx) => {
                        const dist = Math.sqrt(
                            Math.pow(coord[0] - waypoint.lat, 2) + 
                            Math.pow(coord[1] - waypoint.lng, 2)
                        );
                        if (dist < minDist) {
                            minDist = dist;
                            bestIndex = idx;
                        }
                    });
                    
                    return bestIndex;
                });
            } else {
                // Fallback
                routeCoords = waypointsLatLng.map(p => [p.lat, p.lng]);
                waypointIndices = waypointsLatLng.map((_, idx) => idx);
            }
            
            // Créer le marqueur du camion
            const camionMarker = L.marker([depotPoint.lat, depotPoint.lng], {
                icon: L.divIcon({
                    className: 'camion-animated',
                    html: createCamionIconWithDechetterie(color, route.camion_id, 0, route.capacite, null),
                    iconSize: [55, 55],
                    iconAnchor: [27, 27]
                })
            }).addTo(map);
            
            simulationMarkers.push({
                marker: camionMarker,
                coords: routeCoords,
                waypoints: waypointsLatLng,
                waypointIndices: waypointIndices,
                currentIndex: 0,
                camionId: route.camion_id,
                charge: 0,
                capacite: route.capacite,
                color: color,
                lastProcessedWaypoint: -1,
                detailsEtapes: route.details_etapes
            });
        }
        
    } catch (error) {
        console.error('Erreur lors de la préparation de la simulation:', error);
    } finally {
        const loadingElement = document.getElementById('loading-sim-routes-opt');
        if (loadingElement) loadingElement.remove();
    }
    
    if (simulationMarkers.length === 0) {
        simulationRunning = false;
        return;
    }
    
    // Afficher/masquer les boutons
    document.getElementById('btn-simuler').style.display = 'none';
    document.getElementById('btn-stop-sim').style.display = 'inline-block';
    
    // Animation
    let step = 0;
    const STEPS_PER_SEGMENT = 25;
    
    simulationInterval = setInterval(() => {
        simulationMarkers.forEach(sim => {
            if (sim.currentIndex < sim.coords.length - 1) {
                const segmentStep = step % STEPS_PER_SEGMENT;
                const progress = segmentStep / STEPS_PER_SEGMENT;
                
                const start = sim.coords[sim.currentIndex];
                const end = sim.coords[sim.currentIndex + 1];
                
                const lat = start[0] + (end[0] - start[0]) * progress;
                const lng = start[1] + (end[1] - start[1]) * progress;
                
                sim.marker.setLatLng([lat, lng]);
                
                // Quand on arrive à la fin d'un segment
                if (segmentStep === STEPS_PER_SEGMENT - 1) {
                    const nextIndex = sim.currentIndex + 1;
                    
                    if (nextIndex >= sim.coords.length) {
                        sim.currentIndex = 0;
                        sim.charge = 0;
                        sim.lastProcessedWaypoint = -1;
                    } else {
                        // Vérifier si on arrive à un waypoint
                        let closestWaypointIdx = -1;
                        let minDist = Infinity;
                        
                        sim.waypointIndices.forEach((wpIdx, waypointIndex) => {
                            const dist = Math.abs(wpIdx - nextIndex);
                            if (dist < minDist && dist <= 3) {
                                minDist = dist;
                                closestWaypointIdx = waypointIndex;
                            }
                        });
                        
                        if (closestWaypointIdx >= 0 && closestWaypointIdx > (sim.lastProcessedWaypoint || -1)) {
                            sim.lastProcessedWaypoint = closestWaypointIdx;
                            const waypoint = sim.waypoints[closestWaypointIdx];
                            
                            if (waypoint.type === 'collecte') {
                                // Collecte : ajouter le volume
                                const point = points.find(p => p.id === waypoint.id);
                                if (point && point.status === 'en_attente') {
                                    point.status = 'en_cours';
                                    updatePointMarker(point);
                                    
                                    setTimeout(() => {
                                        if (point.status === 'en_cours') {
                                            point.status = 'collecte';
                                            updatePointMarker(point);
                                            sim.charge += waypoint.volume || point.volume;
                                            if (sim.charge > sim.capacite) sim.charge = sim.capacite;
                                        }
                                    }, 1000);
                                }
                            } else if (waypoint.type === 'dechetterie') {
                                // Décharge à la déchetterie
                                console.log(`🏭 Camion ${sim.camionId} décharge à ${waypoint.nom}`);
                                sim.charge = 0;
                            } else if (waypoint.type === 'depot') {
                                // Retour au dépôt
                                sim.charge = 0;
                            }
                        }
                        
                        sim.currentIndex = nextIndex;
                    }
                }
                
                // Trouver l'étape actuelle pour afficher l'action
                let currentAction = null;
                if (sim.waypoints && sim.lastProcessedWaypoint >= 0 && sim.lastProcessedWaypoint < sim.waypoints.length) {
                    const wp = sim.waypoints[sim.lastProcessedWaypoint];
                    currentAction = wp.type === 'dechetterie' ? '♻️ Décharge' : wp.type === 'collecte' ? '📦 Collecte' : null;
                }
                
                const chargePercent = (sim.charge / sim.capacite) * 100;
                sim.marker.setIcon(L.divIcon({
                    className: 'camion-animated',
                    html: createCamionIconWithDechetterie(sim.color, sim.camionId, chargePercent, sim.capacite, currentAction),
                    iconSize: [55, 55],
                    iconAnchor: [27, 27]
                }));
                
                sim.marker.setPopupContent(createCamionPopupWithDechetterie(
                    sim.camionId,
                    sim.charge,
                    sim.capacite,
                    sim.waypoints,
                    sim.lastProcessedWaypoint
                ));
            }
        });
        
        step++;
    }, 80);
}

function createCamionIconWithDechetterie(color, camionId, chargePercent, capacite, currentAction) {
    const chargeBar = chargePercent > 0 ? `
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${Math.min(chargePercent, 100)}%; 
                    background: ${chargePercent > 80 ? '#dc3545' : chargePercent > 50 ? '#ffc107' : '#28a745'}; 
                    border-radius: 0 0 25px 25px; transition: all 0.3s;"></div>
    ` : '';
    
    const actionBadge = currentAction ? `
        <div style="position: absolute; top: -5px; right: -5px; background: white; border-radius: 50%; 
                    padding: 2px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ${currentAction === '♻️ Décharge' ? '♻️' : '📦'}
        </div>
    ` : '';
    
    return `
        <div style="position: relative; background: ${color}; width: 55px; height: 55px; 
                    border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
                    display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <div style="position: relative; z-index: 2; font-size: 26px;">🚛</div>
            <div style="position: absolute; bottom: 2px; left: 2px; right: 2px; font-size: 10px; 
                        color: white; font-weight: bold; text-align: center; z-index: 3;">
                ${Math.round(chargePercent)}%
            </div>
            ${chargeBar}
            ${actionBadge}
        </div>
    `;
}

function createCamionPopupWithDechetterie(camionId, charge, capacite, waypoints, currentWaypointIdx) {
    const chargePercent = (charge / capacite) * 100;
    const status = chargePercent > 80 ? '🔴 Plein' : chargePercent > 50 ? '🟡 Moyen' : '🟢 Disponible';
    
    // Construire la liste des étapes
    const etapesHtml = waypoints.slice(0, 6).map((wp, idx) => {
        let icon = '📍';
        let style = '';
        if (wp.type === 'depot') icon = '🏭';
        else if (wp.type === 'collecte') icon = '🗑️';
        else if (wp.type === 'dechetterie') icon = '♻️';
        
        if (idx === currentWaypointIdx) {
            style = 'background: #e3f2fd; font-weight: bold;';
        } else if (idx < currentWaypointIdx) {
            style = 'color: #999; text-decoration: line-through;';
        }
        
        return `<div style="padding: 2px 5px; font-size: 11px; ${style}">${icon} ${wp.nom}</div>`;
    }).join('');
    
    return `
        <div style="min-width: 220px;">
            <b>🚛 Camion ${camionId}</b>
            <hr style="margin: 5px 0;">
            <b>Charge:</b> ${charge.toFixed(0)} / ${capacite} kg<br>
            <b>Statut:</b> ${status}<br>
            <div style="margin-top: 5px; height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden;">
                <div style="height: 100%; width: ${chargePercent}%; 
                            background: ${chargePercent > 80 ? '#dc3545' : chargePercent > 50 ? '#ffc107' : '#28a745'};"></div>
            </div>
            <hr style="margin: 8px 0;">
            <b>Parcours :</b>
            <div style="max-height: 120px; overflow-y: auto; margin-top: 5px;">
                ${etapesHtml}
                ${waypoints.length > 6 ? '<div style="color: #666; font-size: 10px;">... et plus</div>' : ''}
            </div>
        </div>
    `;
}
