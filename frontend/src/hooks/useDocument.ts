import { useState, useCallback, useRef } from 'react';

export function useDocument(initialContent: string = '') {
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(0);
  const isLocalChangeRef = useRef(false);

  const applyOperation = useCallback((operation: any) => {
    setContent(prev => {
      if (operation.type === 'insert') {
        return prev.slice(0, operation.position) + operation.chars + prev.slice(operation.position);
      } else if (operation.type === 'delete') {
        return prev.slice(0, operation.position) + prev.slice(operation.position + operation.length);
      }
      return prev;
    });
    setVersion(v => v + 1);
  }, []);

  const setLocalContent = useCallback((newContent: string) => {
    isLocalChangeRef.current = true;
    setContent(newContent);
    setVersion(v => v + 1);
  }, []);

  const reset = useCallback((newContent: string) => {
    setContent(newContent);
    setVersion(0);
  }, []);

  return {
    content,
    version,
    applyOperation,
    setLocalContent,
    reset,
    isLocalChange: isLocalChangeRef.current
  };
}