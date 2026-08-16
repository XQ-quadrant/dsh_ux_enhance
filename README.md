# dsh_ux_enhance

[![CI](https://github.com/XQ-quadrant/dsh_ux_enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/XQ-quadrant/dsh_ux_enhance/actions)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

DSH 会话界面增强插件，不改 DSH 核心，纯客户端注入。

---

## 五大核心功能

### 1. PC 版布局优化
- 加宽消息列（748px → 900px）
- 改为左右两栏布局：左侧消息流，右侧输入框 + 统计区
- 悬浮「跳到底部」按钮，不丢上下文
- 工作区文件目录面板（PC 端显示于输入框右侧）

![PC效果](PC效果.png)

### 2. 手机版界面适配
- ≤767px 自动回退为原生单栏布局
- 通过 `--dshsc-mobile-*` CSS 变量缩小字号、收紧间距
- 保证手机端核心操作流畅

![手机效果1](手机效果1.png)
![手机效果2](手机效果2.png)

### 3. 侧边栏会话颜色
- 会话行「⋯」菜单注入「设置颜色」入口
- 10 种预设色 + 清除按钮
- 颜色存入 `localStorage`，浏览器重启后保留

### 4. 音效提示
- **完成音**：`running` true → false（每轮对话跑完），上行双音「叮-咚」
- **提问音**：`pendingInteraction` 变为 `question` / `plan-review`，两声短促「叮-叮」
- Web Audio 合成，无需外部音频文件
- 可通过 `localStorage` 开关或调节音量（`dsh.soundAlert.v1`）

### 5. 工作区文件目录面板
- PC 端右侧栏显示工作区文件树（如 DSH 上下文提供 `workspace/project/files` API）
- 手机端自动隐藏，不干扰主流程

---

## 工作原理

- 宿主半 `lib/index.js`：空 `apply`，仅让本包成为 cordis Loader 条目，供
  `dsh-client-modules` 的 node 半扫描 `dsh.client` 声明并下发浏览器半。
- 浏览器半 `lib/client.js`：注册为懒加载工厂包。它用 MutationObserver 监听
  会话行「⋯」菜单弹出，向其中注入「设置颜色」；点击后用 `react-dom/client`
  渲染一个自绘色板弹层；颜色写入 `localStorage` 后给对应行上背景色。
- 音效模块订阅 `ctx.sessions.list`，对每个会话做状态 diff，只对**状态跳变**发声。

## 目录结构

```
dsh_ux_enhance/
├── lib/
│   ├── index.js          # 宿主半（空 apply）
│   ├── client.js         # 浏览器半 bundle（由 scripts/build.mjs 生成）
│   ├── entry.js          # 浏览器端入口，组合三个功能模块
│   ├── session-color.js  # 功能1：侧边栏会话颜色
│   ├── layout-ui.js      # 功能2：PC 布局 + 手机适配 + 文件目录面板
│   └── sound-alert.js    # 功能3：音效提示
├── scripts/
│   └── build.mjs         # node scripts/build.mjs 生成 lib/client.js
└── package.json
```

> 修改源码后运行 `node scripts/build.mjs` 重新生成 `lib/client.js`，再提交。

## 安装（web profile）

以 Windows、插件放在 `D:\workspace\DSH\dsh_ux_enhance` 为例：

1. 把插件链接进 profile（`~/.dsh/profiles/web/package.json` 的 `dependencies`）：

   ```json
   {
     "dependencies": {
       "dsh_ux_enhance": "link:D:/workspace/DSH/dsh_ux_enhance"
     }
   }
   ```

2. 在 profile 的补丁层插入该插件（`~/.dsh/profiles/web/cordis.patch.yml`）：

   ```yaml
   - insert:
       - id: ux-enhance
         name: 'dsh_ux_enhance'
   ```

3. 在 profile 目录安装：

   ```powershell
   cd $env:USERPROFILE\.dsh\profiles\web
   pnpm install
   ```

4. 重启 DSH web（插件集合的变化在重启后生效）。

## 音效配置（可选）

声音开关/音量存在 `localStorage` 的 `dsh.soundAlert.v1`：

```js
// 完全静音
localStorage.setItem('dsh.soundAlert.v1', JSON.stringify({ enabled: false }));

// 调小音量（0 ~ 1，默认 0.15）
localStorage.setItem('dsh.soundAlert.v1', JSON.stringify({ volume: 0.08 }));

// 恢复默认
localStorage.removeItem('dsh.soundAlert.v1');
```

## 已知限制

- 依赖 `dsh-client-ui-workspace` 的 DOM 结构，DSH 升级后可能失效
- 会话识别用「行文本 ↔ `displayTitle` 最长匹配」，标题重复时可能串行
- 颜色和音效设置存在 `localStorage`，不跨设备同步
- UI 优化用到构建期哈希类名（`wSkVaW_*` 等），DSH 升级后可能需要更新

## License

MIT © XQ-quadrant
