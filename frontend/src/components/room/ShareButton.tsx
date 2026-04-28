import { useState } from 'react';

interface ShareButtonProps {
  roomId: string;
}

export default function ShareButton({ roomId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Collab Editor room',
          text: 'Come code with me in real-time!',
          url: url
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        padding: '6px 12px',
        background: copied ? '#4ECDC4' : '#0e639c',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background 0.2s'
      }}
    >
      {copied ? '✓ Copied!' : '🔗 Share'}
    </button>
  );
}