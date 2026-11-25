import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

setWorkerUrl(maplibreWorkerUrl);

const LAND = [
  "match",
  ["get", "CONTINENT"],
  "Africa",
  "#c4895a",
  "Europe",
  "#7f9a72",
  "Asia",
  "#d4a15a",
  "North America",
  "#5f8f99",
  "South America",
  "#c46a58",
  "Oceania",
  "#8d7eae",
  "Antarctica",
  "#a9bcc9",
  "#7f93a3",
];

const globeSky = {
  "sky-color": "transparent",
  "horizon-color": "transparent",
  "sky-horizon-blend": 0,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0.75, 5, 0.15],
};

paintSpace();

const flatSky = {
  "sky-color": "#1a78a8",
  "horizon-color": "#1a78a8",
  "atmosphere-blend": 0,
};

const numberFormat = new Intl.NumberFormat("fr-FR");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = (ms) => (reduceMotion ? 0 : ms);

const panel = document.querySelector("#panel");
const panelBody = document.querySelector("#panel-body");
const boot = document.querySelector("#boot");
const searchInput = document.querySelector("#country-search");
const searchResults = document.querySelector("#search-results");
const globeButton = document.querySelector("#mode-globe");
const mapButton = document.querySelector("#mode-map");

const featuresById = new Map();
let searchIndex = [];
let mode = "globe";
let hoveredId = null;
let selectedId = null;
let selectedFeature = null;
let requestToken = 0;
let profilesPromise = null;
let activeResult = -1;

const map = new MapLibreMap({
  container: "map",
  style: {
    version: 8,
    projection: { type: "globe" },
    sky: globeSky,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#1a78a8" },
      },
    ],
  },
  center: [12, 16],
  zoom: 1.55,
  attributionControl: {
    compact: true,
    customAttribution: "Natural Earth · Flagcdn",
  },
  maplibreLogo: false,
  minZoom: 0.8,
  maxZoom: 8,
  renderWorldCopies: false,
});

const geoPromise = fetch("/countries.geojson").then((response) => {
  if (!response.ok) throw new Error("Impossible de charger les frontières.");
  return response.json();
});

map.on("load", async () => {
  try {
    const data = await geoPromise;
    data.features.forEach((feature, index) => {
      feature.id = index + 1;
      featuresById.set(feature.id, feature);
    });
    searchIndex = buildSearchIndex(data.features);
    map.addSource("countries", { type: "geojson", data });
    map.addLayer({
      id: "countries-fill",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#f0c14d",
          ["boolean", ["feature-state", "hover"], false],
          "#d7eef8",
          LAND,
        ],
        "fill-opacity": 1,
      },
    });
    map.addLayer({
      id: "countries-line",
      type: "line",
      source: "countries",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#8a5a12",
          "rgba(7, 16, 24, 0.45)",
        ],
        "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 1.6, 0.7],
      },
    });
    bindMapEvents();
    boot.hidden = true;
  } catch (error) {
    console.error(error);
    boot.textContent = "Impossible de charger la carte.";
  }
});

globeButton.addEventListener("click", () => setMode("globe"));
mapButton.addEventListener("click", () => setMode("map"));
document.querySelector("#panel-close").addEventListener("click", closePanel);
searchInput.addEventListener("input", () => showMatches(searchInput.value));
searchInput.addEventListener("keydown", onSearchKeydown);
searchResults.addEventListener("mousedown", (event) => event.preventDefault());
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".search")) hideResults();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!searchResults.hidden) {
    hideResults();
    return;
  }
  if (!panel.hidden) closePanel();
});

function paintSpace() {
  const width = 1600;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(20261125);

  const wash = ctx.createRadialGradient(width * 0.5, height * 0.42, 40, width * 0.5, height * 0.5, width * 0.75);
  wash.addColorStop(0, "#121c36");
  wash.addColorStop(0.5, "#070c18");
  wash.addColorStop(1, "#02040a");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 1600; index += 1) {
    drawStar(ctx, random() * width, random() * height, random);
  }

  for (let index = 0; index < 700; index += 1) {
    const x = random() * width;
    const y = height * 0.62 + (x - width * 0.5) * 0.42 + (random() - 0.5) * 150;
    drawStar(ctx, x, y, random, 0.35);
  }

  document.documentElement.style.setProperty("--space", `url("${canvas.toDataURL()}")`);
}

