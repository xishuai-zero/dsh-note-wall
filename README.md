# dsh-note-wall · 便签墙

> 仓库：<https://github.com/xishuai-zero/dsh-note-wall> · 许可：AGPL-3.0-only（见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)）

DSH 侧栏入口 + 主面板便签墙：随手记下灵感。配色取自官方演示清晰帧实测值——暖黄输入卡、白底细描边胶囊、七色粉彩便签底与同色系深色正文；版面按「标题 + 副标题 + 搜索/计数胶囊 + 瀑布流便签」组织。

## 界面

- **页头**：便签墙标题、副标题「每个灵感，都值得记下。便签自动保存。」、白底细描边搜索胶囊与「N 张便签」计数；导出入口在页尾。
- **输入卡**：整块暖黄色卡片（`#fde5a1`，圆角 22px），顶部写灵感；底部七种圆角色点、`⌘/Ctrl + Enter` 提示和深橄榄色「＋ 添加到墙上」按钮（`#605026`）。选色时输入卡底色会即时过渡到对应柔和色，默认仍是暖黄。
- **便签卡片**：瀑布流三列，浅色便签底（琥珀 `#fee6a3`、玫瑰 `#fbd9e4`、天蓝 `#d8ecfb`、薄荷 `#d8f1e7`、紫罗兰 `#d8caf6`、米白 `#f8efcf`、青柠绿 `#d9f4d2`；琥珀与紫为官方演示清晰帧实测值，青柠绿取自 Qoder 品牌绿 `#2ADB5C` 的粉彩化版本、正文用其深森林绿 `#255a41`，其余按同族饱和度校准），顶部显示第一个 `#标签`（无标签显示加深后的「灵感」字样），正文大字排版并用卡片同色系深色文字，左下「刚刚 / n 分钟前 / 昨天」，右下铅笔打开放大编辑；置顶、删除与编辑图标常显，悬停时加深。

## 功能

- **快速记录**：`Ctrl + Enter`（macOS 为 `Cmd + Enter`）添加；`#标签` 自动成为卡片标签。
- **随时拖入**：在 QQ、哔哩哔哩、浏览器等任意软件里选中文字，直接拖到 DSH 窗口任意位置松开即存为便签（拖到输入框时保持原生插入）。拖动过程中窗口底部浮层提示「松开即可保存到便签墙」，保存后显示结果并可点「查看」跳转；便签墙已打开时列表即时刷新。
- **七种配色**：琥珀、玫瑰、天蓝、薄荷、紫罗兰、米白、青柠绿；便签底色为浅色调，色点更饱和以便辨认。青柠绿接近 Qoder 的亮绿，与偏青的薄荷色区分明显。
- **置顶**：置顶便签排在最前，其次按更新时间倒序，卡片右上显示小图钉。
- **编辑**：点开便签即可在便签墙内居中放大一张编辑卡，其余便签淡出变暗；正文在放大卡里完整显示、自动撑高，不再被卡片高度截断。`Ctrl + Enter` 保存，`Esc` 或点击背景关闭；空内容不会保存。
- **心想事成**：每张便签卡底部（放大编辑卡里也有一份）点「✦ 心想事成」，会先用本地结构化模板把便签整理成可执行 prompt，再交给 PromptOptimizer 的模型与「基础优化」模板改写，完成后自动跳转到会话界面并填入输入框（默认只填草稿，不自动发送，可改完再发）。优化期间底部显示「正在通过 PromptOptimizer 优化…」；PromptOptimizer 不可用（数据文件不存在、没有启用的模型、请求失败或超时）时自动回退到本地模板并提示。没有可用的会话输入框时，浮层提示先打开或新建一个会话。
- **删除**：每张卡片右下角常显垃圾桶，点击后卡片底部出现「确认删除吗？」与「删除 / 取消」，确认后才删除；3.2 秒不操作自动收起，避免误删。
- **搜索与标签筛选**：搜索胶囊过滤正文；点击卡片标签进入标签筛选，页头出现可清除的筛选胶囊。
- **导出 Markdown**：一键下载 `note-wall-YYYY-MM-DD-HHmm.md`。
- **本地存储**：默认 `$DSH_HOME/note-wall/notes.json`，可在 bundle patch 里用 `notesFile` 覆盖。原子写入；文件损坏时移到 `.corrupt-<时间戳>` 旁路保存，不会直接覆盖。

## 心想事成的实现

