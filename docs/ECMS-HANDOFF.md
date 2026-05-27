# QiuAi-ECMS 开发交接文档

## 1. 项目定位

当前项目是 `QiuAi-ECMS`，不是原始的 `QiuAi` 图片工具。

目标方向：
- 以桌面应用形式承载电商内容生产工作流
- 保留原“生图”能力
- 在顶部扩展为多分页电商系统

当前主要分页：
- `选品`
- `文本`
- `生图`
- `视频`
- `草稿`
- `上架`

其中：
- `生图` 仍承载原项目核心内容
- `文本`、`视频` 版式需要尽量和 `生图` 保持一致
- `草稿` 已有基础联动
- `上架` 当前按用户要求先显示“待开发”

## 2. 当前技术栈

- Electron
- Vue 3
- Vite
- electron-store
- axios

关键入口：
- [package.json](D:/Workspace/QiuAi-ECMS/package.json)
- [main/main.js](D:/Workspace/QiuAi-ECMS/main/main.js)
- [main/src/bootstrap/registerIpc.js](D:/Workspace/QiuAi-ECMS/main/src/bootstrap/registerIpc.js)
- [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue)

## 3. 已完成的核心改造

### 3.1 品牌与版本

- 包名已切为 `qiuai-ecms`
- `productName` 已切为 `QiuAi-ECMS`
- 当前版本号为 `2.0.0`

### 3.2 顶部分页

已接入顶部分页导航，当前主要逻辑都在 [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue)。

### 3.3 文本功能

已接入文本工作台基础能力：
- 默认免费模型为 `GLM-4.7-Flash`
- 允许用户在文本工作台单独填写自己的 `GLM API Key`
- 文本“模型价格”卡片已加入用户要求的对话模型展示

注意：
- 收费模型的 API 和 API Key 不向终端用户暴露
- 只有 `GLM` 的用户自填 Key 入口允许开放

相关文件：
- [main/src/services/copywritingGenerationService.js](D:/Workspace/QiuAi-ECMS/main/src/services/copywritingGenerationService.js)
- [main/src/services/settingsStoreService.js](D:/Workspace/QiuAi-ECMS/main/src/services/settingsStoreService.js)
- [renderer/src/components/ecms/EcmsStudioPage.vue](D:/Workspace/QiuAi-ECMS/renderer/src/components/ecms/EcmsStudioPage.vue)

### 3.4 视频功能

已接入视频工作台基础能力：
- 使用 `Sora` 相关模型方向
- 管理员配置区支持单独保存视频 API Key
- 视频“模型价格”卡片已做展示

当前视频配置相关文件：
- [main/src/services/videoGenerationService.js](D:/Workspace/QiuAi-ECMS/main/src/services/videoGenerationService.js)
- [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue)

### 3.5 选品功能

当前重点开发最多的模块是 `选品`。

已接入平台：
- `TEMU`
- `SHEIN`
- `虾皮`
- `亚马逊`
- `速卖通`
- `TikTok`

已接入分类：
- `热销商品`
- `热销新品`
- `新店热销`
- `大卖新品`

关键文件：
- [main/src/services/sourcingProductService.js](D:/Workspace/QiuAi-ECMS/main/src/services/sourcingProductService.js)
- [renderer/src/components/ecms/HotProductsPage.vue](D:/Workspace/QiuAi-ECMS/renderer/src/components/ecms/HotProductsPage.vue)
- [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue)

## 4. 选品模块的重要约束

这些是用户明确强调过的，后续开发不要违背：

1. 不要向终端用户暴露目标选品网站的网址信息
2. 不要在 UI 中提供可直接回到榜单源站的按钮
3. 允许“查看商品”，但只能打开商品真正的电商平台 URL
4. 要尽量降低爬虫风险，避免对源站造成压力
5. 每个平台每个分类只展示前 `10` 个商品
6. 必须按“总销量”降序后再取前 `10`
7. 第一次打开可自动拉取，但要有安全延迟
8. 后续主要依赖本地缓存，避免频繁打源站

## 5. 选品模块当前实现状态

### 5.1 排序

已修复“没有按总销量排序”的问题。

当前排序逻辑：
- 主排序字段优先级包含 `sales`
- 其次是 `totalSold`
- 再次是 `sold`
- 再次是 `monthSold`

当前还做了三层兜底：
- 服务层排序
- 缓存写入前排序
- 前端展示前排序

### 5.2 缓存

选品缓存使用 `electron-store` 保存在：
- `C:\Users\admin\AppData\Roaming\QiuAi-ECMS\qiuai-settings.json`

缓存键在设置项里叫：
- `sourcingCache`

当前缓存有版本控制。
最近一次版本号为：
- `2026-05-27-total-sold-top10-v3-smt-preview`

