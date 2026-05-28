import React, { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  gold:   '#c9a961',
  black:  '#080706',
  marble: '#e8e2d4',
  panel:  '#13110f',
  stone:  '#2e2a24',
  red:    '#c0392b',
  green:  '#27ae60',
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const LS = {
  get: (k, d = null) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d }
    catch { return d }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]

function calGoal(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'Femenino' ? -161 : 5)
  const tdee = Math.round(bmr * p.activityLevel)
  const adj = {
    'Recomposición corporal': 0, 'Definición / Cutting': -300,
    'Volumen / Bulking': 300, 'Mantenimiento': 0, 'Pre-competencia': -500,
  }
  return tdee + (adj[p.phase] || 0)
}

function fmtDate() {
  return new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
}

function getTrainingDay(split, daysPerWeek) {
  const dow = new Date().getDay()
  const m = dow === 0 ? 6 : dow - 1
  const MAP = {
    PPL:           ['Push','Pull','Legs','Push','Pull','Legs','Descanso'],
    Arnold:        ['Pecho-Espalda','Hombros-Brazos','Piernas','Pecho-Espalda','Hombros-Brazos','Piernas','Descanso'],
    'Upper-Lower': ['Upper','Lower','Descanso','Upper','Lower','Descanso','Descanso'],
    'Full Body':   ['Full Body','Descanso','Full Body','Descanso','Full Body','Descanso','Descanso'],
  }
  const sched = MAP[split] || MAP.PPL
  if (daysPerWeek <= 4 && m >= daysPerWeek) return 'Descanso'
  return sched[m]
}

async function callAI(messages, system = '', maxTokens = 1000) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('API key no configurada en .env')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, system, messages }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error?.message || `Error ${r.status}`)
  }
  return (await r.json()).content[0].text
}

// ─── DEFAULT PROFILE ─────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  name: 'York', weight: 81, height: 184, age: 27, sex: 'Masculino',
  phase: 'Recomposición corporal', split: 'PPL', daysPerWeek: 6,
  activityLevel: 1.725, useAnabolics: false,
  supplements: 'Magnesio, Creatina', injuries: '', sleepGoal: 8,
  objective: 'Hipertrofia máxima',
}

// ─── ACTIVITY TYPES WITH MET ──────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { name: 'Pesas', met: 5 }, { name: 'Cardio', met: 8 },
  { name: 'Básquetbol', met: 8 }, { name: 'Fútbol', met: 9 },
  { name: 'Natación', met: 8 }, { name: 'Ciclismo', met: 7 },
  { name: 'HIIT', met: 10 }, { name: 'Caminata', met: 4 }, { name: 'Otro', met: 6 },
]
const calcKcalBurned = (met, kg, mins) => Math.round((met * kg * mins) / 60)

// ─── SVG: MEANDER ────────────────────────────────────────────────────────────
function MeanderSVG({ opacity = 0.35 }) {
  return (
    <svg width="100%" height="12" viewBox="0 0 240 12" preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', opacity }}>
      <path d="M0,6 L4,6 L4,2 L12,2 L12,10 L20,10 L20,2 L24,2 L24,6
               L28,6 L28,2 L36,2 L36,10 L44,10 L44,2 L48,2 L48,6
               L52,6 L52,2 L60,2 L60,10 L68,10 L68,2 L72,2 L72,6
               L76,6 L76,2 L84,2 L84,10 L92,10 L92,2 L96,2 L96,6
               L100,6 L100,2 L108,2 L108,10 L116,10 L116,2 L120,2 L120,6
               L124,6 L124,2 L132,2 L132,10 L140,10 L140,2 L144,2 L144,6
               L148,6 L148,2 L156,2 L156,10 L164,10 L164,2 L168,2 L168,6
               L172,6 L172,2 L180,2 L180,10 L188,10 L188,2 L192,2 L192,6
               L196,6 L196,2 L204,2 L204,10 L212,10 L212,2 L216,2 L216,6
               L220,6 L220,2 L228,2 L228,10 L236,10 L236,2 L240,2 L240,6"
        fill="none" stroke={C.gold} strokeWidth="1.5" />
    </svg>
  )
}

// ─── SVG: ATLAS (LEFT) ───────────────────────────────────────────────────────
function AtlasFigure() {
  return (
    <svg viewBox="0 0 160 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position:'fixed', left:0, top:'20%', height:'65vh', width:'auto',
               pointerEvents:'none', zIndex:0, opacity:0.07 }}>
      {/* Globe */}
      <circle cx="80" cy="18" r="24" stroke={C.gold} strokeWidth="1.2"/>
      <ellipse cx="80" cy="18" rx="24" ry="9" stroke={C.gold} strokeWidth="0.7"/>
      <path d="M56,18 Q68,8 80,6 Q92,8 104,18" stroke={C.gold} strokeWidth="0.6" fill="none"/>
      <path d="M56,18 Q68,28 80,30 Q92,28 104,18" stroke={C.gold} strokeWidth="0.6" fill="none"/>
      {/* Head */}
      <circle cx="80" cy="54" r="18" stroke={C.gold} strokeWidth="1.3"/>
      <path d="M66,46 Q70,38 80,36 Q90,38 94,46" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      {/* Arms up */}
      <path d="M62,70 Q42,62 38,44 Q36,30 46,22" stroke={C.gold} strokeWidth="1.3"/>
      <path d="M98,70 Q118,62 122,44 Q124,30 114,22" stroke={C.gold} strokeWidth="1.3"/>
      {/* Shoulders */}
      <path d="M62,70 Q50,74 42,82" stroke={C.gold} strokeWidth="1.4"/>
      <path d="M98,70 Q110,74 118,82" stroke={C.gold} strokeWidth="1.4"/>
      {/* Neck */}
      <path d="M73,70 L72,84 M87,70 L88,84" stroke={C.gold} strokeWidth="1.2"/>
      {/* Torso */}
      <path d="M42,82 Q38,110 40,140 Q42,160 50,175" stroke={C.gold} strokeWidth="1.3"/>
      <path d="M118,82 Q122,110 120,140 Q118,160 110,175" stroke={C.gold} strokeWidth="1.3"/>
      {/* Chest */}
      <path d="M48,90 Q65,100 80,98 Q95,100 112,90" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <path d="M46,106 Q64,116 80,114 Q96,116 114,106" stroke={C.gold} strokeWidth="0.7" fill="none"/>
      {/* Abs */}
      <path d="M64,116 L64,172 M72,114 L72,175 M88,114 L88,175 M96,116 L96,172" stroke={C.gold} strokeWidth="0.5"/>
      <path d="M62,126 Q80,129 98,126 M62,140 Q80,143 98,140 M62,154 Q80,157 98,154" stroke={C.gold} strokeWidth="0.5" fill="none"/>
      {/* Belt */}
      <path d="M50,172 Q65,179 80,177 Q95,179 110,172" stroke={C.gold} strokeWidth="1.2" fill="none"/>
      <path d="M48,182 Q65,189 80,187 Q95,189 112,182" stroke={C.gold} strokeWidth="1" fill="none"/>
      {/* Legs */}
      <path d="M58,184 Q54,224 50,264 Q48,296 52,336" stroke={C.gold} strokeWidth="1.4"/>
      <path d="M102,184 Q106,224 110,264 Q112,296 108,336" stroke={C.gold} strokeWidth="1.4"/>
      {/* Drapery */}
      <path d="M54,180 Q58,215 55,255" stroke={C.gold} strokeWidth="0.5" opacity="0.7"/>
      <path d="M68,177 Q70,210 66,250" stroke={C.gold} strokeWidth="0.4" opacity="0.7"/>
      <path d="M106,180 Q102,215 105,255" stroke={C.gold} strokeWidth="0.5" opacity="0.7"/>
      {/* Feet */}
      <path d="M52,336 Q44,348 38,352 Q54,358 64,348" stroke={C.gold} strokeWidth="1" fill="none"/>
      <path d="M108,336 Q116,348 122,352 Q106,358 96,348" stroke={C.gold} strokeWidth="1" fill="none"/>
    </svg>
  )
}

