
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ToneType, Challenge } from "../types.ts";

/**
 * Manual base64 decoding implementation as required by guidelines.
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

const ai = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  // Using Flash model for near-instant results as requested
  const modelName = 'gemini-3-flash-preview';
  
  try {
    const response = await ai().models.generateContent({
      model: modelName,
      contents: text,
      config: {
        systemInstruction: `You are a world-class senior linguistic editor. 
        Your goal: Absolute perfection in English. 
        
        TASK:
        1. Fix ALL errors (grammar, spelling, punctuation).
        2. Adjust phrasing to be clear and sophisticated.
        3. Tone: ${tone}.
        4. ${humanize ? 'HUMANIZE: Use varied structures to mimic a professional human writer.' : 'OPTIMIZE: Ensure maximum clarity and precision.'}
        
        RULES:
        - Return ONLY the improved text. 
        - NO commentary. NO explanations.`,
        temperature: humanize ? 0.4 : 0.1,
        topP: 0.95,
        // Disable thinking budget for maximum speed
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Linguistic Engine Error:", error);
    return text;
  }
}

export async function generateChallenges(text: string): Promise<Challenge[]> {
  try {
    const response = await ai().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create 3 interactive grammar/phrasing challenges based on this text: "${text}".
      For each challenge, identify a mistake, provide 3 correction options, and a brief explanation.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              originalPart: { type: Type.STRING, description: 'The specific incorrect word or phrase' },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Three options including the correct one' },
              correctIndex: { type: Type.INTEGER, description: 'The 0-based index of the correct option' },
              explanation: { type: Type.STRING, description: 'Why this is correct' },
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

export async function speakText(text: string, tone: ToneType): Promise<Uint8Array> {
  const voiceMap: Record<ToneType, string> = {
    'Standard': 'Kore',
    'Professional': 'Charon',
    'Friendly': 'Puck',
    'Casual': 'Zephyr',
    'Academic': 'Fenrir'
  };

  try {
    const response = await ai().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this ${tone} text naturally: ${text}` }] }],
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