只要后续你改了排序结构、图片结构、缓存结构，都建议继续推进版本号，强制淘汰旧缓存。

### 5.3 安全延迟与后台预取

`选品` 当前不是每次切换都立刻请求。

在 [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue) 中有这些关键状态：
- `SOURCING_SAFE_DELAY_MS`
- `sourcingRequestStateMap`
- `sourcingPrefetchState`
- `hasScheduledSourcingPrefetch`

当前策略：
- 首次打开当前页时，优先恢复本地缓存
- 如果缓存不存在或过期，则等待安全延迟后请求
- 当前分类请求后，再后台补其他平台和分类缓存

### 5.4 速卖通图片

“速卖通图片不显示”已修复。

根因：
- 速卖通接口有图
- 但前端直接热链 `aliexpress-media` 图片在 Electron 中不稳定

当前修复方案：
- 只对 `速卖通` 图片走主进程代理兜底
- 在服务层下载图片
- 转成 `data:` URL 后再返回给前端展示

相关实现：
- [main/src/services/sourcingProductService.js](D:/Workspace/QiuAi-ECMS/main/src/services/sourcingProductService.js)

## 6. 选品到后续业务的已接思路

用户明确希望这条链路最终成立：

1. 用户在 `选品` 页选择一个商品
2. 点击“一键编辑”
3. 标题自动送到 `文本`
4. 预览图自动送到 `生图/套图生成`
5. 生成后的标题、描述、套图任务进入 `草稿`

目前这条链路已做了基础版联动，但仍是简化实现，后续还需要细化规则。

## 7. 当前已知问题 / 风险

### 7.1 中文乱码

仓库里仍有不少中文字符串存在乱码，尤其旧文件里较多。
后续改文案时要谨慎，避免做大面积误替换。

### 7.2 lint 不是全绿

`build:renderer` 当前可通过。

但 `npm run lint` 仍有一些历史问题，不一定全部通过。
后续如果要收敛代码质量，需要单独清一轮。

### 7.3 工作区未提交改动较多

当前仓库是 dirty 状态，继续开发前一定先看：
- `git status`

不要误回滚用户已有改动。

## 8. 重要文件索引

### 主流程

- [renderer/src/App.vue](D:/Workspace/QiuAi-ECMS/renderer/src/App.vue)

### 选品页面

- [renderer/src/components/ecms/HotProductsPage.vue](D:/Workspace/QiuAi-ECMS/renderer/src/components/ecms/HotProductsPage.vue)
- [main/src/services/sourcingProductService.js](D:/Workspace/QiuAi-ECMS/main/src/services/sourcingProductService.js)

### 设置与缓存

- [main/src/services/settingsStoreService.js](D:/Workspace/QiuAi-ECMS/main/src/services/settingsStoreService.js)

### IPC 注册

- [main/src/bootstrap/registerIpc.js](D:/Workspace/QiuAi-ECMS/main/src/bootstrap/registerIpc.js)
- [main/src/ipc/studioIpc.js](D:/Workspace/QiuAi-ECMS/main/src/ipc/studioIpc.js)
- [main/src/ipc/settingsIpc.js](D:/Workspace/QiuAi-ECMS/main/src/ipc/settingsIpc.js)

### 文本 / 视频

- [main/src/services/copywritingGenerationService.js](D:/Workspace/QiuAi-ECMS/main/src/services/copywritingGenerationService.js)
- [main/src/services/videoGenerationService.js](D:/Workspace/QiuAi-ECMS/main/src/services/videoGenerationService.js)
- [renderer/src/components/ecms/EcmsStudioPage.vue](D:/Workspace/QiuAi-ECMS/renderer/src/components/ecms/EcmsStudioPage.vue)

## 9. 启动与验证

### 正常启动

在项目根目录执行：

```powershell
cd D:\Workspace\QiuAi-ECMS
npm run dev
```

### 如果 Electron 没自动弹出

```powershell
cmd /c "set ELECTRON_RUN_AS_NODE=& set NODE_ENV=development& set VITE_DEV_SERVER_URL=http://127.0.0.1:5173& .\node_modules\electron\dist\electron.exe ."
```

### 当前验证习惯

常用检查项：
- `npm run build:renderer`
- `git status --short`
- 检查 `http://127.0.0.1:5173`
- 检查 `Get-Process electron,node`

## 10. 后续建议优先级

如果继续开发，建议优先顺序如下：

1. 继续收口 `选品` 的 UI 文案和乱码
2. 补强 `选品 -> 文本/生图 -> 草稿` 的数据结构
3. 统一 `文本`、`视频` 和 `生图` 的版式细节
4. 完善 `草稿` 的分组与上架前结构
5. 最后再做 `上架`
