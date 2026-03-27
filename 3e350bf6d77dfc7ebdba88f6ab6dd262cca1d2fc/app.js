// ==========================================
// 1. GLOBALS
// ==========================================
let map;
let bounds;
window.geojsonData = null;

// Chart & Filter Globals
let landuseEChart = null;
window.activeLanduseFilter = null;

// Load saved Typology Splits from browser memory, or use defaults if none exist
const savedSplits = localStorage.getItem("adl_housingSplits");
if (savedSplits) {
  window.housingSplits = JSON.parse(savedSplits);
} else {
  window.housingSplits = {
    180: 100,
    150: 100,
    100: 80,
    70: 40,
    50: 20,
    30: 0,
    20: 0,
  };
}

const savedEfficiency = localStorage.getItem("adl_efficiency");
window.netToGrossEfficiency = savedEfficiency ? Number(savedEfficiency) : 60;

const savedPph = localStorage.getItem("adl_pph");
window.peoplePerHome = savedPph ? Number(savedPph) : 2.4;

const savedCap = localStorage.getItem("adl_masterplanCap");
window.masterplanCap = savedCap ? Number(savedCap) : 70;

// Load saved Infra Assumptions from browser memory, or use defaults from spreadsheet
const defaultInfra = {
  edu: {
    eyYield: 0.1,
    eyPlaces: 30,
    eySqm: 2.3,
    priYield: 0.29,
    priFE: 210,
    priHa: 1.0,
    priSize: 3,
    secYield: 0.14,
    secFE: 150,
    secHa: 1.3,
    secSize: 10,
    sendYield: 0.01,
    sendHa: 1.5,
  },
  health: {
    gpPop: 1800,
    gpSqm: 165,
    denPop: 2000,
    denSqm: 100,
    acuteBedsK: 2.4,
    acuteSqm: 48,
    mentalBedsK: 0.000274,
    mentalSqm: 48.9,
  },
  comm: {
    space: 65,
    art: 45,
    museum: 28,
    library: 30,
  },
  leisure: {
    poolPop: 20211,
    poolSqm: 935,
    hallPop: 14561,
    hallSqm: 1100,
    bowlsPop: 88849,
  },
  space: {
    parks: 0.8,
    amenity: 0.6,
    natural: 1.8,
    pitches: 1.2,
    courts: 0.4,
    playEq: 0.25,
    playInf: 0.3,
  },
};
const savedInfra = localStorage.getItem("adl_infra");
window.infraAss = savedInfra ? JSON.parse(savedInfra) : defaultInfra;

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  const savedGeojson = localStorage.getItem("adl_geojsonDataScenario1");

  if (savedGeojson) {
    window.geojsonData = JSON.parse(savedGeojson);
    startupApp(window.geojsonData);
  } else {
    try {
      const response = await fetch("data/addlington_plots_scenario1.geojson");
      window.geojsonData = await response.json();
      currentScenario = "scenario1";
      setActiveButton("scenario1Btn");
      startupApp(window.geojsonData);
    } catch (err) {
      console.warn("Could not load geojson.", err);
      initMap();
    }
  }
});

function startupApp(geojson) {
  calculateBounds(geojson);
  updateDensityLegend(geojson);
  updateDashboardKPIs(geojson);
  initLanduseChart(geojson);
  initMap();

  map.on("load", () => {
    addHtmlLabels(geojson);
    setupClickInteractions();
  });
}

// ==========================================
// 3. DASHBOARD & LEGEND MATH
// ==========================================
function updateDensityLegend(geojson) {
  let min = Infinity;
  let max = -Infinity;
  let foundValidParcel = false;

  const filteredLandUses = ["residential", "town centre", "local centre"];

  geojson.features.forEach((feature) => {
    const props = feature.properties;
    if (
      props &&
      props.landuse &&
      filteredLandUses.includes(props.landuse.toLowerCase()) &&
      props.avg_density !== undefined
    ) {
      const density = Number(props.avg_density);
      if (!isNaN(density)) {
        if (density < min) min = density;
        if (density > max) max = density;
        foundValidParcel = true;
      }
    }
  });

  if (foundValidParcel) {
    document.getElementById("density-min").innerText = Math.floor(min);
    document.getElementById("density-max").innerText = Math.ceil(max);
  } else {
    document.getElementById("density-min").innerText = "0";
    document.getElementById("density-max").innerText = "100+";
  }
}

function updateMethodologyLabels() {
  const infra = window.infraAss;
  const setM = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  // Site & Pop
  setM("m-eff", window.netToGrossEfficiency);
  setM("m-pph", window.peoplePerHome);

  // Education
  setM("m-ey-yield", infra.edu.eyYield);
  setM("m-ey-sqm", infra.edu.eySqm);
  setM("m-pri-yield", infra.edu.priYield);
  setM("m-pri-fe", infra.edu.priFE);
  setM("m-pri-ha", infra.edu.priHa);
  setM("m-sec-yield", infra.edu.secYield);
  setM("m-sec-fe", infra.edu.secFE);
  setM("m-sec-ha", infra.edu.secHa);
  setM("m-send-ha", infra.edu.sendHa);

  // Health
  setM("m-gp-pop", infra.health.gpPop);
  setM("m-gp-sqm", infra.health.gpSqm);
  setM("m-den-pop", infra.health.denPop);
  setM("m-den-sqm", infra.health.denSqm);
  setM("m-acute-beds", infra.health.acuteBedsK);
  setM("m-acute-sqm", infra.health.acuteSqm);
  setM("m-mental-beds", infra.health.mentalBedsK);
  setM("m-mental-sqm", infra.health.mentalSqm);

  // Community & Leisure
  setM("m-comm-space", infra.comm.space);
  setM("m-comm-art", infra.comm.art);
  setM("m-comm-museum", infra.comm.museum);
  setM("m-comm-lib", infra.comm.library);
  setM("m-pool-pop", infra.leisure.poolPop);
  setM("m-pool-sqm", infra.leisure.poolSqm);
  setM("m-hall-pop", infra.leisure.hallPop);
  setM("m-hall-sqm", infra.leisure.hallSqm);
  setM("m-bowls-pop", infra.leisure.bowlsPop);

  // Open Space
  setM("m-space-parks", infra.space.parks);
  setM("m-space-amenity", infra.space.amenity);
  setM("m-space-natural", infra.space.natural);
  setM("m-space-pitches", infra.space.pitches);
  setM("m-space-courts", infra.space.courts);
  setM("m-space-play-eq", infra.space.playEq);
  setM("m-space-play-inf", infra.space.playInf);
}

