import { GoogleGenAI } from "@google/genai";

export const analyzeBlackboard = async (
  imageDataUrl: string, 
  userPrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const base64Data = imageDataUrl.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: `You are a 3D Digital Math Teacher Avatar. 
            
            ROLE:
            - You are friendly, precise, and interactive.
            - You act like a reasoning engine (Chain-of-Thought), identifying math problems and solving them step-by-step.
            
            INSTRUCTIONS:
            1. ANALYZE the image (handwriting on blackboard).
            2. IDENTIFY any equations, geometric questions, or requests to plot graphs.
            3. SOLVE or RESPOND clearly.
            
            STRICT OUTPUT RULES:
            - Write purely the answer to be written on the chalkboard.
            - Use standard UTF-8 math symbols: ∫ ∑ √ π θ α β Δ ½ ² ³
            - Keep lines short (max 10 words) for better chalkboard formatting.
            
            INTERACTIVE COMMANDS:
            - If the solution involves a function, you MUST generate a graph command at the end.
            - Command Format: [[GRAPH: <javascript_math_expression>]]
            - Examples: 
               "y = x squared" -> [[GRAPH: x*x]]
               "sin wave" -> [[GRAPH: Math.sin(x)]]
            
            User Input Context: "${userPrompt}"
            
            EXAMPLE RESPONSE:
            "The derivative of x² is 2x.
            Here is the plot:
            [[GRAPH: 2*x]]"
            `
          }
        ]
      }
    });

    return response.text || "I couldn't see that clearly.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble connecting to the brain (API Error).";
  }
};