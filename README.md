# GeoField – offline geological field mapping (v0.1)

## Put it on your iPhone (once, needs internet, ~10 minutes)

1. Create a free account at https://github.com (if you don't have one).
2. Click **+ → New repository**. Name it `geofield`, choose **Public**, click **Create repository**.
3. On the new page click **uploading an existing file**. Drag in **everything inside the `geofield` folder**
   (index.html, styles.css, sw.js, manifest.webmanifest, the two icons, README.md, and the `js` folder).
   Click **Commit changes**.
4. Go to **Settings → Pages**. Under *Branch* choose `main` and `/ (root)`, click **Save**.
   After about 1 minute your app is at `https://YOUR-USERNAME.github.io/geofield/`.
5. On the iPhone open that address in **Safari** (not Chrome).
6. Tap **Share → Add to Home Screen**. Open GeoField from the home screen icon.
7. Allow **Location** when asked. When you first use the phone compass, allow **Motion & Orientation**.
8. Still on Wi-Fi: open each tab once (Map, Stations, Log, Structures, Project) and pan the satellite map over
   your field area at the zoom levels you need. Those tiles are then kept for offline use.

## Before you go to the field

- Project tab: fill Region, License, Project, Prospect, Geologist, station prefix, first sample number,
  magnetic declination (central Saudi Arabia ≈ +3.5°). Coordinate system defaults to UTM 38N (EPSG:32638).
- Map → ☰ Layers → Import: load your GeoTIFF / MBTiles base maps and KML / Shapefile (.zip) layers.
- For a polygon layer (licenses, prospects, geology map) tap ⋯ and choose which attribute fills which form field.
- Georeferenced PDF: convert to GeoTIFF in QGIS first. Plain JPG/PNG must be georeferenced first.

## Every evening

Project → **Save full backup** and save it to Files / iCloud / send to yourself. Also export **Everything (ZIP)**.

## Notes / limits of v0.1

- Data is stored only on this phone until team sync (logins) is added.
- Big GeoTIFFs (> ~150 MB) may be too heavy for the phone: prefer MBTiles for large base maps.
- Keep the app open while recording a point; iOS stops GPS when the app is in the background.
