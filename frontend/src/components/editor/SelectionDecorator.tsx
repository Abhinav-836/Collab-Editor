import React from 'react';

interface SelectionDecoratorProps {
  selections?: Array<{
    userId: string;
    userName: string;
    selection: { startLine: number; endLine: number; startCol: number; endCol: number };
    color: string;
  }>;
}

const SelectionDecorator: React.FC<SelectionDecoratorProps> = ({ selections = [] }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 99 }}>
      {selections.map((selection) => (
        <div
          key={selection.userId}
          style={{
            position: 'absolute',
            background: `${selection.color}30`,
            border: `1px solid ${selection.color}`,
            borderRadius: '2px',
            transform: `translate(${selection.selection.startCol * 8}px, ${selection.selection.startLine * 20}px)`,
            width: `${(selection.selection.endCol - selection.selection.startCol) * 8}px`,
            height: `${(selection.selection.endLine - selection.selection.startLine + 1) * 20}px`,
          }}
          title={selection.userName}
        />
      ))}
    </div>
  );
};

export default SelectionDecorator;