import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import placesEn from "./places-en.json";

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

const COPY = {
  fr: {
    title: "Carte du monde",
    search: "Rechercher un pays",
    showMap: "Afficher la carte",
    showGlobe: "Afficher le globe",
    langLabel: "Passer en anglais",
    langTitle: "English",
    langCode: "EN",
    north: "Nord",
    resetNorth: "Revenir au nord",
    close: "Fermer la fiche",
    boot: "Chargement de la carte…",
    bootError: "Impossible de charger la carte.",
    loading: "Chargement des informations…",
    missing: "Pas de fiche pour ce territoire.",
    error: "Impossible de charger les informations.",
    noResults: "Aucun pays trouvé",
    flag: (name) => `Drapeau : ${name}`,
    inhabitants: "hab.",
    capital: "Capitale",
    population: "Population",
    area: "Superficie",
    continent: "Continent",
    region: "Région",
    languages: "Langues",
    currency: "Monnaie",
    west: "O",
    locale: "fr-FR",
    sort: "fr",
  },
  en: {
    title: "World map",
    search: "Search for a country",
    showMap: "Show the map",
    showGlobe: "Show the globe",
    langLabel: "Switch to French",
    langTitle: "Français",
    langCode: "FR",
    north: "North",
    resetNorth: "Reset to north",
    close: "Close the panel",
    boot: "Loading the map…",
    bootError: "Could not load the map.",
    loading: "Loading details…",
    missing: "No details for this territory.",
    error: "Could not load the details.",
    noResults: "No country found",
    flag: (name) => `Flag: ${name}`,
    inhabitants: "people",
    capital: "Capital",
    population: "Population",
    area: "Area",
    continent: "Continent",
    region: "Region",
    languages: "Languages",
    currency: "Currency",
    west: "W",
    locale: "en-US",
    sort: "en",
  },
};

const CONTINENTS = {
  Afrique: "Africa",
  "Amérique du Nord": "North America",
  "Amérique du Sud": "South America",
  Antarctique: "Antarctica",
  Asie: "Asia",
  Europe: "Europe",
  Océan: "Ocean",
  Océanie: "Oceania",
};

const REGIONS = {
  "Afrique australe": "Southern Africa",
  "Afrique centrale": "Central Africa",
  "Afrique de l’Est": "Eastern Africa",
  "Afrique de l’Ouest": "Western Africa",
  "Afrique du Nord": "Northern Africa",
  "Amérique centrale": "Central America",
  "Amérique du Nord": "North America",
  "Amérique du Sud": "South America",
  Antarctique: "Antarctica",
  "Asie centrale": "Central Asia",
  "Asie de l’Est": "Eastern Asia",
  "Asie de l’Ouest": "Western Asia",
  "Asie du Sud": "Southern Asia",
  "Asie du Sud-Est": "Southeast Asia",
  "Australie et Nouvelle-Zélande": "Australia and New Zealand",
  Caraïbes: "Caribbean",
  "Europe centrale": "Central Europe",
  "Europe de l’Est": "Eastern Europe",
  "Europe de l’Ouest": "Western Europe",
  "Europe du Nord": "Northern Europe",
  "Europe du Sud": "Southern Europe",
  "Europe du Sud-Est": "Southeast Europe",
  Micronésie: "Micronesia",
  Mélanésie: "Melanesia",
  Polynésie: "Polynesia",
};

let lang = "fr";
try {
  const stored = localStorage.getItem("map-lang");
  if (stored === "en" || stored === "fr") lang = stored;
} catch {
  lang = "fr";
}
let copy = COPY[lang];
let numberFormat = new Intl.NumberFormat(copy.locale);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = (ms) => (reduceMotion ? 0 : ms);

const panel = document.querySelector("#panel");
const panelBody = document.querySelector("#panel-body");
const boot = document.querySelector("#boot");
const searchInput = document.querySelector("#country-search");
const searchResults = document.querySelector("#search-results");
const modeButton = document.querySelector("#mode-toggle");
const langButton = document.querySelector("#lang-toggle");
const searchLabel = document.querySelector("label[for='country-search']");
const compassWest = document.querySelector("#compass-west");
const panelClose = document.querySelector("#panel-close");
const compass = document.querySelector("#compass");
const compassRose = document.querySelector("#compass-rose");

const featuresById = new Map();
let searchIndex = [];
let mode = "globe";
let panelView = null;
let bootFailed = false;
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
    bootFailed = true;
    boot.textContent = copy.bootError;
  }
});

modeButton.addEventListener("click", () => setMode(mode === "globe" ? "map" : "globe"));
langButton.addEventListener("click", () => applyLanguage(lang === "fr" ? "en" : "fr"));
applyLanguage(lang);
compass.addEventListener("click", resetNorth);
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
map.on("rotate", syncCompass);
map.on("pitch", syncCompass);
syncCompass();

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

