interface SpinnerProps {
    size?: number;
    color?: string;
  }
  
  export default function Spinner({ size = 40, color = '#4ECDC4' }: SpinnerProps) {
    return (
      <div
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          border: `3px solid ${color}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      >
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }