import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const getAISuggestions = async (req: Request, res: Response) => {
  try {
    const { code, language, position, model } = req.body;
    const selectedModel = model || 'gemma4:31b-cloud';
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }
    const suggestions = await ollamaService.getCodeSuggestion(code, language || 'javascript', position, selectedModel);
    return res.json({ success: true, suggestions, model: selectedModel });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate suggestions' });
  }
};