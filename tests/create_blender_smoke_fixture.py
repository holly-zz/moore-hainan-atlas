"""Creates a small explicit SYNTHETIC GIS smoke-test fixture near the user's selected
Haikou-school test center. This fixture does not claim to be a real building survey.
The live website exports REAL, currently loaded GIS features instead.
"""
import json,math
from pathlib import Path
C=(110.302509,20.029762)
def rectangle(dx,dy,wx,wy):
 x=C[0]+dx;y=C[1]+dy;return [[x-wx,y-wy],[x+wx,y-wy],[x+wx,y+wy],[x-wx,y+wy],[x-wx,y-wy]]
def feat(points,properties):
 return {"type":"Feature","geometry":{"type":"Polygon","coordinates":[points]},"properties":properties}
bundle={"schema":"moore-blender-site-v1","crs":"EPSG:4326","selection":feat(rectangle(0,0,.004,.004),{}),"layers":{
 "buildings":{"type":"FeatureCollection","features":[feat(rectangle(0,0,.00015,.00012),{"osm_id":"SYNTHETIC_SMOKE_TEST","height":12})]},
 "roads":{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[C[0]-.001,C[1]],[C[0]+.001,C[1]]]},"properties":{"test":"synthetic"}}]},
 "green":{"type":"FeatureCollection","features":[feat(rectangle(.0006,.0006,.00015,.00015),{"test":"synthetic"})]}},"metadata":{"fixture":"SYNTHETIC ONLY","center":C}}
Path("tests").mkdir(exist_ok=True)
Path("tests/blender_smoke_synthetic.json").write_text(json.dumps(bundle),encoding="utf8")
