# 超级生态 · 项目长期记忆

## 项目定位

超级生态 = 「观点进化缸 Opinion Evolution Tank」：把知乎问题变成可观察、可干预、可放生的观点生态系统。知乎黑客松 2026 校园新锐季参赛作品（活动代码 zhihu_hackathon_2026_p2），建议赛道「知识炼金场」。**作品提交截止 2026-09-15 10:00，不接受补交。**

## 关键约束（官方 API 边界，勿再踩）

- 无"问题 ID→回答列表"接口，只能 zhihu_search 关键词汇聚（单次 ≤10 条）
- 无历史时序数据 → 时间轴 = AI 演化重建（必须标注）
- 无折叠/粉丝数/收藏数 → 化石层已移除，影响力用 AuthorityLevel
- 直答 100 次/日（守卫 90）· 热榜 100/日（缓存 1h）· 搜索 5000/日（缸缓存 24h）

## 代码结构

- `app/server`（Express，端口 8787，持有 Access Secret，.env 加载）
- `app/web`（React+TS+Vite+d3-force，构建产物由 server 托管）
- `app/docs/DEVELOPMENT.md` 踩坑实录 ｜ `app/docs/SUBMISSION.md` 提交清单
- 官方 API skill 参考文档在 `zhihu skill/references/`（hackathon.md 为赛事事实源）

## 设计与诚信红线

- 扁平商务风：柔和浅底+描边卡片，禁渐变/霓虹/脉冲/斜体/纯白块
- 诚信三标注：时间轴"AI 演化重建·非历史记录"、放生"AI 模拟预测"、演示模式 fail-closed 徽标
- 凭证只存服务端 .env，前端/仓库/日志/录屏零泄露

## 本机工具链坑位（Windows 沙箱）

详见 `app/docs/DEVELOPMENT.md` 第 5 节：PowerShell stdout 吞噬→落盘再读；npm.cmd 拦截→node 直调 npm-cli.js；registry 慢→npmmirror+后台；d3-force link source 需 typeof 收窄。
