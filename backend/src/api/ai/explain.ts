import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

export const explainCode = async (req: Request, res: Response) => {
  try {
    const { code, language, model } = req.body;
    const selectedModel = model || 'gemma4:31b-cloud';

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    const lang = language || 'javascript';
    let explanation: any;
    let aiGenerated = false;

    try {
      const aiExplanation = await ollamaService.explainCode(code, lang, selectedModel);
      explanation = {
        summary: aiExplanation,
        complexity: code.split('\n').length > 100 ? 'Complex' : code.split('\n').length > 30 ? 'Moderate' : 'Simple',
        lineCount: code.split('\n').length,
        language: lang,
        suggestions: ['Add comments for clarity', 'Consider error handling', 'Add type checking']
      };
      aiGenerated = true;
    } catch {
      explanation = generateFallbackExplanation(code, lang);
    }

    return res.json({ success: true, explanation, aiGenerated, model: selectedModel });
  } catch (error) {
    console.error('Error explaining code:', error);
    return res.status(500).json({ success: false, error: 'Failed to explain code' });
  }
};

function generateFallbackExplanation(code: string, language: string) {
  const lines = code.split('\n');
  const hasFunction = code.includes('function') || code.includes('def');
  const hasLoop = code.includes('for') || code.includes('while');
  const hasConditional = code.includes('if') || code.includes('else');
  const hasClass = code.includes('class') || code.includes('interface');

  let explanation = '';
  const suggestions: string[] = [];

  if (hasFunction) { explanation += 'This code defines functions. '; suggestions.push('Add JSDoc comments'); }
  if (hasLoop) { explanation += 'It uses loops. '; suggestions.push('Consider map/filter/reduce'); }
  if (hasConditional) explanation += 'The code uses conditionals. ';
  if (hasClass) { explanation += 'Object-oriented design used. '; suggestions.push('Follow SOLID principles'); }
  if (!explanation) explanation = 'Simple statements or expressions. ';

  return {
    summary: explanation + `Written in ${language}.`,
    complexity: lines.length > 50 ? 'Moderate' : 'Simple',
    lineCount: lines.length,
    language,
    hasFunctions: hasFunction,
    suggestions
  };
}