// Gestion des templates d'import/export et cache OSRM

// ==================== CACHE OSRM (localStorage) ====================

const OSRM_CACHE_KEY = 'villepropre_osrm_cache';
const OSRM_CACHE_VERSION = '1.0';

/**
 * Charge le cache OSRM depuis localStorage
 */
function loadOSRMCache() {
    try {
        const cached = localStorage.getItem(OSRM_CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.version === OSRM_CACHE_VERSION && data.routes) {
                window.routeCache = data.routes;
                console.log(`✅ Cache OSRM chargé : ${Object.keys(data.routes).length} routes`);
                return true;
            }
        }
    } catch (error) {
        console.warn('⚠️ Erreur lors du chargement du cache OSRM:', error);
    }
    window.routeCache = {};
    return false;
}

/**
 * Sauvegarde le cache OSRM dans localStorage
 */
function saveOSRMCache() {
    try {
        const data = {
            version: OSRM_CACHE_VERSION,
            timestamp: new Date().toISOString(),
            routes: window.routeCache || {}
        };
        localStorage.setItem(OSRM_CACHE_KEY, JSON.stringify(data));
        console.log(`✅ Cache OSRM sauvegardé : ${Object.keys(window.routeCache).length} routes`);
        return true;
    } catch (error) {
        console.warn('⚠️ Erreur lors de la sauvegarde du cache OSRM:', error);
        // Si localStorage est plein, essayer de nettoyer les anciennes entrées
        if (error.name === 'QuotaExceededError') {
            clearOldOSRMCache();
        }
        return false;
    }
}

/**
 * Nettoie les anciennes entrées du cache si localStorage est plein
 */
function clearOldOSRMCache() {
    try {
        // Garder seulement les 1000 routes les plus récentes
        const routes = window.routeCache || {};
        const entries = Object.entries(routes);
        if (entries.length > 1000) {
            entries.sort((a, b) => {
                // Trier par timestamp si disponible, sinon garder les premières
                return 0;
            });
            const toKeep = entries.slice(0, 1000);
            window.routeCache = Object.fromEntries(toKeep);
            saveOSRMCache();
            console.log('🧹 Cache OSRM nettoyé (1000 routes conservées)');
        }
    } catch (error) {
        console.warn('⚠️ Erreur lors du nettoyage du cache:', error);
    }
}

/**
 * Ajoute une route au cache OSRM et sauvegarde
 */
function cacheOSRMRoute(key, routeData) {
    if (!window.routeCache) {
        window.routeCache = {};
    }
    window.routeCache[key] = routeData;
    // Sauvegarder de manière asynchrone pour ne pas bloquer
    setTimeout(() => saveOSRMCache(), 100);
}

// ==================== EXPORT TEMPLATE ====================

/**
 * Exporte un template complet avec tous les éléments et résultats
 */
function exportTemplate() {
    const template = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        metadata: {
            nom: prompt('Nom du template (optionnel):') || 'Template',
            description: prompt('Description (optionnel):') || ''
        },
        depot: depotPoint ? {
            id: depotPoint.id,
            nom: depotPoint.nom,
            x: parseFloat(depotPoint.x),
            y: parseFloat(depotPoint.y),
            lat: depotPoint.lat,
            lng: depotPoint.lng
        } : null,
        points: points.map(p => ({
            id: p.id,
            nom: p.nom,
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            lat: p.lat,
            lng: p.lng,
            volume: p.volume,
            priorite: p.priorite,
            isDepot: p.isDepot || false
        })),
        dechetteries: dechetteries.map(d => ({
            id: d.id,
            nom: d.nom,
            x: parseFloat(d.x),
            y: parseFloat(d.y),
            lat: d.lat,
            lng: d.lng,
            capacite_max: d.capacite_max,
            types_dechets: d.types_dechets,
            horaires: d.horaires
        })),
        camions: camions.map(c => ({
            id: c.id,
            capacite: c.capacite,
            cout_fixe: c.cout_fixe,
            zones_accessibles: c.zones_accessibles || []
        })),
        connexions: (typeof generateConnections === 'function' && depotPoint) ? generateConnections() : [],
        niveau1_result: niveau1Result,
        niveau2_result: niveau2Result,
        osrm_cache: window.routeCache || {}
    };

    // Créer un fichier JSON téléchargeable
    const jsonStr = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${template.metadata.nom.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Template exporté avec succès');
    alert(`✅ Template exporté avec succès !\n\nContenu:\n- ${points.length} points de collecte\n- ${dechetteries.length} déchetteries\n- ${camions.length} camions\n- ${Object.keys(window.routeCache || {}).length} routes OSRM en cache`);
}

