# 上游 PR 提案（deepseek-harness）

本文档整理 `dsh_ux_enhance` 在重构中发现的、需要**贡献回 DSH 上游**
（github.com/deepseek-ai/deepseek-harness）的两个小改动。它们都是"通用扩展点"：
补上后，任何插件都能用稳定的公开面做「会话行染色 / 行级动作」和「带文件的目录树」，
而不需要刮 DOM 或依赖构建期哈希类名。

> 当前基线：`@deepseek-ai/dsh` `0.1.0-rc.6`。

---

## PR 1 — ui-workspace：会话行稳定标识 + 行级动作槽

### 问题

侧边栏会话行（`SessionNodeItem` 渲染的 `div[role=treeitem]`）**没有携带会话 id
的稳定属性**。插件想按会话给行上色、或往行上挂动作，只能：

- 用「行文本 ↔ `displayTitle`」反查（标题重复会串行），或
- 用 MutationObserver 监听行菜单弹出再 clone 菜单项。

两个都是脆的。上游只需要两处小改动就能一劳永逸。

### 改动 1a：会话行加 `data-session-id`（最小、必须）

文件：`packages/client/ui-workspace/src/client/rows.tsx`（构建产物
`lib/client.js`）

`SessionNodeItem` 的行元素（当前在 `lib/client.js` ≈ L717）：

```tsx
// before
<div
  className={clsx(Rows_module_css_default.sessionRow, …)}
  role="treeitem"
  aria-selected={selected}
  onClick={() => { onOpen(node.id); }}
>
```

```tsx
// after —— 只加一行
<div
  className={clsx(Rows_module_css_default.sessionRow, …)}
  role="treeitem"
  aria-selected={selected}
  data-session-id={node.id}
  onClick={() => { onOpen(node.id); }}
>
```

搜索结果的会话行（`SearchResultItem`，`button[role=treeitem]`，≈ L651）同样处理：

```tsx
<button … role="treeitem" aria-selected={selected} data-session-id={result.id} …>
```

效果：任何插件现在都能 `document.querySelectorAll('[data-session-id]')` 稳定地
把 DOM 行映射到会话 id。对已上色行，插件用 `[data-session-id="<id>"]` 精确命中，
不再有文本匹配。

### 改动 1b：`sidebar.session.row.action` 行级动作槽（推荐）

在 1a 之上，给行动作区开一个公开槽，让「设置颜色」这类行级动作以官方机制注册，
连 DOM 查询都不需要。

**契约**（`packages/client/ui-workspace/src/client/contract/slots.ts`）：

```ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * 侧边栏一行会话的附加动作（渲染在该行 ⋯ 菜单旁边）。root 作用域：
     * 侧边栏同时展示多个会话，sessionId 由行作为 owner 数据传入，而不是
     * 框架的"当前会话"。
     */
    'sidebar.session.row.action': {
      kind: 'list';
      scope: 'root';
      owner: SidebarSessionRowActionOwnerProps;
    };
  }
}

export interface SidebarSessionRowActionOwnerProps {
  sessionId: SessionId;
  /** 是否当前选中行（行高亮状态）。 */
  selected: boolean;
  /** 行的展示标题（displayTitle 之后）。 */
  title: string;
}
```

**声明**：`WorkspaceBrowser` 注册进 `sidebar.workspaces` 时，在 `children` 表里
追加（当前在 `lib/client.js` ≈ L2398）：

```js
ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
  name: "sidebar.workspaces",
  children: {
    "sidebar.workspaces.directoryFlow": { kind: "single", scope: "root" },
    "sidebar.session.row.action": { kind: "list", scope: "root", owner: { /* 见契约 */ } }
  },
  …
```

**渲染**：把 `renderSlot` 从 `WorkspaceBrowser` 透传到 `SessionNodeItem`，
在该行 `rowActions` 区域内、`Menu` 之前渲染：

```tsx
<span className={Rows_module_css_default.rowActions}>
  {renderSlot('sidebar.session.row.action', { sessionId: node.id, selected, title })}
  <Menu … />
</span>
```

`WorkspaceBrowserProps` 的 `PropsRenderSlots` 同步加入新键。

### 改动文件清单

| 文件 | 改动 |
|---|---|
| `packages/client/ui-workspace/src/client/rows.tsx` | 1a：两处 `data-session-id`；1b：行内 `renderSlot` |
| `packages/client/ui-workspace/src/client/contract/slots.ts` | 1b：SlotMap 声明 + owner 类型 |
| `packages/client/ui-workspace/src/client/index.ts`（apply） | 1b：children 表追加声明 |

### 兼容性

- 1a：纯加属性，零回归。
- 1b：槽未注册时不渲染任何东西（`renderSlot` 空列表 → 无输出），对既有 UI 无影响。
- 不需要新 RPC、不动 wire。

---

## PR 2 — host：`listDirectory` 返回文件（带 `type`）

### 问题

客户端唯一的目录 API 是 `ctx.workspaces.listDirectory`，走 `browse` 能力。
但浏览能力**只返回目录**：`dsh-host-directory-picker-browse` 的 `list`
里 `if (!dirent.isDirectory() && !dirent.isSymbolicLink()) continue;` 把文件全跳过，
`DirectoryEntry` 也没有类型字段。结果是插件拿不到文件列表，工作区文件树只能显示
目录层级。

