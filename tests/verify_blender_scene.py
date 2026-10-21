"""Executed INSIDE Blender on generated .blend to assert real editable geometry."""
import bpy,sys
p=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=p)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
curves=[o for o in bpy.data.objects if o.type=='CURVE']
assert len(meshes)>=2, f"Expected >= 2 editable meshes, got {len(meshes)}"
assert len(curves)>=1, f"Expected road curve, got {len(curves)}"
assert any(o.get('height_source')=='OSM explicit height meters' for o in meshes)
print("BLENDER_SMOKE_PASS",{"mesh_count":len(meshes),"curve_count":len(curves),"file":p})
