/**
 * Tableau de bord statistiques - Niveau 3
 */

(function () {
    "use strict";

    const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

    function getCoutParJour(entries) {
        return entries.length * 42;
    }

    function getDistanceParJour(entries) {
        return entries.reduce((s, e) => s + (e.duree_totale || 0) * 0.15, 0);
    }

    function renderStatsDashboard(result) {
        const container = document.getElementById("stats-dashboard-content");
        if (!container) return;

        const indicateurs = result?.indicateurs || {};
        const ph = result?.planification_hebdomadaire || {};
        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        const points = data.points || [];

        const tauxOcc = indicateurs.taux_occupation || 0;
        const respectH = indicateurs.respect_horaires || 100;
        const congestion = indicateurs.congestion_moyenne || 1;
        const retard = indicateurs.retard_moyen || 0;

        let statsHtml = `
      <div class="stats-kpis">
        <div class="stat-kpi">
          <div class="stat-kpi-label">Taux d'Occupation</div>
          <div class="stat-kpi-bar"><div class="stat-kpi-fill" style="width:${Math.min(100, tauxOcc)}%"></div></div>
          <div class="stat-kpi-value">${tauxOcc}%</div>
        </div>
        <div class="stat-kpi">
          <div class="stat-kpi-label">Respect des Horaires</div>
          <div class="stat-kpi-bar"><div class="stat-kpi-fill" style="width:${respectH}%"></div></div>
          <div class="stat-kpi-value">${respectH}%</div>
        </div>
        <div class="stat-kpi">
          <div class="stat-kpi-label">Congestion Moyenne</div>
          <div class="stat-kpi-bar"><div class="stat-kpi-fill" style="width:${(congestion - 1) * 100}%"></div></div>
          <div class="stat-kpi-value">${congestion}</div>
          <div class="stat-kpi-hint">${congestion <= 1.2 ? "Plutôt fluide" : congestion <= 1.5 ? "Modéré" : "Embouteillages"}</div>
        </div>
        <div class="stat-kpi">
          <div class="stat-kpi-label">Retard Moyen</div>
          <div class="stat-kpi-value">${retard} min</div>
          <div class="stat-kpi-hint">${retard === 0 ? "Aucun retard prévu" : ""}</div>
        </div>
      </div>`;

        const rows = [];
        let totalTours = 0;
        let totalDistance = 0;
        let totalCout = 0;

        JOURS.forEach((jour) => {
            const entries = ph[jour] || [];
            const nbTours = entries.length;
            const dist = getDistanceParJour(entries);
            const cout = getCoutParJour(entries);
            totalTours += nbTours;
            totalDistance += dist;
            totalCout += cout;
            rows.push({
                jour: jour.charAt(0).toUpperCase() + jour.slice(1),
                tours: nbTours,
                distance: dist,
                cout,
            });
        });

        statsHtml += `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Jour</th>
            <th>Tours</th>
            <th>Distance</th>
            <th>Coût</th>
            <th>CO2</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.jour}</td>
              <td>${r.tours}</td>
              <td>${r.distance > 0 ? r.distance.toFixed(1) + " km" : "-"}</td>
              <td>${r.cout > 0 ? r.cout.toFixed(2) + "€" : "-"}</td>
              <td>${r.distance > 0 ? (r.distance * 0.15).toFixed(1) + " kg" : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>TOTAL</strong></td>
            <td><strong>${totalTours}</strong></td>
            <td><strong>${totalDistance.toFixed(1)} km</strong></td>
            <td><strong>${totalCout.toFixed(2)}€</strong></td>
            <td><strong>${(totalDistance * 0.15).toFixed(1)} kg</strong></td>
          </tr>
        </tfoot>
      </table>`;

        container.innerHTML = statsHtml;
    }

    window.renderStatsDashboard = renderStatsDashboard;
})();