### 改动 2a：`DirectoryEntry` 增加 `type`

文件：`packages/host/apiproxy/src/types/api/host.ts`（≈ L7）、
`packages/host/apiproxy/src/types/api/host.schema.ts`、以及浏览器侧的镜像
`packages/client/connection/src/…/schema.ts`（当前 schema：`hidden: z.boolean()`）。

```ts
// host.ts
export interface DirectoryEntry {
  name: string;
  path: string;
  hidden: boolean;
  /** 条目类型：目录 / 文件 / 其他（未知或不可用种类）。 */
  type: 'directory' | 'file' | 'other';
}

// host.schema.ts（与客户端 schema 同步）
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
  type: z.enum(['directory', 'file', 'other']),
});
```

`crumbs` 始终是目录，`type: 'directory'` 常量即可。

### 改动 2b：浏览能力返回全部条目

文件：`packages/host/directory-picker-browse/src/index.ts`

当前 `directoryRow`（≈ L121）对非目录返回 `null`，`list` 的读取循环（≈ L182）
先 `continue` 掉非目录。改为：

```ts
async function directoryRow(parent, name, isDirectory, isSymbolicLink, signal) {
  const path = join(parent, name);
  if (isDirectory) {
    return { name, path, hidden: name.startsWith('.'), type: 'directory' };
  }
  if (isSymbolicLink) {
    try {
      const info = await raceAbort(stat(path), signal);
      return {
        name, path,
        hidden: name.startsWith('.'),
        type: info.isDirectory() ? 'directory' : 'file'
      };
    } catch {
      if (signal?.aborted) throw asError(signal.reason);
      return null; // 坏链/循环链仍跳过
    }
  }
  return { name, path, hidden: name.startsWith('.'), type: 'file' };
}
```

`list` 的循环去掉目录过滤，让每个 dirent 都进入 `boundedInsert` 窗口：

```ts
for (;;) {
  const dirent = await raceAbort(level.read(), signal);
  if (dirent === null) break;
  if (boundedInsert(window, {
    name: dirent.name,
    isDirectory: dirent.isDirectory(),
    isSymbolicLink: dirent.isSymbolicLink()
  }, keep)) evicted = true;
}
```

`maxEntries` 上限与 `truncated` 语义不变（窗口现在覆盖文件+目录合计）。

### 改动 2c：目录选择器过滤到目录，行为不变

文件：`packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx`

选择器语义是"选一个目录作为工作区"，文件一旦出现必须被过滤，否则文件行会变得
可选中。在 `visibleEntries`（当前 ≈ L222）最前面加一条：

```ts
function visibleEntries(entries, selectedPath, showHidden, filterPrefix) {
  const dirs = entries.filter((entry) => entry.type === 'directory');
  // …原有 hidden/前缀过滤逻辑照旧作用于 dirs…
}
```

（或者退一步：2b 不动，新增 `host.listTree` 等独立方法。但加 `type` + 过滤是
改动面最小、复用 `listDirectory` 路径的方案。）

### 改动文件清单

| 文件 | 改动 |
|---|---|
| `packages/host/apiproxy/src/types/api/host.ts` | 2a：`DirectoryEntry.type` |
| `packages/host/apiproxy/src/types/api/host.schema.ts` | 2a：schema 加 `type` |
| `packages/client/connection/src/…/schema.ts`（镜像） | 2a：同步 |
| `packages/host/directory-picker-browse/src/index.ts` | 2b：返回文件 + `type` |
| `packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx` | 2c：过滤目录 |

### 兼容性

- `type` 是**新增字段**；`host.d.ts` 明确 client/host 同发（"client and host ship
  together"），加字段安全。
- 2c 必须与 2b 同版本发布，否则旧 picker 会把文件当可选目录。

---

## 插件将如何消费

两个 PR 落地后，`dsh_ux_enhance` 的对应改造：

| 功能 | 现状（等 PR 前） | PR 落地后 |
|---|---|---|
| 会话行染色 | 暂缺（无稳定行标识） | 根作用域 store 存 `{ [sessionId]: colorKey }`，`[data-session-id]` 精确上色；色板入口迁回 `sidebar.session.row.action`（回到行菜单旁） |
| 会话头部色板 | 已迁到 `conversation.session.header.actions`（可保留作为入口之一） | 与行动作并存，两个入口共用同一个 store |
| 工作区文件树 | 仅目录 | `entry.type === 'file'` 渲染 📄 叶子，仅 `type === 'directory'` 可展开；「打开」对文件/目录都可用（`openPath`） |

## 验收标准

- **PR1a**：改动后 `document.querySelectorAll('[data-session-id]')` 命中全部会话行
  （含搜索结果行），且不改变现有渲染/交互。
- **PR1b**：注册进 `sidebar.session.row.action` 的测试条目在每行出现、卸载即消失；
  无条目时零视觉影响。
- **PR2**：`listDirectory` 返回带 `type` 的文件条目；目录选择器仍只显示目录；
  文件树插件能渲染文件叶子。

## 建议合并顺序

1. **PR1a**（一个属性，零风险）→ 立刻解锁行染色。
2. **PR2**（type + 文件 + picker 过滤）→ 解锁文件树。
3. **PR1b**（行动作槽）→ 把行级 UI 彻底官方化，可独立评审。