function drawStar(ctx, x, y, random, minimumAlpha = 0) {
  const roll = random();
  const size = roll > 0.992 ? 2 : 1;
  const alpha = Math.max(minimumAlpha, 0.35 + random() * 0.65);
  const tint = random();
  ctx.fillStyle = tint > 0.94 ? `rgba(255, 214, 170, ${alpha})` : tint > 0.88 ? `rgba(186, 214, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
  ctx.fillRect(x, y, size, size);
  if (size === 2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
    ctx.fillRect(x - 2, y, 6, 1);
    ctx.fillRect(x, y - 2, 1, 6);
  }
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function setMode(next) {
  if (next === mode) return;
  mode = next;
  globeButton.setAttribute("aria-pressed", String(next === "globe"));
  mapButton.setAttribute("aria-pressed", String(next === "map"));
  document.body.classList.toggle("mode-globe", next === "globe");

  if (next === "globe") {
    map.setProjection({ type: "globe" });
    map.setSky(globeSky);
    map.setMinZoom(0.8);
    map.setMaxPitch(50);
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    const center = selectedFeature
      ? [Number(selectedFeature.properties.LABEL_X), Number(selectedFeature.properties.LABEL_Y)]
      : map.getCenter();
    map.easeTo({
      center,
      zoom: 1.7,
      pitch: 0,
      bearing: 0,
      duration: motion(800),
      essential: true,
    });
    return;
  }

  map.setProjection({ type: "mercator" });
  map.setSky(flatSky);
  map.setMinZoom(0);
  map.setMaxPitch(0);
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.easeTo({ pitch: 0, bearing: 0, duration: 0 });
  fitWorld();
}

function fitWorld() {
  map.fitBounds(
    [
      [-168, -56],
      [178, 72],
    ],
    {
      padding: viewPadding(),
      duration: motion(800),
      maxZoom: 4,
    },
  );
}

function bindMapEvents() {
  let moving = false;

  map.on("movestart", () => {
    moving = true;
    map.getCanvas().style.cursor = "";
    clearHover();
  });
  map.on("moveend", () => {
    moving = false;
  });

  map.on("mousemove", (event) => {
    if (moving) return;
    const hits = map.queryRenderedFeatures(event.point, { layers: ["countries-fill"] });
    const next = hits[0]?.id ?? null;
    map.getCanvas().style.cursor = next == null ? "" : "pointer";
    if (next === hoveredId) return;
    clearHover();
    hoveredId = next;
    if (hoveredId != null) {
      map.setFeatureState({ source: "countries", id: hoveredId }, { hover: true });
    }
  });

  map.on("mouseout", () => {
    map.getCanvas().style.cursor = "";
    clearHover();
  });

  map.on("click", (event) => {
    hideResults();
    const feature = countryAt(event.point);
    if (!feature) {
      closePanel();
      return;
    }
    openCountry(featuresById.get(feature.id) || feature);
  });
}

function clearHover() {
  if (hoveredId == null) return;
  map.setFeatureState({ source: "countries", id: hoveredId }, { hover: false });
  hoveredId = null;
}

function countryAt(point) {
  const exact = map.queryRenderedFeatures(point, { layers: ["countries-fill"] });
  if (exact.length) return exact[0];
  const pad = 8;
  const around = map.queryRenderedFeatures(
    [
      [point.x - pad, point.y - pad],
      [point.x + pad, point.y + pad],
    ],
    { layers: ["countries-fill"] },
  );
  return around[0] || null;
}

function highlight(id) {
  if (selectedId != null && selectedId !== id) {
    map.setFeatureState({ source: "countries", id: selectedId }, { selected: false });
  }
  selectedId = id;
  map.setFeatureState({ source: "countries", id }, { selected: true });
}

function clearSelection() {
  if (selectedId != null) {
    map.setFeatureState({ source: "countries", id: selectedId }, { selected: false });
  }
  selectedId = null;
  selectedFeature = null;
}

async function openCountry(feature) {
  const token = ++requestToken;
  const props = feature.properties;
  selectedFeature = feature;
  highlight(feature.id);
  panel.hidden = false;
  document.body.classList.add("panel-open");
  renderLoading(props);
  focusFeature(feature);

  try {
    const profiles = await loadProfiles();
    if (token !== requestToken) return;
    const profile =
      profiles.get(props.ADM0_A3) || profiles.get(props.ISO_A2) || profiles.get(props.ISO_A3);
    if (!profile) {
      renderMissing(props);
      return;
    }
    renderProfile(profile);
  } catch (error) {
    console.error(error);
    if (token !== requestToken) return;
    renderError(props);
  }
}

function closePanel() {
  requestToken += 1;
  panel.hidden = true;
  document.body.classList.remove("panel-open");
  clearSelection();
}

function focusFeature(feature) {
  const bounds = geometryBounds(feature.geometry);
  const padding = viewPadding();
  const center = [Number(feature.properties.LABEL_X), Number(feature.properties.LABEL_Y)];
  const duration = motion(1100);
  const crosses = bounds.width > 180;
  const south = Math.max(bounds.minY, -82);
  const north = Math.min(bounds.maxY, 84);
  if (crosses || !Number.isFinite(bounds.minX) || south >= north) {
    map.flyTo({
      center,
      zoom: mode === "globe" ? 2.6 : 3,
      padding,
      duration,
      essential: true,
    });
    return;
  }
  const span = Math.max(bounds.width, bounds.height);
  const maxZoom = span < 2 ? 5.8 : span < 8 ? 4.8 : mode === "globe" ? 3.6 : 4.4;
  map.fitBounds(
    [
      [bounds.minX, south],
      [bounds.maxX, north],
    ],
    { padding, duration, maxZoom, essential: true },
  );
}

function viewPadding() {
  const narrow = window.matchMedia("(max-width: 760px)").matches;
  const open = !panel.hidden;
  if (narrow) {
    return {
      top: 96,
      left: 16,
      right: 16,
      bottom: open ? Math.round(window.innerHeight * 0.42) : 28,
    };
  }
  return { top: 76, left: 20, right: open ? 380 : 20, bottom: 28 };
}

function geometryBounds(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords) => {
    if (!coords) return;
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const part of coords) walk(part);
  };
  walk(geometry?.coordinates);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function loadProfiles() {
  if (!profilesPromise) {
    profilesPromise = fetch("/profiles.json")
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les fiches.");
        return response.json();
      })
      .then((list) => {
        const byKey = new Map();
        for (const profile of list) {
          if (profile.id) byKey.set(profile.id, profile);
          if (profile.cca2) byKey.set(profile.cca2, profile);
          if (profile.cca3) byKey.set(profile.cca3, profile);
        }
        return byKey;
      })
      .catch((error) => {
        profilesPromise = null;
        throw error;
      });
  }
  return profilesPromise;
}

function renderLoading(props) {
  panelBody.replaceChildren(heading(props.NAME_FR || props.NAME), note("Chargement des informations…", "loading"));
}

function renderMissing(props) {
  panelBody.replaceChildren(
    heading(props.NAME_FR || props.NAME),
    note("Pas de fiche pour ce territoire.", "message"),
  );
}

function renderError(props) {
  panelBody.replaceChildren(
    heading(props.NAME_FR || props.NAME),
    note("Impossible de charger les informations.", "message"),
  );
}

function renderProfile(profile) {
  const nodes = [heading(profile.name)];
  if (profile.official && profile.official !== profile.name) {
    nodes.push(note(profile.official, "official"));
  }
  if (profile.flag) {
    const flag = document.createElement("img");
    flag.className = "flag";
    flag.alt = `Drapeau : ${profile.name}`;
    flag.src = profile.flag;
    flag.addEventListener("error", () => {
      const fallback = document.createElement("p");
      fallback.className = "flag-fallback";
      fallback.textContent = profile.emoji || "";
      flag.replaceWith(fallback);
    });
    nodes.push(flag);
  }
  const facts = document.createElement("dl");
  facts.className = "facts";
  addFact(facts, "Capitale", profile.capital.join(", "));
  addFact(facts, "Population", profile.population ? `${numberFormat.format(profile.population)} hab.` : "");
  addFact(facts, "Superficie", profile.area ? `${numberFormat.format(profile.area)} km²` : "");
  addFact(facts, "Continent", profile.continent);
  addFact(facts, "Région", profile.region);
  addFact(facts, "Langues", profile.languages.join(", "));
  addFact(
    facts,
    "Monnaie",
    profile.currencies
      .map((currency) => [currency.symbol, currency.name, currency.code].filter(Boolean).join(" · "))
      .join(", "),
  );
  nodes.push(facts);
  panelBody.replaceChildren(...nodes);
}

function heading(text) {
  const title = document.createElement("h2");
  title.id = "panel-title";
  title.className = "country-name";
  title.textContent = text;
  return title;
}

function note(text, className) {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text;
  return paragraph;
}

function addFact(list, label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value || "—";
  list.append(term, detail);
}

function buildSearchIndex(features) {
  return features
    .map((feature) => {
      const props = feature.properties;
      const label = props.NAME_FR || props.NAME;
      const aliases = [
        label,
        props.NAME,
        props.NAME_EN,
        props.NAME_LONG,
        props.FORMAL_FR,
        props.ISO_A2,
        props.ISO_A3,
        props.ADM0_A3,
      ].filter((value) => value && value !== "-99");
      return {
        id: feature.id,
        feature,
        label,
        detail: props.NAME && normalize(props.NAME) !== normalize(label) ? props.NAME : "",
        aliases: [...new Set(aliases.map(normalize).filter(Boolean))],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

function showMatches(rawQuery) {
  const query = normalize(rawQuery);
  activeResult = -1;
  if (!query) {
    hideResults();
    return;
  }
  const matches = searchCountries(query);
  searchResults.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Aucun pays trouvé";
    searchResults.append(empty);
  } else {
    matches.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "result";
      item.id = `search-result-${index}`;
      item.setAttribute("role", "option");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("span");
      name.textContent = entry.label;
      button.append(name);
      if (entry.detail) {
        const detail = document.createElement("small");
        detail.textContent = entry.detail;
        button.append(detail);
      }
      button.addEventListener("click", () => chooseResult(entry));
      item.append(button);
      searchResults.append(item);
    });
  }
  searchResults.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchInput.removeAttribute("aria-activedescendant");
}

function searchCountries(query) {
  const ranked = [];
  for (const entry of searchIndex) {
    let best = Infinity;
    for (const alias of entry.aliases) {
      if (alias === query) best = Math.min(best, 0);
      else if (alias.startsWith(query)) best = Math.min(best, 1);
      else if (alias.includes(query)) best = Math.min(best, 2);
    }
    if (best < Infinity) ranked.push({ entry, best });
  }
  ranked.sort((a, b) => a.best - b.best || a.entry.label.localeCompare(b.entry.label, "fr"));
  return ranked.slice(0, 8).map((row) => row.entry);
}

function chooseResult(entry) {
  searchInput.value = entry.label;
  hideResults();
  openCountry(entry.feature);
}

function hideResults() {
  searchResults.hidden = true;
  searchResults.replaceChildren();
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  activeResult = -1;
}

function onSearchKeydown(event) {
  const options = [...searchResults.querySelectorAll(".result")];
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!options.length) return;
    event.preventDefault();
    if (searchResults.hidden) showMatches(searchInput.value);
    const nextOptions = [...searchResults.querySelectorAll(".result")];
    if (!nextOptions.length) return;
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeResult = (activeResult + direction + nextOptions.length) % nextOptions.length;
    nextOptions.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === activeResult));
    });
    const current = nextOptions[activeResult];
    searchInput.setAttribute("aria-activedescendant", current.id);
    current.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "Enter") {
    const matches = searchCountries(normalize(searchInput.value));
    const chosen = matches[activeResult] || matches[0];
    if (!chosen) return;
    event.preventDefault();
    chooseResult(chosen);
    return;
  }
  if (event.key === "Escape") {
    hideResults();
  }
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
