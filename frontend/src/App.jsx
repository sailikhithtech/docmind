import { useState, useRef, useEffect, useCallback } from "react"

const API = "http://localhost:8000"

let authToken = localStorage.getItem("docmind_token") || ""

const setAuthToken = (token) => {
  authToken = token
  if (token) localStorage.setItem("docmind_token", token)
  else localStorage.removeItem("docmind_token")
}

const authFetch = async (url, options = {}) => {
  const headers = options.headers || {}
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`
  
  if (options.body instanceof FormData) {
    // browser sets content-type automatically
  } else if (!headers["Content-Type"]) {
    // defaults to JSON if no body or body isn't formdata
  }
  
  options.headers = headers
  const res = await window.fetch(url, options)
  if (res.status === 401) {
    setAuthToken("")
    window.location.reload()
  }
  return res
}


// ─── Toast ───────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  const colors = {
    error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", icon: "✕" },
    success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", icon: "✓" },
    info: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)", icon: "i" }
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 9999,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: "14px 20px",
      display: "flex", alignItems: "center", gap: 12,
      animation: "fadeUp 0.3s ease", backdropFilter: "blur(20px)", maxWidth: 380
    }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: c.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", color: "var(--text-dim)", fontSize: 18, marginLeft: 8, flexShrink: 0 }}>×</button>
    </div>
  )
}

// ─── Background ──────────────────────────────────────────
function Background() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "60%", height: "60%", background: "radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
    </div>
  )
}

// ─── Listen Button ────────────────────────────────────────
function ListenButton({ filename }) {
  const [language, setLanguage] = useState("English")
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const audioRef = useRef()
  const languages = ["English", "Hindi", "Telugu"]

  const handleListen = async () => {
    if (!filename) return
    setLoading(true)
    setAudioUrl(null)
    try {
      const res = await authFetch(`${API}/listen?filename=${encodeURIComponent(filename)}&language=${language}`, { method: "POST" })
      const data = await res.json()
      if (data.audio_url) {
        setAudioUrl(data.audio_url)
        setTimeout(() => audioRef.current?.play(), 300)
      }
    } catch {
      alert("Audio generation failed. Make sure backend is running.")
    }
    setLoading(false)
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", marginTop: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>🔊 Listen to Document</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {languages.map(lang => (
          <button key={lang} onClick={() => { setLanguage(lang); setAudioUrl(null) }} style={{
            padding: "8px 16px", borderRadius: 8,
            background: language === lang ? "var(--blue-dim)" : "var(--bg3)",
            border: `1px solid ${language === lang ? "var(--blue-glow)" : "var(--border)"}`,
            color: language === lang ? "var(--blue)" : "var(--text-dim)",
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s", cursor: "pointer"
          }}>
            {lang === "English" ? "🇬🇧" : lang === "Hindi" ? "🇮🇳" : "🏳️"} {lang}
          </button>
        ))}
      </div>
      <button onClick={handleListen} disabled={loading} style={{
        width: "100%", padding: "12px",
        background: loading ? "var(--bg3)" : "linear-gradient(135deg, var(--blue), var(--purple))",
        color: loading ? "var(--text-dimmer)" : "#fff",
        borderRadius: 10, fontSize: 14,
        fontFamily: "var(--font-display)", fontWeight: 700, transition: "all 0.2s"
      }}>
        {loading ? (language !== "English" ? "⏳ Translating & generating audio..." : "⏳ Generating audio...") : `▶ Listen in ${language}`}
      </button>
      {audioUrl && (
        <div style={{ marginTop: 14 }}>
          <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%", marginBottom: 8 }} />
          <a href={audioUrl} download style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--blue)", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none" }}>⬇ Download</a>
        </div>
      )}
    </div>
  )
}

// ─── Summary History Page ────────────────────────────────
function SummaryHistoryPage({ showToast, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  const personaColors = { Student: "var(--blue)", Researcher: "var(--purple)", Executive: "var(--green)" }
  const personaEmoji = { Student: "🎓", Researcher: "🔬", Executive: "💼" }
  const scoreColor = (pct) => pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)"

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API}/summary-history`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch {
      showToast("Could not load history. Make sure backend is running.", "error")
    }
    setLoading(false)
  }

  useEffect(() => { fetchHistory() }, [])

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const deleteRecord = async (id) => {
    try {
      await authFetch(`${API}/summary-history/${id}`, { method: "DELETE" })
      setHistory(h => h.filter(item => item.id !== id))
      setConfirmDelete(null)
      showToast("Summary record deleted", "success")
    } catch {
      showToast("Could not delete record", "error")
    }
  }

  const personas = [...new Set(history.map(h => h.persona))]
  const avgScore = history.length
    ? Math.round(history.reduce((a, h) => a + (h.hallucination?.percentage ?? 0), 0) / history.length)
    : 0

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "40px 32px", maxWidth: 960, margin: "0 auto" }}>

      {/* Delete confirm modal */}
      {confirmDelete !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "32px 40px", maxWidth: 400, textAlign: "center",
            animation: "fadeUp 0.25s ease"
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗑️</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Delete this record?</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>This action cannot be undone. The summary will be permanently removed from history.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: "12px", background: "var(--bg3)", border: "1px solid var(--border)",
                color: "var(--text-dim)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, cursor: "pointer"
              }}>Cancel</button>
              <button onClick={() => deleteRecord(confirmDelete)} style={{
                flex: 1, padding: "12px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
                color: "var(--red)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, cursor: "pointer"
              }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div style={{ animation: "fadeUp 0.4s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", borderRadius: 100, padding: "4px 14px", marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: "pulse 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}>Summary History</span>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Past Summaries</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>All your previously summarized documents with full details</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "10px 20px", borderRadius: 8,
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s", cursor: "pointer"
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >← Back</button>
          <button onClick={fetchHistory} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "10px 20px", borderRadius: 8,
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s", cursor: "pointer"
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Loading history...</div>
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px 0", animation: "fadeUp 0.4s ease" }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>📄</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, marginBottom: 10 }}>No summaries yet</div>
          <div style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>Upload a PDF and generate a summary — it will automatically appear here.</div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28, animation: "fadeUp 0.4s 0.1s ease both" }}>
            {[
              { label: "Total Summaries", value: history.length, color: "var(--blue)", icon: "📄" },
              { label: "Unique Docs", value: [...new Set(history.map(h => h.filename))].length, color: "var(--purple)", icon: "📚" },
              { label: "Personas Used", value: personas.length, color: "var(--green)", icon: "🎭" },
              { label: "Avg Confidence", value: `${avgScore}%`, color: scoreColor(avgScore), icon: "✔️" },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {history.map((item, i) => {
              const pct = item.hallucination?.percentage ?? 0
              const sc = scoreColor(pct)
              const isOpen = expanded[item.id]
              const pc = personaColors[item.persona] || "var(--blue)"
              return (
                <div key={item.id} style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 18, overflow: "hidden",
                  animation: `fadeUp 0.35s ${i * 0.06}s ease both`,
                  transition: "border-color 0.2s, background 0.2s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)" }}
                >
                  {/* Card Header */}
                  <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                      {/* Icon */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        background: `${pc}22`, border: `1px solid ${pc}55`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
                      }}>{personaEmoji[item.persona] || "💬"}</div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
                          marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>{item.filename}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {/* Persona badge */}
                          <span style={{
                            background: `${pc}22`, border: `1px solid ${pc}55`,
                            color: pc, padding: "2px 10px", borderRadius: 100,
                            fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700
                          }}>{personaEmoji[item.persona]} {item.persona}</span>
                          {/* Model badge */}
                          <span style={{
                            background: "var(--bg3)", border: "1px solid var(--border)",
                            color: "var(--text-dim)", padding: "2px 10px", borderRadius: 100,
                            fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600
                          }}>🤖 {item.model_used}</span>
                          {/* Date */}
                          <span style={{ fontSize: 12, color: "var(--text-dimmer)" }}>🕐 {item.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence + Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      {/* Score pill */}
                      <div style={{
                        background: `${sc}22`, border: `1px solid ${sc}55`,
                        color: sc, padding: "4px 14px", borderRadius: 100,
                        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13
                      }}>{pct}%</div>

                      {/* Expand toggle */}
                      <button onClick={() => toggleExpand(item.id)} style={{
                        background: "var(--bg3)", border: "1px solid var(--border)",
                        color: "var(--text-dim)", padding: "6px 14px", borderRadius: 8,
                        fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600,
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
                      >{isOpen ? "▲ Hide" : "▼ View"}</button>

                      {/* Delete */}
                      <button onClick={() => setConfirmDelete(item.id)} style={{
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                        color: "var(--red)", padding: "6px 12px", borderRadius: 8,
                        fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600,
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                      >🗑 Delete</button>
                    </div>
                  </div>

                  {/* Confidence bar (always visible) */}
                  <div style={{ padding: "0 24px 8px" }}>
                    <div style={{ height: 3, background: "var(--bg3)", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: sc, width: `${pct}%`, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${sc}` }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dimmer)", marginTop: 4 }}>{item.hallucination?.label || "Confidence score"}</div>
                  </div>

                  {/* Summary preview (always visible, truncated) */}
                  {!isOpen && item.summary && (
                    <div style={{ padding: "8px 24px 20px" }}>
                      <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7, margin: 0,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
                      }}>{item.summary}</p>
                    </div>
                  )}

                  {/* Expanded section */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "20px 24px", animation: "fadeIn 0.2s ease" }}>
                      {/* Full Summary */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Full Summary</div>
                        <div style={{
                          background: "var(--bg3)", border: "1px solid var(--border)",
                          borderRadius: 12, padding: "16px 20px",
                          fontSize: 14, lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap"
                        }}>{item.summary}</div>
                      </div>

                      {/* Sentence Analysis */}
                      {item.hallucination?.details?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sentence Analysis</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {item.hallucination.details.map((d, di) => (
                              <div key={di} style={{
                                background: "var(--bg3)", border: `1px solid var(--border)`,
                                borderLeft: `3px solid ${d.grounded ? "var(--green)" : "var(--red)"}`,
                                borderRadius: 8, padding: "10px 14px",
                                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12
                              }}>
                                <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)" }}>{d.sentence}.</span>
                                <span style={{
                                  background: d.grounded ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                  color: d.grounded ? "var(--green)" : "var(--red)",
                                  border: `1px solid ${d.grounded ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                                  padding: "3px 10px", borderRadius: 100,
                                  fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                                  fontFamily: "var(--font-display)"
                                }}>{d.grounded ? "✓ Grounded" : "⚠ Review"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Audio player if available */}
                      {item.audio_url && (
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🔊 Summary Audio</div>
                          <audio src={item.audio_url} controls style={{ width: "100%", marginBottom: 8 }} />
                          <a href={item.audio_url} download style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            color: "var(--blue)", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none"
                          }}>⬇ Download Audio</a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Unified History Page ─────────────────────────────────
function HistoryPage({ showToast }) {
  const [tab, setTab] = useState("summaries")
  const [summaries, setSummaries] = useState([])
  const [audios, setAudios] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  const personaColors = { Student: "var(--blue)", Researcher: "var(--purple)", Executive: "var(--green)" }
  const personaEmoji = { Student: "🎓", Researcher: "🔬", Executive: "💼" }
  const langFlag = { English: "🇬🇧", Hindi: "🇮🇳", Telugu: "🏳️" }
  const scoreColor = (pct) => pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)"

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        authFetch(`${API}/summary-history`),
        authFetch(`${API}/audio-history`)
      ])
      const sData = await sRes.json()
      const aData = await aRes.json()
      setSummaries(sData.history || [])
      setAudios(aData.history || [])
    } catch {
      showToast("Could not load history. Make sure backend is running.", "error")
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const deleteSummary = async (id) => {
    try {
      await authFetch(`${API}/summary-history/${id}`, { method: "DELETE" })
      setSummaries(h => h.filter(i => i.id !== id))
      setConfirmDelete(null)
      showToast("Summary deleted", "success")
    } catch { showToast("Could not delete", "error") }
  }

  const deleteAudio = async (id) => {
    try {
      await authFetch(`${API}/audio-history/${id}`, { method: "DELETE" })
      setAudios(h => h.filter(i => i.id !== id))
      setConfirmDelete(null)
      showToast("Audio record deleted", "success")
    } catch { showToast("Could not delete", "error") }
  }

  const avgScore = summaries.length
    ? Math.round(summaries.reduce((a, h) => a + (h.hallucination?.percentage ?? 0), 0) / summaries.length)
    : 0

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "40px 32px", maxWidth: 960, margin: "0 auto" }}>

      {/* Delete Confirm Modal */}
      {confirmDelete !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 40px", maxWidth: 400, textAlign: "center", animation: "fadeUp 0.25s ease" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗑️</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Delete this record?</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                if (confirmDelete.type === "summary") deleteSummary(confirmDelete.id)
                else deleteAudio(confirmDelete.id)
              }} style={{ flex: 1, padding: "12px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--red)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, animation: "fadeUp 0.4s ease" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", borderRadius: 100, padding: "4px 14px", marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: "pulse 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}>History</span>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Document History</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>All your past summaries and generated audio files</p>
        </div>
        <button onClick={fetchAll} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "10px 20px", borderRadius: 8, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
        >↻ Refresh</button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {[{ id: "summaries", label: "📋 Summaries", count: summaries.length }, { id: "audio", label: "🔊 Audio", count: audios.length }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "9px 20px", borderRadius: 9,
            background: tab === t.id ? "linear-gradient(135deg, var(--blue), var(--purple))" : "transparent",
            color: tab === t.id ? "#fff" : "var(--text-dim)",
            border: "none", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
            transition: "all 0.2s", cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            {t.label}
            <span style={{ background: tab === t.id ? "rgba(255,255,255,0.2)" : "var(--bg3)", border: tab === t.id ? "none" : "1px solid var(--border)", padding: "1px 8px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Loading history...</div>
        </div>
      ) : tab === "summaries" ? (
        summaries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", animation: "fadeUp 0.4s ease" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No summaries yet</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Upload a PDF and generate a summary — it will appear here.</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24, animation: "fadeUp 0.4s 0.1s ease both" }}>
              {[
                { label: "Total", value: summaries.length, color: "var(--blue)", icon: "📄" },
                { label: "Unique Docs", value: [...new Set(summaries.map(h => h.filename))].length, color: "var(--purple)", icon: "📚" },
                { label: "Personas", value: [...new Set(summaries.map(h => h.persona))].length, color: "var(--green)", icon: "🎭" },
                { label: "Avg Confidence", value: `${avgScore}%`, color: scoreColor(avgScore), icon: "✔️" },
              ].map((s, i) => (
                <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: s.color, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Summary Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {summaries.map((item, i) => {
                const pct = item.hallucination?.percentage ?? 0
                const sc = scoreColor(pct)
                const isOpen = expanded[item.id]
                const pc = personaColors[item.persona] || "var(--blue)"
                return (
                  <div key={item.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", animation: `fadeUp 0.35s ${i * 0.06}s ease both`, transition: "border-color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-bright)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    {/* Header row */}
                    <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: `${pc}22`, border: `1px solid ${pc}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{personaEmoji[item.persona] || "📄"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename}</div>
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ background: `${pc}22`, border: `1px solid ${pc}55`, color: pc, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700 }}>{personaEmoji[item.persona]} {item.persona}</span>
                            <span style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "2px 9px", borderRadius: 100, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600 }}>🤖 {item.model_used}</span>
                            <span style={{ fontSize: 11, color: "var(--text-dimmer)" }}>🕐 {item.date}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <div style={{ background: `${sc}22`, border: `1px solid ${sc}55`, color: sc, padding: "4px 12px", borderRadius: 100, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12 }}>{pct}%</div>
                        <button onClick={() => toggleExpand(item.id)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "5px 12px", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
                        >{isOpen ? "▲ Hide" : "▼ View"}</button>
                        <button onClick={() => setConfirmDelete({ id: item.id, type: "summary" })} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)", padding: "5px 10px", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                        >🗑 Delete</button>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ padding: "0 22px 6px" }}>
                      <div style={{ height: 3, background: "var(--bg3)", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: sc, width: `${pct}%`, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${sc}` }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-dimmer)", marginTop: 3 }}>{item.hallucination?.label || "Confidence"}</div>
                    </div>

                    {/* Summary preview */}
                    {!isOpen && item.summary && (
                      <div style={{ padding: "6px 22px 18px" }}>
                        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.summary}</p>
                      </div>
                    )}

                    {/* Expanded */}
                    {isOpen && (
                      <div style={{ borderTop: "1px solid var(--border)", padding: "20px 22px", animation: "fadeIn 0.2s ease" }}>
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Full Summary</div>
                          <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", fontSize: 14, lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap" }}>{item.summary}</div>
                        </div>
                        {item.hallucination?.details?.length > 0 && (
                          <div style={{ marginBottom: 18 }}>
                            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Sentence Analysis</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {item.hallucination.details.map((d, di) => (
                                <div key={di} style={{ background: "var(--bg3)", borderLeft: `3px solid ${d.grounded ? "var(--green)" : "var(--red)"}`, borderRadius: 7, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                  <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)" }}>{d.sentence}.</span>
                                  <span style={{ background: d.grounded ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: d.grounded ? "var(--green)" : "var(--red)", border: `1px solid ${d.grounded ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, padding: "2px 9px", borderRadius: 100, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "var(--font-display)" }}>{d.grounded ? "✓ Grounded" : "⚠ Review"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.audio_url && (
                          <div>
                            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🔊 Summary Audio</div>
                            <audio src={item.audio_url} controls style={{ width: "100%", marginBottom: 8 }} />
                            <a href={item.audio_url} download style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--blue)", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none" }}>⬇ Download Audio</a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      ) : (
        // Audio Tab
        audios.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", animation: "fadeUp 0.4s ease" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎵</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No Audio History Yet</div>
            <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Generate audio from the Audio tab and it will appear here.</div>
          </div>
        ) : (
          <>
            {/* Audio Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24, animation: "fadeUp 0.4s 0.1s ease both" }}>
              {[
                { label: "Total Audios", value: audios.length, color: "var(--blue)", icon: "🎵" },
                { label: "Languages", value: [...new Set(audios.map(h => h.language))].length, color: "var(--purple)", icon: "🌐" },
                { label: "Documents", value: [...new Set(audios.map(h => h.filename))].length, color: "var(--green)", icon: "📄" },
              ].map((s, i) => (
                <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: s.color, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Audio Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {audios.map((item, i) => (
                <div key={item.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 22px", animation: `fadeUp 0.3s ${i * 0.05}s ease both`, transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-bright)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎵</div>
                      <div>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{item.filename}</div>
                        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                          <span style={{ background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", color: "var(--blue)", padding: "2px 9px", borderRadius: 100, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700 }}>{langFlag[item.language] || "🌐"} {item.language}</span>
                          <span style={{ fontSize: 11, color: "var(--text-dimmer)" }}>🕐 {item.date}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setConfirmDelete({ id: item.id, type: "audio" })} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)", padding: "5px 10px", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                    >🗑 Delete</button>
                  </div>
                  <audio src={item.audio_url} controls style={{ width: "100%", marginBottom: 8 }} />
                  <a href={item.audio_url} download style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--blue)", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none" }}>⬇ Download Audio</a>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  )
}


// ─── Landing Page ─────────────────────────────────────────
function LandingPage({ onStart }) {
  const features = [
    { icon: "🔒", title: "100% Private", desc: "All processing happens on your machine. No data leaves your computer." },
    { icon: "🎭", title: "Persona Driven", desc: "Student, Researcher, Executive — each gets a different summary." },
    { icon: "🤖", title: "AI Powered", desc: "Qwen 2.5 LLM runs offline for intelligent document analysis." }
  ]
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 48px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--blue), var(--purple))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>DocMind AI</span>
        </div>
        <button onClick={onStart} style={{ background: "var(--blue)", color: "#fff", padding: "10px 24px", borderRadius: 8, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, transition: "all 0.2s" }}
          onMouseEnter={e => e.target.style.background = "#2563EB"}
          onMouseLeave={e => e.target.style.background = "var(--blue)"}
        >Get Started →</button>
      </nav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", borderRadius: 100, padding: "6px 16px", marginBottom: 32, animation: "fadeUp 0.5s ease" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, color: "var(--blue)", fontWeight: 500 }}>Offline AI · Zero Cloud · Full Privacy</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24, background: "linear-gradient(135deg, #F1F5F9 0%, #94A3B8 50%, #3B82F6 100%)", backgroundSize: "200% 200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "fadeUp 0.5s 0.1s ease both, gradientShift 6s ease infinite" }}>
          Transform Any PDF Into<br />Personalized Intelligence
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-dim)", maxWidth: 520, lineHeight: 1.7, marginBottom: 48, animation: "fadeUp 0.5s 0.2s ease both" }}>
          AI-powered summaries tailored to your role. Your documents stay on your machine — private, fast, and intelligent.
        </p>
        <button onClick={onStart} style={{ background: "linear-gradient(135deg, var(--blue), var(--purple))", color: "#fff", padding: "16px 40px", borderRadius: 12, fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.02em", boxShadow: "0 0 40px rgba(59,130,246,0.3)", transition: "all 0.3s", animation: "fadeUp 0.5s 0.3s ease both" }}
          onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 0 60px rgba(59,130,246,0.5)" }}
          onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = "0 0 40px rgba(59,130,246,0.3)" }}
        >Analyze Your Document →</button>
        <div style={{ display: "flex", gap: 20, marginTop: 80, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.5s 0.4s ease both" }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 32px", width: 240, textAlign: "center", transition: "all 0.3s", backdropFilter: "blur(10px)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.background = "var(--card-hover)"; e.currentTarget.style.transform = "translateY(-4px)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.transform = "" }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Upload Page ──────────────────────────────────────────
function UploadPage({ onComplete, showToast, onHistory }) {
  const [files, setFiles] = useState([])
  const [persona, setPersona] = useState("")
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState("Uploading your documents...")
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const inputRef = useRef()

  const personas = [
    { id: "Student", emoji: "🎓", label: "Student", desc: "Simple concepts & key definitions" },
    { id: "Researcher", emoji: "🔬", label: "Researcher", desc: "Methods, results & technical depth" },
    { id: "Executive", emoji: "💼", label: "Executive", desc: "Conclusions & business impact" }
  ]

  const msgs = ["Uploading your documents...", "Extracting text from PDFs...", "Building knowledge index...", "Generating AI summary...", "Analyzing for accuracy...", "Almost ready..."]

  const addFiles = useCallback((newFiles) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.name.toLowerCase().endsWith(".pdf"))
    const nonPdf = newFiles.length - pdfFiles.length
    if (nonPdf > 0) showToast(`${nonPdf} non-PDF file${nonPdf > 1 ? "s" : ""} skipped. Only PDFs are allowed.`, "error")
    if (pdfFiles.length === 0) return
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name))
      const unique = pdfFiles.filter(f => !existingNames.has(f.name))
      const dupes = pdfFiles.length - unique.length
      if (dupes > 0) showToast(`${dupes} duplicate file${dupes > 1 ? "s" : ""} skipped`, "info")
      return [...prev, ...unique]
    })
  }, [showToast])

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleFile = e => {
    addFiles(e.target.files)
    e.target.value = ""
  }

  const totalSize = files.reduce((a, f) => a + f.size, 0)

  const handleAnalyze = async () => {
    if (files.length === 0) return showToast("Please upload at least one PDF", "error")
    if (!persona) return showToast("Please select a persona first", "error")
    setLoading(true)
    setUploadProgress({ current: 0, total: files.length })
    let msgIndex = 0
    setLoadingMsg(msgs[0])
    const interval = setInterval(() => { msgIndex = (msgIndex + 1) % msgs.length; setLoadingMsg(msgs[msgIndex]) }, 3000)
    try {
      // Upload all files
      const formData = new FormData()
      files.forEach(f => formData.append("files", f))

      setLoadingMsg(`Uploading ${files.length} PDF${files.length > 1 ? "s" : ""}...`)
      let upRes
      if (files.length === 1) {
        const singleForm = new FormData()
        singleForm.append("file", files[0])
        upRes = await authFetch(`${API}/upload`, { method: "POST", body: singleForm })
        if (!upRes.ok) { const err = await upRes.json(); throw new Error(err.detail || "Upload failed") }
        const upData = await upRes.json()
        setUploadProgress({ current: 1, total: 1 })

        setLoadingMsg("Generating AI summary — this takes 20-40 seconds...")
        const sumRes = await authFetch(`${API}/summarize?filename=${encodeURIComponent(upData.filename)}&persona=${persona}&model=best`, { method: "POST" })
        if (!sumRes.ok) { const err = await sumRes.json(); throw new Error(err.detail || "Summarization failed") }
        const sumData = await sumRes.json()
        clearInterval(interval)
        onComplete(sumData, upData.filename, persona, [upData.filename])
      } else {
        upRes = await authFetch(`${API}/upload-multiple`, { method: "POST", body: formData })
        if (!upRes.ok) { const err = await upRes.json(); throw new Error(err.detail || "Upload failed") }
        const upData = await upRes.json()
        const uploadedFiles = upData.results.map(r => r.filename)
        setUploadProgress({ current: uploadedFiles.length, total: files.length })

        if (upData.errors?.length > 0) {
          showToast(`${upData.errors.length} file${upData.errors.length > 1 ? "s" : ""} failed to process`, "error")
        }
        if (uploadedFiles.length === 0) throw new Error("No files were successfully processed")

        // ── Combined summary: merge ALL uploaded docs into one summary ──
        setLoadingMsg(`Analyzing ${uploadedFiles.length} documents together — generating combined summary...`)
        const joinedNames = uploadedFiles.map(encodeURIComponent).join(",")
        const sumRes = await authFetch(
          `${API}/summarize-combined?filenames=${joinedNames}&persona=${persona}&model=best`,
          { method: "POST" }
        )
        if (!sumRes.ok) { const err = await sumRes.json(); throw new Error(err.detail || "Combined summarization failed") }
        const sumData = await sumRes.json()
        clearInterval(interval)
        onComplete(sumData, sumData.filename, persona, uploadedFiles)
      }
    } catch (err) {
      clearInterval(interval); setLoading(false)
      showToast(err.message || "Something went wrong. Make sure the backend is running.", "error")
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, position: "relative", zIndex: 1 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, animation: "pulse 2s ease infinite" }}>{loadingMsg}</div>
      {uploadProgress.total > 1 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 240, height: 6, background: "var(--bg3)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, var(--blue), var(--purple))", width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: "width 0.5s ease", borderRadius: 100 }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-display)", fontWeight: 600 }}>{uploadProgress.current} / {uploadProgress.total} files processed</div>
        </div>
      )}
      <div style={{ fontSize: 13, color: "var(--text-dimmer)" }}>Processing with Qwen 2.5 locally on your machine</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[0, 1, 2].map(i => (<div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: `pulse 1.2s ${i * 0.2}s ease infinite` }} />))}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, animation: "fadeUp 0.3s ease" }}>
          <button onClick={onHistory} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            color: "var(--text-dim)", padding: "8px 18px", borderRadius: 8,
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
            transition: "all 0.2s", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >📜 History</button>
        </div>
        <div style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.4s ease" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Upload Your Documents</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 15 }}>Drop one or more PDFs and choose your persona to get personalized AI summaries</p>
        </div>
        <div onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
          style={{ border: `2px dashed ${dragging ? "var(--blue)" : files.length > 0 ? "var(--green)" : "var(--border-bright)"}`, borderRadius: 20, padding: "48px 32px", textAlign: "center", cursor: "pointer", background: dragging ? "var(--blue-dim)" : files.length > 0 ? "rgba(16,185,129,0.05)" : "var(--card)", transition: "all 0.3s", marginBottom: files.length > 0 ? 16 : 32, boxShadow: dragging ? "0 0 40px var(--blue-glow)" : "none", animation: "fadeUp 0.4s 0.1s ease both" }}>
          <input ref={inputRef} type="file" accept=".pdf" multiple onChange={handleFile} style={{ display: "none" }} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>{files.length > 0 ? "✅" : "📄"}</div>
          {files.length > 0 ? (
            <><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{files.length} PDF{files.length > 1 ? "s" : ""} selected</div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>{(totalSize / 1024 / 1024).toFixed(2)} MB total · Click or drop to add more</div></>
          ) : (
            <><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Drop your PDFs here</div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>or click to browse · Supports multiple files</div></>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginBottom: 32, animation: "fadeUp 0.3s ease", display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "12px 16px", transition: "border-color 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-bright)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
                  }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeFile(i) }} style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "var(--red)", padding: "6px 12px", borderRadius: 8,
                  fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s", flexShrink: 0
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                >✕ Remove</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 32, animation: "fadeUp 0.4s 0.2s ease both" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 16 }}>Select Your Persona</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {personas.map(p => (
              <div key={p.id} onClick={() => setPersona(p.id)} style={{ border: `1px solid ${persona === p.id ? "var(--blue)" : "var(--border)"}`, borderRadius: 16, padding: "24px 16px", textAlign: "center", cursor: "pointer", transition: "all 0.25s", background: persona === p.id ? "var(--blue-dim)" : "var(--card)", boxShadow: persona === p.id ? "0 0 24px var(--blue-glow)" : "none" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{p.emoji}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 6, fontSize: 15, color: persona === p.id ? "var(--blue)" : "var(--text)" }}>{p.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleAnalyze} style={{ width: "100%", padding: "18px", marginTop: 20, background: (files.length === 0 || !persona) ? "var(--bg3)" : "linear-gradient(135deg, var(--blue), var(--purple))", color: (files.length === 0 || !persona) ? "var(--text-dimmer)" : "#fff", borderRadius: 12, fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.02em", transition: "all 0.3s", animation: "fadeUp 0.4s 0.3s ease both" }}>
          {files.length > 0 && persona ? `✨ Analyze ${files.length} Document${files.length > 1 ? "s" : ""}` : "Upload PDFs and select persona to continue"}
        </button>
      </div>
    </div>
  )
}

// ─── Results Dashboard ────────────────────────────────────
function ResultsDashboard({ data, filename, persona, onReset, showToast, allFiles, onSwitchDoc, onHistory }) {
  const [activeTab, setActiveTab] = useState("summary")
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(-1)
  const chatEndRef = useRef()
  const audioRef = useRef()
  const activesentenceRef = useRef()

  // ── Audio readiness polling ──────────────────────────────
  const [audioReady, setAudioReady] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const audioPollRef = useRef(null)

  // Start polling when user switches to the audio tab
  useEffect(() => {
    if (activeTab !== "audio") return
    // Already confirmed ready — no need to poll again
    if (audioReady) return

    const poll = async () => {
      try {
        const res = await authFetch(
          `${API}/audio-status?filename=${encodeURIComponent(filename)}&audio_type=summary&language=English`
        )
        const d = await res.json()
        if (d.ready) {
          setAudioReady(true)
          setAudioUrl(d.audio_url)
          clearInterval(audioPollRef.current)
        }
      } catch { /* backend not responding — keep polling */ }
    }

    poll() // immediate first check
    audioPollRef.current = setInterval(poll, 2000)
    return () => clearInterval(audioPollRef.current)
  }, [activeTab, audioReady, filename])

  // Split summary into sentences for highlighting
  const sentences = (data.summary || "").split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  const totalChars = sentences.reduce((a, s) => a + s.length, 0)

  // Build cumulative character offsets for proportional timing
  const sentenceOffsets = []
  let cumulative = 0
  for (const s of sentences) {
    sentenceOffsets.push(cumulative / totalChars)
    cumulative += s.length
  }

  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio || !audio.duration || sentences.length === 0) return
    const progress = audio.currentTime / audio.duration
    let idx = 0
    for (let i = 0; i < sentenceOffsets.length; i++) {
      if (progress >= sentenceOffsets[i]) idx = i
      else break
    }
    setActiveSentenceIdx(idx)
  }

  const handleAudioPause = () => setActiveSentenceIdx(-1)
  const handleAudioEnd = () => setActiveSentenceIdx(-1)

  // Auto-scroll to the active sentence
  useEffect(() => {
    if (activeSentenceIdx >= 0 && activesentenceRef.current) {
      activesentenceRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [activeSentenceIdx])

  const tabs = [
    { id: "summary", label: "📋 Summary" },
    { id: "chat", label: "💬 Chat" },
    { id: "hallucination", label: "🔍 Analysis" },
    { id: "audio", label: "🔊 Audio" }
  ]

  const personaColors = { Student: "var(--blue)", Researcher: "var(--purple)", Executive: "var(--green)" }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [chatHistory])

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const q = chatInput.trim()
    setChatInput("")
    setChatHistory(h => [...h, { role: "user", text: q }])
    setChatLoading(true)
    try {
      const res = await authFetch(`${API}/chat?filename=${encodeURIComponent(filename)}&question=${encodeURIComponent(q)}`, { method: "POST" })
      const d = await res.json()
      // Store sources alongside the answer so the UI can show which doc(s) were used
      setChatHistory(h => [...h, { role: "ai", text: d.answer, sources: d.sources || [] }])
    } catch {
      showToast("Chat failed. Make sure backend is running.", "error")
      setChatHistory(h => [...h, { role: "ai", text: "Sorry, I could not get a response. Please try again.", sources: [] }])
    }
    setChatLoading(false)
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${filename.replace(".pdf", "")}_${persona}_summary.json`; a.click()
    URL.revokeObjectURL(url)
    showToast("JSON downloaded successfully!", "success")
  }

  const scoreColor = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)", gray: "var(--text-dim)" }[data.hallucination?.color || "gray"]

  const [switchLoading, setSwitchLoading] = useState(false)

  const handleSwitchDoc = async (newFilename) => {
    if (newFilename === filename || switchLoading) return
    setSwitchLoading(true)
    try {
      const sumRes = await authFetch(`${API}/summarize?filename=${encodeURIComponent(newFilename)}&persona=${persona}&model=best`, { method: "POST" })
      if (!sumRes.ok) { const err = await sumRes.json(); throw new Error(err.detail || "Summarization failed") }
      const sumData = await sumRes.json()
      onSwitchDoc(sumData, newFilename)
    } catch (err) {
      showToast(err.message || "Failed to switch document", "error")
    }
    setSwitchLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      {/* Loading overlay when switching documents */}
      {switchLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, animation: "pulse 2s ease infinite" }}>Switching document...</div>
          <div style={{ fontSize: 13, color: "var(--text-dimmer)" }}>Generating summary for the new document</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "rgba(8,11,18,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>{data.combined ? "📚" : "📄"}</span>
          {data.combined ? (
            <>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>Combined Summary</span>
              <span style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "var(--purple)", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700 }}>📚 {data.doc_count} docs merged</span>
            </>
          ) : allFiles && allFiles.length > 1 ? (
            <select value={filename} onChange={e => handleSwitchDoc(e.target.value)} style={{
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14,
              background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", maxWidth: 220,
              appearance: "auto"
            }}>
              {allFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</span>
          )}
          {!data.combined && allFiles && allFiles.length > 1 && (
            <span style={{ background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", color: "var(--blue)", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700 }}>{allFiles.length} docs</span>
          )}
        </div>
        <div style={{ background: `${personaColors[persona]}22`, border: `1px solid ${personaColors[persona]}55`, color: personaColors[persona], padding: "6px 16px", borderRadius: 100, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
          {persona === "Student" ? "🎓" : persona === "Researcher" ? "🔬" : "💼"} {persona}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onHistory} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, transition: "all 0.2s", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >📜 History</button>
          <button onClick={onReset} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, transition: "all 0.2s", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >+ New Document</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "16px 32px", borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 20px", borderRadius: 8, background: activeTab === t.id ? "var(--blue-dim)" : "transparent", color: activeTab === t.id ? "var(--blue)" : "var(--text-dim)", border: `1px solid ${activeTab === t.id ? "var(--blue-glow)" : "transparent"}`, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>

        {activeTab === "summary" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {/* Combined-summary banner */}
            {data.combined && (
              <div style={{
                background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: 14, padding: "16px 22px", marginBottom: 20,
                display: "flex", alignItems: "flex-start", gap: 14, animation: "fadeUp 0.4s ease"
              }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>📚</span>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--purple)", marginBottom: 6 }}>Combined Document Summary</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    This summary was generated by analyzing <strong style={{ color: "var(--text)" }}>{data.doc_count} documents together</strong>:
                    &nbsp;{(data.filenames || []).join(" · ")}
                  </div>
                </div>
              </div>
            )}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>AI Summary</div>
              <p style={{ lineHeight: 1.8, fontSize: 15, color: "var(--text)", whiteSpace: "pre-wrap" }}>{data.summary}</p>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Confidence Score</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: scoreColor }}>{data.hallucination?.percentage ?? 0}%</div>
              </div>
              <div style={{ height: 8, background: "var(--bg3)", borderRadius: 100, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", borderRadius: 100, background: scoreColor, width: `${data.hallucination?.percentage ?? 0}%`, transition: "width 1.5s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 12px ${scoreColor}` }} />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{data.hallucination?.label}</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={downloadJSON} style={{ flex: 1, padding: "14px", background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, transition: "all 0.2s" }}>⬇ Download JSON</button>
              <button onClick={() => setActiveTab("chat")} style={{ flex: 1, padding: "14px", background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", color: "var(--blue)", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, transition: "all 0.2s" }}>💬 Ask Questions</button>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div style={{ animation: "fadeIn 0.3s ease", height: "calc(100vh - 260px)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                {data.combined ? "Chat with all documents" : "Chat with your document"}
              </div>
              {data.combined && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(data.filenames || []).map(f => (
                    <span key={f} style={{
                      background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)",
                      color: "var(--purple)", padding: "2px 10px", borderRadius: 100,
                      fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600
                    }}>📄 {f}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 16, paddingRight: 4 }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-dimmer)", marginTop: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                  <div style={{ fontSize: 15 }}>
                    {data.combined
                      ? `Ask anything — answers will draw from all ${data.doc_count} documents`
                      : "Ask anything about your document"}
                  </div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "slideIn 0.3s ease" }}>
                  {m.role === "ai" && (<div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--purple-dim)", border: "1px solid var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10, flexShrink: 0, marginTop: 4 }}>🤖</div>)}
                  <div style={{ maxWidth: "70%" }}>
                    <div style={{ padding: "12px 16px", borderRadius: 14, background: m.role === "user" ? "var(--blue)" : "var(--card)", border: m.role === "user" ? "none" : "1px solid var(--border)", fontSize: 14, lineHeight: 1.7, borderTopRightRadius: m.role === "user" ? 4 : 14, borderTopLeftRadius: m.role === "ai" ? 4 : 14 }}>{m.text}</div>
                    {/* Source pills — only on AI messages with multiple sources */}
                    {m.role === "ai" && m.sources && m.sources.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, paddingLeft: 2 }}>
                        <span style={{ fontSize: 10, color: "var(--text-dimmer)", fontFamily: "var(--font-display)", fontWeight: 600, alignSelf: "center" }}>Sources:</span>
                        {m.sources.map(src => (
                          <span key={src} style={{
                            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                            color: "var(--blue)", padding: "1px 8px", borderRadius: 100,
                            fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 600
                          }}>📄 {src}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--purple-dim)", border: "1px solid var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "12px 20px", borderRadius: 14, borderTopLeftRadius: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (<div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: `pulse 1.2s ${i * 0.2}s ease infinite` }} />))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px 8px 8px 16px" }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder={data.combined ? `Ask across all ${data.doc_count} documents...` : "Ask anything about your document..."}
                style={{ flex: 1, background: "none", border: "none", color: "var(--text)", fontSize: 14 }} />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} style={{ background: chatInput.trim() ? "var(--blue)" : "var(--bg3)", color: chatInput.trim() ? "#fff" : "var(--text-dimmer)", padding: "10px 20px", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>Send →</button>
            </div>
          </div>
        )}

        {activeTab === "hallucination" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Sentence-Level Analysis</div>
            <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 24 }}>Each sentence in the summary is checked against the original document.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Total Checked", value: data.hallucination?.total_count ?? 0, color: "var(--text)" },
                { label: "Grounded", value: data.hallucination?.grounded_count ?? 0, color: "var(--green)" },
                { label: "Needs Review", value: (data.hallucination?.total_count ?? 0) - (data.hallucination?.grounded_count ?? 0), color: "var(--yellow)" }
              ].map((s, i) => (
                <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: s.color, marginBottom: 6 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(data.hallucination?.details || []).map((d, i) => (
                <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: `4px solid ${d.grounded ? "var(--green)" : "var(--red)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, animation: `fadeUp 0.3s ${i * 0.05}s ease both` }}>
                  <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6 }}>{d.sentence}.</div>
                  <div style={{ background: d.grounded ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: d.grounded ? "var(--green)" : "var(--red)", border: `1px solid ${d.grounded ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "var(--font-display)" }}>
                    {d.grounded ? "✓ Grounded" : "⚠ Review"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "audio" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {/* Split layout: Audio player (left) + Summary text (right) */}
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>

              {/* Left: Audio Section */}
              <div style={{ flex: "1 1 380px", minWidth: 320 }}>
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 36px", textAlign: "center" }}>
                  <div style={{ fontSize: 44, marginBottom: 20 }}>🔊</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Audio Summary</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.6 }}>Listen to your {persona} summary</div>
                  {audioReady && audioUrl ? (
                    <div style={{ animation: "fadeIn 0.4s ease" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>AI Generated Audio</div>
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        style={{ width: "100%", marginBottom: 16 }}
                        controls
                        onTimeUpdate={handleAudioTimeUpdate}
                        onPause={handleAudioPause}
                        onEnded={handleAudioEnd}
                      />
                      <a href={audioUrl} download style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        width: "100%", background: "var(--blue-dim)", border: "1px solid var(--blue-glow)",
                        color: "var(--blue)", padding: "12px", borderRadius: 10, fontSize: 14,
                        fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none",
                        transition: "all 0.2s"
                      }}>⬇ Download Summary Audio</a>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-dim)", fontSize: 14, background: "var(--bg3)", borderRadius: 12, padding: "28px 20px", lineHeight: 1.6 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 6, color: "var(--text)" }}>Generating Audio...</div>
                      <div style={{ fontSize: 13, color: "var(--text-dimmer)" }}>Your summary is being converted to speech. This usually takes 5–15 seconds.</div>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 18 }}>
                        {[0, 1, 2].map(i => (<div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: `pulse 1.2s ${i * 0.2}s ease infinite` }} />))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Summary Text with sentence highlighting */}
              {data.summary && (
                <div style={{ flex: "1 1 380px", minWidth: 320 }}>
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 32px", height: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: "var(--purple-dim)", border: "1px solid var(--purple)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
                        }}>📝</div>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>Summary Text</div>
                      </div>
                      {activeSentenceIdx >= 0 && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "var(--blue-dim)", border: "1px solid var(--blue-glow)",
                          padding: "3px 12px", borderRadius: 100
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: "pulse 1.5s ease infinite", display: "inline-block" }} />
                          <span style={{ fontSize: 11, color: "var(--blue)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Playing</span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      background: "var(--bg3)", border: "1px solid var(--border)",
                      borderRadius: 12, padding: "18px 20px",
                      maxHeight: 380, overflowY: "auto",
                      fontSize: 14, lineHeight: 1.85,
                      scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent"
                    }}>
                      {sentences.map((sentence, i) => {
                        const isActive = i === activeSentenceIdx
                        return (
                          <span
                            key={i}
                            ref={isActive ? activesentenceRef : null}
                            style={{
                              color: isActive ? "var(--text)" : activeSentenceIdx >= 0 ? "var(--text-dimmer)" : "var(--text-dim)",
                              background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                              borderRadius: isActive ? 6 : 0,
                              padding: isActive ? "2px 4px" : "0",
                              boxShadow: isActive ? "0 0 12px rgba(59,130,246,0.2)" : "none",
                              transition: "all 0.3s ease",
                              borderLeft: isActive ? "2px solid var(--blue)" : "2px solid transparent",
                              marginLeft: isActive ? -2 : 0,
                            }}
                          >{sentence}{" "}</span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Listen to Document section — full width below */}
            <div style={{ marginTop: 24 }}>
              <ListenButton filename={filename} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Auth Page ────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const url = isLogin ? `${API}/auth/login` : `${API}/auth/register`
    const body = isLogin ? { email, password } : { name, email, password }
    try {
      const res = await authFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Authentication failed")
      
      if (!isLogin) {
        setIsLogin(true)
        alert("Registration successful. Please log in.")
      } else {
        onLogin(data.access_token, data.user)
      }
    } catch (err) {
      alert(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: 20 }}>
      <div style={{ background: "rgba(8,11,18,0.8)", padding: 40, borderRadius: 24, border: "1px solid var(--border)", width: 400, maxWidth: "100%", animation: "fadeUp 0.4s ease", backdropFilter: "blur(20px)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, marginBottom: 8, textAlign: "center" }}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
        <p style={{ textAlign: "center", color: "var(--text-dim)", marginBottom: 32 }}>{isLogin ? "Sign in to access your document workspace" : "Get started with your private workspace"}</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && (
            <input required placeholder="Full Name" value={name} onChange={e => setName(e.target.value)}
              style={{ padding: "14px", borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)" }} />
          )}
          <input required type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)}
            style={{ padding: "14px", borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ padding: "14px", borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)" }} />
          
          <button disabled={loading} style={{
            marginTop: 8, padding: "14px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, var(--blue), var(--purple))", color: "#fff",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, cursor: "pointer"
          }}>
            {loading ? "Processing..." : (isLogin ? "Log In" : "Register")}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14 }}>
          <span style={{ color: "var(--text-dim)" }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </span>
          <button onClick={() => setIsLogin(!isLogin)} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, marginLeft: 8, cursor: "pointer" }}>
            {isLogin ? "Register" : "Log In"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("landing")
  const [resultData, setResultData] = useState(null)
  const [filename, setFilename] = useState("")
  const [persona, setPersona] = useState("")
  const [allFiles, setAllFiles] = useState([])
  const [toast, setToast] = useState(null)

  // Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("docmind_user")
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    if (authToken && !user) {
      authFetch(`${API}/auth/me`)
        .then(res => {
          if (res.ok) { return res.json(); }
          throw new Error("Invalid token");
        })
        .then(data => {
            setUser({ name: data.name, email: data.email })
            localStorage.setItem("docmind_user", JSON.stringify({ name: data.name, email: data.email }))
        }).catch(() => {
            setAuthToken("")
            setUser(null)
            localStorage.removeItem("docmind_user")
        });
    }
  }, []);

  const handleLogin = (token, userData) => {
    setAuthToken(token)
    setUser(userData)
    localStorage.setItem("docmind_user", JSON.stringify(userData))
  }

  const handleLogout = () => {
    setAuthToken("")
    setUser(null)
    localStorage.removeItem("docmind_user")
    setPage("landing")
  }

  const showToast = (message, type = "info") => setToast({ message, type, id: Date.now() })

  const handleComplete = (data, fn, p, uploadedFiles) => {
    setResultData(data); setFilename(fn); setPersona(p); setAllFiles(uploadedFiles || [fn]); setPage("results")
  }

  const handleSwitchDoc = (data, newFilename) => {
    setResultData(data); setFilename(newFilename)
  }

  const handleReset = () => {
    setResultData(null); setFilename(""); setPersona(""); setAllFiles([]); setPage("upload")
  }

  if (!authToken) {
    return (
      <>
        <Background />
        <AuthPage onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      <Background />
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Persistent Auth Header */}
      <div style={{ position: "fixed", top: 20, right: 24, zIndex: 1000, display: "flex", alignItems: "center", gap: 16 }}>
        {user && <span style={{ color: "var(--text)", fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, background: "rgba(8,11,18,0.5)", padding: "6px 12px", borderRadius: 8, backdropFilter: "blur(10px)" }}>👤 {user.name}</span>}
        <button onClick={handleLogout} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "var(--red)", padding: "6px 16px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.25)" }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)" }}>Logout</button>
      </div>

      {page === "landing" && <LandingPage onStart={() => setPage("upload")} />}
      {page === "upload" && <UploadPage onComplete={handleComplete} showToast={showToast} onHistory={() => setPage("history")} />}
      {page === "results" && resultData && <ResultsDashboard data={resultData} filename={filename} persona={persona} onReset={handleReset} showToast={showToast} allFiles={allFiles} onSwitchDoc={handleSwitchDoc} onHistory={() => setPage("history")} />}
      {page === "history" && <SummaryHistoryPage showToast={showToast} onBack={() => setPage(resultData ? "results" : "upload")} />}
    </>
  )
}
