import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const referDir = join(__dirname, '..', 'refer');
const outputDir = join(__dirname, '..', 'data');

// 确保输出目录存在
import { mkdirSync } from 'fs';
mkdirSync(outputDir, { recursive: true });

// ---- 提取 CSV 提示词 ----
function extractCSV() {
  const csvPath = join(referDir, 'nano-banana-pro-prompts-20260420.csv');
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  
  const prompts = [];
  let currentLine = '';
  let inQuotedBlock = false;
  let quoteCount = 0;

  // 处理多行 JSON 的 CSV 解析
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (inQuotedBlock) {
      currentLine += '\n' + line;
      quoteCount += (line.match(/""/g) || []).length;
      
      // 检查是否结束（计算引号数量判断是否闭合）
      if (line.trimEnd().endsWith('",') || line.trimEnd().endsWith('"')) {
        const openQuotes = (currentLine.match(/"/g) || []).length;
        const escapedQuotes = (currentLine.match(/""/g) || []).length;
        if ((openQuotes - escapedQuotes * 2) % 2 === 0) {
          inQuotedBlock = false;
        }
      }
      continue;
    }

    currentLine = line;
    const openQuotes = (line.match(/"/g) || []).length;
    const escapedQuotes = (line.match(/""/g) || []).length;
    
    if ((openQuotes - escapedQuotes * 2) % 2 !== 0) {
      inQuotedBlock = true;
      quoteCount = 0;
    }

    try {
      const values = parseCSVLine(currentLine);
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        // 提取 content 字段（可能是 JSON）
        let promptContent = null;
        try {
          promptContent = JSON.parse(row.content);
        } catch {
          promptContent = row.content;
        }

        if (row.content && row.content.length > 10) {
          prompts.push({
            id: `csv-${row.id || i}`,
            source: 'nano-banana-pro',
            title: row.title || '',
            description: row.description || '',
            content: promptContent,
            contentRaw: row.content,
            author: row.author || '',
            sourceLink: row.sourceLink || '',
            tags: extractTags(row.title, row.description),
            textForEmbedding: `${row.title} ${row.description} ${typeof promptContent === 'string' ? promptContent : JSON.stringify(promptContent)}`.substring(0, 4000)
          });
        }
      }
    } catch (e) {
      // 跳过解析失败的行
    }

    currentLine = '';
  }

  return prompts;
}

// 简单 CSV 解析（处理引号转义）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        result.push(current);
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }
  result.push(current);
  return result;
}

// ---- 提取 Markdown 提示词 ----
function extractMarkdown() {
  const mdPath = join(referDir, 'gpt-image2-prompt.md');
  const content = readFileSync(mdPath, 'utf-8');
  
  const prompts = [];
  // 匹配每个提示词块
  const blocks = content.split(/### No\. \d+:/).slice(1);

  for (const block of blocks) {
    const titleMatch = block.match(/^(.+)$/m);
    const descMatch = block.match(/#### 📖 描述\s*\n([\s\S]*?)\n#### 📝 提示词/);
    const promptMatch = block.match(/#### 📝 提示词\s*\n```(?:json)?\s*([\s\S]*?)```/);
    const authorMatch = block.match(/- \*\*作者:\*\* \[([^\]]+)\]/);
    const linkMatch = block.match(/\[👉 立即尝试 →\]\(([^)]+)\)/);
    const categoriesMatch = block.match(/\[(.+?)\]\(https:\/\/youmind\.com\/[^)]+?categories=([^)]+)\)/g);
    
    if (titleMatch && (descMatch || promptMatch)) {
      const title = titleMatch[1].trim();
      const description = descMatch ? descMatch[1].trim() : '';
      
      let promptContent = null;
      if (promptMatch) {
        try {
          promptContent = JSON.parse(promptMatch[1].trim());
        } catch {
          promptContent = promptMatch[1].trim();
        }
      }

      const tags = [
        ...extractTags(title, description),
        ...(categoriesMatch ? categoriesMatch.map(c => {
          const m = c.match(/\[([^\]]+)\]/);
          return m ? m[1] : '';
        }).filter(Boolean) : [])
      ];

      const textForEmbedding = `${title} ${description} ${typeof promptContent === 'string' ? promptContent : JSON.stringify(promptContent)}`.substring(0, 4000);

      prompts.push({
        id: `md-${prompts.length + 1}`,
        source: 'gpt-image2',
        title,
        description,
        content: promptContent,
        contentRaw: typeof promptContent === 'string' ? promptContent : JSON.stringify(promptContent),
        author: authorMatch ? authorMatch[1] : '',
        sourceLink: linkMatch ? linkMatch[1] : '',
        tags: [...new Set(tags)],
        textForEmbedding
      });
    }
  }

  return prompts;
}