// ==================== IMPORT TEMPLATE ====================

/**
 * Importe un template complet et applique tous les éléments
 */
async function importTemplate(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const template = JSON.parse(e.target.result);
                
                if (!template.version) {
                    throw new Error('Format de template invalide : version manquante');
                }

                console.log('📥 Import du template:', template.metadata?.nom || 'Sans nom');

                // 1. Nettoyer les éléments existants
                clearAllElements();

                // 2. Charger le cache OSRM depuis le template
                if (template.osrm_cache) {
                    window.routeCache = template.osrm_cache;
                    saveOSRMCache();
                    console.log(`✅ Cache OSRM importé : ${Object.keys(template.osrm_cache).length} routes`);
                }

                // 3. Charger les points de collecte
                if (template.points && Array.isArray(template.points)) {
                    // Réinitialiser le compteur d'IDs pour préserver les IDs du template
                    let maxId = 0;
                    for (const p of template.points) {
                        if (p.id && p.id > maxId) {
                            maxId = p.id;
                        }
                    }
                    // Ajuster le compteur global pour éviter les conflits
                    window.nextPointId = maxId + 1;
                    
                    for (const p of template.points) {
                        // Ne pas ajouter le dépôt comme point de collecte normal (sera géré séparément)
                        if (template.depot && p.id === template.depot.id) {
                            continue;
                        }
                        // Créer le point avec l'ID du template
                        const casablancaCenter = typeof CASABLANCA_CENTER !== 'undefined' ? CASABLANCA_CENTER : [33.5731, -7.5898];
                        const newPoint = {
                            id: p.id,
                            lat: p.lat,
                            lng: p.lng,
                            x: p.x ? p.x.toString() : ((p.lng - casablancaCenter[1]) * 111 * Math.cos(casablancaCenter[0] * Math.PI / 180)).toFixed(2),
                            y: p.y ? p.y.toString() : ((p.lat - casablancaCenter[0]) * 111).toFixed(2),
                            nom: p.nom,
                            volume: p.volume || 0,
                            priorite: p.priorite || 'normale',
                            status: 'en_attente',
                            isDepot: false
                        };
                        // Ajouter le point directement (sans passer par addPoint pour préserver l'ID)
                        points.push(newPoint);
                        if (typeof updatePointMarker === 'function') {
                            updatePointMarker(newPoint);
                        }
                    }
                    if (typeof updatePointsList === 'function') {
                        updatePointsList();
                    }
                    console.log(`✅ ${template.points.filter(p => !template.depot || p.id !== template.depot.id).length} points de collecte importés`);
                }

                // 4. Charger les déchetteries
                if (template.dechetteries && Array.isArray(template.dechetteries)) {
                    for (const d of template.dechetteries) {
                        addDechetterie({
                            id: d.id,
                            x: d.x,
                            y: d.y,
                            nom: d.nom,
                            capacite_max: d.capacite_max || 0,
                            types_dechets: d.types_dechets || [],
                            horaires: d.horaires || {}
                        });
                        // Mettre à jour les coordonnées lat/lng si disponibles
                        const dech = dechetteries.find(dc => dc.id === d.id);
                        if (dech && d.lat && d.lng) {
                            dech.lat = d.lat;
                            dech.lng = d.lng;
                            if (dech.marker) {
                                map.removeLayer(dech.marker);
                                updateDechetterieMarker(dech);
                            }
                        }
                    }
                    console.log(`✅ ${template.dechetteries.length} déchetteries importées`);
                }

                // 5. Charger les camions
                if (template.camions && Array.isArray(template.camions)) {
                    for (const c of template.camions) {
                        // Vérifier si le camion existe déjà
                        const existingCamion = camions.find(cam => cam.id === c.id);
                        if (!existingCamion) {
                            addCamion(
                                c.id,
                                c.capacite,
                                c.cout_fixe,
                                c.zones_accessibles ? c.zones_accessibles.join(',') : ''
                            );
                        }
                    }
                    if (typeof updateCamionsList === 'function') {
                        updateCamionsList();
                    }
                    console.log(`✅ ${template.camions.length} camions importés`);
                }

                // 6. Sélectionner le dépôt
                if (template.depot) {
                    // Chercher le dépôt dans les points ou déchetteries
                    let depot = points.find(p => p.id === template.depot.id);
                    if (!depot) {
                        depot = dechetteries.find(d => d.id === template.depot.id);
                    }
                    
                    // Si le dépôt n'existe pas encore, le créer comme point
                    if (!depot) {
                        // Créer le dépôt comme point de collecte avec l'ID du template
                        const casablancaCenter = typeof CASABLANCA_CENTER !== 'undefined' ? CASABLANCA_CENTER : [33.5731, -7.5898];
                        const depotPointData = {
                            id: template.depot.id,
                            lat: template.depot.lat,
                            lng: template.depot.lng,
                            x: template.depot.x ? template.depot.x.toString() : ((template.depot.lng - casablancaCenter[1]) * 111 * Math.cos(casablancaCenter[0] * Math.PI / 180)).toFixed(2),
                            y: template.depot.y ? template.depot.y.toString() : ((template.depot.lat - casablancaCenter[0]) * 111).toFixed(2),
                            nom: template.depot.nom || 'Dépôt',
                            volume: 0,
                            priorite: 'normale',
                            status: 'en_attente',
                            isDepot: false
                        };
                        points.push(depotPointData);
                        if (typeof updatePointMarker === 'function') {
                            updatePointMarker(depotPointData);
                        }
                        depot = depotPointData;
                    }
                    
                    if (depot) {
                        depotPoint = depot;
                        depotPoint.isDepot = true;
                        if (depot.type === 'dechetterie') {
                            updateDechetterieMarker(depot);
                        } else {
                            updatePointMarker(depot);
                        }
                        updateDepotCoords();
                        console.log('✅ Dépôt sélectionné:', depotPoint.nom);
                    }
                }

                // 7. Appliquer les résultats du niveau 1 si disponibles
                if (template.niveau1_result) {
                    niveau1Result = template.niveau1_result;
                    // Attendre un peu pour que la carte soit prête
                    setTimeout(() => {
                        if (typeof displayPaths === 'function' && niveau1Result.chemins_calcules) {
                            displayPaths(niveau1Result.chemins_calcules);
                            console.log(`✅ ${niveau1Result.chemins_calcules.length} chemins affichés sur la carte`);
                        }
                    }, 800);
                    console.log('✅ Résultats Niveau 1 appliqués');
                }

                // 8. Appliquer les résultats du niveau 2 si disponibles
                if (template.niveau2_result) {
                    niveau2Result = template.niveau2_result;
                    console.log('✅ Résultats Niveau 2 appliqués');
                    
                    // Activer le bouton de simulation si les résultats sont disponibles
                    const btnSimuler = document.getElementById('btn-simuler');
                    if (btnSimuler) {
                        btnSimuler.disabled = false;
                    }
                    
                    const btnPresentation = document.getElementById('btn-show-presentation');
                    if (btnPresentation && niveau2Result.affectation) {
                        btnPresentation.style.display = 'inline-block';
                    }
                }

                // 9. Mettre à jour les listes
                if (typeof updatePointsList === 'function') {
                    updatePointsList();
                }
                if (typeof updateDechetteriesList === 'function') {
                    updateDechetteriesList();
                }
                if (typeof updateCamionsList === 'function') {
                    updateCamionsList();
                }

                // 10. Recentrer la carte sur les éléments
                setTimeout(() => {
                    if (points.length > 0 || dechetteries.length > 0) {
                        const allMarkers = [
                            ...points.map(p => [p.lat, p.lng]),
                            ...dechetteries.map(d => [d.lat, d.lng])
                        ];
                        if (allMarkers.length > 0 && typeof map !== 'undefined') {
                            const bounds = L.latLngBounds(allMarkers);
                            map.fitBounds(bounds, { padding: [50, 50] });
                        }
                    }
                }, 300);

                resolve(template);
                
                const stats = {
                    points: template.points?.filter(p => !template.depot || p.id !== template.depot.id).length || 0,
                    dechetteries: template.dechetteries?.length || 0,
                    camions: template.camions?.length || 0,
                    routes: Object.keys(template.osrm_cache || {}).length,
                    niveau1: template.niveau1_result ? '✓' : '✗',
                    niveau2: template.niveau2_result ? '✓' : '✗'
                };
                
                alert(`✅ Template importé avec succès !\n\n📊 Contenu:\n- ${stats.points} points de collecte\n- ${stats.dechetteries} déchetteries\n- ${stats.camions} camions\n- ${stats.routes} routes OSRM en cache\n\n📈 Résultats:\n- Niveau 1 : ${stats.niveau1}\n- Niveau 2 : ${stats.niveau2}\n\nLes chemins réels OSRM ont été restaurés depuis le cache.`);

            } catch (error) {
                console.error('❌ Erreur lors de l\'import du template:', error);
                reject(error);
                alert('❌ Erreur lors de l\'import du template : ' + error.message);
            }
        };

        reader.onerror = () => {
            reject(new Error('Erreur lors de la lecture du fichier'));
        };

        reader.readAsText(file);
    });
}

