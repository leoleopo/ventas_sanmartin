import { useState } from 'react'
import { Lock } from 'lucide-react'

interface LoginProps {
  onLogin: (pass: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('')

  return (
    <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" style={{ padding: '3rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ background: 'var(--primary)', color: 'white', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <Lock size={32} />
        </div>
        <h2 style={{ marginBottom: '1.5rem' }}>Acceso Admin</h2>
        <input 
          type="password" 
          placeholder="Contraseña"
          className="glass"
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLogin(password)}
        />
        <button className="primary" style={{ width: '100%' }} onClick={() => onLogin(password)}>
          Entrar
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Contraseña inicial: admin123
        </p>
      </div>
    </div>
  )
}
