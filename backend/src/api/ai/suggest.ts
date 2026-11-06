import { Request, Response } from 'express';
import { DEFAULT_MODEL, ollamaService } from '../../services/ollamaService.js';
import { AIInputError, BuiltPrompt, buildSuggestPrompt } from '../../services/aiPrompts.js';
import { AI_UNAVAILABLE } from './explain.js';

/**
 * POST /api/ai/suggest { code, language, model? }
 * Reviews the whole file and returns up to 5 concrete improvements, each with
 * a pasteable code block. Returns 503 if the model can't be reached.
 */
export const getAISuggestions = async (req: Request, res: Response) => {
  const { code, language, model } = req.body ?? {};

  let built: BuiltPrompt;
  try {
    built = buildSuggestPrompt({ code, language });
  } catch (error) {
    if (error instanceof AIInputError) return res.status(400).json({ success: false, error: error.message });
    throw error;
  }

  const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL;
  try {
    const suggestions = await ollamaService.generateCompletion(built.prompt, selectedModel, 0.3);
    return res.json({ success: true, suggestions, truncated: built.truncated, model: selectedModel });
  } catch (error) {
    console.error('Suggest error:', (error as Error).message);
    return res.status(503).json({ success: false, error: AI_UNAVAILABLE });
  }
};