// ─── SVG: GREEK BUST (RIGHT) ─────────────────────────────────────────────────
function BustFigure() {
  return (
    <svg viewBox="0 0 150 340" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position:'fixed', right:0, top:'25%', height:'55vh', width:'auto',
               pointerEvents:'none', zIndex:0, opacity:0.07 }}>
      {/* Laurel crown */}
      <path d="M32,36 Q38,22 55,16 Q72,10 75,12" stroke={C.gold} strokeWidth="1" fill="none"/>
      <path d="M118,36 Q112,22 95,16 Q78,10 75,12" stroke={C.gold} strokeWidth="1" fill="none"/>
      <ellipse cx="37" cy="29" rx="7" ry="4" transform="rotate(-30 37 29)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="48" cy="21" rx="7" ry="4" transform="rotate(-15 48 21)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="61" cy="15" rx="7" ry="4" transform="rotate(-5 61 15)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="113" cy="29" rx="7" ry="4" transform="rotate(30 113 29)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="102" cy="21" rx="7" ry="4" transform="rotate(15 102 21)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="89" cy="15" rx="7" ry="4" transform="rotate(5 89 15)" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      {/* Head */}
      <ellipse cx="75" cy="58" rx="30" ry="34" stroke={C.gold} strokeWidth="1.3" fill="none"/>
      {/* Eyes */}
      <ellipse cx="63" cy="54" rx="5" ry="3" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="87" cy="54" rx="5" ry="3" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      {/* Nose */}
      <path d="M75,54 L72,64 Q75,67 78,64 L75,54" stroke={C.gold} strokeWidth="0.7" fill="none"/>
      {/* Mouth */}
      <path d="M66,72 Q75,77 84,72" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      {/* Ears */}
      <path d="M45,52 Q41,58 45,65" stroke={C.gold} strokeWidth="0.9" fill="none"/>
      <path d="M105,52 Q109,58 105,65" stroke={C.gold} strokeWidth="0.9" fill="none"/>
      {/* Hair curls */}
      <path d="M47,40 Q44,30 52,25 Q60,20 66,24" stroke={C.gold} strokeWidth="0.7" fill="none"/>
      <path d="M103,40 Q106,30 98,25 Q90,20 84,24" stroke={C.gold} strokeWidth="0.7" fill="none"/>
      {/* Neck */}
      <path d="M60,88 L57,104 M90,88 L93,104" stroke={C.gold} strokeWidth="1.2"/>
      {/* Shoulders and bust */}
      <path d="M57,104 Q32,114 22,134 Q16,156 22,180" stroke={C.gold} strokeWidth="1.3"/>
      <path d="M93,104 Q118,114 128,134 Q134,156 128,180" stroke={C.gold} strokeWidth="1.3"/>
      <path d="M22,180 Q40,196 75,198 Q110,196 128,180" stroke={C.gold} strokeWidth="1.2" fill="none"/>
      {/* Toga drape lines */}
      <path d="M22,134 Q28,150 32,165" stroke={C.gold} strokeWidth="0.7"/>
      <path d="M38,118 Q42,138 44,158" stroke={C.gold} strokeWidth="0.5"/>
      <path d="M128,134 Q122,150 118,165" stroke={C.gold} strokeWidth="0.7"/>
      {/* Bust base */}
      <path d="M22,180 L16,206 L134,206 L128,180" stroke={C.gold} strokeWidth="1" fill="none"/>
      <path d="M12,206 L138,206" stroke={C.gold} strokeWidth="1.5"/>
      <path d="M18,212 L132,212" stroke={C.gold} strokeWidth="0.8"/>
      {/* Pedestal */}
      <path d="M28,212 L22,244 L128,244 L122,212" stroke={C.gold} strokeWidth="1" fill="none"/>
      <path d="M16,244 L134,244" stroke={C.gold} strokeWidth="1.5"/>
      {/* Olive branch */}
      <path d="M26,116 Q14,110 10,98 Q7,82 16,70" stroke={C.gold} strokeWidth="0.8" fill="none"/>
      <ellipse cx="13" cy="80" rx="5" ry="3" transform="rotate(-40 13 80)" stroke={C.gold} strokeWidth="0.6" fill="none"/>
      <ellipse cx="10" cy="92" rx="5" ry="3" transform="rotate(-20 10 92)" stroke={C.gold} strokeWidth="0.6" fill="none"/>
      <ellipse cx="16" cy="104" rx="4" ry="2.5" transform="rotate(10 16 104)" stroke={C.gold} strokeWidth="0.6" fill="none"/>
    </svg>
  )
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────
function GoldBtn({ children, onClick, style = {}, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? C.stone : C.gold,
      color: disabled ? '#777' : C.black,
      border: 'none', borderRadius: 6,
      padding: '9px 16px',
      fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 12,
      letterSpacing: 1, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s', ...style,
    }}>{children}</button>
  )
}

function ProgressBar({ value, max, height = 10, gradient }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const bg = gradient || `linear-gradient(90deg, ${C.green} 0%, ${C.gold} 100%)`
  return (
    <div style={{ background: C.stone, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: bg, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  )
}

function Bar2({ value, max, color = C.gold, height = 10 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ background: C.stone, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  )
}

function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.panel} 0%, #0a0908 100%)`,
      borderRadius: 12, padding: 16, marginBottom: 12,
      border: '1px solid rgba(201,169,97,0.2)',
      boxShadow: '0 0 20px rgba(201,169,97,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold,
      letterSpacing: 3, textTransform: 'uppercase',
      marginBottom: 14,
      paddingBottom: 8,
      borderBottom: '1px solid rgba(201,169,97,0.3)',
    }}>{children}</div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

const iStyle = {
  background: C.stone, border: `1px solid rgba(201,169,97,0.25)`,
  borderRadius: 6, color: C.marble, padding: '8px 12px',
  fontFamily: 'Inter,sans-serif', fontSize: 13,
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value}
        onChange={e => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', ...iStyle }} />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', ...iStyle }}>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  )
}

function MicBtn({ listening, onStart, onStop }) {
  return (
    <button onClick={listening ? onStop : onStart}
      style={{ background: listening ? C.red : C.stone, border: `1px solid ${listening ? C.red : C.gold}40`, borderRadius: 6, color: listening ? '#fff' : C.marble, padding: '8px 14px', cursor: 'pointer', fontSize: 16, fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
      {listening ? '⏹' : '🎙'} {listening ? 'Detener' : 'Dictar'}
    </button>
  )
}

function useSpeech(lang = 'es-CL') {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const ref = useRef(null)
  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return }
    const r = new SR(); r.lang = lang; r.continuous = true; r.interimResults = true
    r.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setTranscript(t) }
    r.onend = () => setListening(false)
    r.start(); ref.current = r; setListening(true)
  }
  function stop() { ref.current?.stop(); setListening(false) }
  return { listening, transcript, setTranscript, start, stop }
}

// ─── ORACLE AUTO-MESSAGE ──────────────────────────────────────────────────────
function useAutoOracle(totalKcal, goal, totalProt, protGoal) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const h = new Date().getHours()
      const ctx = `Hora: ${h}:00h. Kcal: ${totalKcal}/${goal}. Balance: ${totalKcal - goal > 0 ? '+' : ''}${totalKcal - goal} kcal. Proteína: ${totalProt}g/${protGoal}g.`
      const r = await callAI(
        [{ role: 'user', content: ctx }],
        'Coach de hipertrofia de élite. 2-3 líneas, español directo. Si <12h y 0 kcal: sugiere desayuno hipercalórico. Si >20h y faltan >500 kcal: urgencia. Si exceso: qué evitar. Si en rango: motiva.'
      )
      setMsg(r)
    } catch (e) { setMsg(`Error: ${e.message}`) }
    setLoading(false)
  }

  // Auto-load once on mount
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; refresh() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { msg, loading, refresh }
}

