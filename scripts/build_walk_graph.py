"""Build a pedestrian-routing graph from clipped OSM road geometries.
Topology is noded at intersections using GEOS unary_union, then projected to WGS84.
Access permissions cannot be guaranteed from fclass alone; graph is preliminary.
"""
import json,sys,math
from pathlib import Path
import geopandas as gpd
from shapely.ops import unary_union
from shapely.geometry import LineString, MultiLineString, GeometryCollection
from pyproj import Transformer

EXCLUDE={"motorway","motorway_link","trunk","trunk_link","construction","proposed","raceway"}
def walk_lines(geom):
 if geom.geom_type=="LineString":yield geom
 elif hasattr(geom,"geoms"):
  for part in geom.geoms:yield from walk_lines(part)
def main(root="data"):
 root=Path(root);p=root/"roads.geojson"
 if not p.exists():raise RuntimeError("Missing clipped roads GeoJSON")
 g=gpd.read_file(p).to_crs("EPSG:32649")
 if "fclass" in g:g=g[~g.fclass.fillna("").str.lower().isin(EXCLUDE)]
 segments=[line for geom in g.geometry if geom is not None and not geom.is_empty for line in walk_lines(geom) if line.length>1]
 if not segments:raise RuntimeError("No walkable road segments")
 # Node at geometric intersections, preserving actual OSM road geometry.
 noded=unary_union(segments)
 to_ll=Transformer.from_crs("EPSG:32649","EPSG:4326",always_xy=True)
 nodes=[];ids={};edges=[]
 def get_id(x,y):
  key=(round(x,2),round(y,2))
  if key not in ids:
   ids[key]=len(nodes);lon,lat=to_ll.transform(x,y);nodes.append([round(lon,7),round(lat,7)])
  return ids[key]
 for line in walk_lines(noded):
  coords=list(line.coords)
  for a,b in zip(coords,coords[1:]):
   dist=math.dist(a[:2],b[:2])
   if dist<.1:continue
   u,v=get_id(*a[:2]),get_id(*b[:2])
   if u!=v:edges.append([u,v,round(dist,2)])
 result={"crs":"EPSG:4326","nodes":nodes,"edges":edges,"undirected":True,
 "method":"geometry-noded OSM road graph (approximate walking candidate), not verified pedestrian access",
 "warnings":["Road-class filtering only; foot access and bridges/tunnels are not reliably modeled","Overpasses can appear connected in 2D","Endpoints snapped to nearest node; off-network connectors not included"]}
 out=root/"walk_graph.json";out.write_text(json.dumps(result,separators=(",",":")),encoding="utf8")
 print(json.dumps({"nodes":len(nodes),"edges":len(edges),"graph_bytes":out.stat().st_size}))
if __name__=="__main__":main(sys.argv[1] if len(sys.argv)>1 else "data")
