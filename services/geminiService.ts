
import { GoogleGenAI } from "@google/genai";
import { ToneType } from "../types.ts";

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  // Initializing within the function as per guidelines to ensure fresh context
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: `Linguistic Expert. Fix grammar/spelling/flow. Tone: ${tone}. ${humanize ? 'Humanize phrasing.' : ''} Return ONLY the corrected text. No explanations.`,
        temperature: humanize ? 0.4 : 0, // 0 is fastest/most stable for standard correction
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for immediate output
      },
    });

    return response.text?.trim() || text;
  } catch (error: any) {
    // Silent fallback to original text if API fails, ensuring the UI never breaks
    console.warn("Fast-path fallback triggered");
    return text;
  }
}