function updateDashboardKPIs(geojson) {
  let totalHomes = 0;
  let totalHouses = 0;
  let totalFlats = 0;

  const splits = window.housingSplits;

  // --- 1. HOUSING CAPACITY MATH ---
  geojson.features.forEach((feature) => {
    const props = feature.properties;

    // Corrected to include all center types as requested
    const validHousingUses = [
      "residential",
      "town centre",
      "district centre",
      "local centre",
    ];
    const currentUse = props.landuse ? props.landuse.toLowerCase() : "";

    if (props && props.landuse && validHousingUses.includes(currentUse)) {
      const area = Number(props.plot_area_ha) || 0;

      const v180 = Number(props.density_mix_180dph) || 0;
      const v150 = Number(props.density_mix_150dph) || 0;
      const v100 = Number(props.density_mix_100dph) || 0;
      const v70 = Number(props.density_mix_70dph) || 0;
      const v50 = Number(props.density_mix_50dph) || 0;
      const v30 = Number(props.density_mix_30dph) || 0;
      const v20 = Number(props.density_mix_20dph) || 0;

      const n2g = window.netToGrossEfficiency / 100;

      const homes180 = area * (v180 / 100) * n2g * 180;
      const homes150 = area * (v150 / 100) * n2g * 150;
      const homes100 = area * (v100 / 100) * n2g * 100;
      const homes70 = area * (v70 / 100) * n2g * 70;
      const homes50 = area * (v50 / 100) * n2g * 50;
      const homes30 = area * (v30 / 100) * n2g * 30;
      const homes20 = area * (v20 / 100) * n2g * 20;

      totalHomes +=
        homes180 + homes150 + homes100 + homes70 + homes50 + homes30 + homes20;

      totalFlats +=
        homes180 * (splits[180] / 100) +
        homes150 * (splits[150] / 100) +
        homes100 * (splits[100] / 100) +
        homes70 * (splits[70] / 100) +
        homes50 * (splits[50] / 100) +
        homes30 * (splits[30] / 100) +
        homes20 * (splits[20] / 100);

      totalHouses +=
        homes180 * (1 - splits[180] / 100) +
        homes150 * (1 - splits[150] / 100) +
        homes100 * (1 - splits[100] / 100) +
        homes70 * (1 - splits[70] / 100) +
        homes50 * (1 - splits[50] / 100) +
        homes30 * (1 - splits[30] / 100) +
        homes20 * (1 - splits[20] / 100);
    }
  });

  const totalPopulation = totalHomes * window.peoplePerHome;

  // --- 2. UPDATE HOUSING HTML ---
  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTxt("kpi-total-homes", Math.round(totalHomes).toLocaleString());
  setTxt("kpi-population", Math.round(totalPopulation).toLocaleString());
  setTxt("kpi-pph-label", `@ ${window.peoplePerHome} per home`);
  setTxt(
    "kpi-houses",
    Math.round(totalHouses).toLocaleString() +
      "  (" +
      ((Math.round(totalHouses) / Math.round(totalHomes)) * 100)
        .toFixed(0)
        .toLocaleString() +
      "%)",
  );
  setTxt(
    "kpi-flats",
    Math.round(totalFlats).toLocaleString() +
      " (" +
      ((Math.round(totalFlats) / Math.round(totalHomes)) * 100)
        .toFixed(0)
        .toLocaleString() +
      "%)",
  );

  setTxt(
    "kpi-efficiency-label",
    `${window.netToGrossEfficiency}% Net-to-Gross`,
  );

  // Overall Average Density Calculation
  let overall_density_sum = 0;
  let tmp_count = 0;
  geojson.features.forEach((feature) => {
    const density = Number(feature.properties.avg_density);
    if (density) {
      overall_density_sum += density;
      tmp_count++;
    }
  });

  const overallAvgDensity = tmp_count ? overall_density_sum / tmp_count : "N/A";
  setTxt(
    "kpi-overall-avg-density",
    overallAvgDensity.toFixed(2).toLocaleString(),
  );

  // --- 3. CALCULATE INFRASTRUCTURE REQUIREMENTS ---
  const infra = window.infraAss;

  // Education
  const eyPupils = totalHomes * infra.edu.eyYield;
  const eySqm = eyPupils * infra.edu.eySqm;
  const eyNurseries = eyPupils / infra.edu.eyPlaces;

  const priFE = (totalHomes * infra.edu.priYield) / infra.edu.priFE;
  const primaryHa = priFE * infra.edu.priHa;
  const priSchools = priFE / (infra.edu.priSize || 3);

  const secFE = (totalHomes * infra.edu.secYield) / infra.edu.secFE;
  const secondaryHa = secFE * infra.edu.secHa;
  const secSchools = secFE / (infra.edu.secSize || 10);

  const sendYield = totalHomes * infra.edu.sendYield;
  const sendSchools = sendYield > 0 ? 1 : 0;
  const sendHa = sendSchools * infra.edu.sendHa;

  const totalEduHa = primaryHa + secondaryHa + sendHa;

  // Health
  const gpSqm = (totalPopulation / infra.health.gpPop) * infra.health.gpSqm;
  const dentistSqm =
    (totalPopulation / infra.health.denPop) * infra.health.denSqm;
  const acuteSqm =
    (totalPopulation / 1000) * infra.health.acuteBedsK * infra.health.acuteSqm;
  const mentalSqm =
    (totalPopulation / 1000) *
    infra.health.mentalBedsK *
    infra.health.mentalSqm;
  const totalHealthSqm = gpSqm + dentistSqm + acuteSqm + mentalSqm;

  // Community
  const popK = totalPopulation / 1000;
  const commSqm = popK * infra.comm.space;
  const artSqm = popK * infra.comm.art;
  const museumSqm = popK * infra.comm.museum;
  const libSqm = popK * infra.comm.library;
  const totalCommSqm = commSqm + artSqm + museumSqm + libSqm;

  // Leisure
  const poolSqm =
    (totalPopulation / infra.leisure.poolPop) * infra.leisure.poolSqm;
  const hallSqm =
    (totalPopulation / infra.leisure.hallPop) * infra.leisure.hallSqm;
  const bowlsCount = totalPopulation / infra.leisure.bowlsPop;
  const totalLeisureSqm = poolSqm + hallSqm;

  // Open Space
  const parksHa = popK * infra.space.parks;
  const amenityHa = popK * infra.space.amenity;
  const naturalHa = popK * infra.space.natural;
  const pitchesHa = popK * infra.space.pitches;
  const courtsHa = popK * infra.space.courts;
  const playEqHa = popK * infra.space.playEq;
  const playInfHa = popK * infra.space.playInf;
  const totalOpenHa =
    parksHa +
    amenityHa +
    naturalHa +
    pitchesHa +
    courtsHa +
    playEqHa +
    playInfHa;

  // --- 4. UPDATE INFRASTRUCTURE HTML ---

  const safelyUpdate = (id, val, isSqm = false) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = isSqm
        ? `${Math.round(val).toLocaleString()} sqm`
        : `${val.toFixed(2)} ha`;
    }
  };

  // Push Education
  setTxt(
    "req-ey-sqm",
    `${Math.round(eySqm).toLocaleString()} sqm (~${eyNurseries.toFixed(1)}x ${infra.edu.eyPlaces} place)`,
  );
  setTxt(
    "req-primary-ha",
    `${primaryHa.toFixed(2)} ha (${priFE.toFixed(1)} FE)`,
  );
  setTxt(
    "req-secondary-ha",
    `${secondaryHa.toFixed(2)} ha (${secFE.toFixed(1)} FE)`,
  );
  safelyUpdate("req-send-ha", sendHa);
  safelyUpdate("req-total-edu", totalEduHa);

  // Push Health
  safelyUpdate("req-gp-sqm", gpSqm, true);
  safelyUpdate("req-dentist-sqm", dentistSqm, true);
  safelyUpdate("req-acute-sqm", acuteSqm, true);
  safelyUpdate("req-mental-sqm", mentalSqm, true);
  safelyUpdate("req-total-health", totalHealthSqm, true);

  // Community
  safelyUpdate("req-comm-sqm", commSqm, true);
  safelyUpdate("req-art-sqm", artSqm, true);
  safelyUpdate("req-museum-sqm", museumSqm, true);
  safelyUpdate("req-lib-sqm", libSqm, true);
  safelyUpdate("req-total-comm", totalCommSqm, true);

  // Leisure
  safelyUpdate("req-pool-sqm", poolSqm, true);
  safelyUpdate("req-hall-sqm", hallSqm, true);
  setTxt("req-bowls-count", `${bowlsCount.toFixed(2)} facilities`);
  safelyUpdate("req-total-leisure", totalLeisureSqm, true);

  // Open Space
  safelyUpdate("req-parks-ha", parksHa);
  safelyUpdate("req-amenity-ha", amenityHa);
  safelyUpdate("req-natural-ha", naturalHa);
  safelyUpdate("req-pitches-ha", pitchesHa);
  safelyUpdate("req-courts-ha", courtsHa);
  safelyUpdate("req-play-eq-ha", playEqHa);
  safelyUpdate("req-play-inf-ha", playInfHa);
  safelyUpdate("req-total-open", totalOpenHa);

  // =========================================================
  // --- 5. CAPACITY CHECK FORMULA ---
  // =========================================================

  let grossArea = 0;
  const validCapUses = [
    "residential",
    "town centre",
    "district centre",
    "local centre",
  ];

  // 1. Get the Gross Area for the specific land uses
  geojson.features.forEach((feature) => {
    const props = feature.properties;
    const currentUse = props.landuse ? props.landuse.toLowerCase() : "";
    if (props && validCapUses.includes(currentUse)) {
      grossArea +=
        Number(props.shape_area_ha) || Number(props.plot_area_ha) || 0;
    }
  });

  // 2. Calculate Net Area using the user-defined Net-to-Gross efficiency
  const n2g = window.netToGrossEfficiency / 100;
  const netArea = grossArea * n2g;

  // 3. Convert sqm infra to ha (1 ha = 10,000 sqm)
  const healthHa = totalHealthSqm / 10000;
  const commHa = totalCommSqm / 10000;
  const leisureHa = totalLeisureSqm / 10000;

  // Total infrastructure land take
  const infraLandTake = totalEduHa + healthHa + commHa + leisureHa;

  // 4. Left Side: Demand (Net Area + Infra Land Take)
  const requiredLandTake = netArea + infraLandTake;

  // 5. Right Side: Supply / Maximum Allowance (Dynamic User Cap % of Gross Area)
  const capPercentage = (window.masterplanCap || 50) / 100;
  const maxAllowance = grossArea * capPercentage;

  // 6. Update the UI
  const capReqEl = document.getElementById("cap-required");
  const capAllEl = document.getElementById("cap-allowed");
  const trackEl = document.getElementById("capacity-track");
  const capStatusEl = document.getElementById("cap-status");

  // Stacked Bar Elements
  const fillRes = document.getElementById("cap-fill-res");
  const fillEdu = document.getElementById("cap-fill-edu");
  const fillHealth = document.getElementById("cap-fill-health");
  const fillComm = document.getElementById("cap-fill-comm");
  const fillLeisure = document.getElementById("cap-fill-leisure");

  if (capReqEl && capAllEl && trackEl && capStatusEl) {
    capReqEl.innerText = `${requiredLandTake.toFixed(2)} ha`;
    capAllEl.innerText = `${maxAllowance.toFixed(2)} ha`;

    // Helper function to safely calculate percentage
    const getPct = (val) => (maxAllowance > 0 ? (val / maxAllowance) * 100 : 0);

    // Apply widths to each block
    fillRes.style.width = `${getPct(netArea)}%`;
    fillEdu.style.width = `${getPct(totalEduHa)}%`;
    fillHealth.style.width = `${getPct(healthHa)}%`;
    fillComm.style.width = `${getPct(commHa)}%`;
    fillLeisure.style.width = `${getPct(leisureHa)}%`;

    // Warning state if over capacity
    if (requiredLandTake > maxAllowance) {
      // Add a red border to the track to show it's "spilling over"
      trackEl.style.borderColor = "var(--adl-rust)";
      trackEl.style.boxShadow = "0 0 0 1px var(--adl-rust)";
      capStatusEl.innerText = `OVER CAPACITY BY ${(requiredLandTake - maxAllowance).toFixed(2)} ha`;
      capStatusEl.style.color = "var(--adl-rust)";
    } else {
      trackEl.style.borderColor = "transparent";
      trackEl.style.boxShadow = "none";
      capStatusEl.innerText = `${(maxAllowance - requiredLandTake).toFixed(2)} ha remaining allowance`;
      capStatusEl.style.color = "var(--adl-slate)";
    }
  }

  // Update Methodology Text
  if (typeof updateMethodologyLabels === "function") {
    updateMethodologyLabels();
  }
  initDensityCompositionChart(geojson);
}

