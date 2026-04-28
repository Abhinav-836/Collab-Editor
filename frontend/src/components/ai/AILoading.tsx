import React from 'react';

interface AILoadingProps {
  message?: string;
}

const AILoading: React.FC<AILoadingProps> = ({ message = 'AI is thinking...' }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#252526',
        padding: '8px 16px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          border: '2px solid #4ECDC4',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <span style={{ color: '#d4d4d4', fontSize: '12px' }}>{message}</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AILoading;