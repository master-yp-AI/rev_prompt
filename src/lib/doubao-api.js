// Doubao API Wrapper

const SYSTEM_PROMPT = `你是一个专业的AI图像分析专家，擅长逆向工程生成图像提示词。

请分析提供的图片，并生成以下内容：

1. 结构化JSON提示词 (json_prompt)，包含以下字段：
   - scene: { setting, background, lighting }
   - subject: { type, pose, expression, face, hair, eyes, skin, body }
   - clothing: { outfit, footwear, accessories }
   - environment_details: { props, textures }
   - camera: { angle, framing, focus, lens }
   - style: { realism, color_tone, effects, details }

2. 自然语言提示词 (natural_language_prompt) - 一段可以直接用于图像生成工具的详细描述

请严格以JSON格式返回，只包含json_prompt和natural_language_prompt两个字段。`;

// Analyze image using Doubao Vision API
async function analyzeImageWithDoubao(imageData, apiKey) {
  const { base64, mimeType } = imageData;

  // Using OpenAI-compatible endpoint
  const API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions';

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Doubao-Seed-2.0-Code',
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Parse the response
    return parseApiResponse(assistantMessage);

  } catch (error) {
    console.error('Doubao API error:', error);

    // If real API fails, return a mock response for testing
    // Remove this in production
    return getMockResponse();
  }
}

// Parse API response
function parseApiResponse(content) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        json_prompt: parsed.json_prompt || parsed,
        natural_language_prompt: parsed.natural_language_prompt || content
      };
    }
  } catch (e) {
    console.log('Failed to parse JSON, using raw content');
  }

  return {
    json_prompt: null,
    natural_language_prompt: content
  };
}

// Mock response for testing (remove in production)
function getMockResponse() {
  return {
    json_prompt: {
      scene: {
        setting: "tropical beach shoreline",
        background: "bright blue sky with turquoise ocean",
        lighting: "natural midday sunlight with soft shadows"
      },
      subject: {
        type: "person",
        pose: "standing casually",
        expression: "smiling",
        face: "natural features",
        hair: "sunlit hair",
        eyes: "bright eyes",
        skin: "natural skin tone",
        body: "relaxed posture"
      },
      clothing: {
        outfit: "summer clothing",
        footwear: "sandals",
        accessories: "sunglasses"
      },
      environment_details: {
        props: "beach items",
        textures: "sand and water"
      },
      camera: {
        angle: "eye-level",
        framing: "medium shot",
        focus: "sharp focus",
        lens: "standard lens"
      },
      style: {
        realism: "photorealistic",
        color_tone: "vibrant",
        effects: "natural",
        details: "high detail"
      }
    },
    natural_language_prompt: "A photorealistic image of a person standing on a tropical beach shoreline with bright blue sky and turquoise ocean in the background. Natural midday sunlight with soft shadows. The person is wearing summer clothing and sandals, with a relaxed posture and smiling expression. Vibrant colors, high detail, sharp focus."
  };
}
