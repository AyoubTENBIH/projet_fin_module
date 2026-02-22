// Dashboard et statistiques

let chartCharges = null;

function updateDashboard(statistiques) {
    document.getElementById('dashboard').style.display = 'block';
    
    // Mettre à jour les statistiques
    document.getElementById('stat-distance').textContent = 
        niveau1Result ? niveau1Result.chemins_calcules.reduce((sum, c) => sum + c.distance, 0).toFixed(1) + ' km' : '-';
    
    document.getElementById('stat-cout').textContent = 
        statistiques.cout_total_estime ? statistiques.cout_total_estime.toFixed(2) + ' €' : '-';
    
    document.getElementById('stat-camions').textContent = 
        `${statistiques.nombre_camions_utilises}/${camions.length}`;
    
    document.getElementById('stat-taux').textContent = 
        statistiques.taux_utilisation_moyen ? statistiques.taux_utilisation_moyen.toFixed(1) + '%' : '-';
    
    // Mettre à jour le graphique
    updateChart(statistiques);
}

function updateChart(statistiques) {
    const ctx = document.getElementById('chart-charges');
    
    if (chartCharges) {
        chartCharges.destroy();
    }
    
    // Préparer les données depuis niveau2Result
    if (niveau2Result && niveau2Result.affectation) {
        const labels = niveau2Result.affectation.map(a => `Camion ${a.camion_id}`);
        const charges = niveau2Result.affectation.map(a => a.charge_totale);
        const capacites = niveau2Result.affectation.map(a => {
            const camion = camions.find(c => c.id === a.camion_id);
            return camion ? camion.capacite : 0;
        });
        
        chartCharges = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Charge actuelle (kg)',
                        data: charges,
                        backgroundColor: 'rgba(102, 126, 234, 0.6)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Capacité maximale (kg)',
                        data: capacites,
                        backgroundColor: 'rgba(200, 200, 200, 0.3)',
                        borderColor: 'rgba(200, 200, 200, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Charge (kg)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Répartition des charges par camion'
                    }
                }
            }
        });
    }
}