- 第一步仍是纯函数 `buildWishPrompt(note)`：把便签原文与第一个 `#标签` 整理成本地结构化 prompt（核心问题、3 个方向、最小可行下一步、风险与验证）。
- 第二步调用 Host 半身的 `POST /api/note-wall/wish/optimize`：`src/wish-optimizer.mjs` 读取 PromptOptimizer 的本地数据文件（默认 `%APPDATA%/@prompt-optimizer/desktop/prompt-optimizer-data.json`），复用其中已启用的模型连接（优先 DeepSeek），按 PromptOptimizer 内置 `user-prompt-basic` v2.0.0「基础优化」模板发起一次 OpenAI 兼容的 `/chat/completions` 请求，返回改写后的 prompt。PromptOptimizer 本身没有 CLI、深链或本地 HTTP API，这是不改动其安装目录的唯一集成方式。
- 请求超时 90 秒；数据文件缺失、模型未启用、HTTP 失败、空结果、超时都会返回稳定的错误码（`optimizer-config-missing` / `optimizer-model-missing` / `optimizer-request-failed` / `optimizer-timeout` / `optimizer-empty-response`），客户端据此回退本地模板。API Key 只留在 Host 进程内存中，不写日志、不返回给浏览器。
- 注入仍走宿主公开的会话插槽：插件把隐藏桥接组件注册进 `conversation.composer.dock`（session 作用域），组件拿到 `inputActions` 后调用 `setDraft(prompt)` 填入草稿；跳转会话用 `ctx.layout.selectPanel(null)`。不调用发送接口，不会自动发起对话。
- 若 1.6 秒内没有会话输入区接管 prompt（例如当前没有会话），浮层提示「请先打开或新建一个会话」并清空待注入内容。

## 动效

- **入场**：页头与输入卡自下而上淡入（220–550ms）；便签按顺序 40ms 递增依次浮现。
- **新增**：新便签弹出式出现（缩放 + 上移），张数胶囊同步弹跳，按钮短暂显示「✓ 已添加」并回弹。
- **删除**：确认后卡片像揉纸一样旋转收缩淡出 170ms，再删除数据，避免布局瞬间跳变。
- **悬停/按压**：卡片保持平整清晰、无投影（不再轻微歪贴，避免文字发虚）；悬停时轻抬，色点选中弹跳，图钉切换甩动，按钮 hover 微转、按下弹性回弹，操作图标常显并在悬停时加深。
- **空状态**：一张漂浮的小便签涂鸦，轻轻上下晃动。
- **输入聚焦**：输入卡出现柔和外圈；添加成功后焦点回到输入框。
- **拖入浮层**：拖拽子外部文字时自底部滑入；保存成功 2.6 秒后自动淡出，失败提示保留 4.2 秒。
- **放大编辑**：点开便签时背景同步 0.2s 模糊变暗，编辑卡从被点击便签的位置与大小出发，0.2s 内过渡放大到墙内居中；关闭即时复位。
- **无障碍**：`prefers-reduced-motion: reduce` 下关闭全部动画与过渡。

## 安装

```bash
node --check index.js
node --check client.js
node --test
```

安装到当前 DSH profile（已在本机实测）：

1. 首次安装：`plugin_manager` 的 `install_bundle`，`target` 指向本目录绝对路径。
2. 更新本地 link 版本：先 `remove_bundle`（target `dsh-note-wall`），再 `install_bundle`；否则会提示已安装。
3. 安装成功返回 `application: "applied"` 即生效（Host 半身立即生效）；客户端半身刷新页面（Ctrl+Shift+R）后加载最新 bundle。

同步与校验命令见上；当前版本 0.2.8，测试 38 个用例全部通过（9 个客户端契约 + 6 个 Host 路由 + 6 个请求围栏 + 5 个存储 + 7 个 PromptOptimizer 适配 + 5 个优化器安全）。

## 配置

存储路径由 bundle patch 的 `config.notesFile` 决定，默认 `$DSH_HOME/note-wall/notes.json`；PromptOptimizer 数据文件路径由 `config.promptOptimizerData` 决定（省略则按 `%APPDATA%` 自动解析）。个人机器上的路径覆盖建议写在用户 profile 的 patch 里，不要提交到仓库：