// ─── TAB: HOY ─────────────────────────────────────────────────────────────────
function TabHoy({ profile, foods, water, setWater, activities, setActivities, weights, setWeights }) {
  const goal = calGoal(profile)
  const protGoal = Math.round(profile.weight * 2.2)
  const totalKcal = foods.reduce((s, f) => s + (f.kcal || 0), 0)
  const totalProt = foods.reduce((s, f) => s + (f.protein || 0), 0)
  const totalBurned = activities.reduce((s, a) => s + (a.kcalBurned || 0), 0)
  const balance = totalKcal - goal
  const waterGoal = 3000
  const calPct = goal > 0 ? Math.min(100, Math.round((totalKcal / goal) * 100)) : 0
  const waterPct = Math.min(100, Math.round((water / waterGoal) * 100))

  const { msg: oracleMsg, loading: oracleLoading, refresh: consultOracle } = useAutoOracle(totalKcal, goal, totalProt, protGoal)

  const [waterInput, setWaterInput] = useState('')
  const [weightInput, setWeightInput] = useState('')
  const [actType, setActType] = useState('Pesas')
  const [actMins, setActMins] = useState('')

  const todayWeight = weights[today()] || null
  const prevEntries = Object.entries(weights).filter(([d]) => d < today()).sort()
  const prevWeight = prevEntries.length ? prevEntries[prevEntries.length - 1] : null
  const weightDiff = todayWeight && prevWeight ? (todayWeight - prevWeight[1]).toFixed(1) : null

  let barGrad = 'linear-gradient(90deg, #27ae60 0%, #c9a961 100%)'
  if (balance > 150) barGrad = `linear-gradient(90deg, ${C.red} 0%, #e74c3c 100%)`

  function addWater(ml) { setWater(w => w + ml) }
  function addWaterManual() { const ml = parseInt(waterInput); if (ml > 0) { addWater(ml); setWaterInput('') } }

  function addActivity() {
    if (!actMins || parseInt(actMins) <= 0) return
    const met = ACTIVITY_TYPES.find(a => a.name === actType)?.met || 6
    const kcalBurned = calcKcalBurned(met, profile.weight, parseInt(actMins))
    setActivities(a => [...a, { id: Date.now(), type: actType, text: actType, minutes: parseInt(actMins), kcalBurned }])
    setActMins('')
  }

  function removeActivity(id) { setActivities(a => a.filter(x => x.id !== id)) }

  function saveWeight() {
    const w = parseFloat(weightInput); if (w > 0) { setWeights(p => ({ ...p, [today()]: w })); setWeightInput('') }
  }

  return (
    <div>
      {/* ── EDICTO CALÓRICO ── */}
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <MeanderSVG opacity={0.3} />
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: C.gold, letterSpacing: 2 }}>EDICTO CALÓRICO</span>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: `${C.gold}88`, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right', maxWidth: 140, lineHeight: 1.4 }}>
              {profile.phase.toUpperCase()}
            </span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 52, fontWeight: 700, color: C.marble, lineHeight: 1 }}>{totalKcal}</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 17, color: '#555' }}> /{goal} kcal</span>
          </div>
          {/* 52px progress bar */}
          <div style={{ background: C.stone, borderRadius: 99, height: 52, overflow: 'hidden', marginBottom: 6, position: 'relative' }}>
            <div style={{ width: `${calPct}%`, background: barGrad, height: '100%', borderRadius: 99, transition: 'width 0.5s' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 16, color: '#fff', textShadow: '0 1px 6px #000a' }}>
              {calPct}%
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#777' }}>{calPct}% completado</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: balance > 0 ? C.red : C.gold, fontWeight: 600 }}>
              {balance > 0 ? `+${balance} kcal exceso` : `${Math.abs(balance)} kcal restantes`}
            </span>
          </div>
          {/* Oracle box */}
          <div style={{ background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.2)', borderRadius: 8, padding: '12px 14px', minHeight: 54, marginBottom: 10 }}>
            {oracleMsg
              ? <p style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: 16, color: C.marble, lineHeight: 1.7, margin: 0 }}>{oracleMsg}</p>
              : <p style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: 15, color: '#555', margin: 0 }}>
                  {oracleLoading ? 'El Oráculo contempla...' : 'Consulta al Oráculo para recibir su veredicto.'}
                </p>
            }
          </div>
          <button onClick={consultOracle} disabled={oracleLoading}
            style={{ width: '100%', background: 'none', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 6, color: C.gold, padding: '9px 16px', fontFamily: 'Cinzel,serif', fontSize: 11, letterSpacing: 2, cursor: oracleLoading ? 'not-allowed' : 'pointer' }}>
            {oracleLoading ? '...' : '↺ ACTUALIZAR MENSAJE'}
          </button>
        </div>
        <MeanderSVG opacity={0.3} />
      </Panel>

      {/* ── 4 STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { icon: '🔥', label: 'QUEMADAS', value: totalBurned, unit: 'kcal' },
          { icon: '◎', label: 'PROTEÍNA', value: `${totalProt}/${protGoal}`, unit: 'g' },
          { icon: '↓', label: 'DÉFICIT', value: balance > 0 ? `+${balance}` : `${balance}`, unit: 'kcal', col: balance > 150 ? C.red : balance < -150 ? C.marble : C.green },
          { icon: 'ψ', label: 'HIDOR', value: `${(water / 1000).toFixed(2)}`, unit: 'L' },
        ].map(s => (
          <div key={s.label} style={{ background: '#13110f', border: '1px solid rgba(201,169,97,0.2)', borderRadius: 10, padding: '14px 12px', textAlign: 'center', boxShadow: '0 0 20px rgba(201,169,97,0.05)' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 22, fontWeight: 700, color: s.col || C.marble, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#666', marginTop: 1 }}>{s.unit}</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: C.gold, letterSpacing: 2, marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── HIDRATACIÓN ── */}
      <Panel>
        <SectionTitle>HIDOR · HIDRATACIÓN</SectionTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 32, fontWeight: 700, color: C.marble }}>{(water / 1000).toFixed(2)} L</span>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#666' }}>meta 3.0 L</span>
        </div>
        <div style={{ background: C.stone, borderRadius: 99, height: 14, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{ width: `${waterPct}%`, background: `linear-gradient(90deg, rgba(201,169,97,0.5) 0%, ${C.gold} 100%)`, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[250, 500, 750].map(ml => (
            <GoldBtn key={ml} onClick={() => addWater(ml)} style={{ flex: 1 }}>+{ml}ml</GoldBtn>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={waterInput} onChange={e => setWaterInput(e.target.value)} placeholder="ml manual" type="number"
            style={{ flex: 1, ...iStyle }} />
          <GoldBtn onClick={addWaterManual}>Agregar</GoldBtn>
        </div>
      </Panel>

      {/* ── ACTIVIDAD ── */}
      <Panel>
        <SectionTitle>ACTIVIDAD DEL DÍA</SectionTitle>
        {activities.length === 0
          ? <p style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', color: '#555', fontSize: 15, margin: '0 0 14px' }}>Sin actividades registradas hoy.</p>
          : activities.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,169,97,0.1)' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: C.marble, letterSpacing: 1 }}>{a.type || a.text}</div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#666', marginTop: 2 }}>{a.minutes} min · ~{a.kcalBurned} kcal quemadas</div>
              </div>
              <button onClick={() => removeActivity(a.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>
          ))
        }
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginTop: 12 }}>
          <select value={actType} onChange={e => setActType(e.target.value)} style={{ ...iStyle }}>
            {ACTIVITY_TYPES.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <input value={actMins} onChange={e => setActMins(e.target.value)} placeholder="min" type="number"
            style={{ ...iStyle }} />
        </div>
        <GoldBtn onClick={addActivity} style={{ width: '100%', marginTop: 8 }}>+ Registrar actividad</GoldBtn>
      </Panel>

      {/* ── PESO ── */}
      <Panel>
        <SectionTitle>PESO DEL DÍA</SectionTitle>
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
          {todayWeight && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 36, fontWeight: 700, color: C.gold }}>{todayWeight}</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: '#666', letterSpacing: 2 }}>KG HOY</div>
            </div>
          )}
          {weightDiff !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 22, fontWeight: 600, color: parseFloat(weightDiff) < 0 ? C.green : parseFloat(weightDiff) > 0 ? C.red : C.gold }}>
                {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff}
              </div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: '#666', letterSpacing: 2 }}>VS AYER</div>
            </div>
          )}
          {prevWeight && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 22, fontWeight: 600, color: '#555' }}>{prevWeight[1]}</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: '#666', letterSpacing: 2 }}>ANTERIOR</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder="Peso en kg" type="number"
            style={{ flex: 1, ...iStyle }} />
          <GoldBtn onClick={saveWeight}>Guardar</GoldBtn>
        </div>
      </Panel>
    </div>
  )
}

