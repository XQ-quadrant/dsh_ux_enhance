# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-08-17

### Added
- **工作区文件树（含文件）** — 宿主半在 DSH webserver 上注册同源只读路由
  `GET /ux-enhance/tree?path=<cwd>`（递归含文件、限深 5 层、每目录 200 项、
  总量 3000 节点、跳过 `node_modules/.git/dist/__pycache__` 等、拒绝 `..`）；
  路由不可用时回退官方 `ctx.workspaces.listDirectory`（仅目录）
- **手机版文件树 tab** — ≤767px 时文件树以会话头部 tab「文件」出现
  （`conversation.view` 视图，与「对话/轨迹」同级），桌面不显示
- **树交互** — 单击：目录展开/收起 + 复制相对路径（手机轻点同样生效）；
  双击：系统文件管理器/默认应用打开；右键：复制相对路径；回车/空格同单击；
  复制后行尾闪现「✓ 已复制」

### Changed
- **会话颜色恢复侧边栏行配置** — 颜色存根作用域 `defineStore({ persist })`
  映射并一次性迁移旧 `dsh.sessionColor.v1`（已有颜色保留）；painting 订阅
  store + `ctx.sessions.list` 响应式刷新
- **桌面两栏布局** — 文件树位于右栏顶部（随右栏高度伸展）；输入框默认高度
  180px→220px；输入卡（含两行 token 统计）`flex-shrink:0` 不被压缩
- **host 半** — 从 no-op 恢复为工作区树服务（同源路由，无额外端口/CORS）

### Removed
- 临时诊断日志（保留 `[ux-enhance] apply` 启动日志与路由回退警告各一条）

### Known Limitations
- 布局优化依赖构建期哈希类名（`wSkVaW_*` 等），DSH 升级后可能需要更新
- 「含文件」目前靠宿主半 shim；原生 `listDirectory` 只返回目录，上游方案见
  `docs/upstream-proposals.md` PR 2
- 会话颜色的行级动作仍无公开槽（上游 PR 1）

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
