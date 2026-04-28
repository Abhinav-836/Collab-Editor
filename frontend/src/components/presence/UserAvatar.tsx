interface UserAvatarProps {
    userName: string;
    userId: string;
    isOnline?: boolean;
    color?: string;
  }
  
  export default function UserAvatar({ userName, userId, isOnline = true, color }: UserAvatarProps) {
    const avatarColor = color || `hsl(${hashCode(userId) % 360}, 70%, 50%)`;
    
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: avatarColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          title={userName}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        {isOnline && (
          <span
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#4ECDC4',
              border: '2px solid #252526'
            }}
          />
        )}
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