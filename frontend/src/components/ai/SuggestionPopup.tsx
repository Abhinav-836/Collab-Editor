import React, { useState, useEffect } from 'react';

interface SuggestionPopupProps {
  suggestions: string[];
  position: { x: number; y: number };
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

const SuggestionPopup: React.FC<SuggestionPopupProps> = ({ 
  suggestions, 
  position, 
  onSelect, 
  onClose 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        background: '#252526',
        border: '1px solid #3e3e42',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
        minWidth: '200px',
        maxHeight: '300px',
        overflow: 'auto'
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            background: index === selectedIndex ? '#0e639c' : 'transparent',
            color: '#d4d4d4',
            fontSize: '13px',
            fontFamily: 'monospace',
            transition: 'background 0.1s'
          }}
        >
          {suggestion}
        </div>
      ))}
    </div>
  );
};

export default SuggestionPopup;