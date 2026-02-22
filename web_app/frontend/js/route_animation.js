// Animation progressive des routes - Style applications de livraison (Glovo, inDrive)
// Dessine les routes de manière progressive avec des flèches animées

// Configuration des couleurs distinctes pour chaque camion
const ROUTE_COLORS = [
    '#e74c3c', // Rouge
    '#3498db', // Bleu
    '#2ecc71', // Vert
    '#9b59b6', // Violet
    '#f39c12', // Orange
    '#1abc9c', // Turquoise
    '#e91e63', // Rose
    '#00bcd4', // Cyan
];

// État global des animations
let animatedRoutes = [];
let animationFrameId = null;
let routeAnimationRunning = false;

// Classe pour gérer une route animée
class AnimatedRoute {
    constructor(camionId, waypoints, color, routeCoords) {
        this.camionId = camionId;
        this.waypoints = waypoints; // Points avec type (depot, collecte, dechetterie)
        this.color = color;
        this.routeCoords = routeCoords; // Coordonnées OSRM complètes
        this.progress = 0; // 0 à 1
        this.currentSegment = 0;
        this.polyline = null;
        this.arrowMarker = null;
        this.drawnCoords = [];
        this.isComplete = false;
        this.waypointMarkers = [];
        this.visitedWaypoints = [];
    }
    
