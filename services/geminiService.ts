import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSnakeName = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Generate a single, cool, short username (max 12 chars) for a competitive snake game player. Do not include quotes or extra text.",
    });
    return response.text?.trim() || "Viper";
  } catch (error) {
    console.error("Failed to generate name:", error);
    return "Unknown";
  }
};

export const generateGameOverCommentary = async (score: number, kills: number, playerName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `The player named "${playerName}" just finished a game of snake. 
      Score: ${score}. 
      Snakes Defeated: ${kills}.
      
      Write a witty, sarcastic, or encouraging 1-sentence comment about their performance. Max 20 words.`,
    });
    return response.text?.trim() || "Game Over. Try again!";
  } catch (error) {
    console.error("Failed to generate commentary:", error);
    return "Great effort! Play again?";
  }
};