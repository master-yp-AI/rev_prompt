import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const VISION_API_URL = "https://token-plan-cn.xiaomimimo.com/v1/chat/completions";
const VISION_API_KEY = Deno.env.get("VISION_API_KEY")!;
const VISION_MODEL = "mimo-v2.5";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    const { imageBase64, mimeType, systemPrompt } = await req.json();

    const response = await fetch(VISION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VISION_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt || SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: "请分析这张图片并生成逆向提示词。" },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `Vision API error: ${response.status} ${err}` }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ content: data.choices[0].message.content }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});