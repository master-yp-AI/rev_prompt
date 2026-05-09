import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'prompts-for-supabase.json');

// ====== 配置（通过环境变量传入）======
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pzjrstbglhrgurahvvcn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'doubao-embedding-vision-251215';
const EMBEDDING_DIM = 2048;
const BATCH_SIZE = 20;
// ======

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('请设置环境变量 SUPABASE_URL 和 SUPABASE_KEY');
  console.error('示例: SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=xxx node scripts/import-supabase.mjs');
  process.exit(1);
}

const prompts = JSON.parse(readFileSync(dataPath, 'utf-8'));
console.log(`加载 ${prompts.length} 条提示词`);

// 生成向量（调用豆包 embedding API）
async function getEmbedding(text) {
  const response = await fetch(EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMBEDDING_API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [{ type: 'text', text: text.substring(0, 8000) }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data.embedding;
}

// 批量导入 Supabase
async function importToSupabase(batch) {
  // 去重（同一批次内可能有重复 id）
  const seen = new Set();
  const uniqueBatch = batch.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  if (uniqueBatch.length === 0) return;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/prompts?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(uniqueBatch)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Supabase import error: ${response.status} ${err}`);
  }
}

// 主流程
async function main() {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE);
    console.log(`\n处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(prompts.length / BATCH_SIZE)}...`);

    // 为每条数据生成向量
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        if (!p.text_for_embedding) return { ...p, embedding: null };
        const embedding = await getEmbedding(p.text_for_embedding);
        return { ...p, embedding };
      })
    );

    // 过滤成功的
    const succeeded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results.filter(r => r.status === 'rejected');
    failCount += failed.length;

    // 导入 Supabase
    if (succeeded.length > 0) {
      try {
        await importToSupabase(succeeded);
        successCount += succeeded.length;
        console.log(`  ✅ 导入 ${succeeded.length} 条`);
      } catch (err) {
        console.error(`  ❌ 导入失败: ${err.message}`);
        failCount += succeeded.length;
      }
    }

    // 避免 API 限流
    if (i + BATCH_SIZE < prompts.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n========== 完成 ==========`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
}

main().catch(console.error);
