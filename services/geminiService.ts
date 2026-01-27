
import { GoogleGenAI } from "@google/genai";
import { ToneType } from "../types.ts";

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // We throw internally, but App.tsx handles this gracefully
    throw new Error("API_KEY_NOT_FOUND");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: `Linguistic Expert. Fix grammar, spelling, and phrasing. Tone: ${tone}. ${humanize ? 'Humanize phrasing rhythm.' : ''} Rule: Return ONLY corrected text. No explanations.`,
        temperature: humanize ? 0.4 : 0,
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text?.trim() || text;
  } catch (error: any) {
    console.error("Linguistic Engine failure:", error);
    // Return original text if anything goes wrong to avoid breaking UI
    return text;
  }
}
