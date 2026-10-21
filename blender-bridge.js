/* Export selected AOI as a source-based Blender scene GIS bundle. */
(()=>{
const panel=document.querySelector('main > aside');if(!panel)return;
const section=document.createElement('section');section.innerHTML='<h2>08 / GIS → BLENDER</h2><div class="sub">使用上方矢量选框或行政区选择；导出真实 GIS 地物。建筑没有 height/levels 时只生成平面轮廓，绝不虚构高度。</div><button id="blenderConnect" class="wide">检测本地 Blender 桥接服务</button><button id="blenderGenerate" class="primary wide">直接生成 Blender 模型</button><button id="blenderExport" class="wide">备用：下载场地 JSON 数据包</button><a id="blenderDownload" class="wide" href="#" style="display:none">下载生成的 .blend 模型</a><div id="blenderInfo" class="note">请先绘制或选择范围。导出为 JSON，可使用仓库中的 Blender 导入脚本生成模型。</div>';panel.append(section);
const $=id=>document.getElementById(id);
function prepare(){
 const mask=window.spatialMask?.area;if(!mask)throw Error('尚无选框。先到范围筛选绘制矩形/选中多边形。');
 if(!window.turf)throw Error('Turf 载入失败');
 const keys=['buildings','roads','commercial','residential','industrial','green','agriculture','other_landuse','water'],out={};
 for(const key of keys){const features=layers[key]?.toGeoJSON()?.features||[];const subset=[];for(const f of features){try{if(!f.geometry||!turf.booleanIntersects(f,mask))continue;let clipped;if(f.geometry.type.includes('Polygon'))clipped=turf.intersect(turf.featureCollection([f,mask]));else clipped=f;if(clipped?.geometry)subset.push(clipped)}catch(e){}}out[key]={type:'FeatureCollection',features:subset}}
 const payload={schema:'moore-blender-site-v1',crs:'EPSG:4326',selection:mask,layers:out,metadata:{source:'OSM Geofabrik study data',warning:'Only currently loaded clipped research-area vectors; not a complete four-district model. Building heights absent unless attributes explicitly carry them. Line clipping still approximate.',generated_at:new Date().toISOString()}};
 return payload;}
$('blenderExport').onclick=()=>{try{const payload=prepare();const out=payload.layers;const keys=Object.keys(out); const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='moore-blender-site.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('blenderInfo').textContent='已导出：'+keys.map(k=>k+' '+out[k].features.length).join(' · ')+'。数据包已保存。';}catch(e){$('blenderInfo').textContent=e.message}};
async function enrichOverturePilot(payload){
 const center=[110.302509,20.029762];
 const p=turf.point(center);
 let outside=false;
 // Only accept selection coordinates within this static 500m Overture pilot.
 turf.coordEach(payload.selection,c=>{if(turf.distance(p,turf.point(c),{units:'kilometers'})>.515)outside=true});
 if(outside)return;
 try{
  const response=await fetch('./data/pilot_overture_500m.geojson');
  if(!response.ok)return;
  const g=await response.json(),inside=[];
  for(const feature of g.features||[]){
   try{if(!turf.booleanIntersects(feature,payload.selection))continue;
    const geom=turf.intersect(turf.featureCollection([feature,payload.selection]));
    if(geom?.geometry){geom.properties={...feature.properties};inside.push(geom)}
   }catch(e){}
  }
  if(inside.length){payload.layers.buildings={type:'FeatureCollection',features:inside};payload.metadata.source_buildings='Overture Maps 500m candidate pilot';payload.metadata.height_policy='height only when explicit; floor count never silently converted'}
 }catch(e){console.warn('Overture pilot unavailable',e)}
}
const url='http://127.0.0.1:8765';let activeJob=null;
$('blenderConnect').onclick=async()=>{try{const r=await fetch(url+'/health');if(!r.ok)throw Error('HTTP '+r.status);$('blenderInfo').textContent='已连接本地 Blender 桥接：'+(await r.json()).status}catch(e){$('blenderInfo').textContent='无法连接本地服务。请先在电脑上运行 scripts/local_blender_bridge.py：'+e.message}};
$('blenderGenerate').onclick=async()=>{const button=$('blenderGenerate');button.disabled=true;try{const payload=prepare();await enrichOverturePilot(payload);$('blenderInfo').textContent='上传已选场地数据到本机 Blender…';const r=await fetch(url+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const response=await r.json();if(!r.ok)throw Error(response.error||'服务拒绝');activeJob=response.id;$('blenderDownload').style.display='none';$('blenderInfo').textContent='Blender 已接受任务 '+activeJob+'。点击下方按钮查询进度。';$('blenderPoll').hidden=false}catch(e){$('blenderInfo').textContent='生成失败：'+e.message}finally{button.disabled=false}};
const poll=document.createElement('button');poll.id='blenderPoll';poll.className='wide';poll.textContent='刷新 Blender 生成进度';poll.hidden=true;$('blenderInfo').after(poll);
poll.onclick=async()=>{if(!activeJob)return;try{const r=await fetch(url+'/jobs/'+activeJob);if(!r.ok)throw Error('查询失败');const d=await r.json();$('blenderInfo').textContent='任务 '+activeJob+' · '+d.status+(d.error?'：'+d.error:'');if(d.status==='completed'){$('blenderDownload').href=url+'/jobs/'+activeJob+'/site.blend';$('blenderDownload').style.display='block';poll.hidden=true;$('blenderPreviewButton').style.display='block'}}catch(e){$('blenderInfo').textContent='状态获取失败：'+e.message}};
$('blenderPreviewButton').onclick=async()=>{if(!activeJob)return;try{const res=await fetch(url+'/jobs/'+activeJob+'/site.glb');if(!res.ok)throw Error('GLB 服务未返回文件');const blob=await res.blob();if(window.__blenderGLBUrl)URL.revokeObjectURL(window.__blenderGLBUrl);window.__blenderGLBUrl=URL.createObjectURL(blob);$('blenderViewer').src=window.__blenderGLBUrl;$('blenderViewer').style.display='block';$('blenderInfo').textContent='已加载本机 Blender 导出的 GLB。只有数据源显式提供高度才挤出建筑。'}catch(e){$('blenderInfo').textContent='GLB 预览失败：'+e.message}};
})();