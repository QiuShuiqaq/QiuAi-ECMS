# QiuAi-ECMS 授权体系一期设计

## 目标

- 将授权从旧生图工作流中抽离，提升为整个 `QiuAi-ECMS` 的全局授权中心。
- 用户端只保留“查看、导入、刷新、复制设备码”能力。
- 管理员端单独做 `QiuAi-License-Manager`，负责签发授权，不向用户交付私钥。

## 当前一期范围

- 用户端桌面应用：
  - 启动即校验授权。
  - 未授权、过期、设备不匹配时，优先进入授权中心。
  - 已授权状态可从顶部“激活状态”进入授权中心查看详情。
- 授权文件：
  - 继续兼容旧版 `version: 1` 授权。
  - 新增 `version: 2` 结构，支持版本、模块、到期时间等字段。

## version 2 授权文件结构

```json
{
  "version": 2,
  "product": "QiuAi-ECMS",
  "licenseId": "LIC-20260527-001",
  "customerId": "CUS-001",
  "customerName": "Demo Customer",
  "edition": "professional",
  "deviceCode": "QAI-XXXX",
  "activatedAt": "2026-05-27T12:00:00.000Z",
  "expireAt": "2027-05-27T12:00:00.000Z",
  "maxVersion": "2.x",
  "modules": ["sourcing", "text", "image", "video", "draft"],
  "features": ["priority-support"],
  "remark": "备注",
  "signature": "base64..."
}
```

## 用户端状态模型

- `loading`
- `not_found`
- `activated`
- `expired`
- `mismatch`
- `invalid`

## 模块建议键名

- `sourcing`
- `text`
- `image`
- `video`
- `draft`
- `listing`

## 管理员授权工具建议页面

### 客户

- 客户名称
- 联系方式
- 备注
- 历史授权

### 新建授权

- 客户
- 设备码
- 版本
- 授权编号
- 到期时间
- 可用模块
- 功能项
- 备注
- 导出授权文件

### 授权管理

- 搜索授权编号
- 搜索客户
- 搜索设备码
- 查看详情
- 续期
- 升级
- 作废
- 导出

### 换机处理

- 原设备码
- 新设备码
- 标记原授权为替换
- 生成新授权

## 安全边界

- 私钥仅存在管理员授权工具或离线安全环境。
- `QiuAi-ECMS` 仅保留公钥验签。
- 用户端不可生成授权。
- 后续如需联网，可在 `version: 2` 基础上增加撤销列表与在线刷新能力。
