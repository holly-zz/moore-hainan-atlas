/* Deterministic DOM-free V18/V19 calculation smoke tests. Run: node scripts/test_parcel_entry_lab.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'parcel-entry-lab.js'), 'utf8');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, value: id === 'pelW' ? '20' : id === 'pelD' ? '18' : '',
    textContent: '', disabled: false, classList: {toggle() {}},
    append() {}, prepend() {}, click() {}
  });
  return elements.get(id);
}
function layer() {
  return {
    addTo() {return this;}, addLayer() {return this;}, clearLayers() {return this;},
    setLatLngs() {return this;}, bindTooltip() {return this;}, on() {return this;},
    setLatLng() {return this;}, getBounds() {return {pad() {return this;}};}
  };
}
const L = {layerGroup: layer, polyline: layer, geoJSON: layer, marker: layer,
  circleMarker: layer, divIcon: () => ({})};
const turf = {
  polygon: (coordinates, properties = {}) => ({type:'Feature',geometry:{type:'Polygon',coordinates},properties}),
  point: (coordinates, properties = {}) => ({type:'Feature',geometry:{type:'Point',coordinates},properties}),
  lineString: (coordinates, properties = {}) => ({type:'Feature',geometry:{type:'LineString',coordinates},properties})
};
const browserWindow = {L, turf};
const document = {getElementById: element,
  createElement: () => ({innerHTML:'',textContent:'',append() {},prepend() {}}),
  head: {append() {}}};
const map = {on() {},fitBounds() {},getCenter: () => ({lng:110.32,lat:20.02})};
vm.runInNewContext(source, {window:browserWindow,document,map,L,turf});
const lab = browserWindow.mooreParcelEntryLab;
assert.ok(lab, 'lab mounted');
lab.createDemo();
const initial = lab.compute();
assert.ok(Math.abs(initial.bounds.plot_area_m2 - 2000) < .01, '40 x 50 m synthetic parcel');
assert.equal(initial.bounds.building_footprint_m2, 360, '20 x 18 m building');
assert.ok(initial.fits, 'prototype building fits in synthetic geometry');
lab.state.gateT = .15;
const left = lab.compute();
lab.state.gateT = .5;
const middle = lab.compute();
lab.state.gateT = .85;
const right = lab.compute();
assert.ok(left.walkM > middle.walkM + 3, 'dragging gate changes pedestrian distance');
assert.ok(Math.abs(left.bounds.front_yard_usable_proxy_m2 - middle.bounds.front_yard_usable_proxy_m2) >= 1,
  'gate routing changes approximate usable front yard');
assert.equal(left.side, 'left');
assert.equal(right.side, 'right');
assert.ok(Math.abs(left.incidence - right.incidence) > 10, 'public-facade view geometry changes');
assert.ok(Math.abs(left.bounds.rear_yard_gross_m2 - right.bounds.rear_yard_gross_m2) < .01,
  'a gate-only move cannot physically change gross rear yard');
lab.state.building = [0, 5];
const shifted = lab.compute();
assert.ok(Math.abs(shifted.bounds.front_yard_gross_m2 - initial.bounds.front_yard_gross_m2) > 50,
  'moving building changes yard geometry');
lab.state.building = [100,100];
assert.equal(lab.compute().fits, false, 'out-of-parcel prototype is flagged');
lab.state.building = [0,0];
const report = lab.export();
assert.equal(report.validation.zoning,'missing');
assert.equal(report.privacy_proxy.measured_visibility, null);
assert.ok(report.geojson.features.some(f => f.properties.feature_id === 'GATE_01'));
assert.ok(report.geojson.features.some(f => f.properties.feature_id === 'ROUTE_PED_01'));
console.log('V18/V19 smoke test passed: geometry, gate drag, routes, garage side, yard invariants, evidence export.');
