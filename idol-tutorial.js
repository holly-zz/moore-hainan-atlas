/* Classroom guided workflow for Idol Residence Agent V1. */
(()=>{const $=id=>document.getElementById(id);const target=$('idolAgent');if(!target)return;
const s=document.createElement('section');s.id='idolTutorial';s.innerHTML='<h2>课堂操作演示 / WORKSHOP WALKTHROUGH</h2><div class="sub">按照顺序操作，不随机生成候选地，不伪造实际测量结果。</div><div id="tutorialProgress" class="note">步骤 1 / 7</div><div id="tutorialInstruction" class="note"></div><div class="actions"><button id="tutorialPrev">上一步</button><button id="tutorialNext" class="primary">下一步</button></div><button id="tutorialAction" class="wide">执行当前步骤</button><div id="tutorialValidation" class="note">操作检查将在这里显示。</div><details><summary>三处候选地记录与现场核验清单</summary><div class="sub">A / B / C 候选位置统一评价半径。需要核实：真实地块边界、住宅法定用途、面积与退界、噪声、视线遮挡、地形排水、出入口权限和周边道路实际通行。</div></details>';
target.prepend(s);let index=0;
const steps=[
{title:'加载真实 GIS 图层',body:'左侧打开道路、绿地、建筑轮廓和医疗/零售 POI。仅凭截图或缺失图层无法评分。',action:'检查图层加载',run:()=>{const keys=['roads','green','poi_health','poi_retail'];const missing=keys.filter(k=>!layers[k]);return missing.length?'缺少：'+missing.join('、')+'。请先点击背景图层加载并检查数据诊断。':'道路、绿地及服务 POI 数据已加载。'}},
{title:'核查三个真实候选位置',body:'在地图中寻找三处有代表性的低密环境，分别点击地物核对属性。这里只记录候选位置，不承诺该地块允许建设。',action:'检查当前选中要素',run:()=>typeof selected!=='undefined'&&selected?.layer?'已选择：'+(selected.layer.feature?.properties?.name||'未命名 OSM 地物')+'。请到下方 Agent 点“加入当前选址”。':'地图中尚未选中任何要素。'},
{title:'加入 A、B、C 三个候选地',body:'每次点击真实地图要素后，点 Agent 的“加入当前选址”。至少三处才可比较。注意不能把 POI 当成合法地块边界。',action:'检查候选数量',run:()=>{const n=window.idolResidenceAgent?.candidates?.length||0;return n>=3?'已选择 '+n+' 处候选，进入统一指标计算。':'当前 '+n+' / 3 处，仍需添加 '+(3-n)+' 处。'}},
{title:'固定分析尺度和主人类型',body:'建议课堂首轮统一选 1000 m。选择“演员/歌手”“创作者”或“社交型”，观察权重如何改变判断。',action:'检查设定',run:()=> '当前半径 '+$('idolRadius').value+' m；人物类型 '+$('idolProfile').selectedOptions[0].textContent+'。'},
{title:'计算真实代理指标',body:'点 Agent 的“测量并比较候选位置”。检查道路长度密度、绿地面比例和服务 POI 密度，若缺图层应为 N/A。',action:'检查计算结果',run:()=>window.idolResidenceAgent?.report?'已形成对比数据。正式住宅适宜性依旧 N/A，需单独核查场地合法性。':'尚未计算；请点击 Agent 的测量比较按钮。'},
{title:'导出可编辑 A3 图与证据',body:'点击“导出评分 JSON”与“导出 A3 SVG”，在 Illustrator 或 Inkscape 里进一步排版。V1 的 A3 是数值比较板，不是已经完成的五张 GIS 专题图。',action:'核对结果',run:()=>window.idolResidenceAgent?.report?'可以导出：比较 JSON 与 A3 SVG。':'必须先成功计算比较结果。'},
{title:'人工核验选址适宜性',body:'最后列出必须现场或官方核实的内容：地块建设合法性、准确地界、噪声、真实视野、道路接入、排水、退界和安全性。未经核验不得宣称“最适合建豪宅”。',action:'显示验收提示',run:()=> '交付标准：3 个候选地 + 同半径原始指标 + 缺失数据说明 + A3 SVG + GIS 来源 + 待核实清单。'}];
function render(){const st=steps[index];$('tutorialProgress').textContent='步骤 '+(index+1)+' / '+steps.length+' · '+st.title;$('tutorialInstruction').textContent=st.body;$('tutorialAction').textContent=st.action;$('tutorialPrev').disabled=index===0;$('tutorialNext').disabled=index===steps.length-1}
$('tutorialPrev').onclick=()=>{index=Math.max(0,index-1);render()};
$('tutorialNext').onclick=()=>{index=Math.min(steps.length-1,index+1);render()};
$('tutorialAction').onclick=()=>{$('tutorialValidation').textContent=steps[index].run()};
render();
})();