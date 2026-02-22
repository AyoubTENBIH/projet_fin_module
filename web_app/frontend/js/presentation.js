// Présentation visuelle des chemins et résultats

let presentationInterval = null;
let presentationRunning = false;

// Fonction pour reconstruire le trajet complet (identique à simulation.js)
function construireTrajetComplet(aff) {
    if (!niveau1Result || !niveau1Result.chemins_calcules) {
        return [];
    }
    
    // Fonction pour trouver le chemin entre deux points
    function trouverChemin(departId, arriveeId) {
        if (departId === arriveeId) {
            return [departId];
        }
        
        const cheminDirect = niveau1Result.chemins_calcules.find(
            c => c.depart === departId && c.arrivee === arriveeId
        );
        
        if (cheminDirect && cheminDirect.chemin) {
            return cheminDirect.chemin;
        }
        
        const cheminInverse = niveau1Result.chemins_calcules.find(
            c => c.depart === arriveeId && c.arrivee === departId
        );
        
        if (cheminInverse && cheminInverse.chemin) {
            return [...cheminInverse.chemin].reverse();
        }
        
        // Solution de secours via le dépôt
        const cheminDepartVersDepot = niveau1Result.chemins_calcules.find(
            c => c.depart === departId && c.arrivee === 0
        );
        const cheminDepotVersArrivee = niveau1Result.chemins_calcules.find(
            c => c.depart === 0 && c.arrivee === arriveeId
        );
        
        if (cheminDepartVersDepot && cheminDepotVersArrivee) {
            return [
                ...cheminDepartVersDepot.chemin.slice(0, -1),
                ...cheminDepotVersArrivee.chemin
            ];
        }
        
        return [departId, arriveeId];
    }
    
    // Construire le trajet complet
    const trajetComplet = [0]; // Commencer par le dépôt
    
    // Pour chaque zone affectée, trouver le chemin depuis le dernier point
    aff.zones_affectees.forEach(zoneId => {
        const dernierPoint = trajetComplet[trajetComplet.length - 1];
        const cheminVersZone = trouverChemin(dernierPoint, zoneId);
        
        if (cheminVersZone.length > 1) {
            trajetComplet.push(...cheminVersZone.slice(1));
        } else if (cheminVersZone.length === 1 && cheminVersZone[0] !== dernierPoint) {
            trajetComplet.push(cheminVersZone[0]);
        }
    });
    
    // Ajouter le retour au dépôt
    const dernierPoint = trajetComplet[trajetComplet.length - 1];
    const cheminRetour = trouverChemin(dernierPoint, 0);
    if (cheminRetour.length > 1) {
        trajetComplet.push(...cheminRetour.slice(1));
    }
    
    return trajetComplet;
}

