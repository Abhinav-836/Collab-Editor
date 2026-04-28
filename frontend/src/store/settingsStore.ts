import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // User preferences
  userName: string;
  preferredLanguage: string;
  preferredTheme: string;
  autoSave: boolean;
  autoSaveInterval: number;
  showLineNumbers: boolean;
  enableAI: boolean;
  
  // UI settings
  sidebarOpen: boolean;
  activeTab: 'editor' | 'ai' | 'settings';
  
  // Actions
  setUserName: (name: string) => void;
  setPreferredLanguage: (language: string) => void;
  setPreferredTheme: (theme: string) => void;
  toggleAutoSave: () => void;
  setAutoSaveInterval: (interval: number) => void;
  toggleShowLineNumbers: () => void;
  toggleEnableAI: () => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: 'editor' | 'ai' | 'settings') => void;
  resetSettings: () => void;
}

const defaultSettings = {
  userName: '',
  preferredLanguage: 'javascript',
  preferredTheme: 'vs-dark',
  autoSave: true,
  autoSaveInterval: 10000, // 10 seconds
  showLineNumbers: true,
  enableAI: true,
  sidebarOpen: false,
  activeTab: 'editor' as const
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      
      setUserName: (userName) => set({ userName }),
      
      setPreferredLanguage: (preferredLanguage) => set({ preferredLanguage }),
      
      setPreferredTheme: (preferredTheme) => set({ preferredTheme }),
      
      toggleAutoSave: () => set((state) => ({ autoSave: !state.autoSave })),
      
      setAutoSaveInterval: (autoSaveInterval) => set({ autoSaveInterval }),
      
      toggleShowLineNumbers: () => set((state) => ({ showLineNumbers: !state.showLineNumbers })),
      
      toggleEnableAI: () => set((state) => ({ enableAI: !state.enableAI })),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setActiveTab: (activeTab) => set({ activeTab }),
      
      resetSettings: () => set(defaultSettings)
    }),
    {
      name: 'collab-editor-settings', // localStorage key
      partialize: (state) => ({
        userName: state.userName,
        preferredLanguage: state.preferredLanguage,
        preferredTheme: state.preferredTheme,
        autoSave: state.autoSave,
        autoSaveInterval: state.autoSaveInterval,
        showLineNumbers: state.showLineNumbers,
        enableAI: state.enableAI
      })
    }
  )
);