
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ToneType, Challenge } from "../types.ts";

/**
 * Manual base64 decoding implementation for audio processing.
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
 * AI Writing Assistant Core Logic
 * Fixes grammar, spelling, punctuation, and phrasing instantly.
 */
export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  // Initialize right before use to ensure API key availability
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: `Fix errors in grammar, spelling, and phrasing. 
Tone: ${tone}. 
Style: ${humanize ? 'Natural human flow' : 'Direct professional'}. 
Output: ONLY the improved text. NO commentary.`,
        temperature: humanize ? 0.4 : 0.1,
        thinkingConfig: { thinkingBudget: 0 } // Speed-optimized
      },
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Linguistic Engine Error:", error);
    return text;
  }
}

/**
 * Educational Challenge Generator
 */
export async function generateChallenges(text: string): Promise<Challenge[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create 3 interactive grammar challenges for: "${text}"`,
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
        },
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Challenge Engine Error:", error);
    return [];
  }
}

/**
 * Speech Synthesis (TTS)
 */
export async function speakText(text: string, tone: ToneType): Promise<Uint8Array> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const voiceMap: Record<ToneType, string> = {
    'Standard': 'Kore',
    'Professional': 'Charon',
    'Friendly': 'Puck',
    'Casual': 'Zephyr',
    'Academic': 'Fenrir'
  };

  try {
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
    if (!base64Audio) throw new Error("No audio returned");

    return decode(base64Audio);
  } catch (error) {
    console.error("TTS Engine Error:", error);
    throw error;
  }
}
