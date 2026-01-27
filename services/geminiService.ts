
import { GoogleGenAI } from "@google/genai";
import { ToneType } from "../types";

const getSystemInstruction = (tone: ToneType) => {
  const toneMap: Record<ToneType, string> = {
    'Professional': 'Execute a high-level business edit. Use sophisticated, precise vocabulary and clear, authoritative syntax. Ensure total grammatical perfection.',
    'Friendly': 'Polished but warm and approachable. Use a natural, conversational flow that sounds like a helpful human peer. Keep it professional but light.',
    'Casual': 'Relaxed, modern English. Correct errors while maintaining a laid-back, informal vibe. Perfect for social contexts.',
    'Academic': 'Scholarly and rigorous. Ensure objective tone, complex sentence structures, and high-tier academic vocabulary. Eliminate all colloquialisms.',
    'Standard': 'Natural, native-level fluent English. Fix all grammar, spelling, and phrasing without changing the user\'s original intent.'
  };

  return `You are a Senior Linguistic Editor. Your mission is to provide the world's most accurate and natural English corrections instantly.
PRIMARY RULES:
1. Fix all grammatical errors (subject-verb agreement, tense consistency, articles).
2. Fix all spelling and punctuation.
3. Optimize phrasing for native-level flow and clarity.
4. STRICTLY adhere to this tone: ${toneMap[tone]}
5. NEVER add explanations, meta-commentary, or introductory text.
6. Return ONLY the polished, final text.`;
};

export async function correctText(text: string, tone: ToneType = 'Standard'): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: text,
      config: {
        systemInstruction: getSystemInstruction(tone),
        temperature: 0.1, // Near-zero temperature for maximum consistency and grammatical logic
        thinkingConfig: { thinkingBudget: 0 }, 
        topP: 0.9,
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from editor.");
    }

    return resultText.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
