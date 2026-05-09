# RePrompt — 图生prompt

A Chrome/Edge extension that analyzes web images and generates reverse prompts using AI.

开箱即用，无需配置 API Key。也支持自定义模型。

## Features

- 🖼️ **图生 prompt** — 鼠标悬停任意网页图片，一键生成逆向提示词
- 🤖 **RAG 增强** — 分析图片 + 向量检索相似参考 prompt → 二次增强生成
- 📋 **双格式输出** — JSON 结构化 prompt + 自然语言 prompt，一键复制
- 🔧 **灵活配置** — 默认使用内置模型，也可自定义 OpenAI / Anthropic 协议的任意模型
- 💾 **历史记录** — 自动保存最近 50 条分析结果

## Installation

### 1. Clone / Download

```bash
git clone <this-repo>
```

### 2. Load in Chrome/Edge

1. Open `chrome://extensions`
2. Enable **Developer mode** (右上角开关)
3. Click **Load unpacked** → 选择 `rev_prompt` 文件夹

### 3. Start Using

装完即可使用，无需任何配置。

鼠标悬停网页图片 → 点击「破解prompt」→ 侧边栏查看结果。

## Configuration (Optional)

如果想用自己的 API Key 和模型：

1. 点击扩展图标打开侧边栏
2. 点击 ⚙️ 设置按钮
3. 填写 **Base URL**、**API Key**、**Model Name**
4. 点 **Save Configuration**

清空 API Key 保存可恢复默认配置。

### Supported Providers

- **OpenAI Compatible** — OpenAI, Azure OpenAI, Groq, etc.
- **Anthropic** — Claude 系列模型

## How It Works

```
鼠标悬停图片 → 点击分析
  → AI 视觉分析（默认走 Supabase Edge Function 代理，自配 key 走直连）
  → Supabase 向量检索相似参考 prompt（图片 + 文本双重检索，去重合并）
  → 有参考结果 → RAG 二次增强生成
  → 侧边栏展示结果
```

## Project Structure

```
rev_prompt/
├── manifest.json              # MV3 配置
├── icons/                     # 扩展图标
├── src/
│   ├── background.js          # Service worker — 消息路由，API 调度
│   ├── content-script.js      # 页面注入 — 图片悬停浮层
│   ├── content-style.css
│   ├── sidebar/
│   │   ├── sidebar.html/js/css  # 侧边栏 UI
│   └── lib/
│       ├── supabase-client.js  # Supabase 向量检索 + RAG 管线
│       ├── api-client.js       # AI API 调用（代理 / 直连）
│       └── utils.js            # 图片转 base64 等工具函数
├── supabase/
│   └── functions/
│       └── vision-proxy/       # Edge Function — 默认 vision API 代理
├── scripts/                    # Node.js 工具脚本
│   ├── extract-prompts.mjs     # 从 refer/ 提取数据到 data/
│   ├── import-supabase.mjs     # 批量导入 prompt 到 Supabase
│   └── supabase-migration.sql  # 数据库表结构
├── refer/                      # 原始参考数据（CSV / Markdown）
└── data/                       # 提取后的 JSON 数据
```

## License

MIT
