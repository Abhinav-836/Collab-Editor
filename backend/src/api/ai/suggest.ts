import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const getAISuggestions = async (req: Request, res: Response) => {
  try {
    const { code, language, position, model } = req.body;
    const selectedModel = model || 'llama3.2'; // Default model
    
    const suggestions = await ollamaService.getCodeSuggestion(code, language, position, selectedModel);
    
    res.json({ success: true, suggestions, model: selectedModel });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate suggestions' });
  }
};