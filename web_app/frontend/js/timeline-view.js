/**
 * Timeline interactive - Vue calendrier hebdomadaire Niveau 3
 */

(function () {
    "use strict";

    const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const COULEURS_CAMION = {
        1: { bg: "#e3f2fd", border: "#2196f3" },
        2: { bg: "#e8f5e9", border: "#4caf50" },
        3: { bg: "#fff3e0", border: "#ff9800" },
        4: { bg: "#fce4ec", border: "#e91e63" },
        5: { bg: "#f3e5f5", border: "#9c27b0" },
    };

    function getSemaineLabel() {
        const d = new Date();
        const lundi = new Date(d);
        lundi.setDate(d.getDate() - d.getDay() + 1);
        const dimanche = new Date(lundi);
        dimanche.setDate(lundi.getDate() + 6);
        const fmt = (x) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return `Semaine du ${fmt(lundi)} - ${fmt(dimanche)} ${lundi.getFullYear()}`;
    }

    function buildTimelineData(planning) {
        if (!planning || !planning.planification_hebdomadaire) return [];
        const ph = planning.planification_hebdomadaire;
        const entries = [];
        JOURS.forEach((jour) => {
            (ph[jour] || []).forEach((e) => {
                entries.push({ ...e, jour });
            });
        });
        return entries;
    }

    function renderTimeline(result) {
        const container = document.getElementById("timeline-content");
        if (!container) return;

        const entries = buildTimelineData(result);
        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        const points = data.points || [];
        const ptsMap = new Map(points.map((p) => [p.id, p]));

        let html = `
      <div class="timeline-controls">
        <div class="timeline-nav">
          <button type="button" aria-label="Semaine précédente">◀</button>
          <span class="timeline-week-label">${getSemaineLabel()}</span>
          <button type="button" aria-label="Semaine suivante">▶</button>
        </div>
        <div class="timeline-filter">
          <label>Filtrer par camion :</label>
          <label><input type="radio" name="timeline-camion" value="all" checked> Tous</label>
          ${[1, 2, 3, 4, 5].map((i) => `<label><input type="radio" name="timeline-camion" value="${i}"> Cam${i}</label>`).join(" ")}
        </div>
      </div>
      <div class="timeline-grid">
        <div class="timeline-cell header"></div>
        ${JOURS.map((j) => `<div class="timeline-cell header">${j.charAt(0).toUpperCase() + j.slice(1)}</div>`).join("")}
      `;

        const heures = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
        for (let hi = 0; hi < heures.length - 1; hi++) {
            const hDeb = heures[hi];
            const hFin = heures[hi + 1];
            html += `<div class="timeline-cell hour-label">${hDeb}</div>`;
            JOURS.forEach((jour) => {
                const cellEntries = entries.filter(
                    (e) =>
                        e.jour === jour &&
                        e.creneau &&
                        e.creneau.debut >= hDeb &&
                        e.creneau.debut < hFin
                );
                const pause = hDeb === "12:00" ? true : false;
                html += `<div class="timeline-cell" data-jour="${jour}" data-heure="${hDeb}">`;
                if (pause) {
                    html += '<div class="timeline-pause">PAUSE</div>';
                }
                cellEntries.forEach((e) => {
                    const zone = ptsMap.get(e.zone_id);
                    const zoneNom = zone ? zone.nom : `Zone ${e.zone_id}`;
                    const couleur = COULEURS_CAMION[e.camion_id] || COULEURS_CAMION[1];
                    const debut = e.creneau?.debut || "";
                    const fin = e.creneau?.fin || "";
                    const duree = e.duree_totale || 0;
                    const pts = e.taches ? e.taches.map((t) => t.point_id).join(", ") : "";
                    html += `
            <div class="timeline-block camion-${e.camion_id}" 
                 data-camion="${e.camion_id}" 
                 data-zone="${e.zone_id}"
                 data-debut="${debut}"
                 data-fin="${fin}"
                 data-duree="${duree}"
                 data-zone-nom="${zoneNom}"
                 data-points="${pts}">
              <div class="timeline-block-title">🚛 Camion ${e.camion_id}</div>
              <div class="timeline-block-zone">📍 ${zoneNom}</div>
              <div class="timeline-block-time">⏰ ${debut}-${fin} (${duree} min)</div>
            </div>`;
                });
                html += "</div>";
            });
        }
        html += "</div>";

        html += `
      <div class="timeline-legend">
        ${[1, 2, 3, 4, 5].map((i) => `
          <div class="timeline-legend-item">
            <span class="timeline-legend-color" style="background:${COULEURS_CAMION[i]?.border || "#999"}"></span>
            Camion ${i}
          </div>
        `).join("")}
      </div>`;

        container.innerHTML = html;

        const tooltip = document.createElement("div");
        tooltip.className = "timeline-tooltip";
        tooltip.style.display = "none";
        document.body.appendChild(tooltip);

        container.querySelectorAll(".timeline-block").forEach((block) => {
            block.addEventListener("mouseenter", (e) => {
                const camionId = block.dataset.camion;
                const zoneNom = block.dataset.zoneNom;
                const debut = block.dataset.debut;
                const fin = block.dataset.fin;
                const duree = block.dataset.duree;
                const points = block.dataset.points || "";
                tooltip.innerHTML = `
          <h4>🚛 Camion ${camionId}</h4>
          <p>📍 ${zoneNom}</p>
          <p>⏰ ${debut} - ${fin}</p>
          <p>📏 Durée : ${duree} min</p>
          ${points ? `<p>Points : ${points}</p>` : ""}
        `;
                tooltip.style.display = "block";
                tooltip.style.left = e.pageX + 15 + "px";
                tooltip.style.top = e.pageY + 15 + "px";
            });
            block.addEventListener("mousemove", (e) => {
                tooltip.style.left = e.pageX + 15 + "px";
                tooltip.style.top = e.pageY + 15 + "px";
            });
            block.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });
        });

        container.querySelectorAll('input[name="timeline-camion"]').forEach((radio) => {
            radio.addEventListener("change", () => {
                const val = radio.value;
                container.querySelectorAll(".timeline-block").forEach((b) => {
                    if (val === "all" || b.dataset.camion === val) {
                        b.style.display = "";
                    } else {
                        b.style.display = "none";
                    }
                });
            });
        });
    }

    window.renderTimelineView = renderTimeline;
})();
