# MOORE Spatial Intelligence Lab — V15 architecture contract

## What was actually verified (2026-10-21)

User-exported `haikou-school-1km-study.geojson` is a 1 km circular AOI centered at (110.302509 E, 20.029762 N). User-exported `MOORE_Haikou_Site_1km_A3.svg` contains OSM vector outlines (16 buildings, 104 roads, 28 residential, 10 commercial tagged elements in its legend), but is not a comparative site-suitability plate. Do not represent the existing 18.2/100 illustrative score as a validated suitability result. Some geometry is incomplete because the repository clips OSM to the old research rectangle.

## Product modes

1. **DATA / Urban Atlas.** Verify source, dates, coordinate reference, coverage, and classification; retain raw OSM `fclass`, `osm_id`, `name`, geometry. POI selection must only select/show a feature and right sidebar, never activate service-radius logic.
2. **ANALYZE / Suitability Lab.** Require a specific design-program profile (public facility, ecological retrofit, retail, etc.) before ranking. Fixed AOI (Meilan, Longhua, Xiuying) and **500 m grid**, projected CRS, common observation date. Compute metrics per cell with **identical denominators**. Distinguish independent 1 km candidate-local buffers. Min/max or percentile normalization MUST use all eligible cells of a pinned study version; keep raw values, distribution, direction, thresholds, weights, coverage and missingness. Never quietly redistribute unavailable metrics to imply comparability. Explicitly exclude cells under minimum mapped coverage and near incomplete study edges.
3. **EXPLORE / 3D Urban View.** Use actual building polygons and physical height only where measured `height` or reliably captured `building:levels` data exist. If absent, show flat footprint or an explicit schematic default that cannot be used for height/FAR conclusions. Camera orbit, zoom, layer switching, and click-to-inspect. OSM building data in current GeoJSON have `osm_id,name,fclass` but **no height/levels**; repair upstream import before 3D height assertions.
4. **PUBLISH / Diagram Studio.** A3 portrait/landscape SVG + PDF with overview, small multiple metrics, score distribution, comparative candidate scorecards, evidence/provenance, scale, north, legend and missingness. Editable vectors and audit JSON. No invented results or unmeasured commercial footfall.

## Scoring specification

For raw metric `x_i` in cell `c`, standardize using the **same pinned reference population** `R` and documented method `N_i(x_{i,c}; R)`; reverse signs only per program objective. `Score(c) = sum(w_i N_i(c))/sum(w_i)`. A score is valid ONLY when all required indicators pass quality gates; missing required values cause **N/A**, never zero or silent omission. Disclose reference percentiles, actual score formula and `R` in export. Compare at least three scenarios and give sensitivity to weights. Use hard constraints separately (e.g. protected land, safety restrictions): a high weighted score cannot override exclusion.

## Test case

**Haikou Middle School 1 km** is the field-validation case. Verify exact campus entrance, coordinate and admin district. Its existing export uses (110.302509, 20.029762) as a user-selected mapped feature, NOT surveyed gate. Use it for reproducible smoke tests; flag any uncertainty.

- Compare the site's cell against the overall 500 m grid distribution, not against an arbitrary saturation threshold.
- Full study data must cover selected district AOIs; never equate old Haikou research rectangle to full districts.
- Build five thematic maps: footprint coverage, road length density, mapped transit stop density, mapped retail POI density, green mapped polygon share.
- Building height, FAR, pedestrian activity, sales and flood hazard require independent validated datasets before inclusion.
- POI icon legend must distinguish school, kindergarten, library, bookshop, rail/bus, hospital/clinic/pharmacy. Bookshops belong to retail or cultural categories; retain original tags.
- A3 SVG must contain maps, metrics, methods, legends and source footnotes. PDF should be built from exact vector artifact, not an invented screenshot.

## Definition of done

- [ ] Open website; click one school POI; select is visible and right detail opens; no automatic buffer.
- [ ] POI category and subtype filters operate together and retain clickability.
- [ ] Pick 1 km AOI and see unchanged muted road/building/landuse context outside it.
- [ ] Calculate comparable 500 m AOI-wide grid. Export per-cell vector GeoJSON + score CSV/JSON.
- [ ] Explain missing data and score N/A. Re-run gives same result for same pinned source version.
- [ ] 3D map shows sourced building height metadata or visibly tagged placeholder (never mislabeled actual).
- [ ] A3 SVG and PDF reproduce raw metrics, mapping scales and styling and are editable.
- [ ] Verify browser interactions in desktop Chromium, mobile viewport, and GH Actions deployment.

Current state: this is a contract, not a claim that all above features are implemented.
