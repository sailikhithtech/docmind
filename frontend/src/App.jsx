import { useState, useRef, useEffect, useCallback } from "react"

const API = "http://localhost:8000"

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
      const res = await fetch(`${API}/listen?filename=${encodeURIComponent(filename)}&language=${language}`, { method: "POST" })
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
        {loading ? "⏳ Generating audio..." : `▶ Listen in ${language}`}
      </button>
      {audioUrl && (
        <div style={{ marginTop: 14 }}>
          <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%", marginBottom: 8 }} />
          <a href={audioUrl} download style={{ display: "block", textAlign: "center", color: "var(--blue)", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none" }}>⬇ Download {language} Audio</a>
        </div>
      )}
    </div>
  )
}

// ─── History Page ─────────────────────────────────────────
function HistoryPage({ showToast }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/audio-history`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch {
      showToast("Could not load history. Make sure backend is running.", "error")
    }
    setLoading(false)
  }

  useEffect(() => { fetchHistory() }, [])

  const deleteRecord = async (id) => {
    try {
      await fetch(`${API}/audio-history/${id}`, { method: "DELETE" })
      setHistory(h => h.filter(item => item.id !== id))
      showToast("Audio record deleted", "success")
    } catch {
      showToast("Could not delete record", "error")
    }
  }

  const langFlag = { English: "🇬🇧", Hindi: "🇮🇳", Telugu: "🏳️" }

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "40px 32px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Audio History</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>All your generated audio files saved here</p>
        </div>
        <button onClick={fetchHistory} style={{
          background: "var(--card)", border: "1px solid var(--border)",
          color: "var(--text-dim)", padding: "10px 20px", borderRadius: 8,
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s"
        }}
          onMouseEnter={e => { e.target.style.borderColor = "var(--border-bright)"; e.target.style.color = "var(--text)" }}
          onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-dim)" }}
        >↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "var(--text-dim)" }}>Loading history...</div>
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎵</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No Audio History Yet</div>
          <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Generate audio from the Audio tab and it will appear here</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 8 }}>
            {[
              { label: "Total Audios", value: history.length, color: "var(--blue)" },
              { label: "Languages Used", value: [...new Set(history.map(h => h.language))].length, color: "var(--purple)" },
              { label: "Documents", value: [...new Set(history.map(h => h.filename))].length, color: "var(--green)" }
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Audio Cards */}
          {history.map((item, i) => (
            <div key={item.id} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "20px 24px",
              animation: `fadeUp 0.3s ${i * 0.05}s ease both`,
              transition: "all 0.2s"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.background = "var(--card-hover)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)" }}
            >
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: "var(--blue-dim)", border: "1px solid var(--blue-glow)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
                  }}>🎵</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {item.filename}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        background: "var(--blue-dim)", border: "1px solid var(--blue-glow)",
                        color: "var(--blue)", padding: "2px 10px", borderRadius: 100,
                        fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700
                      }}>{langFlag[item.language]} {item.language}</span>
                      <span style={{ fontSize: 12, color: "var(--text-dimmer)" }}>🕐 {item.date}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteRecord(item.id)} style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "var(--red)", padding: "6px 12px", borderRadius: 8,
                  fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600,
                  transition: "all 0.2s", cursor: "pointer"
                }}
                  onMouseEnter={e => { e.target.style.background = "rgba(239,68,68,0.2)" }}
                  onMouseLeave={e => { e.target.style.background = "rgba(239,68,68,0.1)" }}
                >🗑 Delete</button>
              </div>

              {/* Audio Player */}
              <audio src={item.audio_url} controls style={{ width: "100%", marginBottom: 10 }} />

              {/* Download */}
              <a href={item.audio_url} download style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: "var(--blue)", fontSize: 13,
                fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none"
              }}>⬇ Download Audio</a>
            </div>
          ))}
        </div>
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
function UploadPage({ onComplete, showToast }) {
  const [file, setFile] = useState(null)
  const [persona, setPersona] = useState("")
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState("Uploading your document...")
  const inputRef = useRef()

  const personas = [
    { id: "Student", emoji: "🎓", label: "Student", desc: "Simple concepts & key definitions" },
    { id: "Researcher", emoji: "🔬", label: "Researcher", desc: "Methods, results & technical depth" },
    { id: "Executive", emoji: "💼", label: "Executive", desc: "Conclusions & business impact" }
  ]

  const msgs = ["Uploading your document...", "Extracting text from PDF...", "Building knowledge index...", "Generating AI summary...", "Analyzing for accuracy...", "Almost ready..."]

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".pdf")) setFile(f)
    else showToast("Please upload a PDF file only", "error")
  }, [showToast])

  const handleFile = e => {
    const f = e.target.files[0]
    if (f?.name.endsWith(".pdf")) setFile(f)
    else showToast("Please upload a PDF file only", "error")
  }

  const handleAnalyze = async () => {
    if (!file) return showToast("Please upload a PDF first", "error")
    if (!persona) return showToast("Please select a persona first", "error")
    setLoading(true)
    let msgIndex = 0
    setLoadingMsg(msgs[0])
    const interval = setInterval(() => { msgIndex = (msgIndex + 1) % msgs.length; setLoadingMsg(msgs[msgIndex]) }, 3000)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const upRes = await fetch(`${API}/upload`, { method: "POST", body: formData })
      if (!upRes.ok) { const err = await upRes.json(); throw new Error(err.detail || "Upload failed") }
      const upData = await upRes.json()
      setLoadingMsg("Generating AI summary — this takes 20-40 seconds...")
      const sumRes = await fetch(`${API}/summarize?filename=${encodeURIComponent(upData.filename)}&persona=${persona}&model=best`, { method: "POST" })
      if (!sumRes.ok) { const err = await sumRes.json(); throw new Error(err.detail || "Summarization failed") }
      const sumData = await sumRes.json()
      clearInterval(interval)
      onComplete(sumData, upData.filename, persona)
    } catch (err) {
      clearInterval(interval); setLoading(false)
      showToast(err.message || "Something went wrong. Make sure the backend is running.", "error")
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, position: "relative", zIndex: 1 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--border)", borderTop: "2px solid var(--blue)", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, animation: "pulse 2s ease infinite" }}>{loadingMsg}</div>
      <div style={{ fontSize: 13, color: "var(--text-dimmer)" }}>Processing with Qwen 2.5 locally on your machine</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[0, 1, 2].map(i => (<div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", animation: `pulse 1.2s ${i * 0.2}s ease infinite` }} />))}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.4s ease" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Upload Your Document</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 15 }}>Drop a PDF and choose your persona to get a personalized AI summary</p>
        </div>
        <div onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
          style={{ border: `2px dashed ${dragging ? "var(--blue)" : file ? "var(--green)" : "var(--border-bright)"}`, borderRadius: 20, padding: "48px 32px", textAlign: "center", cursor: "pointer", background: dragging ? "var(--blue-dim)" : file ? "rgba(16,185,129,0.05)" : "var(--card)", transition: "all 0.3s", marginBottom: 32, boxShadow: dragging ? "0 0 40px var(--blue-glow)" : "none", animation: "fadeUp 0.4s 0.1s ease both" }}>
          <input ref={inputRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: "none" }} />
          <div style={{ fontSize: 48, marginBottom: 16 }}>{file ? "✅" : "📄"}</div>
          {file ? (
            <><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{file.name}</div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</div></>
          ) : (
            <><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Drop your PDF here</div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>or click to browse your files</div></>
          )}
        </div>
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
        {file && <ListenButton filename={file?.name} />}
        <button onClick={handleAnalyze} style={{ width: "100%", padding: "18px", marginTop: 20, background: (!file || !persona) ? "var(--bg3)" : "linear-gradient(135deg, var(--blue), var(--purple))", color: (!file || !persona) ? "var(--text-dimmer)" : "#fff", borderRadius: 12, fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.02em", transition: "all 0.3s", animation: "fadeUp 0.4s 0.3s ease both" }}>
          {file && persona ? "✨ Analyze Document" : "Upload PDF and select persona to continue"}
        </button>
      </div>
    </div>
  )
}

// ─── Results Dashboard ────────────────────────────────────
function ResultsDashboard({ data, filename, persona, onReset, showToast }) {
  const [activeTab, setActiveTab] = useState("summary")
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef()
  const audioRef = useRef()

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
      const res = await fetch(`${API}/chat?filename=${encodeURIComponent(filename)}&question=${encodeURIComponent(q)}`, { method: "POST" })
      const d = await res.json()
      setChatHistory(h => [...h, { role: "ai", text: d.answer }])
    } catch {
      showToast("Chat failed. Make sure backend is running.", "error")
      setChatHistory(h => [...h, { role: "ai", text: "Sorry, I could not get a response. Please try again." }])
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

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "rgba(8,11,18,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>📄</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</span>
        </div>
        <div style={{ background: `${personaColors[persona]}22`, border: `1px solid ${personaColors[persona]}55`, color: personaColors[persona], padding: "6px 16px", borderRadius: 100, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
          {persona === "Student" ? "🎓" : persona === "Researcher" ? "🔬" : "💼"} {persona}
        </div>
        <button onClick={onReset} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, transition: "all 0.2s" }}>+ New Document</button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "16px 32px", borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 20px", borderRadius: 8, background: activeTab === t.id ? "var(--blue-dim)" : "transparent", color: activeTab === t.id ? "var(--blue)" : "var(--text-dim)", border: `1px solid ${activeTab === t.id ? "var(--blue-glow)" : "transparent"}`, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "32px", maxWidth: 900, margin: "0 auto" }}>

        {activeTab === "summary" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
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
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Chat with your document</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 16, paddingRight: 4 }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-dimmer)", marginTop: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                  <div style={{ fontSize: 15 }}>Ask anything about your document</div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "slideIn 0.3s ease" }}>
                  {m.role === "ai" && (<div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--purple-dim)", border: "1px solid var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10, flexShrink: 0, marginTop: 4 }}>🤖</div>)}
                  <div style={{ maxWidth: "70%", padding: "12px 16px", borderRadius: 14, background: m.role === "user" ? "var(--blue)" : "var(--card)", border: m.role === "user" ? "none" : "1px solid var(--border)", fontSize: 14, lineHeight: 1.7, borderTopRightRadius: m.role === "user" ? 4 : 14, borderTopLeftRadius: m.role === "ai" ? 4 : 14 }}>{m.text}</div>
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
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} placeholder="Ask anything about your document..." style={{ flex: 1, background: "none", border: "none", color: "var(--text)", fontSize: 14 }} />
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
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "40px 56px", textAlign: "center", maxWidth: 480, width: "100%" }}>
              <div style={{ fontSize: 48, marginBottom: 24 }}>🔊</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Audio Summary</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24, lineHeight: 1.6 }}>Listen to your {persona} summary.</div>
              {data.audio_url ? (
                <>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>AI Generated Summary Audio</div>
                  <audio ref={audioRef} src={data.audio_url} style={{ width: "100%", marginBottom: 16 }} controls />
                  <a href={data.audio_url} download style={{ display: "block", width: "100%", background: "var(--blue-dim)", border: "1px solid var(--blue-glow)", color: "var(--blue)", padding: "12px", borderRadius: 10, fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, textDecoration: "none", textAlign: "center" }}>⬇ Download Summary Audio</a>
                </>
              ) : (
                <div style={{ color: "var(--text-dimmer)", fontSize: 14, background: "var(--bg3)", borderRadius: 10, padding: 20 }}>Summary audio could not be generated.</div>
              )}
            </div>
            <div style={{ maxWidth: 480, width: "100%" }}>
              <ListenButton filename={filename} />
            </div>
          </div>
        )}
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
  const [toast, setToast] = useState(null)

  const showToast = (message, type = "info") => setToast({ message, type, id: Date.now() })

  const handleComplete = (data, fn, p) => {
    setResultData(data); setFilename(fn); setPersona(p); setPage("results")
  }

  const handleReset = () => {
    setResultData(null); setFilename(""); setPersona(""); setPage("upload")
  }

  return (
    <>
      <Background />
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Navigation Bar for History */}
      {page !== "landing" && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          display: "flex", gap: 8
        }}>
          <button onClick={() => setPage("history")} style={{
            background: page === "history" ? "var(--blue)" : "var(--card)",
            border: `1px solid ${page === "history" ? "var(--blue)" : "var(--border)"}`,
            color: page === "history" ? "#fff" : "var(--text-dim)",
            padding: "10px 20px", borderRadius: 100,
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            transition: "all 0.2s", cursor: "pointer"
          }}>🎵 Audio History</button>
          {page === "history" && (
            <button onClick={() => setPage(resultData ? "results" : "upload")} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              color: "var(--text-dim)", padding: "10px 20px", borderRadius: 100,
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              transition: "all 0.2s", cursor: "pointer"
            }}>← Back</button>
          )}
        </div>
      )}

      {page === "landing" && <LandingPage onStart={() => setPage("upload")} />}
      {page === "upload" && <UploadPage onComplete={handleComplete} showToast={showToast} />}
      {page === "results" && resultData && <ResultsDashboard data={resultData} filename={filename} persona={persona} onReset={handleReset} showToast={showToast} />}
      {page === "history" && <HistoryPage showToast={showToast} />}
    </>
  )
}
