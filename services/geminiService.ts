
import { GoogleGenAI, Modality } from "@google/genai";
import { ToneType } from "../types.ts";

const ai = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function correctText(text: string, tone: ToneType = 'Standard', humanize: boolean = false): Promise<string> {
  // Use Pro for heavy-lifting tones, Flash for speed on others
  const modelName = (tone === 'Academic' || tone === 'Professional') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  try {
    const response = await ai().models.generateContent({
      model: modelName,
      contents: text,
      config: {
        systemInstruction: `Act as a senior linguistic editor.
        Task: Correct grammar, spelling, punctuation, and phrasing.
        Current Tone: ${tone}.
        ${humanize ? 'Constraint: Use natural, rhythmic phrasing that mimics human speech patterns. Avoid predictable AI sentence structures.' : 'Constraint: Ensure maximum clarity and precision.'}
        Output: Return ONLY the improved version. No meta-commentary.`,
        temperature: humanize ? 0.7 : 0.1,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Linguistic Engine Error:", error);
    return text;
  }
}

export async function speakText(text: string, tone: ToneType): Promise<ArrayBuffer> {
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

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("TTS Engine Error:", error);
    throw error;
  }
}
