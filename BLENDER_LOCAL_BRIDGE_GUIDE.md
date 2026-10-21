# MOORE GIS → Blender — 本地一键建模（Windows）

## 前提
- Windows 10/11 安装 Blender 4.x。
- 安装 Python 3.10+，用于运行本地桥接服务。
- 保持 MOORE 网站和本地桥接服务同时打开。
- 此版本使用 **GitHub Pages 网页 → 本地 HTTP Bridge → Blender 后台命令行**，不是 Blender 官方 MCP 协议实现；若希望接入已安装的 Blender MCP Server，需要另行设计 MCP 适配器。

## 启动本地服务
在仓库根目录运行（调整 Blender 实际安装目录）：

```powershell
python scripts/local_blender_bridge.py --blender "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

浏览器打开 `http://127.0.0.1:8765/health` 应得到 `status: ready`。

## 网页实际操作
1. 打开 https://holly-zz.github.io/moore-hainan-atlas/
2. 等待 GIS 图层完成加载，开启建筑、道路、土地利用。
3. 在 **范围筛选** 中使用矢量选框，先点两个角点；选择的矩形会作为建模 AOI。
4. 在 **GIS → BLENDER** 点击 **检测本地 Blender 桥接服务**。
5. 点击 **直接生成 Blender 模型**，然后点击 **刷新 Blender 生成进度**。
6. 显示 completed 时，点击 **下载生成的 .blend 模型**。

该操作不再需要先手动下载 JSON 再导入 Blender。JSON 数据包仍可通过备用按钮下载，便于审计或离线复现。

## 当前数据与精度限制
- 网页主要加载旧矩形中 OSM 矢量图层，**尚未连接四区完整 Overture 建筑数据**。空图层不会被自动补建。
- 缺乏真实 `height` 的建筑仅生成二维 footprint 网格，**不是已复原的 3D 城市**。
- 场地坐标转换使用局部平面近似，适合可视化原型，不可作为地籍/施工测量成果。
- 带孔 Polygon 的内部空洞未完全复原；复杂道路折线仅作视觉曲线。
- Blender 在本机后台运行，导出结果为 `.blend`。暂未实现网页内的 glTF/GLB 实时预览。
- 网页 HTTPS 对本机 HTTP 的请求在部分浏览器/防火墙设置下可能被拦截；检查浏览器控制台，勿将本地 Bridge 暴露公网。

## 安全
- 服务只监听 `127.0.0.1:8765`。
- 仅允许指定的网页 Origin，且不能从请求中指定要运行的程序或系统命令。
- 限制 JSON 请求体至 12 MB、要素数至 22,000，任务最长 480 秒。
- 处理文件存储于本地 `blender_jobs/<uuid>` 目录，可自行清理。
- 在本机运行 Blender 代码前，先审查仓库脚本和浏览器数据来源。