// ==========================================
// 4. MAP SETUP & LAYERS
// ==========================================
function calculateBounds(geojson) {
  let firstValidCoord = null;
  bounds = null;

  geojson.features.forEach((feature) => {
    if (feature.geometry && feature.geometry.type === "Polygon") {
      feature.geometry.coordinates[0].forEach((coord) => {
        const [lng, lat] = coord;
        if (!isNaN(lng) && !isNaN(lat)) {
          if (!bounds && !firstValidCoord) {
            firstValidCoord = [lng, lat];
            bounds = new maplibregl.LngLatBounds(
              firstValidCoord,
              firstValidCoord,
            );
          } else {
            bounds.extend([lng, lat]);
          }
        }
      });
    } else if (feature.geometry && feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((polygon) => {
        polygon[0].forEach((coord) => {
          const [lng, lat] = coord;
          if (!isNaN(lng) && !isNaN(lat)) {
            if (!bounds && !firstValidCoord) {
              firstValidCoord = [lng, lat];
              bounds = new maplibregl.LngLatBounds(
                firstValidCoord,
                firstValidCoord,
              );
            } else {
              bounds.extend([lng, lat]);
            }
          }
        });
      });
    }
  });
}

function initMap() {
  const mapOptions = {
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    pitchWithRotate: true,
    dragRotate: true,
  };

  if (bounds && !bounds.isEmpty()) {
    mapOptions.bounds = bounds;
    mapOptions.fitBoundsOptions = {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
    };
  } else {
    mapOptions.center = [-0.1, 51.5];
    mapOptions.zoom = 10;
  }

  map = new maplibregl.Map(mapOptions);
  map.on("load", () => {
    loadGeoJSONLayers();
  });
}

function loadGeoJSONLayers() {
  const brandMidnight = "#02243C";

  map.addSource("addlington-plots", {
    type: "geojson",
    data: window.geojsonData,
  });
  map.addLayer({
    id: "plots-fill",
    type: "fill",
    source: "addlington-plots",
    paint: {
      "fill-color": [
        "case",
        ["==", ["downcase", ["get", "landuse"]], "residential"],
        [
          "interpolate",
          ["linear"],
          ["to-number", ["get", "avg_density"]],
          0,
          "#ffeca9",
          30,
          "#ffe74c",
          60,
          "#ecb419",
          100,
          "#fa7900",
        ],
        ["==", ["downcase", ["get", "landuse"]], "employment"],
        "#9e9dbd",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "town centre"],
          ["==", ["downcase", ["get", "landuse"]], "town_centre"],
        ],
        "#d87beb",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "district centre"],
          ["==", ["downcase", ["get", "landuse"]], "district_centre"],
        ],
        "#ffad94",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "local centre"],
          ["==", ["downcase", ["get", "landuse"]], "local_centre"],
        ],
        "#ffc8b8",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "secondary school"],
          ["==", ["downcase", ["get", "landuse"]], "secondary_school"],
          ["==", ["downcase", ["get", "landuse"]], "school"],
        ],
        "#eb68b6",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "primary school"],
          ["==", ["downcase", ["get", "landuse"]], "primary_school"],
        ],
        "#f5a3d4",
        [
          "any",
          ["==", ["downcase", ["get", "landuse"]], "open space"],
          ["==", ["downcase", ["get", "landuse"]], "open_space"],
        ],
        "#c3c83f",
        "#e0e0e0",
      ],
      "fill-opacity": 0.65,
      "fill-outline-color": "rgba(255, 255, 255, 0.6)",
    },
  });

  map.addLayer({
    id: "plots-line",
    type: "line",
    source: "addlington-plots",
    paint: {
      "line-color": brandMidnight,
      "line-width": 0.5,
      "line-opacity": 0.3,
    },
  });

  map.addSource("addlington-boundary", {
    type: "geojson",
    data: "data/addlington_boundary.geojson",
  });
  map.addLayer({
    id: "boundary-line",
    type: "line",
    source: "addlington-boundary",
    paint: {
      "line-color": brandMidnight,
      "line-width": 2.5,
      "line-opacity": 0.8,
      "line-dasharray": [1, 1],
    },
  });
}