/**
 * Nettoie tous les éléments de la carte
 */
function clearAllElements() {
    // Nettoyer les points
    points.forEach(p => {
        if (p.marker) {
            map.removeLayer(p.marker);
        }
    });
    points = [];

    // Nettoyer les déchetteries
    dechetteries.forEach(d => {
        if (d.marker) {
            map.removeLayer(d.marker);
        }
    });
    dechetteries = [];

    // Nettoyer les camions
    camions = [];

    // Nettoyer le dépôt
    depotPoint = null;

    // Nettoyer les chemins
    if (window.pathLayers) {
        window.pathLayers.forEach(l => map.removeLayer(l));
        window.pathLayers = [];
    }

    // Nettoyer les résultats
    niveau1Result = null;
    niveau2Result = null;

    // Mettre à jour les listes
    updatePointsList();
    updateDechetteriesList();

    // Désactiver les boutons
    const btnSimuler = document.getElementById('btn-simuler');
    if (btnSimuler) {
        btnSimuler.disabled = true;
    }
    const btnPresentation = document.getElementById('btn-show-presentation');
    if (btnPresentation) {
        btnPresentation.style.display = 'none';
    }
}

// ==================== GESTIONNAIRES D'ÉVÉNEMENTS ====================

/**
 * Initialise les gestionnaires d'événements pour l'import/export
 */
function initTemplateHandlers() {
    // Bouton Export
    const btnExport = document.getElementById('btn-export-template');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (points.length === 0 && dechetteries.length === 0 && camions.length === 0) {
                alert('Aucun élément à exporter. Ajoutez des points, déchetteries ou camions d\'abord.');
                return;
            }
            exportTemplate();
        });
    }

    // Bouton Import
    const btnImport = document.getElementById('btn-import-template');
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await importTemplate(file);
                    } catch (error) {
                        console.error('Erreur lors de l\'import:', error);
                    }
                }
            };
            input.click();
        });
    }

    // Charger le cache OSRM au démarrage
    loadOSRMCache();
}
