import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const chat = async (req: Request, res: Response) => {
  try {
    const { message, code, language, model, history } = req.body;
    const selectedModel = model || 'llama3.2';
    
    // Build context from current code
    const context = `
You are an AI coding assistant. The user is working with ${language} code.

Current code:
\`\`\`${language}
${code || '// No code yet'}
\`\`\`

Conversation history:
${history?.map((h: any) => `${h.role}: ${h.content}`).join('\n') || 'No previous messages'}

User: ${message}

Assistant: Help with the code. Provide concise, actionable responses. If suggesting code changes, use code blocks with language specification.`;

    const response = await ollamaService.generateCompletion(context, selectedModel);
    
    res.json({
      success: true,
      response: response,
      model: selectedModel
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get response',
      response: 'Sorry, I encountered an error. Please try again.'
    });
  }
};