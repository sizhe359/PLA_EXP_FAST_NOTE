# 实验速记

面向 Android Chrome 的触摸友好实验数据记录工具。首个模板用于多样品可降解材料实验，支持每种样品三个平行样、独立测量时间、平均降解率曲线、IndexedDB 草稿、CSV/JSON/PNG 导出，以及 Supabase 账号与云同步。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。未配置 Supabase 时会自动进入本地演示模式，数据只保存在当前浏览器。

## 配置 Supabase

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 `supabase/migrations/001_initial_schema.sql`。
3. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 anon key：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. 在 Supabase Authentication 中启用 Email 登录。个人使用时可关闭公开注册，先在后台创建自己的账号。
5. 重启开发服务器。应用会自动切换到登录与云同步模式。

迁移使用以下标准 PostgreSQL 表：

- `experiment_templates`
- `experiments`
- `experiment_samples`
- `sample_measurements`
- `replicate_weights`

所有表均启用 Row Level Security。实验和测量行只能由记录所属用户访问，API 也会重新验证 Supabase 用户，不依赖路由代理作为唯一权限层。

## 部署到 Vercel

1. 将仓库推送到 GitHub。
2. 在 Vercel 导入仓库。
3. 在项目 Environment Variables 添加上述两个 Supabase 变量。
4. 部署成功后，在 Vercel 项目的 Domains 页面添加已购买域名。
5. 按 Vercel 提示在域名服务商处设置 DNS；HTTPS 证书会自动签发。

在正式使用前，分别通过实验室 Wi-Fi 和手机流量测试访问速度与保存可靠性。

## 常用命令

```bash
npm run dev
npm run lint
npm test
npm run build
```

## 当前范围

- 单用户数据隔离，但允许多个独立账号注册使用。
- 每个实验可自定义样品，每种样品固定三个平行样。
- 每个平行样以自身第一次有效重量作为初始重量；首次录入该次测量的重量时自动记录当前时间，时间仍可手动修正。
- 降解率公式为 `(初始重量 - 当前重量) / 初始重量 × 100%`；重量增加时会如实显示负降解率。
- 每种样品使用自己的第一次测量作为 0 小时，主图显示三个有效平行样降解率的即时平均值，并标记有效数量 `n`。
- 重量统一使用 `mg`。
- 计算库仍保留质量/体积浓度、稀释、平均值与单位换算函数，便于后续模板复用。
- 本地草稿防误关和短暂断网；不提供完整离线应用同步。
- 不包含高级拟合、图片附件、多人共享和审计功能。
