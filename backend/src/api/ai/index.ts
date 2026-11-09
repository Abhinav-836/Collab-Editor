import { Router } from 'express';
import { getAISuggestions } from './suggest.js';
import { explainCode } from './explain.js';
import { getModels } from './models.js';
import { chat } from './chat.js';
import { aiQuota } from '../../middleware/aiQuota.js';

const router = Router();

// Each of these is a paid Ollama call: daily limits per visitor and in total
router.post('/suggest', aiQuota, getAISuggestions);
router.post('/explain', aiQuota, explainCode);
router.post('/chat', aiQuota, chat);
router.get('/models', getModels);

export { router as aiRoutes };