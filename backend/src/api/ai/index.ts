import { Router } from 'express';
import { getAISuggestions } from './suggest.js';
import { explainCode } from './explain.js';
import { getModels } from './models.js';
import { chat } from './chat.js';

const router = Router();

router.post('/suggest', getAISuggestions);
router.post('/explain', explainCode);
router.post('/chat', chat);  // Add this line
router.get('/models', getModels);

export { router as aiRoutes };