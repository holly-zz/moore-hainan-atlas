/* Export selected AOI as a source-based Blender scene GIS bundle. */
(()=>{
const panel=document.querySelector('main > aside');if(!panel)return;
const section=document.createElement('section');section.innerHTML='<h2>08 / GIS → BLENDER</h2><div class="sub">使用上方矢量选框或行政区选择；导出真实 GIS 地物。建筑没有 height/levels 时只生成平面轮廓，绝不虚构高度。</div><button id="blenderExport" class="primary wide">导出框选场地 Blender 数据包</button><div id="blenderInfo" class="note">请先绘制或选择范围。导出为 JSON，可使用仓库中的 Blender 导入脚本生成模型。</div>';panel.append(section);
const $=id=>document.getElementById(id);
$('blenderExport').onclick=()=>{
 const mask=window.spatialMask?.area;if(!mask)return $('blenderInfo').textContent='尚无选框。先到「范围筛选」绘制矩形/选中矢量面。';
 if(!window.turf)return $('blenderInfo').textContent='Turf 载入失败';
 const keys=['buildings','roads','commercial','residential','industrial','green','agriculture','other_landuse','water'],out={};
 for(const key of keys){const features=layers[key]?.toGeoJSON()?.features||[];const subset=[];for(const f of features){try{if(!f.geometry||!turf.booleanIntersects(f,mask))continue;let clipped;if(f.geometry.type.includes('Polygon'))clipped=turf.intersect(turf.featureCollection([f,mask]));else clipped=f;if(clipped?.geometry)subset.push(clipped)}catch(e){}}out[key]={type:'FeatureCollection',features:subset}}
 const payload={schema:'moore-blender-site-v1',crs:'EPSG:4326',selection:mask,layers:out,metadata:{source:'OSM Geofabrik study data',warning:'Only currently loaded clipped research-area vectors; not a complete four-district model. Building heights absent unless attributes explicitly carry them. Line clipping still approximate.',generated_at:new Date().toISOString()}};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='moore-blender-site.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('blenderInfo').textContent='已导出：'+keys.map(k=>k+' '+out[k].features.length).join(' · ')+'。Blender 中用仓库 scripts/import_site_blender.py 导入。';
};
})();