import { Request, Response } from 'express';
import {
  codeRunner,
  MAX_CODE_CHARS,
  MAX_STDIN_CHARS,
  RunnerInputError,
  RUNNABLE_LANGUAGES
} from '../services/codeRunner.js';

/** POST /api/run { language, code, stdin? } */
export const runCode = async (req: Request, res: Response) => {
  const { language, code, stdin } = req.body ?? {};

  if (typeof language !== 'string' || !RUNNABLE_LANGUAGES.includes(language)) {
    return res.status(400).json({
      success: false,
      error: `Can't run ${typeof language === 'string' ? language : 'this language'}. Runnable: ${RUNNABLE_LANGUAGES.join(', ')}`
    });
  }
  if (typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ success: false, error: 'There is no code to run' });
  }
  if (code.length > MAX_CODE_CHARS) {
    return res.status(413).json({ success: false, error: 'Code is too large to run' });
  }
  if (stdin !== undefined && (typeof stdin !== 'string' || stdin.length > MAX_STDIN_CHARS)) {
    return res.status(400).json({ success: false, error: 'Input (stdin) is too large' });
  }

  try {
    const result = await codeRunner.run(language, code, stdin ?? '');
    return res.json({ success: true, result });
  } catch (err) {
    if (err instanceof RunnerInputError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error('Run failed:', (err as Error).message);
    return res.status(502).json({ success: false, error: (err as Error).message || 'Code runner failed' });
  }
};