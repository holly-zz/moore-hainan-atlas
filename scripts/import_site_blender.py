"""Blender 4.x import of MOORE site bundle, run:
blender --background --python scripts/import_site_blender.py -- /absolute/path/moore-blender-site.json /absolute/path/site.blend
No external pip modules. Height only from an explicit numeric 'height' in meters.
"""
import bpy,json,sys,math
from pathlib import Path
def arguments():
 a=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 if not a:raise ValueError('Provide GIS bundle JSON after --')
 return Path(a[0]), Path(a[1]) if len(a)>1 else Path(a[0]).with_suffix('.blend')
inp,out=arguments();data=json.loads(inp.read_text(encoding='utf-8'))
if data.get('schema')!='moore-blender-site-v1':raise ValueError('Unsupported site bundle')
bounds=data['selection']['geometry']['coordinates']
def flat_ring(c):
 if isinstance(c[0],(int,float)):return [c]
 return sum((flat_ring(v) for v in c),[])
pts=flat_ring(bounds);lon=sum(p[0] for p in pts)/len(pts);lat=sum(p[1] for p in pts)/len(pts)
kx=111320*math.cos(math.radians(lat));ky=110574
def xy(p):return ((p[0]-lon)*kx,(p[1]-lat)*ky)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def collection(name):
 c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
def polygon(ring,name,col,height=None):
 coords=ring[:-1] if ring[0]==ring[-1] else ring
 if len(coords)<3:return
 vertices=[(*xy(p),0) for p in coords]
 faces=[tuple(range(len(coords)))]
 # Holes aren't triangulated; GIS geometry must be checked against actual openings.
 if height is not None and height>0:
  n=len(vertices);vertices+= [(x,y,height) for x,y,z in vertices]
  faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
  faces +=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);col.objects.link(obj)
 obj['height_source']='OSM explicit height meters' if height else 'none: footprint only'
def line(path,name,col):
 if len(path)<2:return
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=.35;cu.resolution_u=1
 sp=cu.splines.new('POLY');sp.points.add(len(path)-1)
 for i,p in enumerate(path):sp.points[i].co=(*xy(p),.05,1)
 obj=bpy.data.objects.new(name,cu);col.objects.link(obj)
for layer,fc in data['layers'].items():
 col=collection(layer)
 for n,feat in enumerate(fc.get('features',[])):
  geo=feat.get('geometry') or {};typ=geo.get('type');coordinates=geo.get('coordinates');props=feat.get('properties') or {}
  if not coordinates:continue
  height=None
  if layer=='buildings':
   try:height=float(str(props.get('height','')).replace('m','').strip())
   except (ValueError,TypeError):pass
   if height is not None and not (0<height<1000):height=None
  if typ=='Polygon':polygon(coordinates[0],layer+'_'+str(n),col,height)
  if typ=='MultiPolygon':
   for j,poly in enumerate(coordinates):polygon(poly[0],layer+'_'+str(n)+'_'+str(j),col,height)
  if typ=='LineString':line(coordinates,layer+'_'+str(n),col)
  if typ=='MultiLineString':
   for j,path in enumerate(coordinates):line(path,layer+'_'+str(n)+'_'+str(j),col)
bpy.context.scene['model_origin_lon']=lon;bpy.context.scene['model_origin_lat']=lat
bpy.context.scene['CRS_approximation']='local equirectangular meters; use projected GIS for survey accuracy'
bpy.context.scene['SOURCE_WARNING']='No building heights were inferred; polygons with holes are not fully modeled.'
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out.resolve()))
print('Saved',str(out.resolve()))

# Portable preview of the identical Blender scene. This does not add invented heights.
preview=out.with_suffix('.glb')
bpy.ops.export_scene.gltf(filepath=str(preview),export_format='GLB',use_selection=False)
if not preview.exists() or preview.stat().st_size==0:raise RuntimeError('GLB export missing')
print('GLB saved',str(preview.resolve()))


try:
 glb=out.with_suffix('.glb')
 bpy.ops.export_scene.gltf(filepath=str(glb.resolve()), export_format='GLB', export_apply=True)
 print('Saved GLB', str(glb.resolve()))
except Exception as e:
 print('GLB_EXPORT_FAILED:',str(e))
