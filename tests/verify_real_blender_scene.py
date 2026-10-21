"""Open Blender site .blend and verify real imported meshes."""
import bpy,sys
p=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=p)
meshes=[o for o in bpy.data.objects if o.type=="MESH"]
assert meshes, "No real building footprint meshes in Blender scene"
assert len(meshes)>=10, f"Unexpectedly few mapped footprints: {len(meshes)}"
print("REAL_OVERTURE_BLENDER_PASS",{"meshes":len(meshes),"file":p})
