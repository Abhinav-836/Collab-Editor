import { Request, Response } from 'express';
import { DEFAULT_MODEL, ollamaService } from '../../services/ollamaService.js';
import { AI_UNAVAILABLE } from './explain.js';

export const chat = async (req: Request, res: Response) => {
  const { message, code, language, model, history } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }
  const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL;
  const lang = typeof language === 'string' && language ? language : 'javascript';

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

  try {
    const response = await ollamaService.generateCompletion(context, selectedModel);
    return res.json({ success: true, response, model: selectedModel });
  } catch (error) {
    console.error('Chat error:', (error as Error).message);
    // No `response` field here: the client must show this as a failure,
    // not as an assistant reply.
    return res.status(503).json({ success: false, error: AI_UNAVAILABLE });
  }
};