import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SPA_TYPES = ['Day Spa', 'Medical Spa', 'Hair Salon', 'Nail Studio', 'Full-Service Salon & Spa', 'Barbershop', 'Other']
const SERVICES = ['Facials & Skin Care', 'Massage', 'Hair Color & Cuts', 'Nails & Gel', 'Waxing & Threading', 'Body Treatments', 'Lashes & Brows', 'Injectables / Botox', 'Laser & Aesthetics', 'Other']
const TEAM_SIZES = ['Just me', '2–3 providers', '4–6 providers', '7–12 providers', '13–20 providers', '20+ providers']
const SOFTWARES = ['Mangomint', 'Vagaro', 'Boulevard', 'Mindbody', 'Jane App', 'GlossGenius', 'Square Appointments', 'Spreadsheets / Paper', 'Nothing yet', 'Other']
const GOALS = [
  'Smarter reporting & revenue tracking',
  'Easier scheduling & calendar management',
  'Save money on processing fees',
  'Better client notes & history',
  'Online booking for clients',
  'Membership & package revenue',
  'Multi-location management',
  'Replace my current software',
]

export default function Onboarding({ session }: { session: any }) {
  const meta = session?.user?.user_metadata || {}
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)

  // Step 1 — business details
  const [spaName, setSpaName] = useState(meta.spa_name || '')
  const [city, setCity] = useState('')
  const [spaType, setSpaType] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2 — team & services
  const [teamSize, setTeamSize] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [currentSoftware, setCurrentSoftware] = useState('')

  // Step 3 — goals
  const [goals, setGoals] = useState<string[]>([])
  const [extra, setExtra] = useState('')

  const toggleArr = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])

  const finish = async () => {
    setBusy(true)
    const onboardingData = { spaName, city, spaType, phone, teamSize, services, currentSoftware, goals, extra, submittedAt: new Date().toISOString() }

    // 1. Create the org + owner record in Supabase
    try {
      await supabase.rpc('create_account', { p_org_name: spaName || 'My Spa', p_owner_name: meta.name || '' })
    } catch (_) {
      // create_account may already have run if user confirmed email and came back
    }

    // 2. Store onboarding answers in user metadata — visible in Supabase Auth dashboard
    await supabase.auth.updateUser({
      data: { onboarding_complete: true, onboarding: onboardingData },
    })

    setBusy(false)
    setStep(4)
  }

  const ownerName = meta.name || 'there'

  /* ── Step 1: Your business ── */
  if (step === 1) return (
    <OnboardingShell step={1} title={`Hi ${ownerName.split(' ')[0]}, let's set up your spa`} sub="Takes about 2 minutes. We'll use this to personalize your setup.">
      <div className="field"><label>Spa / business name</label><input value={spaName} onChange={(e) => setSpaName(e.target.value)} placeholder="Serenity Spa" autoFocus /></div>
      <div className="field"><label>City & state</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Salt Lake City, UT" /></div>
      <div className="field">
        <label>Type of business</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {SPA_TYPES.map((t) => (
            <ChipBtn key={t} label={t} on={spaType === t} onClick={() => setSpaType(t)} />
          ))}
        </div>
      </div>
      <div className="field"><label>Phone number (so we can reach you)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(801) 555-0100" type="tel" /></div>
      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 13, marginTop: 8 }}
        onClick={() => setStep(2)} disabled={!spaName.trim()}>
        Continue
      </button>
    </OnboardingShell>
  )

  /* ── Step 2: Team & services ── */
  if (step === 2) return (
    <OnboardingShell step={2} title="Tell us about your team" sub="We'll pre-configure SpaSuite around how your spa actually runs.">
      <div className="field">
        <label>How many providers / service staff?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {TEAM_SIZES.map((t) => (
            <ChipBtn key={t} label={t} on={teamSize === t} onClick={() => setTeamSize(t)} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Services you offer <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(select all that apply)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {SERVICES.map((s) => (
            <ChipBtn key={s} label={s} on={services.includes(s)} onClick={() => toggleArr(services, setServices, s)} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Current booking software</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {SOFTWARES.map((s) => (
            <ChipBtn key={s} label={s} on={currentSoftware === s} onClick={() => setCurrentSoftware(s)} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn ghost" style={{ padding: '12px 20px' }} onClick={() => setStep(1)}>Back</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: 13 }} onClick={() => setStep(3)}>Continue</button>
      </div>
    </OnboardingShell>
  )

  /* ── Step 3: Goals ── */
  if (step === 3) return (
    <OnboardingShell step={3} title="What matters most to you?" sub="This helps us prioritize your setup and make sure you get the most out of SpaSuite.">
      <div className="field">
        <label>Your top priorities <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(select all that apply)</span></label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {GOALS.map((g) => (
            <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={goals.includes(g)} onChange={() => toggleArr(goals, setGoals, g)}
                style={{ width: 16, height: 16, accentColor: 'var(--mint)', cursor: 'pointer' }} />
              {g}
            </label>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Anything else we should know?</label>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3}
          placeholder="Special requests, migration questions, specific features you need…"
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'Inter, system-ui', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn ghost" style={{ padding: '12px 20px' }} onClick={() => setStep(2)}>Back</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: 13 }} onClick={finish} disabled={busy}>
          {busy ? 'Setting up…' : 'Finish setup'}
        </button>
      </div>
    </OnboardingShell>
  )

  /* ── Step 4: Done ── */
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 22, marginBottom: 10 }}>You're all set, {ownerName.split(' ')[0]}!</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          <b>{spaName}</b> is ready to go. We'll reach out to{' '}
          <b>{session?.user?.email}</b>{phone ? ` or ${phone}` : ''} within 24 hours to walk you through everything and help you import your data.
        </p>
        <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 13 }}
          onClick={() => window.location.reload()}>
          Open SpaSuite
        </button>
      </div>
    </div>
  )
}

/* ── Shared shell ── */
function OnboardingShell({ step, title, sub, children }: { step: number; title: string; sub: string; children: React.ReactNode }) {
  const TOTAL = 3
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="logo" style={{ flexShrink: 0 }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? 'var(--mint)' : 'var(--line)' }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Step {step} of {TOTAL}</div>
          </div>
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>{title}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>{sub}</p>
        {children}
      </div>
    </div>
  )
}

/* ── Chip button ── */
function ChipBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--mint)' : 'var(--line)'), background: on ? 'var(--mint-soft)' : 'var(--surface-2)', color: on ? 'var(--mint-700)' : 'var(--ink)' }}>
      {label}
    </button>
  )
}
