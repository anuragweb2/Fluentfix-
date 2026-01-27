
import { GoogleGenAI } from "@google/genai";
import { ToneType } from "../types.ts";

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  // Creating instance here ensures it uses the most current API key from the environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: text,
      config: {
        systemInstruction: `Task: Professional Grammar/Fluency Correction. 
        Tone: ${tone}. 
        ${humanize ? 'Humanize phrasing: use natural rhythm and idiomatic flow.' : ''} 
        Rule: Return ONLY the corrected text. NO conversational filler.`,
        temperature: humanize ? 0.6 : 0.1,
        topP: 0.9,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text?.trim() || text;
  } catch (error: any) {
    console.error("Linguistic Engine Error:", error);
    // Return original text if error occurs to maintain usability
    return text;
  }
}