// Afficher le panneau de présentation
function showPresentation(affectation, niveau2Result) {
    const panel = document.getElementById('presentation-panel');
    const content = document.getElementById('presentation-content');
    
    if (!panel || !content) {
        console.error('Panneau de présentation non trouvé');
        return;
    }
    
    // Générer le contenu HTML
    let html = '';
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    
    affectation.forEach((aff, idx) => {
        const camion = camions.find(c => c.id === aff.camion_id);
        if (!camion) return;
        
        const color = colors[idx % colors.length];
        
        // Construire le trajet complet avec tous les points intermédiaires
        const trajetComplet = construireTrajetComplet(aff);
        
        // Séparer les points : dépôt, points de collecte, points intermédiaires
        const pointsDeTrajet = trajetComplet.map(id => {
            if (id === 0) {
                return { id: 0, nom: depotPoint ? depotPoint.nom : 'Dépôt', type: 'depot', isCollecte: false };
            }
            const point = points.find(p => p.id === id && !p.isDepot);
            if (point) {
                const isCollecte = aff.zones_affectees.includes(id);
                return { 
                    id, 
                    nom: point.nom, 
                    type: isCollecte ? 'collecte' : 'intermediaire', 
                    isCollecte,
                    volume: point.volume,
                    priorite: point.priorite
                };
            }
            return null;
        }).filter(p => p !== null);
        
        // Compter les points intermédiaires (points qui ne sont ni le dépôt ni des points de collecte assignés)
        const pointsIntermediaires = pointsDeTrajet.filter(p => p.type === 'intermediaire').length;
        
        // Calculer la distance totale pour ce camion
        let distanceTotale = 0;
        for (let i = 0; i < trajetComplet.length - 1; i++) {
            const chemin = niveau1Result.chemins_calcules.find(
                c => c.depart === trajetComplet[i] && c.arrivee === trajetComplet[i + 1]
            );
            if (chemin) {
                distanceTotale += chemin.distance;
            }
        }
        
        html += `
            <div class="presentation-route" data-camion-id="${aff.camion_id}" style="border-left-color: ${color};">
                <div class="presentation-route-header" style="background: ${color};">
                    <div class="presentation-route-title" style="color: white;">🚛 Camion ${aff.camion_id}</div>
                    <div style="font-size: 0.9em; color: rgba(255,255,255,0.9);">
                        Charge: ${aff.charge_totale} / ${camion.capacite} kg | Distance: ${distanceTotale.toFixed(2)} km
                    </div>
                </div>
                <div class="presentation-route-path-detailed" id="path-${aff.camion_id}" 
                     style="--total-segments: ${pointsDeTrajet.length - 1};">
                    ${pointsDeTrajet.map((point, pointIdx) => {
                        const isLast = pointIdx === pointsDeTrajet.length - 1;
                        const leftPos = pointsDeTrajet.length > 1 
                            ? (pointIdx / (pointsDeTrajet.length - 1)) * 100 
                            : 0;
                        
                        let pointClass = 'presentation-point-detailed';
                        let pointIcon = '🗑️';
                        let pointLabel = point.nom;
                        
                        if (point.type === 'depot') {
                            pointClass = 'presentation-depot-detailed';
                            pointIcon = '🏭';
                            pointLabel = 'Dépôt';
                        } else if (point.type === 'collecte') {
                            pointClass = 'presentation-point-collecte';
                            pointIcon = '🗑️';
                        } else {
                            pointClass = 'presentation-point-intermediaire';
                            pointIcon = '📍';
                            pointLabel = point.nom.length > 10 ? point.nom.substring(0, 8) + '...' : point.nom;
                        }
                        
                        // Calculer la position et largeur de la ligne vers le point suivant
                        let lineStyle = '';
                        if (!isLast) {
                            const nextLeftPos = ((pointIdx + 1) / (pointsDeTrajet.length - 1)) * 100;
                            const lineWidth = nextLeftPos - leftPos;
                            // La ligne commence au centre du point actuel et va jusqu'au centre du point suivant
                            lineStyle = `background: ${color}; width: ${lineWidth}%; left: 50%;`;
                        }
                        
                        // Créer le contenu du popup pour les points de collecte
                        const hasPopup = point.type === 'collecte';
                        const popupId = hasPopup ? `popup-${aff.camion_id}-${point.id}-${pointIdx}` : '';
                        
                        return `
                            <div class="presentation-path-segment" style="left: ${leftPos}%;">
                                <div class="${pointClass} ${hasPopup ? 'presentation-point-hoverable' : ''}" 
                                     id="point-${aff.camion_id}-${point.id}-${pointIdx}" 
                                     style="background: ${point.type === 'depot' ? '#dc3545' : point.type === 'collecte' ? color : '#95a5a6'};"
                                     title="${hasPopup ? `${point.nom} - Volume: ${point.volume || 'N/A'} kg` : point.nom}">
                                    ${pointIcon}
                                    ${hasPopup ? `
                                        <div class="presentation-popup" id="${popupId}" style="display: none;">
                                            <div class="presentation-point-popup">
                                                <strong>${point.nom}</strong><br>
                                                Volume: ${point.volume || 'N/A'} kg<br>
                                                Priorité: ${point.priorite || 'N/A'}<br>
                                                ID: ${point.id}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="presentation-point-label">${pointLabel}</div>
                                ${!isLast ? `
                                    <div class="presentation-segment-line" style="${lineStyle}"></div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                    <div class="presentation-truck-icon-detailed" id="truck-${aff.camion_id}" 
                         style="background: ${color}; left: 0%;">🚛</div>
                </div>
                <div class="presentation-route-info">
                    <div><strong>Points de collecte:</strong> ${aff.zones_affectees.join(', ')}</div>
                    <div><strong>Points intermédiaires:</strong> ${pointsIntermediaires}</div>
                    <div><strong>Total points dans le trajet:</strong> ${trajetComplet.length}</div>
                </div>
            </div>
        `;
    });
    
    // Ajouter les résultats de l'algorithme
    if (niveau2Result && niveau2Result.statistiques) {
        const stats = niveau2Result.statistiques;
        html += `
            <div class="presentation-results">
                <h4>📊 Résultats de l'Algorithme Glouton</h4>
                <div class="presentation-results-item">
                    <strong>Distance Totale:</strong> ${niveau1Result ? niveau1Result.chemins_calcules.reduce((sum, c) => sum + c.distance, 0).toFixed(2) : 'N/A'} km
                </div>
                <div class="presentation-results-item">
                    <strong>Coût Total:</strong> ${stats.cout_total_estime ? stats.cout_total_estime.toFixed(2) : 'N/A'} €
                </div>
                <div class="presentation-results-item">
                    <strong>Camions Utilisés:</strong> ${stats.nombre_camions_utilises || 0} / ${camions.length}
                </div>
                <div class="presentation-results-item">
                    <strong>Taux d'Utilisation Moyen:</strong> ${stats.taux_utilisation_moyen ? stats.taux_utilisation_moyen.toFixed(1) : 'N/A'}%
                </div>
                <div class="presentation-results-item">
                    <strong>Équilibrage de Charge:</strong> ${stats.equilibrage_charge ? stats.equilibrage_charge.toFixed(2) : 'N/A'}
                </div>
                <div class="presentation-results-item">
                    <strong>Contraintes Respectées:</strong> ✅ Capacité, ✅ Zones accessibles, ✅ Dépôt unique
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    panel.style.display = 'flex';
    
    // Ajouter les événements hover pour les popups
    setTimeout(() => {
        document.querySelectorAll('.presentation-point-hoverable').forEach(pointEl => {
            const popup = pointEl.querySelector('.presentation-popup');
            if (popup) {
                pointEl.addEventListener('mouseenter', () => {
                    popup.style.display = 'block';
                });
                pointEl.addEventListener('mouseleave', () => {
                    popup.style.display = 'none';
                });
            }
        });
    }, 100);
    
    // Démarrer l'animation
    startPresentationAnimation(affectation);
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Animer les camions dans la présentation
function startPresentationAnimation(affectation) {
    if (presentationRunning) {
        stopPresentationAnimation();
    }
    
    presentationRunning = true;
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    
    // Réinitialiser toutes les positions et états
    affectation.forEach((aff) => {
        const truckElement = document.getElementById(`truck-${aff.camion_id}`);
        if (truckElement) {
            truckElement.style.left = '0%';
        }
        
        // Réinitialiser tous les points de collecte
        aff.zones_affectees.forEach(zoneId => {
            const pointElements = document.querySelectorAll(`[id^="point-${aff.camion_id}-${zoneId}"]`);
            pointElements.forEach(el => el.classList.remove('collected'));
        });
    });
    
    // Pour chaque camion, créer une animation basée sur le trajet réel
    affectation.forEach((aff, idx) => {
        const truckElement = document.getElementById(`truck-${aff.camion_id}`);
        if (!truckElement) return;
        
        const color = colors[idx % colors.length];
        truckElement.style.background = color;
        
        // Construire le trajet complet (comme dans la simulation)
        const trajetComplet = construireTrajetComplet(aff);
        
        if (trajetComplet.length < 2) {
            console.warn(`Trajet trop court pour le camion ${aff.camion_id}`);
            return;
        }
        
        // Calculer la durée totale (basée sur le nombre de segments)
        const nombreSegments = trajetComplet.length - 1;
        const durationPerSegment = 1500; // 1.5 secondes par segment
        const totalDuration = nombreSegments * durationPerSegment;
        
        // Animation : déplacer le camion le long du trajet réel
        let startTime = Date.now() + (idx * 500); // Délai de départ pour chaque camion
        
        const animate = () => {
            if (!presentationRunning) return;
            
            const elapsed = Math.max(0, Date.now() - startTime);
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Calculer le segment actuel et la position dans ce segment
            const segmentProgress = progress * nombreSegments;
            const currentSegment = Math.floor(segmentProgress);
            const segmentLocalProgress = segmentProgress - currentSegment;
            
            if (currentSegment < nombreSegments) {
                // Position du camion entre le segment actuel et le suivant
                const segmentStart = (currentSegment / nombreSegments) * 100;
                const segmentEnd = ((currentSegment + 1) / nombreSegments) * 100;
                const position = segmentStart + (segmentEnd - segmentStart) * segmentLocalProgress;
                
                truckElement.style.left = `${position}%`;
                
                // Marquer les points de collecte comme collectés quand le camion les atteint
                const currentPointId = trajetComplet[currentSegment + 1];
                if (aff.zones_affectees.includes(currentPointId) && segmentLocalProgress > 0.8) {
                    const pointElements = document.querySelectorAll(`[id^="point-${aff.camion_id}-${currentPointId}"]`);
                    pointElements.forEach(el => {
                        if (el.classList.contains('presentation-point-collecte')) {
                            el.classList.add('collected');
                        }
                    });
                }
            } else {
                // Fin du trajet
                truckElement.style.left = '100%';
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation terminée pour ce camion
                truckElement.style.left = '100%';
                // Marquer tous les points comme collectés
                aff.zones_affectees.forEach(zoneId => {
                    const pointElements = document.querySelectorAll(`[id^="point-${aff.camion_id}-${zoneId}"]`);
                    pointElements.forEach(el => {
                        if (el.classList.contains('presentation-point-collecte')) {
                            el.classList.add('collected');
                        }
                    });
                });
            }
        };
        
        // Démarrer l'animation avec un délai pour chaque camion
        setTimeout(() => {
            animate();
        }, idx * 500); // Délai de 500ms entre chaque camion
    });
}

// Arrêter l'animation
function stopPresentationAnimation() {
    presentationRunning = false;
    if (presentationInterval) {
        clearInterval(presentationInterval);
        presentationInterval = null;
    }
}

// Fermer le panneau de présentation
function closePresentation() {
    const panel = document.getElementById('presentation-panel');
    if (panel) {
        panel.style.display = 'none';
    }
    stopPresentationAnimation();
}
