import { Request, Response } from 'express';
import { DEFAULT_MODEL, ollamaService, normalizeToFreeModel } from '../../services/ollamaService.js';
import { AI_UNAVAILABLE } from './explain.js';
import { MAX_AI_CODE_CHARS } from '../../services/aiPrompts.js';

// Caps on what goes into one prompt (each token is paid for)
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 2_000;
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

export const chat = async (req: Request, res: Response) => {
  const { message, code, language, model, history } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ success: false, error: `Keep messages under ${MAX_MESSAGE_CHARS} characters` });
  }
  const selectedModel = normalizeToFreeModel(typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL);
  const lang = typeof language === 'string' && language ? clip(language, 40) : 'javascript';
  const recent = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];

  const context = `
You are an AI coding assistant. The user is working with ${lang} code.

Current code:
\`\`\`${lang}
${clip(code, MAX_AI_CODE_CHARS) || '// No code yet'}
\`\`\`

Conversation history:
${recent.length ? recent.map((h: any) => `${clip(h?.role, 20)}: ${clip(h?.content, MAX_HISTORY_CHARS)}`).join('\n') : 'No previous messages'}

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