export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extension: 'js', monacoId: 'javascript', runnable: true },
  { id: 'typescript', name: 'TypeScript', extension: 'ts', monacoId: 'typescript', runnable: true },
  { id: 'python', name: 'Python', extension: 'py', monacoId: 'python', runnable: true },
  { id: 'java', name: 'Java', extension: 'java', monacoId: 'java', runnable: true },
  { id: 'cpp', name: 'C++', extension: 'cpp', monacoId: 'cpp', runnable: true },
  { id: 'go', name: 'Go', extension: 'go', monacoId: 'go', runnable: true },
  { id: 'rust', name: 'Rust', extension: 'rs', monacoId: 'rust', runnable: true },
  { id: 'html', name: 'HTML', extension: 'html', monacoId: 'html', runnable: false },
  { id: 'css', name: 'CSS', extension: 'css', monacoId: 'css', runnable: false },
  { id: 'json', name: 'JSON', extension: 'json', monacoId: 'json', runnable: false }
];

export const DEFAULT_LANGUAGE = 'javascript';

export const getLanguage = (monacoId: string) =>
  SUPPORTED_LANGUAGES.find((l) => l.monacoId === monacoId) ?? SUPPORTED_LANGUAGES[0];