# Changelog

All notable changes to this project will be documented in this file.

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
