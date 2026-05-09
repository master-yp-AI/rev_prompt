// Supabase Client - Vector search for prompt retrieval

const SUPABASE_URL = 'https://pzjrstbglhrgurahvvcn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6anJzdGJnbGhyZ3VyYWh2dmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDI3MjIsImV4cCI6MjA5MzgxODcyMn0.GHxTp0QcfJ7Ldzbo0RWAtjgbQfWinJpiBir4ELrMLI4';
const EMBEDDING_API_KEY = 'd4217134-f9d3-4534-a896-8a663e829d40';
const EMBEDDING_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal';
const EMBEDDING_MODEL = 'doubao-embedding-vision-251215';

// 生成向量（支持文本 + 图片多模态）
async function getEmbedding(text, imageData = null) {
  const input = [];

  // 有文本时加入文本输入
  if (text && text.trim().length > 0) {
    input.push({ type: 'text', text: text.substring(0, 8000) });
  }

  // 如果有图片，加入多模态输入（豆包 API 格式）
  if (imageData && imageData.base64) {
    input.push({
      type: 'image_url',
      image_url: {
        url: `data:${imageData.mimeType || 'image/jpeg'};base64,${imageData.base64}`
      }
    });
  }

  const response = await fetch(EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMBEDDING_API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: input
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data.embedding;
}

// 向量检索相似提示词
async function searchSimilarPrompts(queryText, imageData = null, options = {}) {
  const {
    matchCount = 3,
    matchThreshold = 0.0,
    filterSource = null
  } = options;

  try {
    // 生成查询向量（文本 + 图片多模态）
    const embedding = await getEmbedding(queryText, imageData);
    console.log('[Supabase] Embedding 生成完成，维度:', embedding.length);

    // 调用 Supabase RPC 函数
    const body = {
      query_embedding: JSON.stringify(embedding),
      match_threshold: matchThreshold,
      match_count: matchCount
    };
    if (filterSource) body.filter_source = filterSource;

    const url = `${SUPABASE_URL}/rest/v1/rpc/search_prompts`;
    console.log('[Supabase] 请求 URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    console.log('[Supabase] 响应状态:', response.status);

    if (!response.ok) {
      const err = await response.text();
      console.error('[Supabase] 错误响应:', response.status, err);
      return [];
    }

    const results = await response.json();
    console.log('[Supabase] 返回结果数:', results.length);
    if (results.length > 0) {
      console.log('[Supabase] 第一条结果标题:', results[0].title);
    }

    return results.map(r => ({
      id: r.id,
      source: r.source,
      title: r.title,
      description: r.description,
      contentRaw: r.content_raw,
      contentJson: r.content_json,
      author: r.author,
      sourceLink: r.source_link,
      tags: r.tags,
      similarity: r.similarity
    }));
  } catch (error) {
    console.error('[Supabase] 异常:', error);
    return [];
  }
}

// 从分析结果生成查询文本
function buildQueryFromAnalysis(analysis) {
  const parts = [];

  if (analysis.natural_language_prompt) {
    parts.push(analysis.natural_language_prompt);
  }

  // 从 structured_prompt 中提取所有文本值补充检索
  const sp = analysis.structured_prompt;
  if (sp && typeof sp === 'object') {
    for (const value of Object.values(sp)) {
      if (typeof value === 'string') {
        parts.push(value);
      } else if (typeof value === 'object' && value !== null) {
        parts.push(JSON.stringify(value));
      }
    }
  }

  return parts.join(' ').substring(0, 4000);
}

// 主入口：分析图像 + 检索 + RAG 增强生成
async function analyzeAndRetrieve(imageBase64, config, usingDefault = false) {
  const analyze = usingDefault
    ? (img) => analyzeImageViaProxy(img)
    : (img) => analyzeImageWithAI(img, config);

  // 1. 并行：AI 分析 + 图片向量检索（两者互不依赖）
  const [initialAnalysis, imageSimilarPrompts] = await Promise.all([
    analyze(imageBase64),
    searchSimilarPrompts('', imageBase64, {
      matchCount: 5,
      matchThreshold: 0.3
    })
  ]);

  // 2. 用分析文本补充检索，合并去重
  const queryText = buildQueryFromAnalysis(initialAnalysis);
  const textSimilarPrompts = await searchSimilarPrompts(queryText, null, {
    matchCount: 5,
    matchThreshold: 0.3
  });

  const seen = new Set();
  const similarPrompts = [];
  for (const p of [...imageSimilarPrompts, ...textSimilarPrompts]) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      similarPrompts.push(p);
    }
  }

  // 3. RAG 增强：有参考结果时重新生成，无参考结果时用原始分析
  let finalAnalysis = initialAnalysis;
  if (similarPrompts.length > 0) {
    console.log('[RAG] 检索到', similarPrompts.length, '条参考，开始增强生成');
    if (usingDefault) {
      finalAnalysis = await generateEnhancedViaProxy(imageBase64, initialAnalysis, similarPrompts);
    } else {
      finalAnalysis = await generateEnhancedPrompt(imageBase64, initialAnalysis, similarPrompts, config);
    }
  }

  return {
    analysis: finalAnalysis,
    similarPrompts
  };
}

// RAG 增强生成 — 通过 Edge Function 代理
// Uses ENHANCED_SYSTEM_PROMPT from api-client.js (loaded via importScripts)
async function generateEnhancedViaProxy(imageData, analysis, similarPrompts) {
  const ragContext = similarPrompts.map((p, i) => {
    const parts = [`### 参考 ${i + 1}: ${p.title || 'Untitled'}`];
    if (p.description) parts.push(`描述: ${p.description}`);
    parts.push(`提示词: ${p.contentRaw || p.contentJson || ''}`);
    return parts.join('\n');
  }).join('\n\n');

  try {
    return await analyzeImageViaProxy(imageData, ENHANCED_SYSTEM_PROMPT + `\n\n## 参考提示词\n\n${ragContext}`);
  } catch (error) {
    console.error('[RAG] Proxy enhanced generation failed, using initial analysis:', error);
    return analysis;
  }
}
