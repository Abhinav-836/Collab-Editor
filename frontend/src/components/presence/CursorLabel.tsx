interface CursorLabelProps {
  userName: string;
  position: { lineNumber: number; column: number };
  color?: string;
}

export default function CursorLabel({ userName, position, color }: CursorLabelProps) {
  const cursorColor = color || `hsl(${hashCode(userName) % 360}, 70%, 60%)`;
  
  return (
    <div
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: `translate(${position.column * 8}px, ${position.lineNumber * 20}px)`
      }}
    >
      <div
        style={{
          background: cursorColor,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          fontFamily: 'monospace'
        }}
      >
        {userName}
      </div>
      <div
        style={{
          width: '2px',
          height: '18px',
          background: cursorColor,
          marginTop: '2px'
        }}
      />
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}