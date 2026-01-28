
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ToneType, Challenge } from "../types.ts";

/**
 * Ensures the API key is accessible from the environment.
 * In Studio environments, this triggers the platform's native key selection.
 */
async function ensureEnvironmentReady() {
  if (typeof (window as any).aistudio !== 'undefined') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }
}

/**
 * Helper to clean JSON strings that might contain markdown backticks
 */
function cleanJsonString(jsonStr: string): string {
  return jsonStr.replace(/```json\n?|```/g, '').trim();
}

/**
 * PCM decoding for high-fidelity audio output.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Linguistic Correction Engine
 */
export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  await ensureEnvironmentReady();
  
  // Rule: Must use new GoogleGenAI({ apiKey: process.env.API_KEY })
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: text,
    config: {
      systemInstruction: `Professional Linguistic Editor: Correct grammar, spelling, and phrasing errors. 
Tone: ${tone}. 
Style: ${humanize ? 'Human-like professional' : 'Concise & Clear'}. 
Output: Return ONLY the fixed text. No commentary or metadata.`,
      temperature: humanize ? 0.4 : 0.1,
      topP: 0.95,
    },
  });

  const output = response.text?.trim();
  if (!output) throw new Error("Empty response from AI");
  return output;
}

/**
 * Learning Challenge Engine
 */
export async function generateChallenges(text: string): Promise<Challenge[]> {
  await ensureEnvironmentReady();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create 3 interactive grammar/vocabulary challenges for: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            originalPart: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['grammar', 'spelling', 'vocabulary', 'phrasing'] }
          },
          required: ['id', 'originalPart', 'options', 'correctIndex', 'explanation', 'type']
        }
      }
    }
  });

  const cleaned = cleanJsonString(response.text || "[]");
  return JSON.parse(cleaned);
}

/**
 * High-Quality Speech Synthesis
 */
export async function speakText(text: string, tone: ToneType): Promise<Uint8Array> {
  await ensureEnvironmentReady();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const voiceMap: Record<ToneType, string> = {
    'Standard': 'Kore',
    'Professional': 'Charon',
    'Friendly': 'Puck',
    'Casual': 'Zephyr',
    'Academic': 'Fenrir'
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceMap[tone] || 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");

  return decode(base64Audio);
}
