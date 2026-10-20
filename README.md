# MOORE Hainan Spatial Atlas

An interactive Hainan map with city index, local GeoJSON import, optional Tianditu basemap, and a GitHub Actions pipeline to retrieve and convert actual Hainan GIS data.

## Use

Open GitHub Pages or index.html. For online Tianditu tiles, obtain a valid Tianditu token (TK) and enter it in the interface. The no-basemap mode keeps features usable where international map tiles fail. City markers are reference locations, **not administrative polygons**.

## GIS automation

Workflow: `.github/workflows/hainan-gis.yml`.

1. Go to Settings → Pages and select **GitHub Actions** as the publishing source.
2. Go to Actions → Build Hainan GIS Atlas → Run workflow.
3. On a successful run the job downloads Geofabrik's Hainan GeoPackage, extracts real geometries, and publishes GeoJSON with the map.
4. If the official download host is blocked, workflow will fail rather than pretending fabricated geographic data is real.

Source: https://download.geofabrik.de/asia/china/hainan.html ; copyright OpenStreetMap contributors (ODbL). Respect licensing, citation, and size constraints.

Expected data/ output: landuse.geojson, roads.geojson, buildings.geojson, water.geojson, data_manifest.json (only categories actually present).

Coordinates: imported GeoJSON must use WGS84 (EPSG:4326); original source CRS is explicitly read and transformed.

The browser map relies on Leaflet from a CDN; this is not fully offline. Large buildings layers may require tiling/partitioning for performance.

## V3 thematic land-use classification

OSM/Geofabrik data is classified from `fclass`, without guessing from geometry:
- commercial: `commercial`, `retail`
- residential: `residential`
- industrial: `industrial`
- green: `forest`, `wood`, `grass`, `meadow`, `park`, etc.
- agriculture: `farmland`, `farmyard`, `orchard`, etc.
- other_landuse: every remaining `fclass`, preserving original values

Other independent source layers: roads, transport (traffic/transport), POI, water, buildings. Categories are thematic research groupings, **not statutory land-use zones**. True land/coastline polygon requires another verified official or OSM coastline polygon source and is not fabricated.

The builder reports exact counts per output layer and any unmatched categories in `data/data_manifest.json`. If Geofabrik source naming changes, the report flags unavailable families. Large polygon or building datasets can make the browser slow: partition/simplify in a future vector-tile pipeline if necessary.

Current editing capability is visibility and opacity per layer; individual vector geometry editing and save-back are **not** implemented.

## V4 Haikou research lab

Study rectangle is **110.15–110.55 E, 19.85–20.12 N**. It is intentionally not labelled as the legal Haikou city limit.

- Vector editing: select an OSM feature, edit its JSON properties and category (`fclass`); copy to the editable layer and use the Leaflet.Draw toolbar to modify vertices. Draw polygons, polylines and points; export all currently loaded features as GeoJSON. Edits are client-side only and **never saved to OSM**.
- Analytics: spherical area estimates by thematic polygon; geodesic road length per study rectangle area; POI point count; normalized two-category Shannon evenness of detected commercial/residential polygon area.
- Caveats: classification comes from tagged OSM contributors, not statutory zoning. An area can overlap and be double-counted. Unmapped land uses are not zeros. POI counts are raw features, not density/ground-truth completeness.
- GIS build: first extract Hainan source layers, then `python scripts/prepare_haikou.py data` to intersect with the study rectangle. A separate `scripts/fetch_hainan_boundary.py` obtains a province ADM1 boundary from geoBoundaries gbOpen with attribution; this is **not** a certified shoreline polygon. No coastline-derived land polygon is supplied until a verified coastline source is processed.
- Source providers: [Geofabrik Hainan](https://download.geofabrik.de/asia/china/hainan.html) (OSM ODbL); [geoBoundaries API](https://www.geoboundaries.org/api.html) (gbOpen CC BY 4.0). Remote access may fail; unsuccessful builds must not claim real data was produced.
- The web UI uses CDN Leaflet, Leaflet.Draw and Turf; their availability depends on client connectivity. GitHub Pages needs enabling and an Actions workflow run to publish.

## V5 POI points

`scripts/prepare_poi.py` converts OSM Geofabrik `pois` point and polygon records and `transport` layers to **point** GeoJSON categories: medical, education, shopping/retail, transit, restaurants, civic services, leisure, and unmatched. Polygon features are mapped to an interior representative point, **not** a surveyed entrance. Categories follow source `fclass` labels. OSM data is contributed and incomplete: mapped features != every real-world facility.

The web client displays distinct color-coded POI layers, with independent visibility and opacity toggles, click-to-inspect raw properties, and POI totals by category in exported analytics JSON. The source data manifest `data/poi_manifest.json` carries category counts and unmatched classification statistics. Attribution: © OpenStreetMap contributors (ODbL), downloaded through Geofabrik.

The GitHub Actions workflow calls POI classification after Haikou clipping; no synthetic POIs are inserted. If building the atlas locally, run `python scripts/prepare_poi.py data` after `python scripts/prepare_haikou.py data`.

## V6 POI search and service radius

- Search by source `name`, `fclass`, or group name; category select filters result list. The first 100 matching records are displayed while the matched total remains visible. Click an item to navigate to and select its point.
- Clicking a point runs straight-line service coverage for **500 m, 1 km, or 3 km**. "All medical POIs" generates a combined facility service assessment.
- Blueprints of calculation: Turf geodesic circle buffering; `intersect` of mapped residential polygon footprints against circles; union of multiple intersections *per residential polygon* to avoid counting overlapping medical service buffers twice within that feature. The numerator is overlapped OSM residential land area; denominator is mapped OSM residential polygon area in the analysis rectangle.
- This is **not network-based access**, population coverage, health-care capacity, actual walking distance, or a complete inventory of hospitals. Polygon geometry overlaps or topology errors may affect results. The UI reports geometry operation errors; evaluate results against checked field data before publication.
- Exported analytics JSON includes `service_coverage` when available.
- Data will remain unavailable until the GIS workflow successfully fetches and publishes the real Geofabrik records.

## V8 site-selection workbench

- Pick origin or destination from any selected POI, **or place a point manually** by clicking the map (school campus/entrance is not inferred). Study radius 500 m, 1 km or 3 km.
- A lens is created by Turf geographic intersection of the real OSM land-use polygons and the selected circular area. The original land-use layers are temporarily hidden; only polygon portions **inside** the radius are colored. Unmapped regions stay uncolored.
- Suitability scoring is an explicitly illustrative, normalized weighted combination of detected commercial, residential, and green land-use proportions, plus mapped health and transit POI counts capped at 20. User weights are normalized; users should establish independent thresholds for research claims. No missing mapped features are fabricated.
- A preliminary pedestrian candidate graph is generated from clipped OSM roads using GEOS geometry noding and projected distances. Browser Dijkstra finds the shortest path *on this graph*. Routes may be wrong where 2D crossings are actually bridges/underpasses, road access restrictions differ, or campus entrances aren't represented. **This is not verified navigation**.
- OSM school/station names may be incomplete or ambiguous. Choose exact source and destination from search results or mark actual entrances manually; no assumed coordinate for "Haikou Middle School".
- To build, workflow exports `data/walk_graph.json` and copies `site-selector.js`. Geometry loading and routing depend on successful GitHub Actions execution.