function applyLanguage(next) {
  lang = next === "en" ? "en" : "fr";
  copy = COPY[lang];
  numberFormat = new Intl.NumberFormat(copy.locale);
  try {
    localStorage.setItem("map-lang", lang);
  } catch {
    /* ignore private-mode storage failures */
  }
  document.documentElement.lang = lang;
  document.title = copy.title;
  searchLabel.textContent = copy.search;
  searchInput.placeholder = copy.search;
  syncModeButton();
  langButton.textContent = copy.langCode;
  langButton.setAttribute("aria-label", copy.langLabel);
  langButton.title = copy.langTitle;
  compass.setAttribute("aria-label", copy.resetNorth);
  compass.title = copy.north;
  compassWest.textContent = copy.west;
  compassWest.setAttribute("x", lang === "en" ? "15" : "13");
  panelClose.setAttribute("aria-label", copy.close);
  if (!boot.hidden) boot.textContent = bootFailed ? copy.bootError : copy.boot;
  if (featuresById.size) searchIndex = buildSearchIndex([...featuresById.values()]);
  syncSearchField();
  if (!searchResults.hidden) showMatches(searchInput.value);
  paintPanel();
}

function syncModeButton() {
  const label = mode === "globe" ? copy.showMap : copy.showGlobe;
  modeButton.setAttribute("aria-label", label);
  modeButton.title = label;
}

function setMode(next) {
  if (next === mode) return;
  mode = next;
  syncModeButton();
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

function syncCompass() {
  const bearing = map.getBearing();
  const pitch = map.getPitch() * 0.45;
  compassRose.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`;
}

function resetNorth() {
  const bearing = map.getBearing();
  const pitch = map.getPitch();
  if (Math.abs(bearing) < 0.5 && pitch < 0.5) return;
  map.easeTo({
    bearing: 0,
    pitch: 0,
    duration: motion(500),
    essential: true,
  });
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
  panelView = null;
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
      top: 72,
      left: 16,
      right: 16,
      bottom: open ? Math.round(window.innerHeight * 0.48) + 150 : 156,
    };
  }
  return { top: 72, left: 20, right: open ? 380 : 20, bottom: 120 };
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
  panelView = { kind: "loading", props };
  paintPanel();
}

function renderMissing(props) {
  panelView = { kind: "missing", props };
  paintPanel();
}

function renderError(props) {
  panelView = { kind: "error", props };
  paintPanel();
}

function renderProfile(profile) {
  panelView = { kind: "profile", props: selectedFeature?.properties, profile };
  paintPanel();
}

function paintPanel() {
  if (!panelView) return;
  const { kind, props, profile } = panelView;
  if (kind === "loading") {
    panelBody.replaceChildren(heading(placeName(props)), note(copy.loading, "loading"));
    return;
  }
  if (kind === "missing") {
    panelBody.replaceChildren(heading(placeName(props)), note(copy.missing, "message"));
    return;
  }
  if (kind === "error") {
    panelBody.replaceChildren(heading(placeName(props)), note(copy.error, "message"));
    return;
  }
  paintProfile(localized(profile));
}

function localized(profile) {
  if (lang !== "en") return profile;
  const extra = placesEn[profile.id] || placesEn[profile.cca3] || {};
  return {
    ...profile,
    name: extra.name || profile.name,
    official: extra.official || profile.official,
    continent: CONTINENTS[profile.continent] || profile.continent,
    region: REGIONS[profile.region] || profile.region,
    languages: extra.languages?.length ? extra.languages : profile.languages,
    currencies: profile.currencies.map((currency) => ({
      ...currency,
      name: extra.currencies?.[currency.code] || currency.name,
    })),
  };
}

function placeName(props) {
  if (!props) return "";
  return lang === "en" ? props.NAME_EN || props.NAME : props.NAME_FR || props.NAME;
}

function paintProfile(profile) {
  const nodes = [heading(profile.name)];
  if (profile.official && profile.official !== profile.name) {
    nodes.push(note(profile.official, "official"));
  }
  if (profile.flag) {
    const flag = document.createElement("img");
    flag.className = "flag";
    flag.alt = copy.flag(profile.name);
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
  addFact(facts, copy.capital, profile.capital.join(", "));
  addFact(
    facts,
    copy.population,
    profile.population ? `${numberFormat.format(profile.population)} ${copy.inhabitants}` : "",
  );
  addFact(facts, copy.area, profile.area ? `${numberFormat.format(profile.area)} km²` : "");
  addFact(facts, copy.continent, profile.continent);
  addFact(facts, copy.region, profile.region);
  addFact(facts, copy.languages, profile.languages.join(", "));
  addFact(
    facts,
    copy.currency,
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
      const label = labelFor(props);
      const other = otherLabel(props);
      const aliases = [
        label,
        other,
        props.NAME,
        props.NAME_FR,
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
        detail: other && normalize(other) !== normalize(label) ? other : "",
        aliases: [...new Set(aliases.map(normalize).filter(Boolean))],
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, copy.sort));
}

function labelFor(props) {
  const french = props.NAME_FR || props.NAME;
  const english = props.NAME_EN || props.NAME;
  return lang === "en" ? english : french;
}

function otherLabel(props) {
  const french = props.NAME_FR || props.NAME;
  const english = props.NAME_EN || props.NAME;
  return lang === "en" ? french : english;
}

function syncSearchField() {
  if (!selectedFeature) return;
  const props = selectedFeature.properties;
  const names = [props.NAME_FR, props.NAME, props.NAME_EN].filter(Boolean);
  if (names.includes(searchInput.value)) searchInput.value = labelFor(props);
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
    empty.textContent = copy.noResults;
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
  ranked.sort((a, b) => a.best - b.best || a.entry.label.localeCompare(b.entry.label, copy.sort));
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

