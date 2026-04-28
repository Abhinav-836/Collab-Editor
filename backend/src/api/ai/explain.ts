import { Request, Response } from 'express';
import { ollamaService } from '../../services/ollamaService.js';

interface ExplainRequest {
  code: string;
  language: string;
  selectedLines?: number[];
  model?: string;
}

export const explainCode = async (req: Request, res: Response) => {
  try {
    const { code, language, selectedLines, model } = req.body;
    const selectedModel = model || 'llama3.2';
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }
    
    // Try to get AI explanation first
    let explanation;
    let aiGenerated = false;
    
    try {
      const aiExplanation = await ollamaService.explainCode(code, language, selectedModel);
      explanation = generateStructuredExplanation(code, language, aiExplanation);
      aiGenerated = true;
    } catch (error) {
      console.log('Ollama not available, using fallback');
      explanation = generateFallbackExplanation(code, language);
      aiGenerated = false;
    }
    
    res.json({
      success: true,
      explanation: explanation,
      aiGenerated: aiGenerated,
      model: selectedModel
    });
  } catch (error) {
    console.error('Error explaining code:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to explain code' 
    });
  }
};

function generateStructuredExplanation(code: string, language: string, aiExplanation: string) {
  const lines = code.split('\n').length;
  
  return {
    summary: aiExplanation,
    complexity: lines > 100 ? 'Complex' : lines > 30 ? 'Moderate' : 'Simple',
    lineCount: lines,
    suggestions: ['Add comments for clarity', 'Consider error handling', 'Add type checking'],
    aiGenerated: true
  };
}

function generateFallbackExplanation(code: string, language: string) {
  const lines = code.split('\n');
  const hasFunction = code.includes('function') || code.includes('def');
  const hasLoop = code.includes('for') || code.includes('while');
  const hasConditional = code.includes('if') || code.includes('else');
  const hasClass = code.includes('class') || code.includes('interface');
  
  let explanation = '';
  const suggestions: string[] = [];
  
  if (hasFunction) {
    explanation += 'This code defines functions for modularity and reusability. ';
    suggestions.push('Consider adding JSDoc/docstring comments');
  }
  
  if (hasLoop) {
    explanation += 'It uses loops for iteration over data structures. ';
    suggestions.push('Consider using array methods like map/filter/reduce');
  }
  
  if (hasConditional) {
    explanation += 'The code handles different paths using conditionals. ';
  }
  
  if (hasClass) {
    explanation += 'Object-oriented design is implemented using classes. ';
    suggestions.push('Follow SOLID principles');
  }
  
  if (!explanation) {
    explanation = 'This appears to be simple statements or expressions. ';
  }
  
  explanation += `Written in ${language}.`;
  
  return {
    summary: explanation,
    complexity: lines.length > 50 ? 'Moderate' : 'Simple',
    lineCount: lines.length,
    hasFunctions: hasFunction,
    suggestions: suggestions,
    aiGenerated: false
  };
}