// ─── TAB: NUTRICIÓN ──────────────────────────────────────────────────────────
function TabNutricion({ profile, foods, setFoods }) {
  const goal = calGoal(profile)
  const protGoal = Math.round(profile.weight * 2.2)
  const totalKcal = foods.reduce((s, f) => s + (f.kcal || 0), 0)
  const totalProt = foods.reduce((s, f) => s + (f.protein || 0), 0)

  const [input, setInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const { listening, transcript, setTranscript, start, stop } = useSpeech('es-CL')

  useEffect(() => { if (transcript) setInput(transcript) }, [transcript])

  async function analyzeFood() {
    if (!input.trim()) return
    setAnalyzing(true); setAiResult(null)
    try {
      const raw = await callAI(
        [{ role: 'user', content: `Analiza esta ingesta y devuelve SOLO JSON sin texto extra:\n{"meal_type":"Desayuno|Almuerzo|Cena|Snack","items":[{"name":"","kcal":0,"protein":0,"sodium":0}],"score":"Óptimo|Bueno|Mejorable","advice":""}\n\nComida: ${input}` }],
        'Eres nutricionista deportivo. Responde SOLO JSON válido, sin markdown ni texto adicional.'
      )
      const clean = raw.replace(/```json?/g, '').replace(/```/g, '').trim()
      setAiResult(JSON.parse(clean))
    } catch (e) { setAiResult({ error: e.message }) }
    setAnalyzing(false)
  }

  function saveAnalysis() {
    if (!aiResult || aiResult.error) return
    const kcal = aiResult.items.reduce((s, i) => s + i.kcal, 0)
    const protein = aiResult.items.reduce((s, i) => s + i.protein, 0)
    const sodium = aiResult.items.reduce((s, i) => s + i.sodium, 0)
    setFoods(f => [...f, { id: Date.now(), description: input, meal_type: aiResult.meal_type, items: aiResult.items, kcal, protein, sodium, score: aiResult.score, advice: aiResult.advice }])
    setInput(''); setTranscript(''); setAiResult(null)
  }

  function removeFood(id) { setFoods(f => f.filter(x => x.id !== id)) }

  const scoreColor = s => s === 'Óptimo' ? C.green : s === 'Bueno' ? C.gold : C.red
  const totalSodAll = foods.reduce((s, f) => s + (f.sodium || 0), 0)
  const calPct = goal > 0 ? Math.round((totalKcal / goal) * 100) : 0
  const protPct = protGoal > 0 ? Math.round((totalProt / protGoal) * 100) : 0

  return (
    <div>
      <Panel>
        <SectionTitle>PROGRESO DEL DÍA</SectionTitle>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: C.gold, letterSpacing: 1 }}>CALORÍAS</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: C.marble }}><b style={{ color: C.gold }}>{totalKcal}</b> / {goal} kcal · {calPct}%</span>
          </div>
          <ProgressBar value={totalKcal} max={goal} height={12} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: C.gold, letterSpacing: 1 }}>PROTEÍNA · HIPERTROFIA</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: C.marble }}><b style={{ color: '#e07060' }}>{totalProt}g</b> / {protGoal}g · {protPct}%</span>
          </div>
          <Bar2 value={totalProt} max={protGoal} color='#e07060' height={12} />
        </div>
        {totalSodAll > 1500 && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: `${C.red}18`, border: `1px solid ${C.red}`, borderRadius: 6, color: C.red, fontFamily: 'Inter,sans-serif', fontSize: 12 }}>
            ⚠ Sodio acumulado: {totalSodAll}mg — supera 1500mg recomendados
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle>REGISTRAR COMIDA</SectionTitle>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Describe lo que comiste..."
          style={{ width: '100%', minHeight: 80, ...iStyle, padding: '10px 12px', fontFamily: '"Cormorant Garamond",serif', fontSize: 16, resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <MicBtn listening={listening} onStart={start} onStop={stop} />
          <GoldBtn onClick={analyzeFood} disabled={analyzing || !input.trim()} style={{ flex: 1 }}>
            {analyzing ? 'Analizando...' : '🔮 Analizar con IA'}
          </GoldBtn>
        </div>

        {aiResult && !aiResult.error && (
          <div style={{ marginTop: 14, background: C.stone, borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: C.gold, letterSpacing: 1 }}>{aiResult.meal_type}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, padding: '2px 10px', borderRadius: 99, background: scoreColor(aiResult.score) + '30', color: scoreColor(aiResult.score) }}>{aiResult.score}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter,sans-serif', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(201,169,97,0.3)` }}>
                  {['Alimento', 'Kcal', 'Prot', 'Sodio'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 6px', color: C.gold, fontSize: 10, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiResult.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid rgba(201,169,97,0.1)` }}>
                    <td style={{ padding: '5px 6px', color: C.marble }}>{item.name}</td>
                    <td style={{ padding: '5px 6px', color: C.marble }}>{item.kcal}</td>
                    <td style={{ padding: '5px 6px', color: '#e07060' }}>{item.protein}g</td>
                    <td style={{ padding: '5px 6px', color: item.sodium > 600 ? C.red : '#888' }}>{item.sodium}mg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aiResult.advice && (
              <div style={{ marginTop: 10, fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: 15, color: C.marble, lineHeight: 1.6 }}>{aiResult.advice}</div>
            )}
            {aiResult.items.reduce((s, i) => s + i.sodium, 0) > 1500 && (
              <div style={{ marginTop: 8, color: C.red, fontFamily: 'Inter,sans-serif', fontSize: 12 }}>⚠ Sodio en esta comida supera 1500mg</div>
            )}
            <GoldBtn onClick={saveAnalysis} style={{ width: '100%', marginTop: 12 }}>Guardar registro</GoldBtn>
          </div>
        )}
        {aiResult?.error && (
          <div style={{ marginTop: 8, color: C.red, fontFamily: 'Inter,sans-serif', fontSize: 12 }}>Error: {aiResult.error}</div>
        )}
      </Panel>

      {foods.length > 0 && (
        <Panel>
          <SectionTitle>REGISTROS DEL DÍA</SectionTitle>
          {foods.map(f => (
            <div key={f.id} style={{ borderBottom: '1px solid rgba(201,169,97,0.1)', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1 }}>{f.meal_type}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#777', marginLeft: 8 }}>{f.kcal} kcal · {f.protein}g prot</span>
                  {f.score && <span style={{ marginLeft: 8, fontFamily: 'Inter,sans-serif', fontSize: 10, color: scoreColor(f.score) }}>{f.score}</span>}
                </div>
                <button onClick={() => removeFood(f.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 14, color: '#666', fontStyle: 'italic', marginTop: 3 }}>{f.description}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: C.gold, letterSpacing: 1 }}>TOTAL DEL DÍA</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: C.marble, fontWeight: 600 }}>{totalKcal} kcal · {totalProt}g prot</span>
          </div>
        </Panel>
      )}
    </div>
  )
}

