"""Download a real 500m Overture building pilot for the selected Haikou candidate center.
Does not certify a specific school entrance. Static pilot only; other AOIs must not reuse it.
"""
import json,subprocess
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import transform
from pyproj import Transformer
lon,lat=110.302509,20.029762
project=Transformer.from_crs(4326,32649,always_xy=True).transform
unproject=Transformer.from_crs(32649,4326,always_xy=True).transform
center=Point(*project(lon,lat))
from shapely.geometry import mapping
from shapely.ops import transform
aoi=transform(unproject,center.buffer(500,resolution=48))
root=Path("data");root.mkdir(exist_ok=True)
b=aoi.bounds
bbox=",".join(str(round(v,7)) for v in b)
raw=root/"pilot_overture_raw.geojson"
subprocess.run(["overturemaps","download","--type=building","--bbox="+bbox,"-f","geojson","-o",str(raw)],check=True,timeout=480)
g=gpd.read_file(raw)
if g.crs is None:g=g.set_crs("EPSG:4326")
g=g.to_crs(4326)
g=g[g.geometry.intersects(aoi)].copy()
g.geometry=g.geometry.intersection(aoi)
g=g[~g.geometry.is_empty]
g=g[g.geometry.geom_type.isin(["Polygon","MultiPolygon"])]
if g.empty:raise RuntimeError("Overture pilot has no buildings")
columns=[k for k in ["id","height","num_floors","sources","geometry"] if k in g.columns]
if "sources" in columns:columns.remove("sources") # can contain nested objects, not relevant to 3D
g=g[columns]
g["atlas_source"]="Overture Maps Buildings / 500m static pilot"
g.to_file(root/"pilot_overture_500m.geojson",driver="GeoJSON")
stats={"center_wgs84":[lon,lat],"radius_m":500,"footprints":int(len(g)),"height_numeric_present":int(g["height"].notna().sum()) if "height" in g else 0,"floors_present":int(g["num_floors"].notna().sum()) if "num_floors" in g else 0,"status":"pilot_uncertified","restriction":"Use only for candidate-center AOI. Not representative of all four districts."}
(root/"pilot_overture_manifest.json").write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding="utf8")
raw.unlink(missing_ok=True)
print(json.dumps(stats,ensure_ascii=False))
