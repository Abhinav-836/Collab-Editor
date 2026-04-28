import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#1e1e1e'
    }}>
      <h1 style={{ fontSize: '72px', color: '#667eea' }}>404</h1>
      <p style={{ fontSize: '24px', marginTop: '20px' }}>Page not found</p>
      <Link to="/" style={{
        marginTop: '30px',
        padding: '12px 24px',
        background: '#667eea',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '5px'
      }}>
        Go back home
      </Link>
    </div>
  );
}