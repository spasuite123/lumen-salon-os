import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')

  return (
    <div className="login-wrap">
      {mode === 'in' ? (
        <SignInCard onSwitch={() => setMode('up')} />
      ) : (
        <SignUpCard onSwitch={() => setMode('in')} />
      )}
    </div>
  )
}

/* ── Sign in ── */
function SignInCard({ onSwitch }: { onSwitch: () => void }) {
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
    <div className="login-card">
      <div className="logo">S</div>
      <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>Welcome back</h1>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>Sign in to SpaSuite</p>
      <div className="field">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@spa.com" onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
      </div>
      <div className="field" style={{ marginBottom: 20 }}>
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
      {err && <div style={{ color: 'var(--rose)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={submit} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
        Don't have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--mint-700)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          Create one
        </button>
      </div>
    </div>
  )
}

/* ── Sign up ── */
function SignUpCard({ onSwitch }: { onSwitch: () => void }) {
  const [name, setName] = useState('')
  const [spaName, setSpaName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setErr('')
    if (!name.trim()) { setErr('Enter your name'); return }
    if (!spaName.trim()) { setErr('Enter your spa name'); return }
    if (!email.trim()) { setErr('Enter your email'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (password !== confirm) { setErr('Passwords don\'t match'); return }
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), spa_name: spaName.trim() },
      },
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    // If email confirmation required, signUp won't produce a session immediately.
    // Show a "check your email" screen. If auto-confirm is on, App.tsx will detect
    // the new session and route to Onboarding automatically.
    setDone(true)
  }

  if (done) {
    return (
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="logo">S</div>
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>Check your email</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>
          We sent a confirmation link to <b>{email}</b>. Click it to activate your account, then come back here to finish setting up your spa.
        </p>
        <button className="btn ghost" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={onSwitch}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="login-card">
      <div className="logo">S</div>
      <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>Get started free</h1>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>Set up your spa in minutes</p>
      <div className="field">
        <label>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus />
      </div>
      <div className="field">
        <label>Spa / business name</label>
        <input value={spaName} onChange={(e) => setSpaName(e.target.value)} placeholder="Serenity Spa" />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@serenityspa.com" />
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" />
      </div>
      <div className="field" style={{ marginBottom: 20 }}>
        <label>Confirm password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
      {err && <div style={{ color: 'var(--rose)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={submit} disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
        Already have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: 'var(--mint-700)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          Sign in
        </button>
      </div>
    </div>
  )
}
