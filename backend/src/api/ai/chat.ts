import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const chat = async (req: Request, res: Response) => {
  try {
    const { message, code, language, model, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    const selectedModel = model || 'gemma4:31b-cloud';
    const lang = language || 'javascript';

    const context = `
You are an AI coding assistant. The user is working with ${lang} code.

Current code:
\`\`\`${lang}
${code || '// No code yet'}
\`\`\`

Conversation history:
${Array.isArray(history) ? history.map((h: any) => `${h.role}: ${h.content}`).join('\n') : 'No previous messages'}

User: ${message}

Assistant: Help with the code. Provide concise, actionable responses.`;

    const response = await ollamaService.generateCompletion(context, selectedModel);
    return res.json({ success: true, response, model: selectedModel });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get response',
      response: 'Sorry, I encountered an error. Please try again.'
    });
  }
};