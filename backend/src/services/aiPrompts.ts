/**
 * Prompt building + input validation for the AI assistant's actions.
 * Kept free of network calls so it can be unit-tested.
 */

/** Longest file we send to the model; the rest is cut and the model is told. */
export const MAX_AI_CODE_CHARS = 60_000;
/** Longest selection we explain. */
export const MAX_AI_SELECTION_CHARS = 20_000;

export class AIInputError extends Error {}

export interface BuiltPrompt {
  prompt: string;
  /** What was sent: just the selection, or the whole file. */
  scope: 'selection' | 'file';
  /** True if the file was longer than MAX_AI_CODE_CHARS and was cut. */
  truncated: boolean;
}

const asLanguage = (language: unknown): string =>
  typeof language === 'string' && /^[a-z0-9+#-]{1,20}$/i.test(language) ? language : 'plaintext';

function requireCode(code: unknown): string {
  if (typeof code !== 'string' || !code.trim()) {
    throw new AIInputError('The file is empty. Write some code first.');
  }
  return code;
}

function clip(text: string, max: number): { text: string; truncated: boolean } {
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text, truncated: false };
}

/**
 * A fence longer than any backtick run inside the code, so code that itself
 * contains ``` (e.g. a Markdown file) can't close the block early.
 */
export function fence(code: string, language: string): string {
  const longestRun = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(longestRun + 1);
  return `${ticks}${language}\n${code}\n${ticks}`;
}

/**
 * Explain the selection (with the file as context), or the whole file if
 * nothing is selected.
 */
export function buildExplainPrompt(input: { code: unknown; selection?: unknown; language?: unknown }): BuiltPrompt {
  const code = requireCode(input.code);
  const language = asLanguage(input.language);
  const file = clip(code, MAX_AI_CODE_CHARS);
  const cutNote = file.truncated ? '\n(The file was too long and has been cut off here.)' : '';

  const selection = typeof input.selection === 'string' ? input.selection : '';
  if (selection.trim()) {
    if (selection.length > MAX_AI_SELECTION_CHARS) {
      throw new AIInputError(
        `The selection is too long to explain (${selection.length.toLocaleString('en-US')} characters, max ${MAX_AI_SELECTION_CHARS.toLocaleString('en-US')}). Select a smaller part.`
      );
    }
    return {
      scope: 'selection',
      truncated: file.truncated,
      prompt: `You are helping a developer understand ${language} code in a shared code editor.

Explain the SELECTED code below: what it does, how it works step by step, and anything worth noticing (edge cases, bugs, side effects). Use the full file only as context — do not explain the rest of it.

Be concise: short paragraphs or a short list. Do not use Markdown headings or bold text. Only include a code block if it genuinely helps.

Selected code:
${fence(selection, language)}

Full file, for context:
${fence(file.text, language)}${cutNote}`
    };
  }

  return {
    scope: 'file',
    truncated: file.truncated,
    prompt: `You are helping a developer understand a ${language} file in a shared code editor.

Explain what this file does: its purpose, its main parts, and how they fit together. Mention anything surprising (edge cases, bugs, side effects).

Be concise: short paragraphs or a short list. Do not use Markdown headings or bold text. Do not repeat the code back.

${fence(file.text, language)}${cutNote}`
  };
}

/** Concrete, ranked improvement suggestions for the whole file. */
export function buildSuggestPrompt(input: { code: unknown; language?: unknown }): BuiltPrompt {
  const code = requireCode(input.code);
  const language = asLanguage(input.language);
  const file = clip(code, MAX_AI_CODE_CHARS);
  const cutNote = file.truncated ? '\n(The file was too long and has been cut off here.)' : '';

  return {
    scope: 'file',
    truncated: file.truncated,
    prompt: `Review this ${language} file and suggest up to 5 concrete improvements, most important first. Look for bugs, unhandled edge cases, security problems, performance problems and unclear code.

For each suggestion, write:
1. A one-line title on its own line, starting with the number (e.g. "1. Handle an empty list").
2. One or two sentences on why it matters, naming the function or line it applies to.
3. The corrected code in a fenced code block, containing only the part that changes, so it can be pasted in.

Rules:
- Only report real problems you can point to in this code. Do not invent issues.
- If the code is already solid, say so in one sentence and give at most two minor suggestions.
- Do not rewrite the whole file. Do not use Markdown headings or bold text.

${fence(file.text, language)}${cutNote}`
  };
}