// 从标题和描述中提取标签
function extractTags(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const tagMap = {
    'portrait': ['portrait'],
    '肖像': ['portrait'],
    '动漫': ['anime'],
    'anime': ['anime'],
    '插画': ['illustration'],
    'illustration': ['illustration'],
    '摄影': ['photography'],
    'photography': ['photography'],
    '3d': ['3d'],
    '3D': ['3d'],
    '渲染': ['3d-render'],
    '像素': ['pixel-art'],
    'pixel': ['pixel-art'],
    '水彩': ['watercolor'],
    'watercolor': ['watercolor'],
    '油画': ['oil-painting'],
    'oil painting': ['oil-painting'],
    '赛博朋克': ['cyberpunk'],
    'cyberpunk': ['cyberpunk'],
    '极简': ['minimalism'],
    'minimal': ['minimalism'],
    '复古': ['retro'],
    'vintage': ['retro'],
    '电影': ['cinematic'],
    'cinematic': ['cinematic'],
    '产品': ['product'],
    'product': ['product'],
    '角色': ['character'],
    'character': ['character'],
    '风景': ['landscape'],
    'landscape': ['landscape'],
    '建筑': ['architecture'],
    'architecture': ['architecture'],
    '室内设计': ['interior-design'],
    'ui': ['ui-design'],
    '界面': ['ui-design'],
    '海报': ['poster'],
    'poster': ['poster'],
    '图标': ['icon'],
    'icon': ['icon'],
    'logo': ['logo'],
    '漫画': ['comic'],
    'comic': ['comic'],
    '游戏': ['game-asset'],
    'game': ['game-asset'],
    '食物': ['food'],
    'food': ['food'],
    '动物': ['animal'],
    'animal': ['animal'],
    '车辆': ['vehicle'],
    'vehicle': ['vehicle'],
    '城市': ['cityscape'],
    'city': ['cityscape'],
    '文本': ['text-typography'],
    'text': ['text-typography'],
    '排版': ['text-typography'],
    'typography': ['text-typography'],
    '抽象': ['abstract'],
    'abstract': ['abstract'],
    '背景': ['background'],
    'background': ['background'],
    'Q版': ['chibi'],
    'chibi': ['chibi'],
    '等距': ['isometric'],
    'isometric': ['isometric'],
    '草图': ['sketch'],
    'sketch': ['sketch'],
    '线稿': ['line-art'],
    'line art': ['line-art'],
    '水墨': ['ink-chinese'],
    '中国风': ['ink-chinese'],
    '水墨画': ['ink-chinese']
  };

  const tags = [];
  for (const [keyword, tagArr] of Object.entries(tagMap)) {
    const tag = tagArr[0];
    if (text.includes(keyword.toLowerCase()) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

// ---- 主流程 ----
console.log('提取 CSV 提示词...');
const csvPrompts = extractCSV();
console.log(`CSV 提取完成: ${csvPrompts.length} 条`);

console.log('提取 Markdown 提示词...');
const mdPrompts = extractMarkdown();
console.log(`Markdown 提取完成: ${mdPrompts.length} 条`);

const allPrompts = [...csvPrompts, ...mdPrompts];
console.log(`\n总计: ${allPrompts.length} 条提示词`);

// 输出
// 写入完整数据
writeFileSync(
  join(outputDir, 'prompts.json'),
  JSON.stringify(allPrompts, null, 2),
  'utf-8'
);

// 写入 Supabase 导入格式（每条一行，方便导入）
const importData = allPrompts.map(p => ({
  id: p.id,
  source: p.source,
  title: p.title,
  description: p.description,
  content_raw: typeof p.content === 'string' ? p.content : JSON.stringify(p.content),
  content_json: typeof p.content === 'object' ? p.content : null,
  author: p.author,
  source_link: p.sourceLink,
  tags: p.tags,
  text_for_embedding: p.textForEmbedding
}));

writeFileSync(
  join(outputDir, 'prompts-for-supabase.json'),
  JSON.stringify(importData, null, 2),
  'utf-8'
);

console.log(`\n输出文件:`);
console.log(`  data/prompts.json — 完整数据 (${allPrompts.length} 条)`);
console.log(`  data/prompts-for-supabase.json — Supabase 导入格式`);
