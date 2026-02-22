/**
 * Niveau 3 - Planification temporelle - VillePropre
 * Configuration créneaux, contraintes, génération planning, modal
 */

(function () {
    "use strict";

    const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const HEURES_CRENEAUX = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

    // État global Niveau 3
    let creneaux = [];
    let contraintes = {
        fenetres_zone: [],
        pauses_obligatoires: [],
        zones_interdites_nuit: [],
    };
    let planningResult = null;

    const TEMPLATES = {
        semaine_classique: {
            nom: "Semaine classique",
            creneaux: [
                { jour: "lundi", debut: "06:00", fin: "08:00", congestion: 1 },
                { jour: "lundi", debut: "08:00", fin: "10:00", congestion: 1.3 },
                { jour: "lundi", debut: "10:00", fin: "12:00", congestion: 1.2 },
                { jour: "lundi", debut: "14:00", fin: "16:00", congestion: 1.1 },
                { jour: "lundi", debut: "16:00", fin: "18:00", congestion: 1.5 },
                { jour: "mardi", debut: "06:00", fin: "08:00", congestion: 1 },
                { jour: "mardi", debut: "08:00", fin: "10:00", congestion: 1.3 },
                { jour: "mardi", debut: "10:00", fin: "12:00", congestion: 1.2 },
                { jour: "mardi", debut: "14:00", fin: "16:00", congestion: 1.1 },
                { jour: "mardi", debut: "16:00", fin: "18:00", congestion: 1.5 },
                { jour: "mercredi", debut: "06:00", fin: "08:00", congestion: 1 },
                { jour: "mercredi", debut: "08:00", fin: "10:00", congestion: 1.3 },
                { jour: "mercredi", debut: "10:00", fin: "12:00", congestion: 1.2 },
                { jour: "mercredi", debut: "14:00", fin: "16:00", congestion: 1.1 },
                { jour: "jeudi", debut: "06:00", fin: "08:00", congestion: 1 },
                { jour: "jeudi", debut: "08:00", fin: "10:00", congestion: 1.3 },
                { jour: "jeudi", debut: "14:00", fin: "16:00", congestion: 1.1 },
                { jour: "vendredi", debut: "06:00", fin: "08:00", congestion: 1 },
                { jour: "vendredi", debut: "08:00", fin: "10:00", congestion: 1.4 },
                { jour: "vendredi", debut: "10:00", fin: "12:00", congestion: 1.2 },
            ],
        },
        mediterranee: {
            nom: "Ville méditerranéenne (sieste 14h-16h)",
            creneaux: [
                { jour: "lundi", debut: "06:00", fin: "10:00", congestion: 1.2 },
                { jour: "lundi", debut: "16:00", fin: "20:00", congestion: 1.3 },
                { jour: "mardi", debut: "06:00", fin: "10:00", congestion: 1.2 },
                { jour: "mardi", debut: "16:00", fin: "20:00", congestion: 1.3 },
                { jour: "mercredi", debut: "06:00", fin: "10:00", congestion: 1.2 },
                { jour: "mercredi", debut: "16:00", fin: "20:00", congestion: 1.3 },
                { jour: "jeudi", debut: "06:00", fin: "10:00", congestion: 1.2 },
                { jour: "jeudi", debut: "16:00", fin: "20:00", congestion: 1.3 },
                { jour: "vendredi", debut: "06:00", fin: "10:00", congestion: 1.2 },
                { jour: "vendredi", debut: "16:00", fin: "20:00", congestion: 1.4 },
            ],
        },
        ramadan: {
            nom: "Ramadan (horaires spéciaux)",
            creneaux: [
                { jour: "lundi", debut: "06:00", fin: "09:00", congestion: 1.1 },
                { jour: "lundi", debut: "21:00", fin: "23:00", congestion: 1.4 },
                { jour: "mardi", debut: "06:00", fin: "09:00", congestion: 1.1 },
                { jour: "mardi", debut: "21:00", fin: "23:00", congestion: 1.4 },
                { jour: "mercredi", debut: "06:00", fin: "09:00", congestion: 1.1 },
                { jour: "mercredi", debut: "21:00", fin: "23:00", congestion: 1.4 },
                { jour: "jeudi", debut: "06:00", fin: "09:00", congestion: 1.1 },
                { jour: "jeudi", debut: "21:00", fin: "23:00", congestion: 1.4 },
                { jour: "vendredi", debut: "06:00", fin: "09:00", congestion: 1.1 },
                { jour: "vendredi", debut: "21:00", fin: "23:00", congestion: 1.5 },
            ],
        },
    };

    function getCouleurCongestion(c) {
        if (c <= 1.2) return "congestion-low";
        if (c <= 1.5) return "congestion-mid";
        return "congestion-high";
    }

    function getCreneauxParJour() {
        const parJour = {};
        JOURS.forEach((j) => (parJour[j] = []));
        creneaux.forEach((c) => {
            if (parJour[c.jour]) parJour[c.jour].push(c);
        });
        return parJour;
    }

    function renderCreneauxGrid() {
        const container = document.getElementById("creneaux-grid-container");
        if (!container) return;

        const parJour = getCreneauxParJour();

        let html = '<div class="creneaux-grid">';
        html += '<div class="creneaux-grid-header"></div>';
        JOURS.slice(0, 5).forEach((j) => {
            html += `<div class="creneaux-grid-header">${j.charAt(0).toUpperCase() + j.slice(1)}</div>`;
        });

        HEURES_CRENEAUX.forEach((h, i) => {
            if (i === HEURES_CRENEAUX.length - 1) return;
            const hFin = HEURES_CRENEAUX[i + 1];
            html += `<div class="creneaux-slot heure-label">${h}-${hFin}</div>`;

            JOURS.slice(0, 5).forEach((jour) => {
                const creneau = parJour[jour]?.find(
                    (c) => c.debut === h && c.fin === hFin
                );
                const cls = creneau
                    ? `filled ${getCouleurCongestion(creneau.congestion || 1)}`
                    : "";
                const txt = creneau ? `${creneau.congestion || 1}` : "";
                html += `<div class="creneaux-slot ${cls}" data-jour="${jour}" data-debut="${h}" data-fin="${hFin}">${txt}</div>`;
            });
        });
        html += "</div>";
        container.innerHTML = html;

        container.querySelectorAll(".creneaux-slot.filled").forEach((el) => {
            el.addEventListener("click", () => {
                const c = parJour[el.dataset.jour]?.find(
                    (cr) => cr.debut === el.dataset.debut && cr.fin === el.dataset.fin
                );
                if (c) ouvrirFormulaireCreneau(c);
            });
        });
    }

    function ouvrirFormulaireCreneau(creneauExistant) {
        const modal = document.getElementById("modal-creneau");
        if (!modal) return;

        const jourSelect = document.getElementById("creneau-jour");
        const debutInput = document.getElementById("creneau-debut");
        const finInput = document.getElementById("creneau-fin");
        const congestionInput = document.getElementById("creneau-congestion");
        const congestionLabel = document.getElementById("creneau-congestion-label");

        if (creneauExistant) {
            document.getElementById("creneau-form-title").textContent = "Modifier le créneau";
            jourSelect.value = creneauExistant.jour;
            debutInput.value = creneauExistant.debut;
            finInput.value = creneauExistant.fin;
            congestionInput.value = creneauExistant.congestion || 1;
            document.getElementById("creneau-form").dataset.editId = creneauExistant.id;
        } else {
            document.getElementById("creneau-form-title").textContent = "Ajouter un créneau";
            jourSelect.value = "lundi";
            debutInput.value = "08:00";
            finInput.value = "10:00";
            congestionInput.value = "1.0";
            delete document.getElementById("creneau-form").dataset.editId;
        }

        function updateLabel() {
            const v = parseFloat(congestionInput.value) || 1;
            let lbl = "Trafic : Normal";
            if (v >= 1.5) lbl = "Trafic : Embouteillages";
            else if (v >= 1.2) lbl = "Trafic : Modéré";
            congestionLabel.textContent = lbl;
        }
        congestionInput.addEventListener("input", updateLabel);
        updateLabel();

        modal.style.display = "block";
    }

    function sauvegarderCreneau(e) {
        e.preventDefault();
        const form = e.target;
        const id = form.dataset.editId
            ? parseInt(form.dataset.editId, 10)
            : (creneaux.length ? Math.max(...creneaux.map((c) => c.id || 0)) + 1 : 1);

        const creneau = {
            id,
            jour: form.querySelector("#creneau-jour").value,
            debut: form.querySelector("#creneau-debut").value,
            fin: form.querySelector("#creneau-fin").value,
            congestion: parseFloat(form.querySelector("#creneau-congestion").value) || 1,
        };

        if (form.dataset.editId) {
            const idx = creneaux.findIndex((c) => (c.id || 0) === id);
            if (idx >= 0) creneaux[idx] = creneau;
        } else {
            creneaux.push(creneau);
        }

        document.getElementById("modal-creneau").style.display = "none";
        renderCreneauxGrid();
    }

    function dupliquerSemaine() {
        const base = creneaux.filter(
            (c) =>
                c.jour === "lundi" ||
                c.jour === "mardi" ||
                c.jour === "mercredi" ||
                c.jour === "jeudi" ||
                c.jour === "vendredi"
        );
        if (base.length === 0) {
            alert("Aucun créneau à dupliquer. Ajoutez des créneaux d'abord.");
            return;
        }
        const maxId = creneaux.length ? Math.max(...creneaux.map((c) => c.id || 0)) : 0;
        const nouveaux = [];
        JOURS.forEach((jour) => {
            base.forEach((c) => {
                nouveaux.push({
                    ...c,
                    id: maxId + nouveaux.length + 1,
                    jour,
                });
            });
        });
        creneaux = creneaux.concat(nouveaux);
        renderCreneauxGrid();
    }

    function chargerTemplate(key) {
        const t = TEMPLATES[key];
        if (!t) return;
        const maxId = creneaux.length ? Math.max(...creneaux.map((c) => c.id || 0), 0) : 0;
        creneaux = t.creneaux.map((c, i) => ({
            id: maxId + i + 1,
            jour: c.jour,
            debut: c.debut,
            fin: c.fin,
            congestion: c.congestion || 1,
        }));
        renderCreneauxGrid();
    }

    function initContraintes() {
        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        const pts = (data.points || []).filter((p) => !p.isDepot);
        if (pts.length === 0) return;

        const container = document.getElementById("contraintes-fenetres-container");
        if (!container) return;

        let html = "";
        pts.forEach((p) => {
            const f = contraintes.fenetres_zone.find((z) => z.zone_id === p.id);
            html += `
        <div class="contrainte-zone-row">
          <label>Zone ${p.id} (${p.nom || "Sans nom"})</label>
          <div class="fenetre-inputs">
            <input type="time" class="fenetre-debut" data-zone="${p.id}" value="${f ? f.debut : "06:00"}">
            <span>—</span>
            <input type="time" class="fenetre-fin" data-zone="${p.id}" value="${f ? f.fin : "20:00"}">
          </div>
        </div>`;
        });
        container.innerHTML = html;

        container.querySelectorAll(".fenetre-debut, .fenetre-fin").forEach((input) => {
            input.addEventListener("change", () => {
                const zoneId = parseInt(input.dataset.zone, 10);
                const row = input.closest(".contrainte-zone-row");
                const debut = row.querySelector(".fenetre-debut").value;
                const fin = row.querySelector(".fenetre-fin").value;
                const idx = contraintes.fenetres_zone.findIndex((z) => z.zone_id === zoneId);
                const obj = { zone_id: zoneId, debut, fin };
                if (idx >= 0) contraintes.fenetres_zone[idx] = obj;
                else contraintes.fenetres_zone.push(obj);
            });
        });
    }

    function initPausesCamions() {
        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        const camions = data.camions || [];
        const container = document.getElementById("contraintes-pauses-container");
        if (!container) return;

        let html = "";
        camions.forEach((c) => {
            const p = contraintes.pauses_obligatoires.find((x) => x.camion_id === c.id);
            html += `
        <div class="pause-camion-row">
          <label>Camion ${c.id}</label>
          <input type="time" class="pause-debut" data-camion="${c.id}" value="${p ? p.debut : "12:00"}">
          <span>Durée :</span>
          <input type="number" class="pause-duree" data-camion="${c.id}" value="${p ? p.duree : 1}" min="0.5" max="3" step="0.5"> h
        </div>`;
        });
        container.innerHTML = html;

        container.querySelectorAll(".pause-debut, .pause-duree").forEach((input) => {
            input.addEventListener("change", () => {
                const camionId = parseInt(input.dataset.camion, 10);
                const row = input.closest(".pause-camion-row");
                const debut = row.querySelector(".pause-debut").value;
                const duree = parseFloat(row.querySelector(".pause-duree").value) || 1;
                const idx = contraintes.pauses_obligatoires.findIndex((x) => x.camion_id === camionId);
                const obj = { camion_id: camionId, debut, duree };
                if (idx >= 0) contraintes.pauses_obligatoires[idx] = obj;
                else contraintes.pauses_obligatoires.push(obj);
            });
        });
    }

    function initZonesInterdites() {
        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        const pts = (data.points || []).filter((p) => !p.isDepot);
        const container = document.getElementById("contraintes-interdites-container");
        if (!container) return;

        let html = '<p class="contraintes-info">Zones résidentielles interdites la nuit (22h-6h) :</p>';
        pts.forEach((p) => {
            const checked = contraintes.zones_interdites_nuit.includes(p.id);
            html += `
        <label class="checkbox-row">
          <input type="checkbox" class="zone-interdite-nuit" data-zone="${p.id}" ${checked ? "checked" : ""}>
          Zone ${p.id} - ${p.nom || "Sans nom"}
        </label>`;
        });
        container.innerHTML = html;

        container.querySelectorAll(".zone-interdite-nuit").forEach((cb) => {
            cb.addEventListener("change", () => {
                const zoneId = parseInt(cb.dataset.zone, 10);
                if (cb.checked) {
                    if (!contraintes.zones_interdites_nuit.includes(zoneId)) {
                        contraintes.zones_interdites_nuit.push(zoneId);
                    }
                } else {
                    contraintes.zones_interdites_nuit = contraintes.zones_interdites_nuit.filter(
                        (z) => z !== zoneId
                    );
                }
            });
        });
    }

    async function genererPlanning() {
        if (creneaux.length === 0) {
            alert("Veuillez d'abord configurer les créneaux horaires.\nUtilisez un template ou ajoutez des créneaux manuellement.");
            document.getElementById("niveau3-config-accordion")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        const data = window.getVillePropreData ? window.getVillePropreData() : {};
        if (!data.niveau2Result || !data.niveau2Result.affectation) {
            alert("Exécutez d'abord le Niveau 2 : Affecter Zones");
            return;
        }

        if (!data.points || data.points.length === 0) {
            alert("Aucun point de collecte. Exécutez le Niveau 1 et 2.");
            return;
        }

        if (!data.depotPoint) {
            alert("Veuillez sélectionner un dépôt.");
            return;
        }

        const loader = document.getElementById("niveau3-loader");
        if (loader) loader.style.display = "flex";

        const creneauxAPI = creneaux.map((c) => ({
            id: c.id,
            jour: c.jour,
            debut: c.debut,
            fin: c.fin,
            congestion: c.congestion,
            niveau_congestion: c.congestion,
        }));

        const pts = data.points.filter((p) => !p.isDepot);
        const depot = data.depotPoint;
        const allPoints = [
            {
                id: 0,
                x: parseFloat(depot.x),
                y: parseFloat(depot.y),
                nom: depot.nom,
                volume: 0,
            },
            ...pts.map((p) => ({
                id: p.id,
                x: parseFloat(p.x),
                y: parseFloat(p.y),
                nom: p.nom,
                volume: p.volume,
            })),
        ];

        const zonesData = pts.map((p) => ({
            id: p.id,
            points: [p.id],
            volume_moyen: p.volume,
            centre: { x: parseFloat(p.x), y: parseFloat(p.y) },
            priorite: p.priorite || "normale",
        }));

        const connexions = window.buildConnexionsForNiveau3 ? window.buildConnexionsForNiveau3() : [];
        const dechetteries = (data.dechetteries || []).map((d) => ({
            id: d.id,
            x: parseFloat(d.x),
            y: parseFloat(d.y),
            nom: d.nom,
            capacite_max: d.capacite_max || 0,
        }));

        const camionsData = (data.camions || []).map((c) => ({
            id: c.id,
            capacite: c.capacite,
            cout_fixe: c.cout_fixe,
            zones_accessibles: c.zones_accessibles || [],
        }));

        const body = {
            creneaux: creneauxAPI,
            contraintes: {
                fenetres_zone: contraintes.fenetres_zone,
                pauses_obligatoires: contraintes.pauses_obligatoires,
                zones_interdites_nuit: contraintes.zones_interdites_nuit,
            },
            camions: camionsData,
            zones: zonesData,
            points: allPoints,
            connexions,
            dechetteries,
            horizon_jours: parseInt(document.getElementById("niveau3-horizon")?.value || "7", 10),
            use_osrm: document.getElementById("use-osrm-routes")?.checked ?? false,
        };

        try {
            const res = await fetch("/api/niveau3/generer_planning", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (loader) loader.style.display = "none";

            if (!res.ok) {
                alert(data.error || "Erreur lors de la génération du planning");
                return;
            }

            planningResult = data;
            window.planningResult = data;
            ouvrirModalPlanning();
        } catch (err) {
            if (loader) loader.style.display = "none";
            alert("Erreur réseau : " + err.message);
        }
    }

    function ouvrirModalPlanning() {
        const modal = document.getElementById("planning-modal");
        if (!modal) return;

        modal.classList.add("active");

        if (typeof window.renderTimelineView === "function") {
            window.renderTimelineView(planningResult);
        }
        if (typeof window.renderStatsDashboard === "function") {
            window.renderStatsDashboard(planningResult);
        }

        const tab1 = document.getElementById("planning-tab-timeline");
        const tab2 = document.getElementById("planning-tab-carte");
        const tab3 = document.getElementById("planning-tab-stats");
        const panel1 = document.getElementById("planning-panel-timeline");
        const panel2 = document.getElementById("planning-panel-carte");
        const panel3 = document.getElementById("planning-panel-stats");

        function showPanel(idx) {
            [panel1, panel2, panel3].forEach((p, i) => {
                p.classList.toggle("active", i === idx);
            });
            [tab1, tab2, tab3].forEach((t, i) => {
                if (t) t.classList.toggle("active", i === idx);
            });
        }

        if (tab1) tab1.onclick = () => showPanel(0);
        if (tab2) tab2.onclick = () => showPanel(1);
        if (tab3) tab3.onclick = () => showPanel(2);
    }

    function init() {
        const section = document.getElementById("niveau3-section");
        if (!section) return;

        renderCreneauxGrid();

        document.getElementById("btn-add-creneau")?.addEventListener("click", () => ouvrirFormulaireCreneau(null));
        document.getElementById("btn-dupliquer-semaine")?.addEventListener("click", dupliquerSemaine);
        document.getElementById("creneau-form")?.addEventListener("submit", sauvegarderCreneau);

        document.getElementById("template-classique")?.addEventListener("click", () => chargerTemplate("semaine_classique"));
        document.getElementById("template-mediterranee")?.addEventListener("click", () => chargerTemplate("mediterranee"));
        document.getElementById("template-ramadan")?.addEventListener("click", () => chargerTemplate("ramadan"));

        document.getElementById("niveau3-tab-creneaux")?.addEventListener("click", () => {
            document.querySelectorAll(".niveau3-tab").forEach((t) => t.classList.remove("active"));
            document.getElementById("niveau3-tab-creneaux")?.classList.add("active");
            document.getElementById("niveau3-panel-creneaux")?.classList.add("active");
            document.getElementById("niveau3-panel-contraintes")?.classList.remove("active");
        });
        document.getElementById("niveau3-tab-contraintes")?.addEventListener("click", () => {
            document.querySelectorAll(".niveau3-tab").forEach((t) => t.classList.remove("active"));
            document.getElementById("niveau3-tab-contraintes")?.classList.add("active");
            document.getElementById("niveau3-panel-contraintes")?.classList.add("active");
            document.getElementById("niveau3-panel-creneaux")?.classList.remove("active");
            initContraintes();
            initPausesCamions();
            initZonesInterdites();
        });

        document.getElementById("btn-niveau3")?.addEventListener("click", genererPlanning);
        document.getElementById("planning-modal-close")?.addEventListener("click", () => {
            document.getElementById("planning-modal")?.classList.remove("active");
        });

        document.querySelectorAll(".contraintes-sub-tab")?.forEach((t) => {
            t.addEventListener("click", () => {
                document.querySelectorAll(".contraintes-sub-tab").forEach((x) => x.classList.remove("active"));
                t.classList.add("active");
                document.querySelectorAll(".contraintes-sub-panel").forEach((p) => p.classList.remove("active"));
                const target = t.dataset.target;
                if (target) document.getElementById(target)?.classList.add("active");
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.niveau3Creneaux = () => creneaux;
    window.niveau3Contraintes = () => contraintes;
})();
