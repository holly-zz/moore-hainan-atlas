"""Audit actual OSM building outlines without claiming survey-grade accuracy."""
import json,sys
from pathlib import Path
import geopandas as gpd
from shapely.validation import make_valid
def main(root="data"):
 p=Path(root)/"buildings.geojson"
 if not p.exists():raise FileNotFoundError("Missing buildings.geojson")
 g=gpd.read_file(p)
 if g.crs is None:raise RuntimeError("Building CRS missing")
 n=len(g);types=g.geometry.geom_type.value_counts(dropna=False).to_dict()
 invalid=int((~g.geometry.is_valid).sum());null=int(g.geometry.isna().sum());empty=int(g.geometry.is_empty.sum())
 polygons=g[g.geometry.geom_type.isin(["Polygon","MultiPolygon"])].copy()
 if len(polygons)!=n:raise RuntimeError("Building dataset has non-polygon geometries")
 ids=polygons["osm_id"].fillna("").astype(str) if "osm_id" in polygons else None
 duplicate_ids=int(ids[ids.ne("")].duplicated().sum()) if ids is not None else None
 fixed=polygons.geometry.apply(make_valid)
 if not fixed.is_valid.all():raise RuntimeError("Building geometry repair failed")
 projected=gpd.GeoSeries(fixed,crs=g.crs).to_crs("EPSG:32649")
 areas=projected.area
 anomaly=(areas<5)|(areas>100000)
 report={"source":"Geofabrik / OpenStreetMap","study_extent":"Haikou rectangular study, not full city","building_polygons":n,"geom_types":types,"null_geometries":null,"empty_geometries":empty,"invalid_geometries":invalid,"duplicate_osm_ids":duplicate_ids,"area_m2":{"min":round(float(areas.min()),2),"median":round(float(areas.median()),2),"max":round(float(areas.max()),2)},"area_outliers_under_5_or_over_100000_m2":int(anomaly.sum()),"warnings":["OSM building footprints may be incomplete or outdated","OSM roof outline differs from ground-floor parcel footprint","Clipping may create small edge fragments; outlier flag is not proof of error","Area measured in EPSG:32649; not a surveyed building registry"]}
 (Path(root)/"building_qa.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
