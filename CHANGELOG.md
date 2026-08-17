# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-08-17

### Changed
- **会话颜色** — 改用官方扩展面：`ctx.slots.register` 注册进会话头部动作槽
  （`conversation.session.header.actions`），颜色存入框架 `defineStore({ persist })`
  会话级 store；不再注入会话行「⋯」菜单、不再用文本反查会话 id
- **音效设置** — 开关/音量改由框架 store 持久化（沿用 `dsh.soundAlert.v1` 键），
  状态 diff 逻辑不变
- **工作区文件树** — 迁到 `conversation.input.dock` 槽组件，数据改用官方
  `ctx.workspaces.listDirectory`（仅目录；宿主 API 不返回文件）
- **跳到底部按钮** — 迁到 `shell.overlay` 浮层槽组件
- **宿主半** — `lib/index.js` 清为 no-op，移除 47991–47995 本地 HTTP server
  与文件监听
- 移除所有 `dsh-session-color` 遗留命名；bundle 模块 id 统一为 `dsh_ux_enhance`

### Removed
- `lib/workspace-tree.json`（死数据）及 `scripts/list-files.mjs` 的写文件逻辑

### Known Limitations
- 布局优化依赖构建期哈希类名（`wSkVaW_*` 等），DSH 升级后可能需要更新
- 会话颜色的侧边栏行染色暂缺：需上游暴露 `data-session-id` / `session.row` 槽
- 工作区文件树仅显示目录层级（宿主 `listDirectory` 不返回文件）

## [0.1.0] - 2024-08-16

### Added

- **侧边栏会话颜色** — 会话行「⋯」菜单注入「设置颜色」，10 色预设 + 清除，颜色存 localStorage
- **音效提示** — `running` true→false 播「叮-咚」，`pendingInteraction` 变为 question/plan-review 播「叮-叮」；Web Audio 合成，音量/开关可配置
- **PC 版布局优化** — 消息列加宽至 900px，改为左右两栏：左侧消息流、右侧输入框+统计区；悬浮「跳到底部」按钮
- **工作区文件目录面板** — PC 端右侧栏显示工作区文件树（如 DSH 提供 workspace/project/files API）
- **手机版界面适配** — ≤767px 回退原生单栏，通过 CSS 变量（`--dshsc-mobile-*`）优化字号和间距

### Known Limitations
- 依赖 `dsh-client-ui-workspace` DOM 结构，DSH 升级后可能失效
- 会话识别用最长 `displayTitle` 匹配，标题重复时可能串行
- 设置项存储在 `localStorage`，不跨设备同步
