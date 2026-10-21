/* Automatic candidate-area shortlist for Idol Residence, deliberately NOT legal parcels.
   Uses precomputed mapped indicators and stable study-cell reference, never random points. */
(()=>{
const $=id=>document.getElementById(id), agent=$('idolAgent');
if(!agent)return;
const pane=document.createElement('section');pane.innerHTML='<h2>自动初筛 / AUTO DISCOVERY</h2><div class="sub">先让 GIS 筛选候选区域，再让设计者核实真正可建设的地块。不会把 OSM 建筑缺漏当作“低密住宅优势”。</div><label>候选区域筛选范围</label><select id="autoStudy"><option value="study">当前发布的 500 m 研究网格（不等于海口四区全域）</option></select><button id="autoDiscover" class="primary wide">由数据自动筛选 3 个候选区域</button><div id="autoDiscoveryStatus" class="note">尚未筛选。先检查地图数据来源和研究范围。</div><div id="autoDiscoveryList"></div><button id="autoUse" class="wide">把 3 个区域送入 Agent 对比</button>';
agent.prepend(pane);
let shortlist=[],overlay=null,report=null;
const fields=['road_km_km2','green_pct','retail_km2','transit_km2'];
const isNum=x=>typeof x==='number'&&Number.isFinite(x);
const pct=(arr,value)=>{const s=arr.slice().sort((a,b)=>a-b);let lo=0,hi=0;for(const v of s){if(v<value)lo++;if(v<=value)hi++}return s.length?100*(lo+hi)/(2*s.length):null};
function fail(msg){$('autoDiscoveryStatus').textContent=msg}
function km(a,b){return turf.distance(turf.point(a),turf.point(b),{units:'kilometers'})}
$('autoDiscover').onclick=async()=>{
 try{
 fail('正在读取固定 500 m 研究网格与评分元数据…');
 const [a,b]=await Promise.all([fetch('./data/v15_grid.geojson',{cache:'no-store'}),fetch('./data/v15_grid_manifest.json',{cache:'no-store'})]);
 if(!a.ok||!b.ok)throw Error('网站尚未发布 500 m 网格，请查看 GitHub 构建。');
 const fc=await a.json(),manifest=await b.json(),fs=fc.features||[];
 if(!fs.length)throw Error('500 m 研究网格为空');
 const eligible=fs.filter(f=>fields.every(k=>isNum(f.properties?.[k])));
 if(eligible.length<12)throw Error('有效网格数量不足，不生成假候选地');
 const values=Object.fromEntries(fields.map(k=>[k,eligible.map(f=>f.properties[k])]));
 const rule=$('idolProfile')?.value||'private';
 const weights=rule==='artist'?{green:50,quiet:30,access:20}:rule==='social'?{green:20,quiet:20,access:60}:{green:35,quiet:45,access:20};
 // Low road density alone is not quiet; these are explicit provisional proxies.
 const ranked=eligible.map(f=>{
  const p=f.properties;
  const green=pct(values.green_pct,p.green_pct);
  const road=pct(values.road_km_km2,p.road_km_km2);
  const retail=pct(values.retail_km2,p.retail_km2);
  const transit=pct(values.transit_km2,p.transit_km2);
  const quiet=100-road;
  const access=(retail+transit)/2;
  const index=(weights.green*green+weights.quiet*quiet+weights.access*access)/100;
  const center=turf.centroid(f).geometry.coordinates;
  return {cell_id:p.cell_id,center,feature:f,raw:{green_pct:p.green_pct,road_km_km2:p.road_km_km2,retail_km2:p.retail_km2,transit_km2:p.transit_km2},proxy:{green,quiet,access},index};
 }).sort((a,b)=>b.index-a.index);
 // Ensure independent study areas, not three neighboring cells of the same cluster.
 const picks=[];for(const c of ranked){if(picks.every(q=>km(c.center,q.center)>=1.5))picks.push(c);if(picks.length===3)break}
 if(picks.length!==3)throw Error('无法找到 3 个至少相隔 1.5 km 的候选区域；请扩大可靠研究范围');
 shortlist=picks;report={schema:'moore-idol-auto-selection-v1',source_grid:'v15_grid.geojson',source_manifest:manifest,reference_count:eligible.length,weights,screening:'low OSM-mapped road length density + mapped green area share + service POI density',constraints:'Candidate centers are 500m cells, NOT developable land parcels',candidates:picks.map(({feature,...rest})=>rest)};
 $('autoDiscoveryList').replaceChildren();
 picks.forEach((c,i)=>{const btn=document.createElement('button');btn.className='wide';btn.style.textAlign='left';btn.textContent=String.fromCharCode(65+i)+' · 网格 '+c.cell_id+' · 代理指数 '+c.index.toFixed(1)+' | 绿地 '+c.raw.green_pct.toFixed(1)+'% / 路网 '+c.raw.road_km_km2.toFixed(1)+' km/km²';btn.onclick=()=>{map.setView([c.center[1],c.center[0]],14);if(overlay)overlay.eachLayer(l=>l.setStyle?.({weight:2}))};$('autoDiscoveryList').append(btn)});
 if(overlay)map.removeLayer(overlay);
 overlay=L.geoJSON({type:'FeatureCollection',features:picks.map((p,i)=>({...p.feature,properties:{...p.feature.properties,candidate:String.fromCharCode(65+i)}}))},{style:{color:'#c82b90',weight:2.5,fillColor:'#b761b7',fillOpacity:.28},onEachFeature:(f,l)=>l.bindTooltip('候选区域 '+f.properties.candidate)}).addTo(map);
 const bounds=overlay.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.2));
 fail('已在 '+eligible.length+' 个固定网格内选出 3 个至少相隔 1.5 km 的区域。注意：建筑覆盖率未经核验，未参与评分；道路稀疏≠安静，绿地映射≠景观视线；没有确认住宅用地及真实地块边界。不得将试验指数视为适宜性分。');
 }catch(e){shortlist=[];report=null;fail('自动筛选未完成：'+e.message)}
};
$('autoUse').onclick=()=>{
 if(shortlist.length!==3)return fail('请先运行自动筛选');
 const target=window.idolResidenceAgent?.candidates;if(!target)return fail('原 Agent 尚未加载');
 target.length=0;
 shortlist.forEach((c,i)=>target.push({name:'自动初筛区域 '+String.fromCharCode(65+i)+'（非建设地块）',coord:c.center,source:'V15 grid '+c.cell_id}));
 $('idolStatus').textContent=target.map(x=>x.name+' ['+x.coord.map(v=>v.toFixed(5)).join(', ')+']').join('\n');
 fail('已将三个候选区域送入 Agent。请统一半径计算并对实地地块开展独立核验；自动初筛不是住宅用地推荐证明。');
};
window.idolAutoDiscovery={get shortlist(){return shortlist},get report(){return report}};
})();