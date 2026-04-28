import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false,
  type = 'button'
}: ButtonProps) {
  const variants = {
    primary: { background: '#0e639c', hover: '#1177bb' },
    secondary: { background: '#3c3c3c', hover: '#4c4c4c' },
    danger: { background: '#f48771', hover: '#f6a391' },
    success: { background: '#4ECDC4', hover: '#6ee7df' }
  };

  const sizes = {
    small: { padding: '4px 8px', fontSize: '11px' },
    medium: { padding: '8px 16px', fontSize: '13px' },
    large: { padding: '12px 24px', fontSize: '16px' }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...sizes[size],
        background: variants[variant].background,
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s',
        fontWeight: '500'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLButtonElement).style.background = variants[variant].hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.target as HTMLButtonElement).style.background = variants[variant].background;
        }
      }}
    >
      {children}
    </button>
  );
}