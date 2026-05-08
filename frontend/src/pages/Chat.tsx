import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui";
import { Send, Bot, User, Wrench, ShoppingBag, IndianRupee, Navigation, Loader2, MapPin, Mic, MicOff, TrendingUp, Activity, ImagePlus, X } from "lucide-react";
import { getSessionId } from "../lib/utils";
import api from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  products?: any[];
  estimate?: any;
  amcPlans?: any[];
  quickReplies?: string[];
  bookingCreated?: any;
  action?: string;
  healthScore?: { score: number; status: string; details: string[] };
  tdsReadings?: { date: string; value: number }[];
  imageUrl?: string;
}

// ── Voice recognition hook ────────────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); setListening(false); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  }, []);

  const toggle = useCallback(() => {
    if (!recRef.current) return;
    if (listening) { recRef.current.stop(); setListening(false); }
    else { recRef.current.start(); setListening(true); }
  }, [listening]);

  return { listening, supported, toggle };
}

// ── TDS Trend Chart ───────────────────────────────────────────────────────────
function TdsChart({ readings }: { readings: { date: string; value: number }[] }) {
  if (!readings || readings.length < 2) return null;
  const values = readings.map(r => r.value);
  const max = Math.max(...values, 200);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 280; const H = 90; const P = 12;

  const pts = readings.map((r, i) => {
    const x = P + (i / (readings.length - 1)) * (W - P * 2);
    const y = P + ((max - r.value) / range) * (H - P * 2);
    return { x, y, v: r.value, d: r.date };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 w-full">
      <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-primary" /> TDS Trend
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
        {/* Safe zone band 50–150 */}
        <rect x={P} y={P + ((max - 150) / range) * (H - P * 2)} width={W - P * 2}
          height={Math.max(0, ((150 - Math.max(50, min)) / range) * (H - P * 2))}
          fill="#10b981" fillOpacity="0.08" rx="2" />
        {/* Grid line at 150 */}
        <line x1={P} y1={P + ((max - 150) / range) * (H - P * 2)} x2={W - P} y2={P + ((max - 150) / range) * (H - P * 2)} stroke="#f97316" strokeWidth="0.5" strokeDasharray="3,3" />
        <text x={W - P + 1} y={P + ((max - 150) / range) * (H - P * 2) + 3} fontSize="7" fill="#f97316">150</text>
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {pts.map((p, i) => {
          const color = p.v > 300 ? "#ef4444" : p.v > 150 ? "#f97316" : "#10b981";
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="white" strokeWidth="1.5" />
              <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="8" fill="#475569" fontWeight="600">{p.v}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
        <span>{new Date(readings[0].date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
        <span className="text-emerald-600 font-medium">■ Safe zone 50–150 ppm</span>
        <span>{new Date(readings[readings.length - 1].date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

// ── Health Score Gauge ────────────────────────────────────────────────────────
function HealthGauge({ data }: { data: { score: number; status: string; details: string[] } }) {
  const color = data.score >= 80 ? "#10b981" : data.score >= 60 ? "#f97316" : data.score >= 40 ? "#ef4444" : "#dc2626";
  const pct = data.score / 100;
  const r = 48; const cx = 65; const cy = 65;
  const circumference = Math.PI * r; // half circle
  const toX = (deg: number) => cx + r * Math.cos((deg - 180) * Math.PI / 180);
  const toY = (deg: number) => cy + r * Math.sin((deg - 180) * Math.PI / 180);
  const endDeg = pct * 180;
  const ex = toX(endDeg); const ey = toY(endDeg);
  const largeArc = endDeg > 90 ? 1 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 w-full">
      <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-primary" /> RO Health Assessment
      </p>
      <div className="flex items-start gap-4">
        <svg width="130" height="80" viewBox="0 0 130 80" className="flex-shrink-0">
          {/* Background arc */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
          {/* Score arc */}
          {data.score > 0 && (
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>{data.score}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm mb-2" style={{ color }}>{data.status}</p>
          <div className="space-y-1">
            {data.details.slice(0, 4).map((d, i) => (
              <p key={i} className="text-xs text-slate-600 leading-tight">{d}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Chat component ───────────────────────────────────────────────────────
export default function Chat() {
  const { user } = useAuth();
  const sessionId = getSessionId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    api.get("/chat/history?sessionId=" + sessionId)
      .then(res => { if (res.data.length > 0) setMessages(res.data); })
      .catch(() => {});
    // Check AI status
    api.get("/chat/status").then(res => setAiMode(res.data.aiMode)).catch(() => {});
  }, []);

  const send = async (text: string, extras?: { userLat?: number; userLng?: number; detectedAddress?: string; detectedCity?: string }) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", content: extras?.userLat ? `📍 ${text}` : text, timestamp: new Date().toISOString(), imageUrl: imagePreview || undefined }]);
    setInput("");
    setLoading(true);
    const currentImageBase64 = imageBase64;
    const currentImageMimeType = imageMimeType;
    setImagePreview(null); setImageBase64(null); setImageMimeType(null);
    try {
      const res = await api.post("/chat", { message: text, sessionId, userId: user?.id, ...extras, ...(currentImageBase64 ? { imageBase64: currentImageBase64, imageMimeType: currentImageMimeType } : {}) });
      if (res.data.aiMode) setAiMode(res.data.aiMode);
      setMessages(prev => [...prev, {
        role: "assistant", content: res.data.message, timestamp: new Date().toISOString(),
        products: res.data.products, estimate: res.data.estimate, amcPlans: res.data.amcPlans,
        quickReplies: res.data.quickReplies, bookingCreated: res.data.bookingCreated,
        action: res.data.action, healthScore: res.data.healthScore, tdsReadings: res.data.tdsReadings,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Something went wrong. Please try again.", timestamp: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  // ── Voice ─────────────────────────────────────────────────────────────────
  const { listening, supported: voiceSupported, toggle: toggleVoice } = useVoice((text) => {
    setInput(text);
    setTimeout(() => send(text), 400);
  });

  // ── GPS ───────────────────────────────────────────────────────────────────
  const shareGps = async () => {
    if (!navigator.geolocation) { alert("Geolocation not supported by your browser"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers: { "Accept-Language": "en" } });
          const d = await r.json();
          const a = d.address || {};
          const city = a.city || a.town || a.village || a.county || "your area";
          const street = [a.house_number, a.road || a.suburb || a.neighbourhood].filter(Boolean).join(", ");
          const full = street || d.display_name?.split(",").slice(0, 3).join(",") || `${lat.toFixed(4)},${lng.toFixed(4)}`;
          setGpsLoading(false);
          await send(`My location: ${city}, ${full}`, { userLat: lat, userLng: lng, detectedAddress: full, detectedCity: city });
        } catch {
          setGpsLoading(false);
          await send("My GPS location", { userLat: lat, userLng: lng });
        }
      },
      (err) => {
        setGpsLoading(false);
        const msgs: Record<number, string> = { 1: "Location access denied. Allow location in browser settings.", 2: "Could not detect location.", 3: "Location request timed out." };
        alert(msgs[err.code] || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Image picker ─────────────────────────────────────────────────────────
  const pickImage = () => fileInputRef.current?.click();

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 4 * 1024 * 1024) { alert("Image must be under 4 MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleQuickReply = (q: string) => q === "📍 Share my GPS location" ? shareGps() : send(q);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">AquaBot</h1>
            <p className="text-xs text-emerald-500 font-medium">● Online — AI RO Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {aiMode && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${aiMode.includes("gemini") ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
              {aiMode.includes("gemini") ? "✨ Gemini 1.5 Flash + RAG" : "⚠️ Rule-based mode"}
            </span>
          )}
          <div className="hidden sm:flex gap-1.5">
            {["🏥 Health", "📊 TDS", "🇮🇳 Hindi", "🎤 Voice"].map(tag => (
              <span key={tag} className="px-2 py-1 bg-slate-100 rounded-lg text-xs text-slate-500">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Hi! I'm AquaBot</h3>
            <p className="text-slate-500 text-sm mb-5">AI-powered RO diagnosis, booking & tracking</p>
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto mb-4">
              {[["🔍 Diagnose Problem", "My RO has no water"], ["🏥 Health Score", "Check RO health score"], ["📊 Track TDS", "Log my TDS"], ["💰 See Pricing", "Show pricing"]].map(([label, msg]) => (
                <button key={label} onClick={() => send(msg)} className="px-3 py-2.5 bg-white border border-slate-200 hover:border-primary hover:bg-primary/5 rounded-xl text-xs font-medium text-slate-700 transition-all text-left">{label}</button>
              ))}
            </div>
            <p className="text-xs text-slate-400">🎤 Voice · 📍 GPS · 🇮🇳 Hindi · ⭐ Ratings · ❌ Cancel bookings</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-3 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"}`}>
                {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded RO" className="rounded-lg mb-2 max-h-48 object-cover w-full" />}
                {msg.content}
              </div>

              {/* Health Score Gauge */}
              {msg.healthScore && <HealthGauge data={msg.healthScore} />}

              {/* TDS Chart */}
              {msg.tdsReadings && msg.tdsReadings.length >= 2 && <TdsChart readings={msg.tdsReadings} />}

              {/* Price estimate */}
              {msg.estimate && (
                <Card className="p-4 w-full border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3"><IndianRupee className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Price Estimate</span></div>
                  {msg.estimate.parts?.map((p: any) => (
                    <div key={p.name} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-600">{p.name}</span>
                      <span className="font-medium">₹{p.minPrice}{p.minPrice !== p.maxPrice ? `–₹${p.maxPrice}` : ""}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs py-1 border-b border-slate-100"><span className="text-slate-600">Service Charge</span><span className="font-medium">₹{msg.estimate.serviceCharge}</span></div>
                  <div className="flex justify-between text-sm font-bold mt-2 text-primary"><span>Total Estimate</span><span>₹{msg.estimate.totalMin}–₹{msg.estimate.totalMax}</span></div>
                </Card>
              )}

              {/* Products */}
              {msg.products && msg.products.length > 0 && (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {msg.products.map((p: any) => (
                    <Card key={p.id} className="p-3">
                      <div className="flex items-center gap-1 mb-1"><ShoppingBag className="w-3 h-3 text-primary" /><span className="text-xs font-bold truncate">{p.name}</span></div>
                      <p className="text-xs text-slate-500 mb-1">{p.brand}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-amber-400 text-xs">★</span>
                        <span className="text-xs text-slate-500">{p.rating?.toFixed(1)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Booking confirmed */}
              {msg.bookingCreated && (
                <Card className="p-4 border-emerald-200 bg-emerald-50 w-full">
                  <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-emerald-600" /><span className="font-semibold text-sm text-emerald-800">Booking #{msg.bookingCreated.id} Confirmed!</span></div>
                  <p className="text-xs text-emerald-700 mt-1">Technician will accept shortly. Track live location on My Bookings page!</p>
                </Card>
              )}

              {/* GPS share button inline */}
              {msg.action === "request_location" && i === messages.length - 1 && (
                <button onClick={shareGps} disabled={gpsLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-all disabled:opacity-60 shadow-sm">
                  {gpsLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Detecting location...</> : <><Navigation className="w-4 h-4" /> Share My GPS Location</>}
                </button>
              )}

              {/* Quick replies */}
              {msg.quickReplies && msg.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.quickReplies.map((q: string) => (
                    q === "📍 Share my GPS location" ? (
                      <button key={q} onClick={shareGps} disabled={gpsLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-full text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60">
                        {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />} Share location
                      </button>
                    ) : (
                      <button key={q} onClick={() => handleQuickReply(q)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-medium hover:border-primary hover:text-primary transition-colors shadow-sm">
                        {q}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="mt-4 space-y-2">
        {/* Image preview strip */}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 w-28 object-cover rounded-xl border border-slate-200 shadow-sm" />
            <button onClick={() => { setImagePreview(null); setImageBase64(null); setImageMimeType(null); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

          {/* GPS */}
          <button onClick={shareGps} disabled={gpsLoading || loading} title="Share GPS location"
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-xl transition-all disabled:opacity-50">
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Navigation className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Image upload */}
          <button onClick={pickImage} disabled={loading} title="Upload RO photo"
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-50 ${imagePreview ? "bg-primary/10 text-primary" : "bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-600"}`}>
            <ImagePlus className="w-4 h-4" />
          </button>

          {/* Text input */}
          <input
            className="input flex-1"
            placeholder={listening ? "🎤 Listening... speak now" : "Describe your RO problem or ask anything..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
            disabled={loading || listening}
          />

          {/* Voice */}
          {voiceSupported && (
            <button onClick={toggleVoice} disabled={loading} title={listening ? "Stop recording" : "Voice input"}
              className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-all disabled:opacity-50 ${listening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Send */}
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-primary hover:bg-primary-dark text-white rounded-xl transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>📍 GPS · {voiceSupported ? "🎤 Voice · " : ""}🇮🇳 Hindi supported</span>
          <span>
            Try:{" "}
            <button onClick={() => send("Check RO health score")} className="text-primary hover:underline">Health Score</button>
            {" · "}
            <button onClick={() => send("Log my TDS")} className="text-primary hover:underline">TDS</button>
          </span>
        </div>
      </div>
    </div>
  );
}