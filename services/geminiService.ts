
import { GoogleGenAI } from "@google/genai";
import { ToneType } from "../types.ts";

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: `Linguistic Expert. Fix grammar/spelling/flow. Tone: ${tone}. ${humanize ? 'Humanize rhythm.' : ''} Return ONLY corrected text. No chat.`,
        temperature: humanize ? 0.4 : 0,
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text?.trim() || text;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes('API key') || error.message?.includes('401') || error.message?.includes('403')) {
      throw new Error("API_KEY_INVALID");
    }
    return text; // Return original as fallback
  }
}
