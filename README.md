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
- 浏览器半 `lib/client.js`：注册为懒加载工厂包。会话颜色走官方扩展面：
  `ctx.slots.register` 把色板入口注册进会话头部动作槽（`conversation.session.header.actions`），
  颜色存于框架管理的 `defineStore({ persist })` 会话级 store；会话 id 由框架作为
  prop 直接传入，不再靠 DOM 文本反查。
- 音效模块订阅 `ctx.sessions.list`，对每个会话做状态 diff，只对**状态跳变**发声；
  开关/音量由框架 store 持久化（`dsh.soundAlert.v1`）。
- 布局/移动端适配仍为样式层注入（依赖构建期哈希类名，见「已知限制」）。

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

声音开关/音量由框架 store 持久化在 `localStorage` 的 `dsh.soundAlert.v1`
（默认 `{ enabled: true, volume: 0.15 }`）。控制台直接写该键仍有效，
但 store 只在页面加载时重新读取，改动需刷新页面后生效：

```js
// 完全静音（刷新后生效）
localStorage.setItem('dsh.soundAlert.v1', JSON.stringify({ enabled: false }));

// 调小音量（0 ~ 1，默认 0.15；刷新后生效）
localStorage.setItem('dsh.soundAlert.v1', JSON.stringify({ volume: 0.08 }));

// 恢复默认（删除该键，下次加载回到默认）
localStorage.removeItem('dsh.soundAlert.v1');
```

## 已知限制

- 布局优化依赖构建期哈希类名（`wSkVaW_*` 等），DSH 升级后可能需要更新
- 会话颜色的侧边栏行染色暂未实现：侧边栏会话行没有公开的 per-row 槽、
  DOM 上也没有 `data-session-id`，需上游在 `dsh-client-ui-workspace` 暴露
  （加 `data-session-id` 属性或 `session.row` 槽）；当前颜色入口在会话头部
- 颜色和音效设置存于浏览器 `localStorage`，不跨设备同步

## License

MIT © XQ-quadrant
