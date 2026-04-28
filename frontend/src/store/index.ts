export { useEditorStore } from './editorStore';
export { useRoomStore } from './roomStore';
export { useCursorStore } from './cursorStore';
export { useSettingsStore } from './settingsStore';

// Combined store hook
import { useEditorStore } from './editorStore';
import { useRoomStore } from './roomStore';
import { useCursorStore } from './cursorStore';
import { useSettingsStore } from './settingsStore';

export const useStore = () => {
  const editor = useEditorStore();
  const room = useRoomStore();
  const cursor = useCursorStore();
  const settings = useSettingsStore();
  
  return {
    editor,
    room,
    cursor,
    settings,
    // Combined actions
    resetAll: () => {
      editor.resetSettings();
      room.clearRoom();
      cursor.clearCursors();
    }
  };
};