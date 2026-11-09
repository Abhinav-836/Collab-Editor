import { Request, Response } from 'express';
import { DEFAULT_MODEL, ollamaService, normalizeToFreeModel } from '../../services/ollamaService.js';
import { AIInputError, BuiltPrompt, buildExplainPrompt } from '../../services/aiPrompts.js';

export const AI_UNAVAILABLE = 'The AI service is unavailable right now. Try again in a minute.';

/**
 * POST /api/ai/explain { code, selection?, language, model? }
 * Explains the selection (with the file as context), or the whole file.
 * If the model can't be reached this returns 503 — it never sends back a
 * made-up explanation.
 */
export const explainCode = async (req: Request, res: Response) => {
  const { code, selection, language, model } = req.body ?? {};

  let built: BuiltPrompt;
  try {
    built = buildExplainPrompt({ code, selection, language });
  } catch (error) {
    if (error instanceof AIInputError) return res.status(400).json({ success: false, error: error.message });
    throw error;
  }

  const selectedModel = normalizeToFreeModel(typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL);
  try {
    const explanation = await ollamaService.generateCompletion(built.prompt, selectedModel, 0.3);
    return res.json({
      success: true,
      explanation,
      scope: built.scope,
      truncated: built.truncated,
      model: selectedModel
    });
  } catch (error) {
    console.error('Explain error:', (error as Error).message);
    return res.status(503).json({ success: false, error: AI_UNAVAILABLE });
  }
};