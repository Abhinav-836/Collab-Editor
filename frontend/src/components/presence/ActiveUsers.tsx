interface ActiveUsersProps {
  users: Array<{ userId: string; userName: string }>;
}

export default function ActiveUsers({ users }: ActiveUsersProps) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7D794'];
  
  if (users.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: '#555' }}>👥 0 online</span>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '11px', color: '#888' }}>
        👥 {users.length} online
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {users.map((user, idx) => (
          <div
            key={user.userId}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: colors[idx % colors.length],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}