function addHtmlLabels(geojson) {
  document.querySelectorAll(".plot-label").forEach((el) => el.remove());
  geojson.features.forEach((feature) => {
    if (feature.properties && feature.properties.parcel_id) {
      let sumLng = 0,
        sumLat = 0,
        count = 0;
      let coords =
        feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates[0][0];
      coords.forEach((c) => {
        sumLng += c[0];
        sumLat += c[1];
        count++;
      });

      const el = document.createElement("div");
      el.className = "plot-label";
      el.innerText = feature.properties.parcel_id;

      new maplibregl.Marker({ element: el })
        .setLngLat([sumLng / count, sumLat / count])
        .addTo(map);

      // Hover feature
      const tooltip = document.getElementById("label-tooltip");

      el.addEventListener("mouseenter", (e) => {
        tooltip.style.display = "block";
        tooltip.innerHTML = `Avg. Density: ${Number(feature.properties.avg_density).toFixed(2)}`;
      });

      el.addEventListener("mousemove", (e) => {
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
      });

      el.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    }
  });
}

// ==========================================
// 5. MAP PARCEL POPUP EDITOR
// ==========================================
function setupClickInteractions() {
  map.on("mouseenter", "plots-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "plots-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("click", "plots-fill", (e) => {
    const feature = e.features[0];
    const props = feature.properties;
    const parcelId = props.parcel_id;

    const landUses = [
      "Residential",
      "Town Centre",
      "District Centre",
      "Local Centre",
      "Employment",
      "Secondary School",
      "Primary School",
      "Sports",
      "No Development",
    ];
    let optionsHtml = landUses
      .map(
        (lu) =>
          `<option value="${lu}" ${props.landuse === lu ? "selected" : ""}>${lu}</option>`,
      )
      .join("");

    const bands = [180, 150, 100, 70, 50, 30, 20];
    const densityHtml = bands
      .map((band) => {
        const val = props[`density_mix_${band}dph`] || 0;
        return `
        <div class="density-row">
          <span>${band} dph</span> 
          <div class="input-wrapper">
            <input type="number" id="edit-${band}" value="${val}" min="0" max="100" oninput="validateDensitySum()">
            <span class="pct-sign">%</span>
          </div>
        </div>
      `;
      })
      .join("");

    const filteredLandUses = ["Residential", "Town Centre", "Local Centre"];

    const html = `
      <div class="parcel-editor">
        <h4>${parcelId}</h4>
        <div class="editor-group">
          <label>Land Use</label>
          <select id="edit-landuse" onchange="toggleDensityInputs(this.value)">${optionsHtml}</select>
        </div>
        <div id="density-inputs" class="density-inputs-container" style="display: ${filteredLandUses.includes(props.landuse) ? "block" : "none"};">
          <label style="font-size:0.8rem; font-weight:600; margin-bottom:10px; display:block; color: var(--adl-slate);">Density Mix Allocation</label>
          ${densityHtml}
        </div>
        <button id="btn-save-parcel" class="btn-save" onclick="saveParcelData('${parcelId}')" disabled>Reviewing Allocation...</button>
      </div>
    `;

    new maplibregl.Popup({ closeButton: true, className: "glass-popup" })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);

    validateDensitySum();
  });
}

window.toggleDensityInputs = function (value) {
  const filteredLandUses = ["Residential", "Town Centre", "Local Centre"];

  document.getElementById("density-inputs").style.display =
    filteredLandUses.includes(value) ? "block" : "none";
  validateDensitySum();
};

window.validateDensitySum = function () {
  const landuse = document.getElementById("edit-landuse").value;
  const btn = document.getElementById("btn-save-parcel");

  const filteredLandUses = ["Residential", "Town Centre", "Local Centre"];

  if (!filteredLandUses.includes(landuse)) {
    btn.disabled = false;
    btn.style.background = "var(--adl-midnight)";
    btn.innerHTML = "Save Changes";
    return;
  }

  const bands = [
    "edit-180",
    "edit-150",
    "edit-100",
    "edit-70",
    "edit-50",
    "edit-30",
    "edit-20",
  ];
  let sum = 0;
  bands.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value !== "") sum += Number(el.value);
  });

  if (sum === 100) {
    btn.disabled = false;
    btn.style.background = "var(--adl-midnight)";
    btn.innerHTML = "Save Changes";
  } else if (sum < 100) {
    btn.disabled = true;
    btn.style.background = `linear-gradient(to right, var(--adl-midnight) ${sum}%, var(--adl-slate) ${sum}%)`;
    btn.innerHTML = `${100 - sum}% still to allocate`;
  } else {
    btn.disabled = true;
    btn.style.background = "var(--adl-rust)";
    btn.innerHTML = `Over allocated by ${sum - 100}%`;
  }
};

window.saveParcelData = function (parcelId) {
  const filteredLandUses = ["Residential", "Town Centre", "Local Centre"];

  const feature = window.geojsonData.features.find(
    (f) => f.properties.parcel_id === parcelId,
  );
  if (!feature) return;

  const newLanduse = document.getElementById("edit-landuse").value;
  feature.properties.landuse = newLanduse;

  if (filteredLandUses.includes(newLanduse)) {
    const v180 = Number(document.getElementById("edit-180").value) || 0;
    const v150 = Number(document.getElementById("edit-150").value) || 0;
    const v100 = Number(document.getElementById("edit-100").value) || 0;
    const v70 = Number(document.getElementById("edit-70").value) || 0;
    const v50 = Number(document.getElementById("edit-50").value) || 0;
    const v30 = Number(document.getElementById("edit-30").value) || 0;
    const v20 = Number(document.getElementById("edit-20").value) || 0;

    feature.properties.density_mix_180dph = v180;
    feature.properties.density_mix_150dph = v150;
    feature.properties.density_mix_100dph = v100;
    feature.properties.density_mix_70dph = v70;
    feature.properties.density_mix_50dph = v50;
    feature.properties.density_mix_30dph = v30;
    feature.properties.density_mix_20dph = v20;

    const area = Number(feature.properties.plot_area_ha) || 1;
    feature.properties.avg_density =
      (area * 180 * (v180 / 100) +
        area * 150 * (v150 / 100) +
        area * 100 * (v100 / 100) +
        area * 70 * (v70 / 100) +
        area * 50 * (v50 / 100) +
        area * 30 * (v30 / 100) +
        area * 20 * (v20 / 100)) /
      area;
  }

  map.getSource("addlington-plots").setData(window.geojsonData);
  updateDensityLegend(window.geojsonData);
  updateDashboardKPIs(window.geojsonData);
  initLanduseChart(window.geojsonData);

  // Save item depending on current scenario
  if (currentScenario === "scenario1") {
    localStorage.setItem(
      "adl_geojsonDataScenario1",
      JSON.stringify(window.geojsonData),
    );
  } else if (currentScenario === "scenario2") {
    localStorage.setItem(
      "adl_geojsonDataScenario2",
      JSON.stringify(window.geojsonData),
    );
  }

  const popups = document.getElementsByClassName("maplibregl-popup");
  if (popups.length) popups[0].remove();
};

