// AI API Client - Supports OpenAI and Anthropic protocols

const SYSTEM_PROMPT = `你是一个专业的AI图像分析专家，擅长逆向工程生成图像提示词。

## 输出格式

严格以JSON格式返回，包含以下4个字段：

{
  "scene": "一句话中文场景概要",
  "tags": ["英文", "小写", "标签"],
  "structured_prompt": { ... },
  "natural_language_prompt": "..."
}

## 字段说明

### scene
一句话中文描述，让人快速了解图片内容。不超过30字。

### tags
英文小写标签数组，3-8个，从以下维度选取：风格(portrait/landscape/product/illustration/3d-render/anime/pixel-art/watercolor/cinematic/minimalist/cyberpunk/retro)、主体(person/animal/food/architecture/vehicle/text)、技法(photography/digital-art/oil-painting/sketch/line-art/isometric)、氛围(moody/bright/dark/pastel/vibrant)、用途(poster/social-media/game-asset/logo)等。

### structured_prompt
根据图片类型自由组织的结构化字段，不要使用固定模板。参考以下模式：
- 人像摄影 → { "subject": { 人物细节 }, "clothing": { 穿搭 }, "pose": "姿态描述", "lighting": "布光", "camera": "镜头参数" }
- 产品广告 → { "product": { 产品细节 }, "props": { 道具 }, "background": "背景", "lighting": "布光方案" }
- 海报/信息图 → { "layout": { 版面结构 }, "typography": { 文字排版 }, "sections": [ 各区块内容 ] }
- 风景 → { "terrain": "地形", "sky": "天空", "time_of_day": "时段", "atmosphere": "氛围" }
- 插画/动漫 → { "character": { 角色设定 }, "art_style": "画风", "composition": "构图" }
用最能描述这张图片的字段，不要强行填充无关字段。

### natural_language_prompt
最重要的字段。一段完整的、可直接粘贴到图像生成工具中使用的英文提示词。

要求：
- 具体到材质、纹理、光影方向、镜头焦段、色彩倾向
- 描述具体的姿态、表情、空间关系，而不是笼统概括
- 包含风格和质量修饰词

密度对比：
✗ "一个男人坐在椅子上，暗色背景"
✓ "powerful man sitting confidently in a large glossy black leather throne chair, relaxed dominant posture, legs apart and arms resting on chair armrests, wearing narrow dark sunglasses and a metallic crown, large black fur coat with dramatic draping, silver rings on fingers, dark cinematic studio environment with cool toned moody lighting and light haze creating depth, dramatic directional lighting highlighting fur texture and metal reflections, 85mm portrait lens, shallow depth of field, ultra photorealistic, 8k detailed"`;

// ── Supabase Edge Function Proxy (default vision API) ──
// Uses SUPABASE_URL and SUPABASE_KEY from supabase-client.js (loaded via importScripts)

const SUPABASE_PROXY_URL = `${SUPABASE_URL}/functions/v1/vision-proxy`;

