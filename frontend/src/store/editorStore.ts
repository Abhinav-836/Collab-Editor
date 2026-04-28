import { create } from 'zustand';

interface EditorState {
  content: string;
  language: string;
  theme: string;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  lineNumbers: 'on' | 'off';
  
  // Actions
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: string) => void;
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  toggleLineNumbers: () => void;
  resetSettings: () => void;
}

const defaultContent = `// Welcome to Collaborative Code Editor!
// Share this room with friends to code together in real-time.
// Start typing...

function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`;

export const useEditorStore = create<EditorState>((set) => ({
  // Initial state
  content: defaultContent,
  language: 'javascript',
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: false,
  lineNumbers: 'on',
  
  // Actions
  setContent: (content) => set({ content }),
  
  setLanguage: (language) => set({ language }),
  
  setTheme: (theme) => set({ theme }),
  
  setFontSize: (fontSize) => set({ fontSize }),
  
  setTabSize: (tabSize) => set({ tabSize }),
  
  toggleWordWrap: () => set((state) => ({ 
    wordWrap: state.wordWrap === 'on' ? 'off' : 'on' 
  })),
  
  toggleMinimap: () => set((state) => ({ 
    minimap: !state.minimap 
  })),
  
  toggleLineNumbers: () => set((state) => ({ 
    lineNumbers: state.lineNumbers === 'on' ? 'off' : 'on' 
  })),
  
  resetSettings: () => set({
    language: 'javascript',
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
    minimap: false,
    lineNumbers: 'on'
  })
}));