// ==========================================
// 6. TYPOLOGY SPLIT MODAL LOGIC
// ==========================================
window.openSplitSettings = function () {
  const container = document.getElementById("split-inputs-container");
  const bands = [180, 150, 100, 70, 50, 30, 20];

  let html = `
    <div style="display: flex; font-weight: 600; font-size: 0.8rem; color: var(--adl-slate); margin-bottom: 10px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; text-transform: uppercase;">
      <div style="flex: 1;">Density</div>
      <div style="width: 85px; text-align: center; white-space: nowrap;">Flats %</div>
      <div style="width: 85px; text-align: right; white-space: nowrap;">Houses %</div>
    </div>
  `;

  html += bands
    .map((band) => {
      const flatPct = window.housingSplits[band];
      const housePct = 100 - flatPct;
      return `
      <div class="split-row-item">
        <span style="flex: 1; font-weight: 600;">${band} dph</span>
        <div style="width: 85px; display: flex; justify-content: center;">
          <input type="number" id="split-flat-${band}" value="${flatPct}" min="0" max="100" 
                 class="clean-number-input" oninput="updateHousePreview(${band}, this.value)">
        </div>
        <span id="preview-house-${band}" style="width: 85px; text-align: right; color: var(--adl-slate); font-weight: 500;">
          ${housePct}
        </span>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
  document.getElementById("split-modal").style.display = "flex";
};

window.updateHousePreview = function (band, flatValue) {
  let val = Number(flatValue) || 0;
  if (val > 100) val = 100;
  document.getElementById(`preview-house-${band}`).innerText = 100 - val;
};

window.closeSplitSettings = function () {
  document.getElementById("split-modal").style.display = "none";
};

window.saveSplitSettings = function () {
  const bands = [180, 150, 100, 70, 50, 30, 20];

  bands.forEach((band) => {
    let val = Number(document.getElementById(`split-flat-${band}`).value) || 0;
    if (val > 100) val = 100;
    window.housingSplits[band] = val;
  });

  localStorage.setItem(
    "adl_housingSplits",
    JSON.stringify(window.housingSplits),
  );
  closeSplitSettings();
  if (window.geojsonData) {
    updateDashboardKPIs(window.geojsonData);
  }
};

// ==========================================
// 7. GLOBAL ASSUMPTIONS MODAL LOGIC
// ==========================================
window.openEfficiencySettings = function () {
  document.getElementById("input-efficiency").value =
    window.netToGrossEfficiency;
  document.getElementById("input-pph").value = window.peoplePerHome;
  document.getElementById("input-masterplan-cap").value = window.masterplanCap;
  document.getElementById("efficiency-modal").style.display = "flex";
};

window.closeEfficiencySettings = function () {
  document.getElementById("efficiency-modal").style.display = "none";
};

window.saveEfficiencySettings = function () {
  let effVal = Number(document.getElementById("input-efficiency").value) || 0;
  if (effVal > 100) effVal = 100;
  if (effVal < 0) effVal = 0;

  let pphVal = Number(document.getElementById("input-pph").value) || 0;
  if (pphVal < 0) pphVal = 0;

  let capVal =
    Number(document.getElementById("input-masterplan-cap").value) || 0;
  if (capVal > 100) capVal = 100;
  if (capVal < 0) capVal = 0;

  // Set Globals
  window.netToGrossEfficiency = effVal;
  window.peoplePerHome = pphVal;
  window.masterplanCap = capVal;

  // Save to Memory
  localStorage.setItem("adl_efficiency", effVal);
  localStorage.setItem("adl_pph", pphVal);
  localStorage.setItem("adl_masterplanCap", capVal);

  closeEfficiencySettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// ==========================================
// 8. LAND USE CHART & MAP FILTERING
// ==========================================
function normalizeLanduse(lu) {
  if (!lu) return "Other";
  const l = lu.toLowerCase();
  if (l.includes("town")) return "Town Centre";
  if (l.includes("district")) return "District Centre";
  if (l.includes("local")) return "Local Centre";
  if (l.includes("employment")) return "Employment";
  if (l.includes("secondary")) return "Secondary School";
  if (l.includes("primary")) return "Primary School";
  if (l.includes("sports")) return "Sports";
  if (l.includes("residential")) return "Residential";
  if (l.includes("no development")) return "No Development";
  return "Other";
}

function initLanduseChart(geojson) {
  const areaTotals = {};
  let totalArea = 0;

  geojson.features.forEach((feature) => {
    const props = feature.properties;
    if (props && props.landuse) {
      const category = normalizeLanduse(props.landuse);
      const area =
        Number(props.shape_area_ha) || Number(props.plot_area_ha) || 0;
      if (!areaTotals[category]) areaTotals[category] = 0;
      areaTotals[category] += area;
      totalArea += area;
    }
  });

  const colorMap = {
    Residential: "#fcb243",
    "Town Centre": "#d87beb",
    "District Centre": "#ffad94",
    "Local Centre": "#ffc8b8",
    Employment: "#9e9dbd",
    "Primary School": "#f5a3d4",
    "Secondary School": "#eb68b6",
    "Open Space": "#c3c83f",
    Other: "#e0e0e0",
    "No Development": "#e0e0e0",
  };

  // 1. Force the exact order of slices on the chart
  const orderedLabels = [
    "Residential",
    "Town Centre",
    "District Centre",
    "Local Centre",
    "Employment",
    "Primary School",
    "Secondary School",
    "Open Space",
    "Other",
    "No Development",
  ];

  // 2. Map through the hard-coded array rather than the randomized object keys
  const chartData = orderedLabels
    .map((key) => {
      const realArea = areaTotals[key] || 0;
      const pct = totalArea > 0 ? ((realArea / totalArea) * 100).toFixed(1) : 0;
      return {
        name: key,
        value: realArea > 0 ? Math.log10(realArea + 1) : 0, // log10 used for ECharts Rose Area scaling
        realValue: Number(realArea.toFixed(2)),
        truePct: pct,
        itemStyle: { color: colorMap[key] || colorMap["Other"] },
      };
    })
    .filter((item) => item.realValue > 0); // Keep only active categories, but strict order is preserved

  const chartDom = document.getElementById("landuseChart");
  if (!chartDom) return;

  if (window.landuseEChart) {
    window.landuseEChart.dispose();
  }

  window.landuseEChart = echarts.init(chartDom);

  const option = {
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: function (params) {
        return `${params.name}: ${params.data.realValue} ha (${params.data.truePct}%)`;
      },
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderColor: "#8db7c4",
      textStyle: { color: "#02243C", fontFamily: "General Sans" },
    },
    series: [
      {
        type: "pie",
        roseType: "area",
        startAngle: 90,
        radius: ["10%", "90%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        selectedMode: "single",
        selectedOffset: 10,
        itemStyle: { borderRadius: 4, borderColor: "#ffffff", borderWidth: 2 },
        label: {
          show: true,
          formatter: function (params) {
            return `${params.name}\n(${params.data.truePct}%)`;
          },
          color: "#02243c",
          fontWeight: 600,
          fontSize: 10,
          fontFamily: "General Sans",
          lineHeight: 14,
        },
        labelLine: {
          show: true,
          smooth: 0.3,
          length: 10,
          length2: 5,
          lineStyle: { color: "#485a6e", width: 1 },
        },
        data: chartData,
      },
    ],
  };

  window.landuseEChart.setOption(option);

  window.landuseEChart.on("click", function (params) {
    if (window.activeLanduseFilter === params.name) {
      window.activeLanduseFilter = null;
      window.landuseEChart.dispatchAction({
        type: "downplay",
        dataIndex: params.dataIndex,
      });
      resetMapFilter();
    } else {
      window.activeLanduseFilter = params.name;
      applyMapFilter(params.name);
    }
  });
}

// Initialisation of density composition chart
function initDensityCompositionChart(geojson) {
  const chartDom = document.getElementById("densityCompositionChart");
  if (!chartDom) return;

  // Dispose existing chart
  if (window.densityChart) {
    window.densityChart.dispose();
  }

  window.densityChart = echarts.init(chartDom);

  // ===============================
  // 1. SETUP
  // ===============================
  const bands = [180, 150, 100, 70, 50, 30, 20];

  const validUses = [
    "residential",
    "town centre",
    "district centre",
    "local centre",
  ];

  // Colour control (EDIT THESE)
  const densityColors = {
    180: "#ee7300",
    150: "#fa9600",
    100: "#ffbf35",
    70: "rgb(255, 215, 84)",
    50: "#ffe589",
    30: "#ffedaa",
    20: "#fff4cd",
  };

  // ===============================
  // 2. CALCULATE AREAS
  // ===============================
  const totals = {};
  bands.forEach((b) => (totals[b] = 0));

  let totalResidentialArea = 0;

  geojson.features.forEach((feature) => {
    const props = feature.properties;
    if (!props || !props.landuse) return;

    const use = props.landuse.toLowerCase();
    if (!validUses.includes(use)) return;

    const area = Number(props.shape_area_ha) || Number(props.plot_area_ha) || 0;

    totalResidentialArea += area;

    bands.forEach((band) => {
      const pct = Number(props[`density_mix_${band}dph`]) || 0;
      const areaAtDensity = area * (pct / 100);
      totals[band] += areaAtDensity;
    });
  });

  // ===============================
  // 3. CONVERT TO %
  // ===============================
  const data = bands
    .map((band) => {
      const area = totals[band];
      if (area <= 0) return null;

      const pct =
        totalResidentialArea > 0 ? (area / totalResidentialArea) * 100 : 0;

      return {
        name: `${band} dph`,
        value: pct,
        label: {
          formatter: `${band} dph\n(${pct.toFixed(1)}%)`,
        },
        itemStyle: {
          color: densityColors[band],
        },
      };
    })
    .filter(Boolean);

  const legendHTML = `
    <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      align-items: center;
    ">
      ${data
        .map((d) => {
          const density = d.name.split(" ")[0];
          const color = densityColors[density];

          return `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="
                width: 10px;
                height: 10px;
                background: ${color};
                display: inline-block;
              "></span>
              <span>${d.name}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  document.getElementById("densityLegend").innerHTML = legendHTML;

  // ===============================
  // 4. RENDER TREEMAP
  // ===============================
  const option = {
    tooltip: {
      formatter: (params) => {
        return `${params.name}: ${params.value.toFixed(1)}%`;
      },
    },
    series: [
      {
        type: "treemap",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        emphasis: {
          disabled: true,
        },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 0.75,
          gapWidth: 0.75,
        },
        roam: false,
        nodeClick: false,
        label: {
          show: false,
        },
        breadcrumb: { show: false },
        data: data,
      },
    ],
  };

  window.densityChart.setOption(option);
}

function applyMapFilter(selectedCategory) {
  let filterCondition;
  const lu = ["downcase", ["get", "landuse"]];

  switch (selectedCategory) {
    case "Residential":
      filterCondition = ["==", lu, "residential"];
      break;
    case "Town Centre":
      filterCondition = [
        "any",
        ["==", lu, "town centre"],
        ["==", lu, "town_centre"],
      ];
      break;
    case "District Centre":
      filterCondition = [
        "any",
        ["==", lu, "district centre"],
        ["==", lu, "district_centre"],
      ];
      break;
    case "Local Centre":
      filterCondition = [
        "any",
        ["==", lu, "local centre"],
        ["==", lu, "local_centre"],
      ];
      break;
    case "Employment":
      filterCondition = ["==", lu, "employment"];
      break;
    case "Secondary School":
      filterCondition = [
        "any",
        ["==", lu, "secondary school"],
        ["==", lu, "secondary_school"],
        ["==", lu, "school"],
      ];
      break;
    case "Primary School":
      filterCondition = [
        "any",
        ["==", lu, "primary school"],
        ["==", lu, "primary_school"],
      ];
      break;
    case "Sports":
      filterCondition = ["any", ["==", lu, "sports"], ["==", lu, "sports"]];
      break;
    default:
      filterCondition = false;
  }

  map.setPaintProperty("plots-fill", "fill-opacity", [
    "case",
    filterCondition,
    0.95,
    0.15,
  ]);
  map.setPaintProperty("plots-line", "line-opacity", [
    "case",
    filterCondition,
    0.8,
    0.1,
  ]);
}

function resetMapFilter() {
  map.setPaintProperty("plots-fill", "fill-opacity", 0.65);
  map.setPaintProperty("plots-line", "line-opacity", 0.3);
}

// ==========================================
// 9. RESPONSIVE SIDEBAR LOGIC
// ==========================================
window.toggleSidebar = function () {
  const sidebar = document.querySelector(".dashboard-container");
  sidebar.classList.toggle("collapsed");
  setTimeout(() => {
    if (map) map.resize();
    if (landuseEChart) landuseEChart.resize();
  }, 300);
};

document.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth <= 1024) {
    document.querySelector(".dashboard-container").classList.add("collapsed");
  }
});

// ==========================================
// 10. INFRASTRUCTURE MODALS LOGIC
// ==========================================

// --- EDUCATION ---
window.openEduSettings = function () {
  document.getElementById("edu-ey-yield").value = window.infraAss.edu.eyYield;
  document.getElementById("edu-ey-places").value = window.infraAss.edu.eyPlaces;
  document.getElementById("edu-ey-sqm").value = window.infraAss.edu.eySqm;

  document.getElementById("edu-pri-yield").value = window.infraAss.edu.priYield;
  document.getElementById("edu-pri-fe").value = window.infraAss.edu.priFE;
  document.getElementById("edu-pri-ha").value = window.infraAss.edu.priHa;
  document.getElementById("edu-pri-size").value =
    window.infraAss.edu.priSize || 3;

  document.getElementById("edu-sec-yield").value = window.infraAss.edu.secYield;
  document.getElementById("edu-sec-fe").value = window.infraAss.edu.secFE;
  document.getElementById("edu-sec-ha").value = window.infraAss.edu.secHa;
  document.getElementById("edu-sec-size").value =
    window.infraAss.edu.secSize || 10;

  document.getElementById("edu-send-yield").value =
    window.infraAss.edu.sendYield;
  document.getElementById("edu-send-ha").value = window.infraAss.edu.sendHa;
  document.getElementById("edu-modal").style.display = "flex";
};
window.closeEduSettings = function () {
  document.getElementById("edu-modal").style.display = "none";
};
window.saveEduSettings = function () {
  window.infraAss.edu.eyYield =
    Number(document.getElementById("edu-ey-yield").value) || 0;
  window.infraAss.edu.eyPlaces =
    Number(document.getElementById("edu-ey-places").value) || 1;
  window.infraAss.edu.eySqm =
    Number(document.getElementById("edu-ey-sqm").value) || 0;

  window.infraAss.edu.priYield =
    Number(document.getElementById("edu-pri-yield").value) || 0;
  window.infraAss.edu.priFE =
    Number(document.getElementById("edu-pri-fe").value) || 1;
  window.infraAss.edu.priHa =
    Number(document.getElementById("edu-pri-ha").value) || 0;
  window.infraAss.edu.priSize =
    Number(document.getElementById("edu-pri-size").value) || 3;

  window.infraAss.edu.secYield =
    Number(document.getElementById("edu-sec-yield").value) || 0;
  window.infraAss.edu.secFE =
    Number(document.getElementById("edu-sec-fe").value) || 1;
  window.infraAss.edu.secHa =
    Number(document.getElementById("edu-sec-ha").value) || 0;
  window.infraAss.edu.secSize =
    Number(document.getElementById("edu-sec-size").value) || 10;

  window.infraAss.edu.sendYield =
    Number(document.getElementById("edu-send-yield").value) || 0;
  window.infraAss.edu.sendHa =
    Number(document.getElementById("edu-send-ha").value) || 0;

  localStorage.setItem("adl_infra", JSON.stringify(window.infraAss));
  closeEduSettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// --- HEALTH ---
window.openHealthSettings = function () {
  document.getElementById("health-gp-pop").value = window.infraAss.health.gpPop;
  document.getElementById("health-gp-sqm").value = window.infraAss.health.gpSqm;
  document.getElementById("health-den-pop").value =
    window.infraAss.health.denPop;
  document.getElementById("health-den-sqm").value =
    window.infraAss.health.denSqm;
  document.getElementById("health-acute-beds").value =
    window.infraAss.health.acuteBedsK;
  document.getElementById("health-acute-sqm").value =
    window.infraAss.health.acuteSqm;
  document.getElementById("health-mental-beds").value =
    window.infraAss.health.mentalBedsK;
  document.getElementById("health-mental-sqm").value =
    window.infraAss.health.mentalSqm;
  document.getElementById("health-modal").style.display = "flex";
};
window.closeHealthSettings = function () {
  document.getElementById("health-modal").style.display = "none";
};
window.saveHealthSettings = function () {
  window.infraAss.health.gpPop =
    Number(document.getElementById("health-gp-pop").value) || 1;
  window.infraAss.health.gpSqm =
    Number(document.getElementById("health-gp-sqm").value) || 0;
  window.infraAss.health.denPop =
    Number(document.getElementById("health-den-pop").value) || 1;
  window.infraAss.health.denSqm =
    Number(document.getElementById("health-den-sqm").value) || 0;
  window.infraAss.health.acuteBedsK =
    Number(document.getElementById("health-acute-beds").value) || 0;
  window.infraAss.health.acuteSqm =
    Number(document.getElementById("health-acute-sqm").value) || 0;
  window.infraAss.health.mentalBedsK =
    Number(document.getElementById("health-mental-beds").value) || 0;
  window.infraAss.health.mentalSqm =
    Number(document.getElementById("health-mental-sqm").value) || 0;

  localStorage.setItem("adl_infra", JSON.stringify(window.infraAss));
  closeHealthSettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// --- COMMUNITY ---
window.openCommSettings = function () {
  document.getElementById("comm-space").value = window.infraAss.comm.space;
  document.getElementById("comm-art").value = window.infraAss.comm.art;
  document.getElementById("comm-museum").value = window.infraAss.comm.museum;
  document.getElementById("comm-lib").value = window.infraAss.comm.library;
  document.getElementById("comm-modal").style.display = "flex";
};
window.closeCommSettings = function () {
  document.getElementById("comm-modal").style.display = "none";
};
window.saveCommSettings = function () {
  window.infraAss.comm.space =
    Number(document.getElementById("comm-space").value) || 0;
  window.infraAss.comm.art =
    Number(document.getElementById("comm-art").value) || 0;
  window.infraAss.comm.museum =
    Number(document.getElementById("comm-museum").value) || 0;
  window.infraAss.comm.library =
    Number(document.getElementById("comm-lib").value) || 0;

  localStorage.setItem("adl_infra", JSON.stringify(window.infraAss));
  closeCommSettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// --- LEISURE ---
window.openLeisureSettings = function () {
  document.getElementById("leisure-pool-pop").value =
    window.infraAss.leisure.poolPop;
  document.getElementById("leisure-pool-sqm").value =
    window.infraAss.leisure.poolSqm;
  document.getElementById("leisure-hall-pop").value =
    window.infraAss.leisure.hallPop;
  document.getElementById("leisure-hall-sqm").value =
    window.infraAss.leisure.hallSqm;
  document.getElementById("leisure-bowls-pop").value =
    window.infraAss.leisure.bowlsPop;
  document.getElementById("leisure-modal").style.display = "flex";
};
window.closeLeisureSettings = function () {
  document.getElementById("leisure-modal").style.display = "none";
};
window.saveLeisureSettings = function () {
  window.infraAss.leisure.poolPop =
    Number(document.getElementById("leisure-pool-pop").value) || 1;
  window.infraAss.leisure.poolSqm =
    Number(document.getElementById("leisure-pool-sqm").value) || 0;
  window.infraAss.leisure.hallPop =
    Number(document.getElementById("leisure-hall-pop").value) || 1;
  window.infraAss.leisure.hallSqm =
    Number(document.getElementById("leisure-hall-sqm").value) || 0;
  window.infraAss.leisure.bowlsPop =
    Number(document.getElementById("leisure-bowls-pop").value) || 1;

  localStorage.setItem("adl_infra", JSON.stringify(window.infraAss));
  closeLeisureSettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// --- OPEN SPACE ---
window.openSpaceSettings = function () {
  document.getElementById("space-parks").value = window.infraAss.space.parks;
  document.getElementById("space-amenity").value =
    window.infraAss.space.amenity;
  document.getElementById("space-natural").value =
    window.infraAss.space.natural;
  document.getElementById("space-pitches").value =
    window.infraAss.space.pitches;
  document.getElementById("space-courts").value = window.infraAss.space.courts;
  document.getElementById("space-play-eq").value = window.infraAss.space.playEq;
  document.getElementById("space-play-inf").value =
    window.infraAss.space.playInf;
  document.getElementById("space-modal").style.display = "flex";
};
window.closeSpaceSettings = function () {
  document.getElementById("space-modal").style.display = "none";
};
window.saveSpaceSettings = function () {
  window.infraAss.space.parks =
    Number(document.getElementById("space-parks").value) || 0;
  window.infraAss.space.amenity =
    Number(document.getElementById("space-amenity").value) || 0;
  window.infraAss.space.natural =
    Number(document.getElementById("space-natural").value) || 0;
  window.infraAss.space.pitches =
    Number(document.getElementById("space-pitches").value) || 0;
  window.infraAss.space.courts =
    Number(document.getElementById("space-courts").value) || 0;
  window.infraAss.space.playEq =
    Number(document.getElementById("space-play-eq").value) || 0;
  window.infraAss.space.playInf =
    Number(document.getElementById("space-play-inf").value) || 0;

  localStorage.setItem("adl_infra", JSON.stringify(window.infraAss));
  closeSpaceSettings();
  if (window.geojsonData) updateDashboardKPIs(window.geojsonData);
};

// ==========================================
// 11. SWITCH TAB
// ==========================================
window.switchTab = function (tab) {
  document.getElementById("tab-btn-housing").classList.remove("active");
  document.getElementById("tab-btn-infra").classList.remove("active");
  document.getElementById("tab-content-housing").style.display = "none";
  document.getElementById("tab-content-infra").style.display = "none";

  document.getElementById(`tab-btn-${tab}`).classList.add("active");
  document.getElementById(`tab-content-${tab}`).style.display = "block";

  if (tab === "housing" && landuseEChart) {
    landuseEChart.resize();
  }
};

// ==========================================
// 12. METHODOLOGY
// ==========================================

window.openMethodology = function () {
  document.getElementById("methodology-modal").style.display = "flex";
};

window.closeMethodology = function () {
  document.getElementById("methodology-modal").style.display = "none";
};

// Close modal if user clicks the dark overlay (the glass effect)
window.addEventListener("click", function (event) {
  const modal = document.getElementById("methodology-modal");
  if (event.target === modal) {
    closeMethodology();
  }
});

// ==========================================
// CSV EXPORT LOGIC
// ==========================================

window.exportToCSV = function () {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.innerText.replace(/,/g, "") : "0";
  };

  // ===============================
  // 1. SUMMARY (UNCHANGED STRUCTURE)
  // ===============================
  const rows = [
    ["Category", "Metric", "Value"],
    ["Housing & Pop", "Total Homes", getVal("kpi-total-homes")],
    ["Housing & Pop", "Total Houses", getVal("kpi-houses")],
    ["Housing & Pop", "Total Flats", getVal("kpi-flats")],
    ["Housing & Pop", "Population", getVal("kpi-population")],
    [],
    ["Education", "Early Years", getVal("req-ey-sqm")],
    ["Education", "Primary Schools", getVal("req-primary-ha")],
    ["Education", "Secondary Schools", getVal("req-secondary-ha")],
    ["Education", "SEND Schools", getVal("req-send-ha")],
    ["Education", "Total Education Land", getVal("req-total-edu")],
    [],
    ["Health & Social", "Primary Care (GP)", getVal("req-gp-sqm")],
    ["Health & Social", "Dental Practices", getVal("req-dentist-sqm")],
    ["Health & Social", "Acute Hospital", getVal("req-acute-sqm")],
    ["Health & Social", "Mental Health", getVal("req-mental-sqm")],
    ["Health & Social", "Total Health Space", getVal("req-total-health")],
    [],
    ["Community", "Community Space", getVal("req-comm-sqm")],
    ["Community", "Art & Cultural", getVal("req-art-sqm")],
    ["Community", "Museums", getVal("req-museum-sqm")],
    ["Community", "Libraries", getVal("req-lib-sqm")],
    ["Community", "Total Community Space", getVal("req-total-comm")],
    [],
    ["Leisure", "Swimming Pools", getVal("req-pool-sqm")],
    ["Leisure", "Sports Halls", getVal("req-hall-sqm")],
    ["Leisure", "Indoor Bowls", getVal("req-bowls-count")],
    ["Leisure", "Total Leisure Space", getVal("req-total-leisure")],
    [],
    ["Open Space", "Parks & Gardens", getVal("req-parks-ha")],
    ["Open Space", "Amenity Green", getVal("req-amenity-ha")],
    ["Open Space", "Natural Space", getVal("req-natural-ha")],
    ["Open Space", "Sports Pitches", getVal("req-pitches-ha")],
    ["Open Space", "Courts & Tracks", getVal("req-courts-ha")],
    ["Open Space", "Equipped Play", getVal("req-play-eq-ha")],
    ["Open Space", "Informal Play", getVal("req-play-inf-ha")],
    ["Open Space", "Total Open Space", getVal("req-total-open")],
    [],
    ["Capacity Check", "Required Land Take", getVal("cap-required")],
    ["Capacity Check", "Masterplan Allowance", getVal("cap-allowed")],
    ["Capacity Check", "Status", getVal("cap-status")],
  ];

  // Convert to Excel sheet
  const summarySheet = XLSX.utils.aoa_to_sheet(rows);

  // ===============================
  // 2. PARCEL DISTRIBUTION
  // ===============================
  const geojson = window.geojsonData;
  const n2g = window.netToGrossEfficiency / 100;
  const bands = [180, 150, 100, 70, 50, 30, 20];

  const parcelHeaders = [
    "Parcel ID",
    "Land Use",
    ...bands.map((b) => `Mix ${b} dph (%)`),
    "Plot Area (ha)",
    ...bands.map((b) => `Area @ ${b} dph (ha)`),
    "Total Homes",
  ];

  const parcelRows = [parcelHeaders];

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};

    const parcelId = props.parcel_id || "";
    const landuse = props.landuse || "";
    const area = Number(props.shape_area_ha) || Number(props.plot_area_ha) || 0;

    const mixes = bands.map((b) => Number(props[`density_mix_${b}dph`]) || 0);

    const areasAtDensity = mixes.map((pct) => area * (pct / 100));

    let totalHomes = 0;
    bands.forEach((band, i) => {
      totalHomes += areasAtDensity[i] * band * n2g;
    });

    parcelRows.push([
      parcelId,
      landuse,
      ...mixes,
      area,
      ...areasAtDensity,
      Math.round(totalHomes),
    ]);
  });

  const parcelSheet = XLSX.utils.aoa_to_sheet(parcelRows);

  // ===============================
  // 3. WORKBOOK
  // ===============================
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(wb, parcelSheet, "Parcel Distribution");

  // ===============================
  // 4. DOWNLOAD
  // ===============================
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Masterplan_Capacity_Report_${date}.xlsx`);
};

// ==========================================
// SCENARIO LOGIC
// ==========================================
let currentScenario = "scenario1";
window.loadScenario1 = async function () {
  const savedGeojson = localStorage.getItem("adl_geojsonDataScenario1");
  if (savedGeojson) {
    window.geojsonData = JSON.parse(savedGeojson);
    currentScenario = "scenario1";
    setActiveButton("scenario1Btn");
    startupApp(window.geojsonData);
  } else {
    try {
      const response = await fetch("data/addlington_plots_scenario1.geojson");
      window.geojsonData = await response.json();
      currentScenario = "scenario1";
      setActiveButton("scenario1Btn");
      startupApp(window.geojsonData);
    } catch (err) {
      console.warn("Could not load geojson.", err);
    }
  }
};

window.loadScenario2 = async function () {
  const savedGeojson = localStorage.getItem("adl_geojsonDataScenario2");
  if (savedGeojson) {
    window.geojsonData = JSON.parse(savedGeojson);
    currentScenario = "scenario2";
    setActiveButton("scenario2Btn");
    startupApp(window.geojsonData);
  } else {
    try {
      const response = await fetch("data/addlington_plots_scenario2.geojson");
      window.geojsonData = await response.json();
      currentScenario = "scenario2";
      setActiveButton("scenario2Btn");
      startupApp(window.geojsonData);
    } catch (err) {
      console.warn("Could not load geojson.", err);
    }
  }
};

function setActiveButton(activeId) {
  const btn1 = document.getElementById("scenario1Btn");
  const btn2 = document.getElementById("scenario2Btn");

  btn1.classList.remove("active");
  btn2.classList.remove("active");

  document.getElementById(activeId).classList.add("active");
}

window.resetGeoJsons = async function () {
  try {
    localStorage.removeItem("adl_geojsonDataScenario1");
    localStorage.removeItem("adl_geojsonDataScenario2");
    const response = await fetch("data/addlington_plots_scenario1.geojson");
    window.geojsonData = await response.json();
    currentScenario = "scenario1";
    setActiveButton("scenario1Btn");
    startupApp(window.geojsonData);
  } catch (err) {
    console.warn("Could not load geojson.", err);
  }
};

// ==========================================
// OWNERSHIP LOGIC
// ==========================================

const toggle = document.getElementById("toggleSwitch");

toggle.addEventListener("change", function () {
  if (this.checked) {
    addOwnershipJson();
  } else {
    removeOwnershipJson();
  }
});

window.addOwnershipJson = async function () {
  const savedGeojson = localStorage.getItem("adl_geojsonOwnership");
  let foundOwnershipJson = false;
  if (savedGeojson) {
    window.geojsonOwnData = JSON.parse(savedGeojson);
    foundOwnershipJson = true;
  } else {
    try {
      const response = await fetch("data/addlington_ownership.geojson");
      window.geojsonOwnData = await response.json();
      map.addSource("addlington-ownership", {
        type: "geojson",
        data: window.geojsonOwnData,
      });
      localStorage.setItem(
        "adl_geojsonOwnership",
        JSON.stringify(window.geojsonOwnData),
      );
      foundOwnershipJson = true;
    } catch (err) {
      console.warn("Could not load geojson.", err);
    }
  }
  if (foundOwnershipJson) {
    map.addSource("addlington-ownership", {
      type: "geojson",
      data: window.geojsonOwnData,
    });

    map.addLayer({
      id: "ownership-layer",
      type: "fill",
      source: "addlington-ownership",
      paint: {
        "fill-color": "#3e3e3e",
        "fill-opacity": 0.1,
      },
    });
    map.addLayer({
      id: "ownership-outline",
      type: "line",
      source: "addlington-ownership",
      paint: {
        "line-color": "#3e3e3e",
        "line-width": 0.5,
        "line-opacity": 1,
      },
    });
  }
};

window.removeOwnershipJson = function () {
  // Remove Layers
  if (map.getLayer("ownership-layer")) {
    map.removeLayer("ownership-layer");
  }
  if (map.getLayer("ownership-outline")) {
    map.removeLayer("ownership-outline");
  }
  // Remove Source
  if (map.getSource("addlington-ownership")) {
    map.removeSource("addlington-ownership");
  }
};
