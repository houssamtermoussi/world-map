# Carte du monde

Carte interactive du monde, en français et en anglais. On peut passer du globe à une carte plane, chercher un pays et ouvrir sa fiche : drapeau, capitale, population, superficie, continent, région, langues et monnaie.

## Lancer le projet

Il faut [Node.js](https://nodejs.org/) 22.

```bash
npm install
npm run dev
```

Le serveur de développement affiche l’adresse locale (en général `http://localhost:5173`).

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Prévisualisation du build |

En développement, l’application est servie à la racine (`/`). Le build et la prévisualisation utilisent le chemin `/world-map/`, celui de GitHub Pages.

## Utilisation

- Cliquer un pays ouvre sa fiche et centre la vue dessus.
- La recherche accepte le nom en français ou en anglais, et se pilote au clavier.
- Le bouton globe / carte change de projection. Sur le globe, on peut incliner et tourner la vue ; la boussole ramène le nord en haut.
- Le bouton de langue bascule entre le français et l’anglais. Le choix est conservé dans le navigateur.

## Données

| Fichier | Contenu |
| --- | --- |
| `public/countries.geojson` | Frontières (Natural Earth), avec les noms `NAME`, `NAME_FR` et `NAME_EN` |
| `public/profiles.json` | Fiches en français : capitale, population, superficie, continent, région, langues, monnaie, drapeau |
| `src/places-en.json` | Noms, langues et monnaies en anglais, utilisés quand l’interface est en anglais |

Les drapeaux viennent de [Flagcdn](https://flagcdn.com/). Une fiche est reliée à un pays par `ADM0_A3`, `ISO_A2` ou `ISO_A3`.

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : installation, `npm run build`, puis publication de `dist/` sur GitHub Pages. Le site est servi sous `/world-map/`.

## Structure

```
index.html              page
src/main.js             carte, recherche, fiches, langues
src/style.css           styles
src/places-en.json      traductions anglaises des fiches
public/countries.geojson
public/profiles.json
vite.config.js          chemin de base /world-map/ en production
```