    // Initialiser la route sur la carte
    init() {
        // Créer une polyline vide qui sera remplie progressivement
        this.polyline = L.polyline([], {
            color: this.color,
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);
        
        // Créer le marqueur flèche animé
        this.arrowMarker = L.marker(this.routeCoords[0], {
            icon: L.divIcon({
                className: 'route-arrow-marker',
                html: this.createArrowIcon(),
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            }),
            zIndexOffset: 1000
        }).addTo(map);
        
        // Créer les marqueurs de waypoints (initialement grisés)
        this.createWaypointMarkers();
    }
    
    // Créer l'icône de la flèche
    createArrowIcon() {
        return `
            <div style="
                width: 30px; 
                height: 30px; 
                background: ${this.color}; 
                border-radius: 50%; 
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: pulse 1s infinite;
            ">
                <span style="font-size: 16px;">🚛</span>
            </div>
        `;
    }
    
    // Créer les marqueurs pour chaque waypoint
    createWaypointMarkers() {
        this.waypoints.forEach((wp, idx) => {
            if (idx === 0 || idx === this.waypoints.length - 1) {
                // Premier et dernier point (dépôt) - ne pas créer de marqueur spécial
                return;
            }
            
            let icon, bgColor;
            if (wp.type === 'collecte') {
                icon = '🗑️';
                bgColor = '#95a5a6'; // Gris (non visité)
            } else if (wp.type === 'dechetterie') {
                icon = '♻️';
                bgColor = '#95a5a6';
            } else {
                return;
            }
            
            const marker = L.marker([wp.lat, wp.lng], {
                icon: L.divIcon({
                    className: 'waypoint-marker-animated',
                    html: `<div class="waypoint-icon" data-camion="${this.camionId}" data-idx="${idx}" style="
                        background: ${bgColor}; 
                        width: 28px; 
                        height: 28px; 
                        border-radius: 50%; 
                        border: 2px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 14px;
                        transition: all 0.3s ease;
                    ">${icon}</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(map);
            
            marker.waypointIndex = idx;
            marker.waypointData = wp;
            this.waypointMarkers.push(marker);
        });
    }
    
    // Mettre à jour le marqueur d'un waypoint comme "visité"
    markWaypointVisited(waypointIdx) {
        const marker = this.waypointMarkers.find(m => m.waypointIndex === waypointIdx);
        if (marker && !this.visitedWaypoints.includes(waypointIdx)) {
            this.visitedWaypoints.push(waypointIdx);
            
            const wp = marker.waypointData;
            let icon, bgColor;
            
            if (wp.type === 'collecte') {
                icon = '✅';
                bgColor = this.color;
            } else if (wp.type === 'dechetterie') {
                icon = '♻️';
                bgColor = '#27ae60';
            }
            
            marker.setIcon(L.divIcon({
                className: 'waypoint-marker-visited',
                html: `<div style="
                    background: ${bgColor}; 
                    width: 32px; 
                    height: 32px; 
                    border-radius: 50%; 
                    border: 3px solid white;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    animation: popIn 0.3s ease;
                ">${icon}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            }));
            
            // Déclencher l'événement pour le panneau de présentation
            if (typeof onWaypointVisited === 'function') {
                onWaypointVisited(this.camionId, waypointIdx, wp);
            }
        }
    }
    
    // Mettre à jour l'animation (appelé à chaque frame)
    update(deltaProgress) {
        if (this.isComplete) return;
        
        this.progress += deltaProgress;
        
        if (this.progress >= 1) {
            this.progress = 1;
            this.isComplete = true;
        }
        
        // Calculer combien de coordonnées dessiner
        const totalCoords = this.routeCoords.length;
        const coordsToDraw = Math.floor(this.progress * totalCoords);
        
        // Mettre à jour la polyline
        this.drawnCoords = this.routeCoords.slice(0, coordsToDraw + 1);
        this.polyline.setLatLngs(this.drawnCoords);
        
        // Déplacer la flèche
        if (this.drawnCoords.length > 0) {
            const currentPos = this.drawnCoords[this.drawnCoords.length - 1];
            this.arrowMarker.setLatLng(currentPos);
            
            // Calculer la rotation de la flèche
            if (this.drawnCoords.length > 1) {
                const prevPos = this.drawnCoords[this.drawnCoords.length - 2];
                const angle = this.calculateAngle(prevPos, currentPos);
                // La rotation est gérée par CSS
            }
        }
        
        // Vérifier si on a atteint un waypoint
        this.checkWaypointReached();
    }
    
    // Calculer l'angle entre deux points
    calculateAngle(from, to) {
        const dx = to[1] - from[1];
        const dy = to[0] - from[0];
        return Math.atan2(dx, dy) * 180 / Math.PI;
    }
    
    // Vérifier si on a atteint un waypoint
    checkWaypointReached() {
        if (this.drawnCoords.length === 0) return;
        
        const currentPos = this.drawnCoords[this.drawnCoords.length - 1];
        
        this.waypoints.forEach((wp, idx) => {
            if (idx === 0 || this.visitedWaypoints.includes(idx)) return;
            
            const distance = this.distanceBetween(currentPos, [wp.lat, wp.lng]);
            if (distance < 0.0005) { // Environ 50 mètres
                this.markWaypointVisited(idx);
            }
        });
    }
    
    // Distance entre deux points
    distanceBetween(a, b) {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Nettoyer la route
    cleanup() {
        if (this.polyline) {
            map.removeLayer(this.polyline);
        }
        if (this.arrowMarker) {
            map.removeLayer(this.arrowMarker);
        }
        this.waypointMarkers.forEach(m => map.removeLayer(m));
    }
}

// Démarrer l'animation des routes
async function startRouteAnimation(routesResult) {
    // Arrêter toute animation en cours
    stopRouteAnimation();
    
    // Nettoyer les anciennes couches
    if (window.routesOptimiseesLayers) {
        window.routesOptimiseesLayers.forEach(layer => map.removeLayer(layer));
    }
    if (window.pathLayers) {
        window.pathLayers.forEach(layer => map.removeLayer(layer));
    }
    if (window.affectationLayers) {
        window.affectationLayers.forEach(layer => map.removeLayer(layer));
    }
    
    animatedRoutes = [];
    routeAnimationRunning = true;
    
    // Afficher le panneau de suivi en temps réel
    showRealtimeTrackingPanel(routesResult);
    
    // Préparer les routes
    for (let idx = 0; idx < routesResult.routes.length; idx++) {
        const route = routesResult.routes[idx];
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        
        // Convertir les waypoints x/y en lat/lng
        const waypointsLatLng = route.waypoints.map(wp => {
            const lat = CASABLANCA_CENTER[0] + (wp.y / 111);
            const lng = CASABLANCA_CENTER[1] + (wp.x / (111 * Math.cos(CASABLANCA_CENTER[0] * Math.PI / 180)));
            return { lat, lng, ...wp };
        });
        
        if (waypointsLatLng.length < 2) continue;
        
        // Obtenir la route OSRM
        const osrmRoute = await getFullRoute(waypointsLatLng.map(p => ({ lat: p.lat, lng: p.lng })));
        
        let routeCoords;
        if (osrmRoute && osrmRoute.coordinates && osrmRoute.coordinates.length >= 2) {
            routeCoords = osrmRoute.coordinates;
        } else {
            routeCoords = waypointsLatLng.map(p => [p.lat, p.lng]);
        }
        
        // Créer la route animée
        const animatedRoute = new AnimatedRoute(
            route.camion_id,
            waypointsLatLng,
            color,
            routeCoords
        );
        animatedRoute.routeData = route;
        animatedRoute.init();
        animatedRoutes.push(animatedRoute);
        
        // Ajouter au panneau
        addRouteToTrackingPanel(route, color, idx);
    }
    
    // Démarrer la boucle d'animation
    const animationSpeed = 0.002; // Vitesse de progression (0 à 1)
    let lastTime = performance.now();
    
    function animate(currentTime) {
        if (!routeAnimationRunning) return;
        
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Mettre à jour toutes les routes
        let allComplete = true;
        animatedRoutes.forEach(route => {
            if (!route.isComplete) {
                route.update(animationSpeed);
                allComplete = false;
            }
        });
        
        // Mettre à jour le panneau
        updateTrackingPanelProgress();
        
        if (!allComplete) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Animation terminée
            routeAnimationRunning = false;
            onAnimationComplete();
        }
    }
    
    animationFrameId = requestAnimationFrame(animate);
}

// Arrêter l'animation
function stopRouteAnimation() {
    routeAnimationRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    animatedRoutes.forEach(route => route.cleanup());
    animatedRoutes = [];
}

// Afficher le panneau de suivi en temps réel
function showRealtimeTrackingPanel(routesResult) {
    // Utiliser le panneau de présentation existant ou créer un nouveau
    const panel = document.getElementById('presentation-panel');
    if (!panel) return;
    
    panel.style.display = 'flex';
    
    const content = document.getElementById('presentation-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="realtime-tracking">
            <div class="tracking-header">
                <h3>🚀 Suivi en Temps Réel</h3>
                <div class="tracking-stats">
                    <span id="tracking-progress">0%</span> complété
                </div>
            </div>
            <div class="tracking-legend">
                <div class="legend-item"><span class="legend-dot" style="background: #95a5a6;"></span> En attente</div>
                <div class="legend-item"><span class="legend-dot" style="background: #f39c12;"></span> En cours</div>
                <div class="legend-item"><span class="legend-dot" style="background: #27ae60;"></span> Visité</div>
            </div>
            <div id="tracking-routes" class="tracking-routes"></div>
            <div class="tracking-controls">
                <button id="btn-pause-animation" class="btn btn-warning">⏸️ Pause</button>
                <button id="btn-speed-animation" class="btn btn-info">⚡ Vitesse x2</button>
                <button id="btn-stop-animation" class="btn btn-danger">⏹️ Arrêter</button>
            </div>
        </div>
    `;
    
    // Ajouter les styles
    addTrackingStyles();
    
    // Event listeners pour les contrôles
    document.getElementById('btn-stop-animation')?.addEventListener('click', () => {
        stopRouteAnimation();
        panel.style.display = 'none';
    });
    
    document.getElementById('btn-pause-animation')?.addEventListener('click', (e) => {
        if (routeAnimationRunning) {
            routeAnimationRunning = false;
            e.target.textContent = '▶️ Reprendre';
        } else {
            routeAnimationRunning = true;
            requestAnimationFrame(function animate(currentTime) {
                if (!routeAnimationRunning) return;
                animatedRoutes.forEach(route => {
                    if (!route.isComplete) route.update(0.002);
                });
                updateTrackingPanelProgress();
                if (animatedRoutes.some(r => !r.isComplete)) {
                    requestAnimationFrame(animate);
                }
            });
            e.target.textContent = '⏸️ Pause';
        }
    });
}

// Ajouter une route au panneau de suivi
function addRouteToTrackingPanel(route, color, index) {
    const container = document.getElementById('tracking-routes');
    if (!container) return;
    
    const routeDiv = document.createElement('div');
    routeDiv.className = 'tracking-route';
    routeDiv.id = `tracking-route-${route.camion_id}`;
    routeDiv.style.borderLeft = `4px solid ${color}`;
    
    // Créer les étapes
    const etapesHtml = route.waypoints.map((wp, idx) => {
        let icon = '📍';
        let typeLabel = '';
        
        if (wp.type === 'depot') {
            icon = '🏭';
            typeLabel = 'Dépôt';
        } else if (wp.type === 'collecte') {
            icon = '🗑️';
            typeLabel = `Collecte (${wp.volume || 0} kg)`;
        } else if (wp.type === 'dechetterie') {
            icon = '♻️';
            typeLabel = 'Déchetterie';
        }
        
        return `
            <div class="tracking-waypoint" data-camion="${route.camion_id}" data-idx="${idx}" id="wp-${route.camion_id}-${idx}">
                <span class="wp-icon">${icon}</span>
                <span class="wp-name">${wp.nom || typeLabel}</span>
                <span class="wp-status">⏳</span>
            </div>
        `;
    }).join('');
    
    routeDiv.innerHTML = `
        <div class="route-header" style="background: ${color}20;">
            <span class="route-icon" style="background: ${color};">🚛</span>
            <span class="route-title">Camion ${route.camion_id}</span>
            <span class="route-distance">${route.distance_totale?.toFixed(1) || '?'} km</span>
        </div>
        <div class="route-progress">
            <div class="progress-bar" id="progress-${route.camion_id}" style="background: ${color}; width: 0%;"></div>
        </div>
        <div class="route-waypoints">
            ${etapesHtml}
        </div>
    `;
    
    container.appendChild(routeDiv);
}

// Mettre à jour la progression dans le panneau
function updateTrackingPanelProgress() {
    let totalProgress = 0;
    
    animatedRoutes.forEach(route => {
        totalProgress += route.progress;
        
        // Mettre à jour la barre de progression
        const progressBar = document.getElementById(`progress-${route.camionId}`);
        if (progressBar) {
            progressBar.style.width = `${route.progress * 100}%`;
        }
    });
    
    // Mettre à jour le pourcentage global
    const avgProgress = animatedRoutes.length > 0 ? (totalProgress / animatedRoutes.length) * 100 : 0;
    const progressElement = document.getElementById('tracking-progress');
    if (progressElement) {
        progressElement.textContent = `${Math.round(avgProgress)}%`;
    }
}

// Callback quand un waypoint est visité
function onWaypointVisited(camionId, waypointIdx, waypoint) {
    const wpElement = document.getElementById(`wp-${camionId}-${waypointIdx}`);
    if (wpElement) {
        wpElement.classList.add('visited');
        const statusElement = wpElement.querySelector('.wp-status');
        if (statusElement) {
            statusElement.textContent = '✅';
        }
    }
    
    // Mettre à jour le statut du point sur la carte principale si c'est un point de collecte
    if (waypoint.type === 'collecte' && typeof points !== 'undefined') {
        const point = points.find(p => p.id === waypoint.id);
        if (point && point.status !== 'collecte') {
            point.status = 'collecte';
            if (typeof updatePointMarker === 'function') {
                updatePointMarker(point);
            }
            if (typeof updatePointsList === 'function') {
                updatePointsList();
            }
        }
    }
}

// Callback quand l'animation est terminée
function onAnimationComplete() {
    const progressElement = document.getElementById('tracking-progress');
    if (progressElement) {
        progressElement.textContent = '100%';
        progressElement.style.color = '#27ae60';
    }
    
    // Afficher un message de succès
    const trackingHeader = document.querySelector('.tracking-header h3');
    if (trackingHeader) {
        trackingHeader.innerHTML = '✅ Toutes les routes terminées !';
    }
}

// Ajouter les styles CSS pour le tracking
function addTrackingStyles() {
    if (document.getElementById('tracking-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'tracking-styles';
    styles.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
            50% { transform: scale(1.1); box-shadow: 0 2px 20px rgba(0,0,0,0.6); }
            100% { transform: scale(1); box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
        }
        
        @keyframes popIn {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .realtime-tracking {
            padding: 15px;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .tracking-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        
        .tracking-header h3 {
            margin: 0;
            font-size: 18px;
        }
        
        .tracking-stats {
            font-size: 16px;
            font-weight: bold;
            color: #667eea;
        }
        
        .tracking-legend {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            font-size: 12px;
            color: #666;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .legend-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .tracking-routes {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .tracking-route {
            background: #f8f9fa;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .route-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
        }
        
        .route-icon {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: white;
        }
        
        .route-title {
            font-weight: bold;
            flex: 1;
        }
        
        .route-distance {
            font-size: 12px;
            color: #666;
        }
        
        .route-progress {
            height: 4px;
            background: #e0e0e0;
        }
        
        .progress-bar {
            height: 100%;
            transition: width 0.1s ease;
        }
        
        .route-waypoints {
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .tracking-waypoint {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            border-radius: 4px;
            background: white;
            font-size: 12px;
            transition: all 0.3s ease;
        }
        
        .tracking-waypoint.visited {
            background: #d4edda;
        }
        
        .wp-icon {
            font-size: 14px;
        }
        
        .wp-name {
            flex: 1;
        }
        
        .wp-status {
            font-size: 12px;
        }
        
        .tracking-controls {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        
        .tracking-controls .btn {
            flex: 1;
            padding: 8px;
            font-size: 12px;
        }
    `;
    document.head.appendChild(styles);
}

// Fonction pour lancer l'animation depuis les résultats d'optimisation
async function animateRoutesFromResult(routesResult) {
    if (!routesResult || !routesResult.routes || routesResult.routes.length === 0) {
        alert('Aucune route à animer');
        return;
    }
    
    await startRouteAnimation(routesResult);
}
