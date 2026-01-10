
import { GoogleGenAI, Type } from "@google/genai";

// ============================================================================
// 全局配置区域 (Configuration)
// ============================================================================
// 支持 'gemini' (Google SDK) 或 'openai' (通用兼容格式，如 DeepSeek, Moonshot 等)
type AIProvider = 'gemini' | 'openai';

export const API_CONFIG = {
  // 1. 选择提供商: 'gemini' 或 'openai'
  provider: 'openai' as AIProvider, 

  // 2. API Key (从环境变量读取)
  apiKey: process.env.API_KEY,
  
  // 3. 模型 ID
  // Gemini 示例: 'gemini-3-flash-preview', 'gemini-2.0-flash'
  // DeepSeek 示例: 'deepseek-chat', 'deepseek-reasoner'
  modelId: 'deepseek-chat',
  
  // 4. Base URL
  // Gemini (SDK自动处理，通常留空或默认): 'https://generativelanguage.googleapis.com'
  // DeepSeek: 'https://api.deepseek.com'
  // Local/Ollama: 'http://localhost:11434/v1'
  baseUrl: 'https://api.deepseek.com',

  // 5. 超时设置 (毫秒)
  timeout: 30000
};

// ============================================================================
// 统一请求接口 (Unified Request Interface)
// ============================================================================

// 初始化 Gemini 客户端 (仅在 provider 为 gemini 时使用)
const googleClient = new GoogleGenAI({ apiKey: API_CONFIG.apiKey });

/**
 * 将 Google GenAI 的 Schema 对象转换为简单的 JSON 描述字符串，
 * 用于在 DeepSeek/OpenAI 模式下提示模型输出 JSON。
 */
function schemaToDescription(schema: any): string {
    if (!schema || !schema.properties) return "JSON Object";
    // 简单递归简化 schema 用于提示词
    const simplify = (s: any): any => {
        if (s.type === Type.ARRAY) return [simplify(s.items)];
        if (s.type === Type.OBJECT) {
            const obj: any = {};
            for (const key in s.properties) {
                obj[key] = simplify(s.properties[key]);
            }
            return obj;
        }
        return s.type || "string";
    };
    try {
        return JSON.stringify(simplify(schema), null, 2);
    } catch (e) {
        return "Valid JSON format";
    }
}

/**
 * 统一的 JSON 请求函数
 * @param prompt 提示词
 * @param responseSchema 期望的返回结构 (使用 Google SDK 的 Type 定义)
 * @returns 解析后的 JSON 对象
 */
export async function requestJSON<T>(prompt: string, responseSchema?: any): Promise<T> {
  const { provider, apiKey, baseUrl, modelId } = API_CONFIG;

  // --------------------------------------------------------------------------
  // 分支 1: Google Gemini (Native SDK)
  // --------------------------------------------------------------------------
  if (provider === 'gemini') {
    const result = await googleClient.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    
    // SDK returns .text property directly
    const text = result.text;
    if (!text) throw new Error("Gemini returned empty response");
    
    return JSON.parse(text) as T;
  }

  // --------------------------------------------------------------------------
  // 分支 2: OpenAI Compatible (DeepSeek, etc.) via Fetch
  // --------------------------------------------------------------------------
  if (provider === 'openai') {
    // 构造请求体
    // 对于 DeepSeek/OpenAI，我们需要在 Prompt 中显式强调 JSON 格式，因为 strict schema 支持各家不同
    // 我们将 schema 转换为字符串描述附加在 prompt 后
    let finalPrompt = prompt;
    if (responseSchema) {
        finalPrompt += `\n\n[SYSTEM REQUIREMENT]: You MUST strictly output valid JSON. Do not include markdown formatting (like \`\`\`json). The JSON structure must match:\n${schemaToDescription(responseSchema)}`;
    }

    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: "You are a creative storyteller and game engine. You respond strictly in JSON." },
        { role: "user", content: finalPrompt }
      ],
      response_format: { type: "json_object" }, // 大多数兼容接口支持此参数
      temperature: 0.7
    };

    // 处理 URL，确保 /chat/completions 路径正确
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("API returned empty content");
    
    // 清理可能的 Markdown 标记 (DeepSeek 有时会加上 ```json ...)
    const cleanContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(cleanContent) as T;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