// ─── TAB: ATLETA ─────────────────────────────────────────────────────────────
function TabAtleta({ profile, exercises, setExercises, sessions, setSessions }) {
  const trainingDay = getTrainingDay(profile.split, profile.daysPerWeek)

  const [form, setForm] = useState({ name: '', sets: '', reps: '', weight: '' })
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState('')
  const [rmWeight, setRmWeight] = useState('')
  const [rmReps, setRmReps] = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const { listening, transcript, setTranscript, start, stop } = useSpeech('es-CL')

  function addExercise() {
    const { name, sets, reps, weight } = form
    if (!name || !sets || !reps) return
    setExercises(e => [...e, { id: Date.now(), name, sets: +sets, reps: +reps, weight: +weight || 0 }])
    setForm({ name: '', sets: '', reps: '', weight: '' })
  }

  function removeExercise(id) { setExercises(e => e.filter(x => x.id !== id)) }

  async function handleMicStop() {
    stop()
    const txt = transcript.trim(); if (!txt) return
    setVoiceLoading(true)
    try {
      const raw = await callAI(
        [{ role: 'user', content: `Extrae ejercicios y devuelve SOLO JSON array:\n[{"name":"","sets":0,"reps":0,"weight":0}]\n\nTexto: ${txt}` }],
        'Asistente de gym. SOLO JSON array válido, sin texto. Peso corporal = 0.'
      )
      const clean = raw.replace(/```json?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(clean)
      setExercises(e => [...e, ...parsed.map(x => ({ ...x, id: Date.now() + Math.random() }))])
      setTranscript('')
    } catch (e) { alert(`Error al procesar: ${e.message}`) }
    setVoiceLoading(false)
  }

  async function evaluateSession() {
    if (!exercises.length) { alert('No hay ejercicios registrados'); return }
    setEvaluating(true); setEvaluation('')
    try {
      const list = exercises.map(e => `${e.name}: ${e.sets}×${e.reps} @ ${e.weight}kg`).join('\n')
      const resp = await callAI(
        [{ role: 'user', content: `Evalúa esta sesión:\nDía: ${trainingDay}\nFase: ${profile.phase}\nAnabólicos: ${profile.useAnabolics ? 'Sí' : 'No'}\nObjetivo: ${profile.objective}\n\n${list}\n\nResponde con:\nPUNTUACIÓN X/10\nANÁLISIS: ...\nMEJORAS: ...\nPRÓXIMA SESIÓN: ...` }],
        'Coach de élite en hipertrofia. Español, directo y específico.'
      )
      setEvaluation(resp)
    } catch (e) { setEvaluation(`Error: ${e.message}`) }
    setEvaluating(false)
  }

  function closeSession() {
    if (!exercises.length) return
    const totalVol = exercises.reduce((s, e) => s + e.sets * e.reps * (e.weight || 1), 0)
    setSessions(s => [{ id: Date.now(), date: today(), type: trainingDay, exercises: [...exercises], totalVolume: totalVol }, ...s].slice(0, 30))
    setExercises([]); setEvaluation('')
  }

  const rm1 = rmWeight && rmReps ? (parseFloat(rmWeight) * (1 + parseFloat(rmReps) / 30)).toFixed(1) : null
  const rmTable = rm1 ? [60, 70, 80, 90, 100].map(p => ({ pct: p, kg: (rm1 * p / 100).toFixed(1) })) : []
  const fInp = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SectionLabel>Sesión de hoy</SectionLabel>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 24, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>{trainingDay}</div>
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: 13, color: '#666', marginTop: 2 }}>{fmtDate()}</div>
          </div>
          {exercises.length > 0 && <GoldBtn onClick={closeSession} style={{ fontSize: 11 }}>Cerrar sesión</GoldBtn>}
        </div>
      </Panel>

      <Panel>
        <SectionTitle>AGREGAR EJERCICIO</SectionTitle>
        <div style={{ marginBottom: 8 }}>
          <input value={form.name} onChange={e => fInp('name', e.target.value)} placeholder="Nombre del ejercicio"
            style={{ width: '100%', ...iStyle }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input value={form.sets} onChange={e => fInp('sets', e.target.value)} placeholder="Series" type="number" style={{ ...iStyle }} />
          <input value={form.reps} onChange={e => fInp('reps', e.target.value)} placeholder="Reps" type="number" style={{ ...iStyle }} />
          <input value={form.weight} onChange={e => fInp('weight', e.target.value)} placeholder="Kg" type="number" style={{ ...iStyle }} />
        </div>
        <GoldBtn onClick={addExercise} style={{ width: '100%', marginBottom: 12 }}>Agregar ejercicio</GoldBtn>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MicBtn listening={listening} onStart={start} onStop={handleMicStop} />
          {voiceLoading && <span style={{ color: C.gold, fontFamily: 'Inter,sans-serif', fontSize: 12 }}>Procesando...</span>}
        </div>
        {transcript && <div style={{ marginTop: 8, fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: 14, color: '#666' }}>{transcript}</div>}
      </Panel>

      {exercises.length > 0 && (
        <Panel>
          <SectionTitle>EJERCICIOS REGISTRADOS</SectionTitle>
          {exercises.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,169,97,0.1)' }}>
              <div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: C.marble, fontWeight: 600 }}>{e.name}</div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#666' }}>
                  {e.sets}×{e.reps} @ {e.weight}kg · Vol: {(e.sets * e.reps * (e.weight || 1)).toFixed(0)}
                </div>
              </div>
              <button onClick={() => removeExercise(e.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <div style={{ paddingTop: 8 }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1 }}>VOLUMEN TOTAL </span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: C.marble, fontWeight: 700 }}>
              {exercises.reduce((s, e) => s + e.sets * e.reps * (e.weight || 1), 0).toFixed(0)} kg
            </span>
          </div>
        </Panel>
      )}

      <Panel>
        <SectionTitle>EVALUACIÓN IA</SectionTitle>
        <GoldBtn onClick={evaluateSession} disabled={evaluating || !exercises.length} style={{ width: '100%' }}>
          {evaluating ? 'Evaluando...' : '⚔ Evaluar sesión con IA'}
        </GoldBtn>
        {evaluation && (
          <div style={{ marginTop: 14 }}>
            {evaluation.split('\n').map((line, i) => {
              const isH = /^(PUNTUACIÓN|ANÁLISIS|MEJORAS|PRÓXIMA SESIÓN)/i.test(line)
              return (
                <div key={i} style={{ fontFamily: isH ? 'Cinzel,serif' : '"Cormorant Garamond",serif', fontSize: isH ? 11 : 15, color: isH ? C.gold : C.marble, letterSpacing: isH ? 2 : 0, lineHeight: 1.7, marginTop: isH ? 14 : 0 }}>
                  {line}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle>CALCULADORA 1RM · EPLEY</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={rmWeight} onChange={e => setRmWeight(e.target.value)} placeholder="Peso (kg)" type="number" style={{ ...iStyle, flex: 1 }} />
          <input value={rmReps} onChange={e => setRmReps(e.target.value)} placeholder="Reps" type="number" style={{ ...iStyle, flex: 1 }} />
        </div>
        {rm1 && (
          <>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 32, fontWeight: 700, color: C.gold, marginBottom: 10 }}>1RM: {rm1} kg</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid rgba(201,169,97,0.3)` }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: C.gold, fontSize: 10 }}>%</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: C.gold, fontSize: 10 }}>Peso (kg)</th>
                </tr>
              </thead>
              <tbody>
                {rmTable.map(r => (
                  <tr key={r.pct} style={{ borderBottom: '1px solid rgba(201,169,97,0.08)' }}>
                    <td style={{ padding: '5px 8px', color: '#777' }}>{r.pct}%</td>
                    <td style={{ padding: '5px 8px', color: C.marble, fontWeight: 600 }}>{r.kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>

      {sessions.length > 0 && (
        <Panel>
          <SectionTitle>HISTORIAL DE SESIONES</SectionTitle>
          {sessions.slice(0, 5).map(s => (
            <div key={s.id} style={{ borderBottom: '1px solid rgba(201,169,97,0.1)', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: C.gold, letterSpacing: 1 }}>{s.type}</span>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#666' }}>{s.date}</span>
              </div>
              {s.exercises.map((e, i) => (
                <div key={i} style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#888', marginBottom: 2 }}>
                  {e.name}: {e.sets}×{e.reps}@{e.weight}kg
                </div>
              ))}
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, marginTop: 4, letterSpacing: 1 }}>
                VOLUMEN: {s.totalVolume.toFixed(0)} kg
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}

// ─── TAB: PROGRESO ───────────────────────────────────────────────────────────
function TabProgreso({ profile, foods: todayFoods, water: todayWater, weights, sessions }) {
  const goal = calGoal(profile)
  const bmr = Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.sex === 'Femenino' ? -161 : 5))
  const tdee = Math.round(bmr * profile.activityLevel)
  const todayStr = today()

  const [photos, setPhotos] = useState(() => LS.get('oly2_photos', []))
  const [photoNote, setPhotoNote] = useState('')
  const [oracleLoading, setOracleLoading] = useState(false)
  const [oracleResult, setOracleResult] = useState('')
  const [calMonth, setCalMonth] = useState(() => new Date())

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i)
    const key = d.toISOString().split('T')[0]
    const isToday = key === todayStr
    const dayFoods = isToday ? todayFoods : LS.get(`oly2_foods_${key}`, [])
    const dayWater = isToday ? todayWater : LS.get(`oly2_water_${key}`, 0)
    return {
      day: d.toLocaleDateString('es-CL', { weekday: 'short' }),
      key,
      kcal: dayFoods.reduce((s, f) => s + (f.kcal || 0), 0),
      agua: parseFloat(((dayWater || 0) / 1000).toFixed(2)),
      peso: weights[key] || null,
    }
  })

  const weightData = last7.filter(d => d.peso !== null).map(d => ({ day: d.day, peso: d.peso }))
  const kcalData = last7.map(d => ({ day: d.day, kcal: d.kcal }))
  const waterData = last7.map(d => ({ day: d.day, agua: d.agua }))

  const wEntries = Object.entries(weights).sort()
  const mStartKey = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const wMonthStart = wEntries.find(([d]) => d >= mStartKey)
  const wLatest = wEntries[wEntries.length - 1]
  const monthlyChange = wMonthStart && wLatest && wMonthStart[0] !== wLatest[0]
    ? { diff: (wLatest[1] - wMonthStart[1]).toFixed(1), pct: ((wLatest[1] - wMonthStart[1]) / wMonthStart[1] * 100).toFixed(1) }
    : null

  const mYear = calMonth.getFullYear(); const mMonth = calMonth.getMonth()
  const mDays = new Date(mYear, mMonth + 1, 0).getDate()
  const firstDow = (() => { const d = new Date(mYear, mMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()
  const calDays = []
  for (let i = 0; i < firstDow; i++) calDays.push(null)
  for (let d = 1; d <= mDays; d++) {
    const key = `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isToday = key === todayStr
    const dFoods = isToday ? todayFoods : LS.get(`oly2_foods_${key}`, [])
    const kcal = dFoods.reduce((s, f) => s + (f.kcal || 0), 0)
    let bg = 'transparent'
    if (kcal > 0) {
      const pct = (kcal / goal) * 100
      bg = (pct >= 90 && pct <= 110) ? `${C.green}40` : ((pct >= 70 && pct < 90) || (pct > 110 && pct <= 130)) ? '#f39c1240' : `${C.red}40`
    }
    calDays.push({ d, key, kcal, bg, isToday })
  }

  async function uploadPhoto(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const newPhotos = [{ id: Date.now(), data: ev.target.result, note: photoNote, date: todayStr, weight: profile.weight }, ...photos].slice(0, 20)
      setPhotos(newPhotos); LS.set('oly2_photos', newPhotos); setPhotoNote('')
    }
    reader.readAsDataURL(file)
  }

  function removePhoto(id) { const p = photos.filter(x => x.id !== id); setPhotos(p); LS.set('oly2_photos', p) }

  async function consultOracle() {
    setOracleLoading(true); setOracleResult('')
    try {
      const wHist = wEntries.slice(-7).map(([d, w]) => `${d}: ${w}kg`).join(', ')
      const ctx = `Peso: ${profile.weight}kg, Talla: ${profile.height}cm, Edad: ${profile.age}, Fase: ${profile.phase}, TDEE: ${tdee}kcal, Meta: ${goal}kcal. Historial peso: ${wHist || 'sin datos'}.`
      let msgs
      if (photos.length > 0 && photos[0].data?.startsWith('data:image')) {
        const mime = photos[0].data.split(';')[0].split(':')[1]
        const b64 = photos[0].data.split(',')[1]
        msgs = [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: `Analiza mi progreso físico. ${ctx}\nResponde con secciones: ANÁLISIS VISUAL / DIAGNÓSTICO / 5 RECOMENDACIONES / ALERTAS / META 14 DÍAS` },
        ] }]
      } else {
        msgs = [{ role: 'user', content: `Analiza mi progreso. ${ctx}\nResponde con: DIAGNÓSTICO / 5 RECOMENDACIONES / ALERTAS / META 14 DÍAS` }]
      }
      setOracleResult(await callAI(msgs, 'Coach y nutricionista de élite. Español, directo y detallado.'))
    } catch (e) { setOracleResult(`Error: ${e.message}`) }
    setOracleLoading(false)
  }

  const ttStyle = { contentStyle: { background: C.panel, border: `1px solid ${C.gold}`, color: C.marble, fontFamily: 'Inter,sans-serif', fontSize: 12 } }

  return (
    <div>
      <Panel>
        <SectionTitle>STATS PERSONALES</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ l: 'PESO', v: `${profile.weight} kg` }, { l: 'TALLA', v: `${profile.height} cm` }, { l: 'TMB', v: `${bmr} kcal` }, { l: 'TDEE AJUSTADO', v: `${goal} kcal` }].map(s => (
            <div key={s.l} style={{ background: C.stone, borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid rgba(201,169,97,0.15)' }}>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 4 }}>{s.l}</div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 17, fontWeight: 700, color: C.marble }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {weightData.length > 0 && (
        <Panel>
          <SectionTitle>PESO · ÚLTIMOS 7 DÍAS</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData} margin={{ top: 14, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.stone} />
              <XAxis dataKey="day" tick={{ fill: '#777', fontSize: 11 }} />
              <YAxis tick={{ fill: '#777', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip {...ttStyle} />
              <Line type="monotone" dataKey="peso" stroke={C.gold} strokeWidth={2}
                dot={{ fill: C.gold, r: 4, stroke: C.gold }} label={{ position: 'top', fill: C.gold, fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
          {monthlyChange && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: C.stone, borderRadius: 6, textAlign: 'center', fontFamily: 'Inter,sans-serif', fontSize: 13, color: parseFloat(monthlyChange.diff) < 0 ? C.green : parseFloat(monthlyChange.diff) > 0 ? C.red : C.gold }}>
              Cambio mensual: {parseFloat(monthlyChange.diff) > 0 ? '+' : ''}{monthlyChange.diff} kg ({monthlyChange.pct}%)
            </div>
          )}
        </Panel>
      )}

      <Panel>
        <SectionTitle>CALORÍAS · ÚLTIMOS 7 DÍAS</SectionTitle>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={kcalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.stone} />
            <XAxis dataKey="day" tick={{ fill: '#777', fontSize: 11 }} />
            <YAxis tick={{ fill: '#777', fontSize: 11 }} />
            <Tooltip {...ttStyle} />
            <Bar dataKey="kcal" fill={C.gold} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <SectionTitle>HIDRATACIÓN · ÚLTIMOS 7 DÍAS</SectionTitle>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={waterData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.stone} />
            <XAxis dataKey="day" tick={{ fill: '#777', fontSize: 11 }} />
            <YAxis tick={{ fill: '#777', fontSize: 11 }} tickFormatter={v => `${v}L`} />
            <Tooltip {...ttStyle} formatter={v => [`${v}L`, 'Agua']} />
            <Bar dataKey="agua" fill={C.gold} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setCalMonth(new Date(mYear, mMonth - 1, 1))} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>‹</button>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: C.gold, letterSpacing: 2 }}>
            {calMonth.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase()}
          </span>
          <button onClick={() => setCalMonth(new Date(mYear, mMonth + 1, 1))} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: 'Cinzel,serif', fontSize: 9, color: C.gold, padding: '3px 0', letterSpacing: 1 }}>{d}</div>
          ))}
          {calDays.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '4px 2px', borderRadius: 5, background: d ? d.bg : 'transparent', border: d?.isToday ? `1px solid ${C.gold}` : '1px solid transparent', minHeight: 34 }}>
              {d && (
                <>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: d.isToday ? C.gold : C.marble, fontWeight: d.isToday ? 700 : 400 }}>{d.d}</div>
                  {d.kcal > 0 && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 8, color: '#777' }}>{d.kcal}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle>MEMORIA VISUAL</SectionTitle>
        <input value={photoNote} onChange={e => setPhotoNote(e.target.value)} placeholder="Nota opcional..."
          style={{ width: '100%', ...iStyle, marginBottom: 8, boxSizing: 'border-box' }} />
        <label>
          <div style={{ background: C.stone, border: `1px dashed rgba(201,169,97,0.5)`, borderRadius: 8, padding: 14, textAlign: 'center', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: 11, color: C.gold, letterSpacing: 1 }}>
            + SUBIR FOTO
          </div>
          <input type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
        </label>
        {photos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.stone }}>
                <img src={p.data} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '5px 8px', background: `${C.panel}ee` }}>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: C.gold }}>{p.date} · {p.weight}kg</div>
                  {p.note && <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 12, color: '#888', fontStyle: 'italic' }}>{p.note}</div>}
                </div>
                <button onClick={() => removePhoto(p.id)} style={{ position: 'absolute', top: 5, right: 5, background: C.red, border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle>ORÁCULO IA</SectionTitle>
        <GoldBtn onClick={consultOracle} disabled={oracleLoading} style={{ width: '100%' }}>
          {oracleLoading ? 'Consultando al Oráculo...' : '🔮 Consultar Oráculo de Progreso'}
        </GoldBtn>
        {oracleResult && (
          <div style={{ marginTop: 14 }}>
            {oracleResult.split('\n').map((line, i) => {
              const isH = /^(ANÁLISIS VISUAL|DIAGNÓSTICO|RECOMENDACIONES|5 RECOMENDACIONES|ALERTAS|META 14 DÍAS)/i.test(line)
              return (
                <div key={i} style={{ fontFamily: isH ? 'Cinzel,serif' : '"Cormorant Garamond",serif', fontSize: isH ? 11 : 15, color: isH ? C.gold : C.marble, letterSpacing: isH ? 2 : 0, lineHeight: 1.7, marginTop: isH ? 14 : 0 }}>
                  {line}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─── OVERLAY: CONFIGURACIÓN ──────────────────────────────────────────────────
function ConfigOverlay({ profile, setProfile, onClose }) {
  const [form, setForm] = useState({ ...profile })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  function save() { setProfile(form); LS.set('oly2_profile', form); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000dd', zIndex: 1000, overflowY: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
      <div style={{ background: C.panel, borderRadius: 16, width: '100%', maxWidth: 460, margin: '0 16px 60px', border: `1px solid rgba(201,169,97,0.3)`, alignSelf: 'flex-start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.stone}` }}>
          <h2 style={{ fontFamily: 'Cinzel,serif', color: C.gold, margin: 0, fontSize: 14, letterSpacing: 3 }}>CONFIGURACIÓN</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.stone}` }}>DATOS PERSONALES</div>
          <FieldInput label="Nombre" value={form.name} onChange={v => f('name', v)} />
          <FieldInput label="Peso (kg)" value={form.weight} onChange={v => f('weight', v)} type="number" />
          <FieldInput label="Talla (cm)" value={form.height} onChange={v => f('height', v)} type="number" />
          <FieldInput label="Edad" value={form.age} onChange={v => f('age', v)} type="number" />
          <FieldSelect label="Sexo" value={form.sex} onChange={v => f('sex', v)} options={['Masculino', 'Femenino']} />

          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, marginTop: 16, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.stone}` }}>ENTRENAMIENTO</div>
          <FieldSelect label="Fase actual" value={form.phase} onChange={v => f('phase', v)}
            options={['Recomposición corporal', 'Definición / Cutting', 'Volumen / Bulking', 'Mantenimiento', 'Pre-competencia']} />
          <FieldSelect label="Split" value={form.split} onChange={v => f('split', v)} options={['PPL', 'Arnold', 'Upper-Lower', 'Full Body']} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>Días por semana: {form.daysPerWeek}</div>
            <input type="range" min="3" max="6" value={form.daysPerWeek} onChange={e => f('daysPerWeek', +e.target.value)} style={{ width: '100%' }} />
          </div>
          <FieldSelect label="Nivel de actividad" value={form.activityLevel} onChange={v => f('activityLevel', parseFloat(v))}
            options={[{ value: 1.2, label: 'Sedentario (1.2)' }, { value: 1.375, label: 'Ligero (1.375)' }, { value: 1.55, label: 'Moderado (1.55)' }, { value: 1.725, label: 'Activo (1.725)' }, { value: 1.9, label: 'Muy activo (1.9)' }]} />
          <FieldInput label="Objetivo" value={form.objective} onChange={v => f('objective', v)} />

          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, marginTop: 16, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.stone}` }}>SALUD</div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={form.useAnabolics} onChange={e => f('useAnabolics', e.target.checked)} id="anab" style={{ width: 16, height: 16 }} />
            <label htmlFor="anab" style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: C.marble, cursor: 'pointer' }}>Usa anabólicos</label>
          </div>
          <FieldInput label="Suplementos actuales" value={form.supplements} onChange={v => f('supplements', v)} />
          <FieldInput label="Lesiones / limitaciones" value={form.injuries} onChange={v => f('injuries', v)} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>Meta de sueño: {form.sleepGoal}h</div>
            <input type="range" min="6" max="10" value={form.sleepGoal} onChange={e => f('sleepGoal', +e.target.value)} style={{ width: '100%' }} />
          </div>

          <div style={{ background: C.stone, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>META CALÓRICA CALCULADA</div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 24, fontWeight: 700, color: C.marble }}>{calGoal(form)} <span style={{ fontSize: 13, color: '#666' }}>kcal/día</span></div>
          </div>
          <GoldBtn onClick={save} style={{ width: '100%', padding: 12, fontSize: 13 }}>Guardar configuración</GoldBtn>
        </div>
      </div>
    </div>
  )
}

// ─── OVERLAY: RITUALES ───────────────────────────────────────────────────────
function RitualesOverlay({ onClose }) {
  const [rituals, setRituals] = useState(() => LS.get('oly2_rituals', []))
  const ck = `oly2_rituals_check_${today()}`
  const [checks, setChecks] = useState(() => LS.get(ck, {}))
  const [objective, setObjective] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [newR, setNewR] = useState({ icon: '⚡', title: '', desc: '', moment: 'Mañana' })

  function saveR(r) { setRituals(r); LS.set('oly2_rituals', r) }
  function saveC(c) { setChecks(c); LS.set(ck, c) }

  async function generateRituals() {
    if (!objective.trim()) return
    setGenLoading(true)
    try {
      const raw = await callAI([{ role: 'user', content: `Genera 7 rituales diarios para: "${objective}". SOLO JSON array:\n[{"icon":"emoji","title":"...","desc":"...","moment":"Mañana|Tarde|Noche"}]` }],
        'Coach de alto rendimiento. SOLO JSON array válido.')
      const clean = raw.replace(/```json?/g, '').replace(/```/g, '').trim()
      saveR([...rituals, ...JSON.parse(clean).map(r => ({ ...r, id: Date.now() + Math.random() }))])
    } catch (e) { alert(`Error: ${e.message}`) }
    setGenLoading(false)
  }

  function addManual() {
    if (!newR.title) return
    saveR([...rituals, { ...newR, id: Date.now() }]); setNewR({ icon: '⚡', title: '', desc: '', moment: 'Mañana' })
  }

  const done = rituals.filter(r => checks[r.id]).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000dd', zIndex: 1000, overflowY: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
      <div style={{ background: C.panel, borderRadius: 16, width: '100%', maxWidth: 460, margin: '0 16px 60px', border: `1px solid rgba(201,169,97,0.3)`, alignSelf: 'flex-start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.stone}` }}>
          <h2 style={{ fontFamily: 'Cinzel,serif', color: C.gold, margin: 0, fontSize: 14, letterSpacing: 3 }}>RITUALES</h2>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: C.gold, fontWeight: 600 }}>{done}/{rituals.length}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, marginBottom: 8 }}>GENERAR CON IA</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Tu objetivo..."
              style={{ ...iStyle, flex: 1 }} />
            <GoldBtn onClick={generateRituals} disabled={genLoading}>{genLoading ? '...' : 'Generar'}</GoldBtn>
          </div>

          {rituals.length === 0 && (
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', color: '#555', fontSize: 15, marginBottom: 16 }}>Sin rituales aún.</div>
          )}

          {rituals.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.stone}` }}>
              <input type="checkbox" checked={!!checks[r.id]} onChange={() => { const c = { ...checks, [r.id]: !checks[r.id] }; saveC(c) }}
                style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: checks[r.id] ? '#555' : C.marble, textDecoration: checks[r.id] ? 'line-through' : 'none' }}>{r.title}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#666', marginLeft: 'auto' }}>{r.moment}</span>
                </div>
                {r.desc && <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 13, color: '#777', fontStyle: 'italic', marginTop: 2 }}>{r.desc}</div>}
              </div>
              <button onClick={() => saveR(rituals.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          ))}

          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: C.gold, letterSpacing: 2, marginTop: 20, marginBottom: 10 }}>AGREGAR RITUAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, marginBottom: 8 }}>
            <input value={newR.icon} onChange={e => setNewR(p => ({ ...p, icon: e.target.value }))}
              style={{ ...iStyle, textAlign: 'center', fontSize: 20, padding: '8px 4px' }} />
            <input value={newR.title} onChange={e => setNewR(p => ({ ...p, title: e.target.value }))} placeholder="Título..."
              style={{ ...iStyle, width: '100%' }} />
          </div>
          <input value={newR.desc} onChange={e => setNewR(p => ({ ...p, desc: e.target.value }))} placeholder="Descripción..."
            style={{ ...iStyle, width: '100%', marginBottom: 8, display: 'block', boxSizing: 'border-box' }} />
          <select value={newR.moment} onChange={e => setNewR(p => ({ ...p, moment: e.target.value }))}
            style={{ ...iStyle, width: '100%', marginBottom: 10, display: 'block', boxSizing: 'border-box' }}>
            <option>Mañana</option><option>Tarde</option><option>Noche</option>
          </select>
          <GoldBtn onClick={addManual} style={{ width: '100%' }}>Agregar ritual</GoldBtn>
        </div>
      </div>
    </div>
  )
}

// ─── OVERLAY: INSTRUCCIONES ──────────────────────────────────────────────────
function InstruccionesOverlay({ onClose }) {
  const [open, setOpen] = useState(null)
  const items = [
    { t: 'Cómo usar HOY', c: 'La pestaña HOY muestra el Edicto Calórico con barra visual dinámica (verde=en rango, rojo=exceso). Registra hidratación con los botones rápidos, anota actividades con cálculo de calorías quemadas por MET y registra tu peso diario. El Oráculo da feedback inmediato.' },
    { t: 'Cómo registrar nutrición con dictado de voz', c: 'En NUTRICIÓN presiona 🎙 y describe lo que comiste en voz alta. La IA detecta si es desayuno, almuerzo, cena o snack, extrae calorías, proteína y sodio de cada alimento, da una puntuación y consejo personalizado. Presiona ⏹ para detener.' },
    { t: 'Cómo registrar entrenamiento con dictado de voz', c: 'En ATLETA presiona 🎙 y di: "Hice press banca 4 series de 6 con 80 kilos, dominadas 3 series de 8". La IA organiza los ejercicios automáticamente. Al terminar la sesión presiona "Cerrar sesión" para guardarla en el historial.' },
    { t: 'Qué es TMB y TDEE', c: 'TMB (Tasa Metabólica Basal): calorías que tu cuerpo quema en reposo total, calculada con la fórmula Mifflin-St Jeor. TDEE: TMB × factor de actividad. Es tu gasto calórico real diario incluyendo ejercicio y actividad cotidiana.' },
    { t: 'Cómo funciona el ajuste calórico por fase', c: 'Recomposición: TDEE exacto. Cutting: TDEE −300 kcal. Bulking: TDEE +300 kcal. Mantenimiento: TDEE exacto. Pre-competencia: TDEE −500 kcal. La app recalcula la meta automáticamente al guardar configuración.' },
    { t: 'Cómo usar el Oráculo', c: 'El Oráculo IA analiza tu contexto completo (hora, calorías, proteína, fase) para dar recomendaciones ultra específicas. En PROGRESO puede analizar tus fotos para evaluar cambios físicos visuales si has subido imágenes.' },
    { t: 'Consejos para hipertrofia pesada 6-8 reps', c: 'Rango 6-8 reps estimula hipertrofia miofibrilar máxima. Aplica sobrecarga progresiva: sube 2.5kg cuando completes todas las series con buena técnica. Descansa 3-5 minutos entre series. Prioriza compuestos: press, remo, sentadilla, peso muerto, press militar.' },
    { t: 'Cómo funcionan los Rituales', c: 'Los rituales son hábitos diarios configurables que construyen consistencia. Genéralos con IA según tu objetivo o agrégalos manualmente con ícono, título y momento del día. El checklist se resetea cada día a medianoche. El contador muestra tu cumplimiento diario.' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000dd', zIndex: 1000, overflowY: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
      <div style={{ background: C.panel, borderRadius: 16, width: '100%', maxWidth: 460, margin: '0 16px 60px', border: `1px solid rgba(201,169,97,0.3)`, alignSelf: 'flex-start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.stone}` }}>
          <h2 style={{ fontFamily: 'Cinzel,serif', color: C.gold, margin: 0, fontSize: 14, letterSpacing: 3 }}>INSTRUCCIONES</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '8px 20px 20px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.stone}` }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', color: C.marble, padding: '13px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: open === i ? C.gold : C.marble }}>{item.t}</span>
                <span style={{ color: C.gold, fontSize: 18, lineHeight: 1, marginLeft: 8 }}>{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div style={{ fontFamily: '"Cormorant Garamond",serif', fontSize: 15, color: '#999', lineHeight: 1.7, paddingBottom: 14 }}>{item.c}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState(() => ({ ...DEFAULT_PROFILE, ...LS.get('oly2_profile', {}) }))
  const [tab, setTab] = useState('hoy')
  const [overlay, setOverlay] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const dk = today()
  const [foods, setFoods] = useState(() => LS.get(`oly2_foods_${dk}`, []))
  const [water, setWater] = useState(() => LS.get(`oly2_water_${dk}`, 0))
  const [activities, setActivities] = useState(() => LS.get(`oly2_activities_${dk}`, []))
  const [exercises, setExercises] = useState(() => LS.get(`oly2_exercises_${dk}`, []))
  const [weights, setWeights] = useState(() => LS.get('oly2_weights', {}))
  const [sessions, setSessions] = useState(() => LS.get('oly2_sessions', []))

  useEffect(() => { LS.set(`oly2_foods_${dk}`, foods) }, [foods])
  useEffect(() => { LS.set(`oly2_water_${dk}`, water) }, [water])
  useEffect(() => { LS.set(`oly2_activities_${dk}`, activities) }, [activities])
  useEffect(() => { LS.set(`oly2_exercises_${dk}`, exercises) }, [exercises])
  useEffect(() => { LS.set('oly2_weights', weights) }, [weights])
  useEffect(() => { LS.set('oly2_sessions', sessions) }, [sessions])

  const goal = calGoal(profile)
  const totalKcal = foods.reduce((s, f) => s + (f.kcal || 0), 0)
  const trainingDay = getTrainingDay(profile.split, profile.daysPerWeek)
  const rituals = LS.get('oly2_rituals', [])
  const checks = LS.get(`oly2_rituals_check_${dk}`, {})
  const ritualsDone = rituals.filter(r => checks[r.id]).length

  const TABS = [
    { id: 'hoy', icon: '⚡', label: 'HOY' },
    { id: 'nutricion', icon: '🍇', label: 'NUTRICIÓN' },
    { id: 'atleta', icon: '⚔', label: 'ATLETA' },
    { id: 'progreso', icon: '◐', label: 'PROGRESO' },
  ]

  return (
    <div style={{ background: C.black, minHeight: '100vh', color: C.marble, fontFamily: 'Inter,sans-serif', paddingBottom: 80, position: 'relative' }}>
      {/* ── DECORATIVE FIGURES ── */}
      <AtlasFigure />
      <BustFigure />

      <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ══════════════ HEADER v1 STYLE ══════════════ */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: C.black, borderBottom: `1px solid rgba(201,169,97,0.15)` }}>

          {/* Gear button top-right */}
          <div style={{ position: 'absolute', top: 14, right: 16, zIndex: 10 }}>
            <button onClick={() => setMenuOpen(p => !p)}
              style={{ background: C.stone, border: `1px solid rgba(201,169,97,0.3)`, borderRadius: 8, padding: '8px 11px', cursor: 'pointer', fontSize: 15, color: C.marble }}>
              ⚙️
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: C.panel, border: `1px solid rgba(201,169,97,0.3)`, borderRadius: 8, overflow: 'hidden', minWidth: 170, zIndex: 200, boxShadow: '0 8px 28px #00000099' }}>
                {[{ id: 'config', icon: '⚙', label: 'Configuración' }, { id: 'rituales', icon: '◎', label: 'Rituales' }, { id: 'instrucciones', icon: '?', label: 'Instrucciones' }].map(item => (
                  <button key={item.id} onClick={() => { setOverlay(item.id); setMenuOpen(false) }}
                    style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${C.stone}`, color: C.marble, cursor: 'pointer', textAlign: 'left', fontFamily: 'Cinzel,serif', fontSize: 12, letterSpacing: 1 }}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ paddingTop: 18, paddingBottom: 0, textAlign: 'center' }}>
            {/* OLYMPUS logo */}
            <div style={{ fontFamily: '"Cinzel Decorative",cursive', fontSize: '3rem', color: C.gold, letterSpacing: '0.5em', lineHeight: 1, fontWeight: 700, textShadow: `0 0 40px rgba(201,169,97,0.3)` }}>
              OLYMPUS
            </div>
            {/* Subtitle */}
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.65rem', color: C.gold, opacity: 0.6, letterSpacing: '0.3em', marginTop: 4, textTransform: 'uppercase' }}>
              VIRTUS · DISCIPLINA · GLORIA
            </div>
            {/* Meander */}
            <div style={{ marginTop: 8 }}>
              <MeanderSVG opacity={0.3} />
            </div>
            {/* SALVE greeting */}
            <div style={{ fontFamily: '"Cormorant Garamond",serif', fontStyle: 'italic', fontSize: '2.5rem', color: C.marble, marginTop: 10, lineHeight: 1.1 }}>
              Salve, {profile.name}
            </div>
            {/* Date */}
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '0.62rem', color: `${C.gold}88`, letterSpacing: '0.2em', marginTop: 4, textTransform: 'uppercase' }}>
              {fmtDate()}
            </div>
            {/* 3 stats */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 12, marginBottom: 0 }}>
              {[
                { label: 'MASA', value: `${profile.weight}kg` },
                { label: 'FASE', value: profile.phase.split(' ')[0].toUpperCase() },
                { label: 'RITUAL', value: `${ritualsDone}/${rituals.length || 0}` },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <div style={{ width: 1, background: `rgba(201,169,97,0.25)`, margin: '0 16px', alignSelf: 'stretch' }} />}
                  <div style={{ textAlign: 'center', padding: '4px 8px' }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 16, fontWeight: 700, color: C.marble }}>{s.value}</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: C.gold, letterSpacing: 2, marginTop: 2 }}>{s.label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {/* Navigation tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 14, borderTop: `1px solid rgba(201,169,97,0.12)` }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', transition: 'border-color 0.2s' }}>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: tab === t.id ? C.gold : '#555', letterSpacing: 2, textTransform: 'uppercase', display: 'block' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '14px 14px 0' }}>
          {tab === 'hoy'      && <TabHoy profile={profile} foods={foods} water={water} setWater={setWater} activities={activities} setActivities={setActivities} weights={weights} setWeights={setWeights} />}
          {tab === 'nutricion' && <TabNutricion profile={profile} foods={foods} setFoods={setFoods} />}
          {tab === 'atleta'   && <TabAtleta profile={profile} exercises={exercises} setExercises={setExercises} sessions={sessions} setSessions={setSessions} />}
          {tab === 'progreso' && <TabProgreso profile={profile} foods={foods} water={water} weights={weights} sessions={sessions} />}
        </div>

        {/* ── OVERLAYS ── */}
        {overlay === 'config'       && <ConfigOverlay profile={profile} setProfile={setProfile} onClose={() => setOverlay(null)} />}
        {overlay === 'rituales'     && <RitualesOverlay onClose={() => setOverlay(null)} />}
        {overlay === 'instrucciones' && <InstruccionesOverlay onClose={() => setOverlay(null)} />}
        {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
      </div>
    </div>
  )
}
