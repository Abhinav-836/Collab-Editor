import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const getModels = async (_req: Request, res: Response) => {
  try {
    const models = await ollamaService.getAvailableModels();
    return res.json({ success: true, models: models.map((m) => ({ name: m.name, id: m.name })) });
  } catch (error) {
    console.error('Failed to get models:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch models' });
  }
};