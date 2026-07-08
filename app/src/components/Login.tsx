import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">L</div>
        <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>Welcome back</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>Sign in to Lumen Salon OS</p>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@salon.co" onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        {err && <div style={{ color: 'var(--rose)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
