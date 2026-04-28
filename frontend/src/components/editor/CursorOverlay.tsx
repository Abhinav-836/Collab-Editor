import React from 'react';

interface CursorOverlayProps {
  cursors?: Array<{
    userId: string;
    userName: string;
    position: { lineNumber: number; column: number };
    color: string;
  }>;
}

const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors = [] }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 100 }}>
      {cursors.map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            position: 'absolute',
            transform: `translate(${cursor.position.column * 8}px, ${cursor.position.lineNumber * 20}px)`,
          }}
        >
          <div
            style={{
              background: cursor.color,
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
            }}
          >
            {cursor.userName}
          </div>
          <div
            style={{
              width: '2px',
              height: '18px',
              background: cursor.color,
              marginTop: '2px',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default CursorOverlay;