```yaml
- insert:
    - id: note-wall
      name: 'dsh-note-wall'
      config:
        # 可选；默认 $DSH_HOME/note-wall/notes.json
        # notesFile: '<你的便签文件路径>'
        # 可选；默认为 %APPDATA%\@prompt-optimizer\desktop\prompt-optimizer-data.json
        # promptOptimizerData: '<自定义路径>'
```

## 安全与边界

- Host 路由只接受来自 loopback 的 TCP 对端、loopback 的 Host 头与同源浏览器请求；桌面 relay 的 `dsh-app://app` Origin/Referer 对称放行，其他跨站/外部来源一律 403。
- 便签文件载入完成前拒绝所有写操作（503 `loading`），载入失败后返回 503 `storage-unavailable`，避免启动竞态覆盖旧便签。
- `/wish/optimize` 同时只允许一个请求在途，并限制每分钟调用次数，避免被同机页面刷额度。
- 模型 baseURL 必须是 HTTPS（回环地址上的本地推理服务允许 HTTP）；prompt 与模型返回都有长度上限。
- `/state` 只返回便签文件名，不返回绝对路径；响应统一带 `nosniff`；API Key 只在 Host 内存中使用，不写日志、不返回给浏览器。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半身：`/api/note-wall/*` 路由、并发串行化、参数校验、`wish/optimize` 入口 |
| `src/store.mjs` | JSON 存储：默认路径、反序列化清洗、原子写、损坏隔离 |
| `src/trust.mjs` | 同源请求围栏：拒绝非 loopback Host、跨站与外部 Origin |
| `src/wish-optimizer.mjs` | 读取 PromptOptimizer 模型配置、复刻其「基础优化」模板、发起优化请求 |
| `client.js` | 浏览器半身：侧栏图标 + 主面板 UI、全局拖放捕获与结果浮层，注入主题 token 样式 |
| `locale/{zh,en}.json` | 插件显示元数据（标题 / 描述） |
| `icon.svg` | 侧栏与插件页图标 |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/note-wall/state` | 返回 `{ ok, notes, file }` |
| `POST` | `/api/note-wall/notes` | 新建便签，返回完整列表 |
| `PATCH` | `/api/note-wall/notes/:id` | 修改正文 / 配色 / 置顶 |
| `DELETE` | `/api/note-wall/notes/:id` | 删除便签 |
| `POST` | `/api/note-wall/wish/optimize` | 用 PromptOptimizer 的模型与模板优化 prompt，返回 `{ ok, prompt, model, provider }`；失败返回 502 与错误码 |

所有写操作返回 `{ ok: true, notes, file }` 完整快照，客户端无需合并局部状态。

## 已知限制

- 仅同源页面可写；不做多用户同步、附件与历史版本。
- 便签正文上限 5000 字符：输入卡超过上限会提示且不提交；拖入文字超过上限会截断后保存（浮层会提示）。
- 拖放只接收文字：拖入文件或图片会提示暂不支持；能否拖出取决于源软件，QQNT 与哔哩哔哩 PC 客户端已实测可用，其他软件以实际测试为准。
- 「心想事成」依赖当前存在可用的会话输入区：全新空白页若还没有会话，会提示先打开或新建会话。
- 「心想事成」的优化步骤复用 PromptOptimizer 的本地模型配置与内置「基础优化」模板，因此需要：该应用数据文件存在、至少一个非 Chrome Built-in 的模型已启用并配置 baseURL/API Key；调用会消耗该 API Key 的额度。应用未安装或配置缺失时自动回退本地模板。
- 本插件不启动、不操控 PromptOptimizer 窗口；它只读取其公开的本地数据文件，不改动其安装目录与配置。
- 侧栏图标样式继承 Harness 主题 token；未在其他客户端平台验证。
- 本机安装后的界面验收需要在浏览器里刷新页面完成；无浏览器控制时只能验证到 API、清单与客户端模块契约层。

## 致谢与许可

本项目以 **AGPL-3.0-only** 授权，完整文本见 [`LICENSE`](LICENSE)，第三方声明见 [`NOTICE`](NOTICE)。

「心想事成」的优化模板（`src/wish-optimizer.mjs` 中的「用户提示词基础优化助手」system/user 消息）改编自 [Prompt Optimizer](https://github.com/linshenkx/prompt-optimizer)（Copyright (C) 2025 linshenkx，AGPL-3.0-only）。本插件不打包、不启动、不修改 Prompt Optimizer 的任何代码，只读取其本地数据文件中的模型连接配置并发起 API 请求；引用与许可见 `NOTICE`。

