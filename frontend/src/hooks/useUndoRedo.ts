import { useState, useCallback, useRef } from 'react';

interface HistoryState {
  content: string;
  timestamp: number;
}

export function useUndoRedo(initialContent: string = '', maxHistory: number = 50) {
  const [content, setContent] = useState(initialContent);
  const [undoStack, setUndoStack] = useState<HistoryState[]>([{ content: initialContent, timestamp: Date.now() }]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  const isUndoRedoRef = useRef(false);

  const pushToHistory = useCallback((newContent: string) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    setUndoStack(prev => {
      const newStack = [...prev, { content: newContent, timestamp: Date.now() }];
      if (newStack.length > maxHistory) {
        return newStack.slice(-maxHistory);
      }
      return newStack;
    });
    setRedoStack([]);
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (undoStack.length <= 1) return;
    
    const newUndoStack = [...undoStack];
    const lastState = newUndoStack.pop()!;
    const previousState = newUndoStack[newUndoStack.length - 1];
    
    isUndoRedoRef.current = true;
    setContent(previousState.content);
    setUndoStack(newUndoStack);
    setRedoStack(prev => [...prev, lastState]);
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop()!;
    
    isUndoRedoRef.current = true;
    setContent(nextState.content);
    setUndoStack(prev => [...prev, nextState]);
    setRedoStack(newRedoStack);
  }, [redoStack]);

  const canUndo = undoStack.length > 1;
  const canRedo = redoStack.length > 0;

  return {
    content,
    setContent: (newContent: string) => {
      setContent(newContent);
      pushToHistory(newContent);
    },
    undo,
    redo,
    canUndo,
    canRedo
  };
}