async function analyzeImageViaProxy(imageData, systemPrompt) {
  const { base64, mimeType } = imageData;

  const response = await fetch(SUPABASE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    },
    body: JSON.stringify({ imageBase64: base64, mimeType, systemPrompt })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Proxy error: ${response.status}`);
  }

  const data = await response.json();
  return parseApiResponse(data.content);
}

// Main entry point - analyze image with AI
async function analyzeImageWithAI(imageData, config) {
  const { protocol, baseUrl, apiKey, model } = config;

  if (!protocol || !baseUrl || !apiKey || !model) {
    throw new Error('Missing required configuration: protocol, baseUrl, apiKey, or model');
  }

  try {
    if (protocol === 'openai') {
      return await analyzeWithOpenAI(imageData, baseUrl, apiKey, model);
    } else if (protocol === 'anthropic') {
      return await analyzeWithAnthropic(imageData, baseUrl, apiKey, model);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  } catch (error) {
    console.error('AI API error:', error);
    throw error;
  }
}

// OpenAI-compatible API call
async function analyzeWithOpenAI(imageData, baseUrl, apiKey, model) {
  const { base64, mimeType } = imageData;

  // Normalize base URL
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            },
            {
              type: 'text',
              text: '请分析这张图片并生成逆向提示词。'
            }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices[0].message.content;

  return parseApiResponse(assistantMessage);
}

// Anthropic API call
async function analyzeWithAnthropic(imageData, baseUrl, apiKey, model) {
  const { base64, mimeType } = imageData;

  // Normalize base URL
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedBaseUrl}/v1/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 2048,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64
              }
            },
            {
              type: 'text',
              text: '请分析这张图片并生成逆向提示词。'
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const assistantMessage = data.content[0].text;

  return parseApiResponse(assistantMessage);
}

// ── RAG 增强生成 ──

const ENHANCED_SYSTEM_PROMPT = `你是一个专业的AI图像分析专家，擅长逆向工程生成图像提示词。

你的任务：参考一组已有的高质量提示词示例（以 ### 分隔），分析当前图片，生成一个更精准、更完善的逆向提示词。

## 规则
1. 必须仔细观察图片本身的视觉内容（场景、主体、构图、光影、风格等）
2. 参考示例的写法粒度和描述密度，但不要照搬内容
3. 如果示例与当前图片无关，忽略示例，仅基于图片本身生成
4. natural_language_prompt 的密度必须达到参考示例的水平

## 输出格式

严格以JSON格式返回，包含以下4个字段：

{
  "scene": "一句话中文场景概要",
  "tags": ["英文", "小写", "标签"],
  "structured_prompt": { ... },
  "natural_language_prompt": "..."
}

### scene
一句话中文描述，不超过30字。

### tags
英文小写标签数组，3-8个。

### structured_prompt
根据图片类型自由组织结构化字段，不要使用固定模板。

### natural_language_prompt
最重要的字段。完整的英文提示词，具体到材质/姿态/光影/镜头参数。密度必须达到参考示例的水平。`;

// RAG 增强生成入口
async function generateEnhancedPrompt(imageData, analysis, similarPrompts, config) {
  const { protocol, baseUrl, apiKey, model } = config;

  // 构建 RAG 上下文
  const ragContext = similarPrompts.map((p, i) => {
    const parts = [`### 参考 ${i + 1}: ${p.title || 'Untitled'}`];
    if (p.description) parts.push(`描述: ${p.description}`);
    parts.push(`提示词: ${p.contentRaw || p.contentJson || ''}`);
    return parts.join('\n');
  }).join('\n\n');

  try {
    if (protocol === 'openai') {
      return await generateEnhancedWithOpenAI(imageData, ragContext, baseUrl, apiKey, model);
    } else if (protocol === 'anthropic') {
      return await generateEnhancedWithAnthropic(imageData, ragContext, baseUrl, apiKey, model);
    }
  } catch (error) {
    console.error('Enhanced generation failed, falling back to original analysis:', error);
    return analysis; // 失败时回退到原始分析
  }
}

// OpenAI 协议增强生成
async function generateEnhancedWithOpenAI(imageData, ragContext, baseUrl, apiKey, model) {
  const { base64, mimeType } = imageData;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: ENHANCED_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `请分析这张图片，结合以下参考提示词生成更优的逆向提示词：\n\n${ragContext}` }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Enhanced API error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return parseApiResponse(data.choices[0].message.content);
}

// Anthropic 协议增强生成
async function generateEnhancedWithAnthropic(imageData, ragContext, baseUrl, apiKey, model) {
  const { base64, mimeType } = imageData;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.7,
      system: ENHANCED_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: `请分析这张图片，结合以下参考提示词生成更优的逆向提示词：\n\n${ragContext}` }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Enhanced API error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return parseApiResponse(data.content[0].text);
}

// Parse API response
function parseApiResponse(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // 新格式：scene + tags + structured_prompt + natural_language_prompt
      if (parsed.natural_language_prompt) {
        return {
          scene: parsed.scene || '',
          tags: parsed.tags || [],
          structured_prompt: parsed.structured_prompt || parsed.json_prompt || null,
          natural_language_prompt: parsed.natural_language_prompt
        };
      }

      // 兜底：没有 natural_language_prompt，用原文
      return {
        scene: parsed.scene || '',
        tags: parsed.tags || [],
        structured_prompt: parsed.structured_prompt || parsed.json_prompt || parsed,
        natural_language_prompt: content
      };
    }
  } catch (e) {
    console.log('Failed to parse JSON, using raw content');
  }

  // Fallback: no structured JSON, use the entire response as natural language
  return {
    scene: '',
    tags: [],
    structured_prompt: null,
    natural_language_prompt: content
  };
}