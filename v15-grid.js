/* V15 500 m normalized comparison grid (provisional OSM source). */
(()=>{
const $=id=>document.getElementById(id);
const pane=document.querySelector('#rightPanel')||document.querySelector('main > aside');if(!pane)return;
const panel=document.createElement('section');panel.innerHTML='<h2>V15 / UNIFIED 500 M GRID</h2><div class="sub">统一投影网格 · 同一批网格经验百分位 · 原始五项指标 · 数据不完整时标记为试验评分</div><div class="actions"><button id="gridLoad" class="primary">显示统一评分格网</button><button id="gridHide">关闭格网</button></div><label>查看专题</label><select id="gridMetric"><option value="score">综合评分（试验）</option><option value="building_pct">建筑面覆盖率</option><option value="road_km_km2">道路长度密度</option><option value="transit_km2">交通站点密度</option><option value="retail_km2">购物 POI 密度</option><option value="green_pct">绿地面覆盖率</option></select><div id="gridLegend" class="note">先点击「显示统一评分格网」。</div><div id="gridDetail" class="note">点击网格，查看原始数值、百分位、得分与数据来源。</div><button id="gridExport" class="wide">导出评分 GeoJSON</button><button id="gridManifest" class="wide">导出归一化规则 JSON</button>';
pane.prepend(panel);
let raw=null,meta=null,shown=null;let previous={};
const metrics={score:'综合分',building_pct:'建筑面占比 %',road_km_km2:'道路 km/km²',transit_km2:'交通站点 个/km²',retail_km2:'零售 POI 个/km²',green_pct:'绿地占比 %'};
const ramp=['#edf0df','#c4d2b8','#86b99a','#3d997e','#13604f'];
function normalize(val,key){if(key==='score')return Math.min(1,Math.max(0,Number(val)/100));const v=meta?.reference_distribution?.[key];if(!v||v.max===v.min)return .5;return Math.max(0,Math.min(1,(Number(val)-v.min)/(v.max-v.min)))}
function style(f){const k=$('gridMetric').value,t=normalize(f.properties[k],k);return {color:'#485e55',weight:.35,fillColor:ramp[Math.min(4,Math.floor(t*5))],fillOpacity:.72}}
function showDetail(f){const p=f.properties;const rows=['building_pct','road_km_km2','transit_km2','retail_km2','green_pct'];$('gridDetail').textContent='网格 '+p.cell_id+'\n试验综合评分 '+p.score+'/100\n'+rows.map(k=>metrics[k]+': '+Number(p[k]).toFixed(2)+' | 全域百分位 '+p['pctile_'+k]).join('\n')+'\n基准：当前同批次全部有效 500m 网格。OSM 缺漏会影响排名；不是开发许可或真实人流评估。';}
function update(){if(!shown)return;shown.setStyle(style);const k=$('gridMetric').value;const ref=meta?.reference_distribution?.[k];$('gridLegend').textContent='当前专题：'+metrics[k]+'。\n'+(k==='score'?'颜色按 0–100 试验分数':'本批次观测值范围 '+(ref?ref.min+'–'+ref.max:'未知'))+'\n'+ramp.map((c,i)=>(i*20)+'–'+((i+1)*20)).join(' / ')+'\n研究范围仍是旧矩形，不是三区完整行政覆盖。'}
async function fetchGrid(){if(raw)return;const [a,b]=await Promise.all([fetch('./data/v15_grid.geojson',{cache:'no-store'}),fetch('./data/v15_grid_manifest.json',{cache:'no-store'})]);if(!a.ok||!b.ok)throw Error('网格数据未发布，请检查 GitHub Actions');raw=await a.json();meta=await b.json();if(!Array.isArray(raw.features)||!raw.features.length)throw Error('网格数据为空')}
$('gridLoad').onclick=async()=>{try{$('gridLegend').textContent='加载与绘制中…';await fetchGrid();if(shown)map.removeLayer(shown);shown=L.geoJSON(raw,{style,onEachFeature:(f,l)=>l.on('click',()=>showDetail(f))}).addTo(map);shown.bringToFront();update();$('gridLegend').textContent+='\n共 '+raw.features.length+' 个可比较网格';}catch(e){$('gridLegend').textContent='失败：'+e.message}};
$('gridHide').onclick=()=>{if(shown)map.removeLayer(shown);shown=null;$('gridLegend').textContent='评分格网已隐藏。原始图层不变。'};
$('gridMetric').onchange=update;
$('gridExport').onclick=()=>{if(raw&&typeof download==='function')download('haikou_v15_500m_grid.geojson',raw);else $('gridLegend').textContent='请先加载统一格网'};
$('gridManifest').onclick=()=>{if(meta&&typeof download==='function')download('haikou_v15_scoring_manifest.json',meta);else $('gridLegend').textContent='请先加载统一格网'};
})();