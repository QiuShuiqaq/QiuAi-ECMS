# Implementation Plan: QiuAi 选品助手 v1

## Overview

基于已确认的双仓 spec，实现一套“服务端榜单快照 + 客户端工作台选品入口”的最小可用版本。实现范围严格限定在 `QiuAi` 客户端与 `qiu-commerce-license-platform` 授权体系，不进入服务端官网首页公开信息架构。

## Architecture Decisions

- 选品助手不做顶层导航，只作为 `workspace` 内的素材入口
- 客户端只消费服务端规范化快照，不直接接触第三方站点
- 服务端采用“平台适配器 + 快照存储 + 授权接口”结构
- Shopee 将 `siteCode` 作为一级维度
- 客户端采用 manifest 比对 + 本地快照缓存

## Task List

### Phase 1: Shared Contract And Server Foundation

- [ ] Task 1: 定义共享平台/榜单/站点契约常量
  - Acceptance:
    - `QiuAi` 与服务端均使用统一的平台、榜单、站点标识
    - Shopee 站点枚举具备独立配置入口
  - Verify:
    - 定向 source test 或 unit test 通过
  - Files:
    - `QiuAi/shared/`
    - `qiu-commerce-license-platform/src/...` 或等效共享常量位置

- [ ] Task 2: 服务端新增选品快照数据表与 Prisma 模型
  - Acceptance:
    - 可存储原始快照、榜单快照、榜单商品、站点配置
    - 不影响现有生产授权数据结构
  - Verify:
    - Prisma schema 校验通过
    - 迁移文件生成成功
  - Files:
    - `qiu-commerce-license-platform/prisma/schema.prisma`
    - `qiu-commerce-license-platform/prisma/migrations/...`

- [ ] Task 3: 服务端建立选品模块目录与快照服务骨架
  - Acceptance:
    - 新增 selection 模块目录
    - 至少包含 adapter 接口、snapshot service、manifest service 骨架
  - Verify:
    - 服务端测试可运行
  - Files:
    - `qiu-commerce-license-platform/src/.../selection/...`

### Checkpoint: Server Foundation

- [ ] Prisma 与服务端测试在未接入真实采集前保持通过
- [ ] 选品模块与现有官网首页路由无耦合

### Phase 2: Server Snapshot Pipeline And Authorized API

- [ ] Task 4: 实现平台适配器接口与至少一组静态/假数据适配器
  - Acceptance:
    - 适配器输出统一商品结构
    - 支持 `platform + boardType + siteCode`
  - Verify:
    - adapter unit tests 通过
  - Files:
    - `qiu-commerce-license-platform/src/.../selection/adapters/...`
    - `qiu-commerce-license-platform/tests/...`

- [ ] Task 5: 实现 manifest 生成与榜单商品查询服务
  - Acceptance:
    - 可根据快照生成 manifest
    - 可分页查询商品列表与单商品详情
  - Verify:
    - service tests 通过
  - Files:
    - `qiu-commerce-license-platform/src/.../selection/services/...`

- [ ] Task 6: 实现仅授权客户端可访问的选品 API
  - Acceptance:
    - 提供 `manifest/platforms/sites/items/item-detail` 接口
    - 未授权访问被拒绝
    - 官网首页不新增任何公开入口
  - Verify:
    - route/integration tests 通过
  - Files:
    - `qiu-commerce-license-platform/src/.../routes/...`
    - `qiu-commerce-license-platform/tests/...`

- [ ] Task 7: 实现图片代理或可替换的图片访问层
  - Acceptance:
    - 客户端拿到的是服务端控制后的图片地址
    - 不要求本期完成对象存储转存
  - Verify:
    - route/service tests 通过
  - Files:
    - `qiu-commerce-license-platform/src/.../selection/...`

### Checkpoint: Authorized API

- [ ] 客户端接口契约固定
- [ ] 授权失败路径明确
- [ ] 官网首页无功能暴露

### Phase 3: Desktop Client Integration

- [ ] Task 8: 客户端新增选品助手桥接契约与本地缓存服务
  - Acceptance:
    - main/preload/renderer 间具备选品 manifest、列表、详情、缓存同步桥接
    - 支持本地快照缓存
  - Verify:
    - desktop bridge tests 通过
  - Files:
    - `QiuAi/renderer/src/services/desktopBridge.js`
    - `QiuAi/main/src/ipc/...`
    - `QiuAi/main/src/services/...`

- [ ] Task 9: 在工作台中新增选品助手入口与面板 UI
  - Acceptance:
    - 不新增顶层导航
    - 可在工作台中打开选品助手
    - 支持平台/榜单/站点/关键词筛选
  - Verify:
    - renderer source/component tests 通过
    - renderer build 通过
  - Files:
    - `QiuAi/renderer/src/components/ProductWorkbench.vue`
    - `QiuAi/renderer/src/components/...`
    - `QiuAi/renderer/src/App.vue`

- [ ] Task 10: 实现商品带入当前项目与新建项目带入
  - Acceptance:
    - 商品字段正确映射到 `workspace` 项目草稿
    - Shopee 站点、平台、关键词、摘要进入项目元数据或草稿
  - Verify:
    - main/renderer tests 通过
  - Files:
    - `QiuAi/renderer/src/...`
    - `QiuAi/main/src/services/...`

### Checkpoint: Desktop Integration

- [ ] 用户可在工作台内完成“查看榜单 -> 选商品 -> 带入项目”
- [ ] 离线时如缓存存在可读取最近一次数据

### Phase 4: End-To-End Wiring And Verification

- [ ] Task 11: 接通服务端真实授权接口与客户端拉取逻辑
  - Acceptance:
    - manifest 版本一致时命中缓存
    - 版本变化时更新对应快照
  - Verify:
    - 联调验证通过
  - Files:
    - 双仓相关 API client / bridge / service

- [ ] Task 12: 完成最小端到端验收与文档补充
  - Acceptance:
    - 完成开发文档或使用说明更新
    - 形成最小上线前验收记录
  - Verify:
    - 全量测试通过
    - `QiuAi` renderer build 通过
  - Files:
    - `QiuAi/docs/...`
    - `qiu-commerce-license-platform/docs/...`

### Checkpoint: Complete

- [ ] 服务端快照接口仅在授权体系内开放
- [ ] 客户端工作台内可使用选品助手
- [ ] 官网首页无入口暴露
- [ ] 双仓相关测试通过

## Risks And Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 上游站点结构变化 | High | 平台适配器独立、原始快照留存、支持单平台停用 |
| Shopee 站点维度复杂 | Medium | 一开始就把 `siteCode` 纳入统一模型 |
| 客户端入口做成新岛 | Medium | 强制只挂在 `workspace` 内 |
| 数据缓存不一致 | Medium | 使用 manifest 版本比对而不是盲目轮询 |
| 服务端官网路由误暴露 | High | 选品接口只挂授权客户端路由，不进首页信息架构 |

## Open Questions

- V1 是否需要“新建项目并带入”和“带入当前项目”同时上线
- 图片代理是否直接走当前应用，还是抽出单独资源访问层
