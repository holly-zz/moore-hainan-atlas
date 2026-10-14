"""Clip thematic GeoJSON to the Haikou study rectangle (not an administrative polygon)."""
import json, sys
from pathlib import Path
import geopandas as gpd
from shapely.geometry import box
from shapely.validation import make_valid

BBOX=(110.15,19.85,110.55,20.12)
LAYERS=('commercial','residential','industrial','green','agriculture','other_landuse','roads','transport','poi','water','buildings')
def main(root='data'):
  root=Path(root);roi=box(*BBOX);result=[]
  for name in LAYERS:
    path=root/(name+'.geojson')
    if not path.exists():continue
    g=gpd.read_file(path)
    if g.empty:continue
    if g.crs is None:raise RuntimeError('Missing CRS in '+str(path))
    g=g.to_crs(4326)
    g=g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g=g[g.intersects(roi)].copy()
    if g.empty:
      path.unlink()
      continue
    g.geometry=g.geometry.map(lambda f:make_valid(f).intersection(roi))
    g=g[~g.geometry.is_empty].copy()
    if name in ('commercial','residential','industrial','green','agriculture','other_landuse','buildings'):
      g=g[g.geometry.geom_type.isin(['Polygon','MultiPolygon'])]
    if g.empty:
      path.unlink()
      continue
    g.to_file(path,driver='GeoJSON')
    result.append({'layer':name,'features':len(g)})
  (root/'haikou_manifest.json').write_text(json.dumps({'bbox':BBOX,'bbox_is_administrative':False,'layers':result,'source':'OSM Geofabrik','warning':'Incomplete map contributions; not cadastral or official zoning'},ensure_ascii=False,indent=2))
  print(json.dumps(result))
if __name__=='__main__':main(sys.argv[1] if len(sys.argv)>1 else 'data')
