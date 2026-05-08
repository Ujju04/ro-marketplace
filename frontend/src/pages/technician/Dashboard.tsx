import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, Button, Badge, Spinner, Input } from "../../components/ui";
import { Wrench, IndianRupee, CheckCircle, Clock, MapPin, ToggleLeft, ToggleRight, Navigation, Plus, Minus, FileText, ChevronDown, ChevronUp, Phone, Star } from "lucide-react";
import { getStatusColor, formatDate } from "../../lib/utils";
import api from "../../lib/api";

// ── Minimal WebSocket hook for technician job-pool channel ────────────────────
function useTechPoolSocket(onNewJob: () => void) {
  const cbRef = useRef(onNewJob);
  cbRef.current = onNewJob;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?channel=tech:pool`;
    let ws: WebSocket;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    function connect() {
      if (dead) return;
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        try {
          const { type } = JSON.parse(ev.data);
          if (type === "booking:new") cbRef.current();
        } catch {}
      };
      ws.onopen = () => { retryDelay = 1000; };
      ws.onclose = () => {
        if (dead) return;
        retryTimer = setTimeout(() => { retryDelay = Math.min(retryDelay * 2, 30_000); connect(); }, retryDelay);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      dead = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);
}

// ── Technician Reviews component ──────────────────────────────────────────────
function TechnicianReviews() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reviews/technician/me").then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.totalReviews === 0) return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" /> Reviews ({0})</h2>
      <Card className="text-center py-8 text-slate-400">No reviews yet. Complete jobs to receive reviews!</Card>
    </div>
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" /> Reviews ({data.totalReviews})
        <span className="ml-auto text-base font-bold text-amber-500">★ {data.averageRating}</span>
      </h2>
      <div className="space-y-3">
        {data.reviews.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                    {r.userName?.charAt(0) || "U"}
                  </div>
                  <span className="font-medium text-sm text-slate-800">{r.userName || "Customer"}</span>
                  <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                </div>
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                  ))}
                </div>
                {r.comment && <p className="text-sm text-slate-600 italic">"{r.comment}"</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface Part { id: number; name: string; category: string; minPrice: number; maxPrice: number; }
interface BillLine { partId: number; partName: string; quantity: number; unitPrice: number; customPrice: number; }

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [isOnline, setIsOnline] = useState(user?.isAvailable ?? true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [billingJob, setBillingJob] = useState<number | null>(null);
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [billNotes, setBillNotes] = useState("");
  const [billServiceCharge, setBillServiceCharge] = useState(199);
  const [tdsBefore, setTdsBefore] = useState<string>("");
  const [tdsAfter, setTdsAfter] = useState<string>("");
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [generatedBill, setGeneratedBill] = useState<any>(null);
  const locationIntervalRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [jobsRes, earningsRes, partsRes] = await Promise.all([
        api.get("/bookings/technician/jobs"),
        api.get("/bookings/technician/earnings"),
        api.get("/parts"),
      ]);
      setJobs(jobsRes.data);
      setEarnings(earningsRes.data);
      setAllParts(partsRes.data.map((p: any) => ({ id: p.id, name: p.name, category: p.category, minPrice: parseFloat(p.minPrice), maxPrice: parseFloat(p.maxPrice) })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Subscribe to the shared job-pool channel — refresh when a new booking arrives
  useTechPoolSocket(loadData);

  // ── Live location broadcast ────────────────────────────────────────────────
  // Uses Page Visibility API: pauses GPS calls when the tab is hidden,
  // resumes immediately on visibility, so no stale 15-s window gap.
  const startLocationBroadcast = useCallback((bookingId: number) => {
    if (!navigator.geolocation) return;

    const sendLocation = () => {
      if (document.visibilityState === "hidden") return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.patch(`/bookings/${bookingId}/location`, {
              lat: pos.coords.latitude, lng: pos.coords.longitude,
            });
          } catch {}
        },
        undefined,
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    locationIntervalRef.current = setInterval(sendLocation, 15_000);
    sendLocation(); // immediate first ping on job accept

    const onVisibility = () => { if (document.visibilityState === "visible") sendLocation(); };
    document.addEventListener("visibilitychange", onVisibility);
    (locationIntervalRef as any)._cleanup = () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const stopLocationBroadcast = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    (locationIntervalRef as any)._cleanup?.();
  }, []);

  useEffect(() => () => stopLocationBroadcast(), [stopLocationBroadcast]);

  const toggleAvailability = async () => {
    try {
      await api.patch("/technicians/me/availability", { isAvailable: !isOnline });
      setIsOnline(!isOnline);
    } catch (e) { console.error(e); }
  };

  const accept = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/bookings/${id}/accept`);
      await loadData();
      startLocationBroadcast(id);
    } catch (e: any) { alert(e.response?.data?.error || "Could not accept job"); }
    finally { setActionLoading(null); }
  };

  const updateStatus = async (id: number, status: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      if (status === "in_progress") startLocationBroadcast(id);
      if (status === "completed") stopLocationBroadcast();
      await loadData();
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  // ── Billing ────────────────────────────────────────────────────────────────
  const openBilling = (jobId: number) => {
    setBillingJob(jobId);
    setBillLines([]);
    setBillNotes("");
    setBillServiceCharge(199);
    setTdsBefore("");
    setTdsAfter("");
    setGeneratedBill(null);
  };

  const addPart = (part: Part) => {
    setBillLines(prev => {
      const exists = prev.find(l => l.partId === part.id);
      if (exists) return prev.map(l => l.partId === part.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { partId: part.id, partName: part.name, quantity: 1, unitPrice: part.maxPrice, customPrice: part.maxPrice }];
    });
  };

  const removePart = (partId: number) => setBillLines(prev => prev.filter(l => l.partId !== partId));
  const updateQty = (partId: number, delta: number) => setBillLines(prev => prev.map(l => l.partId === partId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l));
  const updatePrice = (partId: number, price: number) => setBillLines(prev => prev.map(l => l.partId === partId ? { ...l, customPrice: price, unitPrice: price } : l));

  const partsTotal = billLines.reduce((s, l) => s + l.customPrice * l.quantity, 0);
  const billTotal = partsTotal + billServiceCharge;

  const submitBill = async () => {
    if (!billingJob) return;
    setBillSubmitting(true);
    try {
      const res = await api.post(`/bookings/${billingJob}/bill`, {
        parts: billLines.map(l => ({ partId: l.partId, quantity: l.quantity, customPrice: l.customPrice })),
        serviceCharge: billServiceCharge,
        notes: billNotes,
        tdsBefore: tdsBefore ? parseInt(tdsBefore) : undefined,
        tdsAfter: tdsAfter ? parseInt(tdsAfter) : undefined,
      });
      setGeneratedBill(res.data);
      await loadData();
    } catch (e: any) { alert(e.response?.data?.error || "Failed to generate bill"); }
    finally { setBillSubmitting(false); }
  };

  const pendingJobs = jobs.filter(j => j.status === "pending" && !j.technicianId);
  const myJobs = jobs.filter(j => j.technicianId);
  const activeJob = myJobs.find(j => j.status === "accepted" || j.status === "in_progress");

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name || "Technician"} 👋</h1>
          <p className="text-slate-500 text-sm">Manage your jobs and generate bills</p>
        </div>
        <button onClick={toggleAvailability}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${isOnline ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>
          {isOnline ? <><ToggleRight className="w-5 h-5" /> Online</> : <><ToggleLeft className="w-5 h-5" /> Offline</>}
        </button>
      </div>

      {/* Stats */}
      {earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Earnings", value: `₹${earnings.totalEarnings.toLocaleString("en-IN")}`, icon: <IndianRupee className="w-5 h-5 text-primary" />, bg: "bg-primary/10" },
            { label: "This Month", value: `₹${earnings.thisMonthEarnings.toLocaleString("en-IN")}`, icon: <IndianRupee className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-100" },
            { label: "Completed", value: earnings.completedJobs, icon: <CheckCircle className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100" },
            { label: "Total Jobs", value: earnings.totalJobs, icon: <Wrench className="w-5 h-5 text-orange-600" />, bg: "bg-orange-100" },
          ].map(s => (
            <Card key={s.label} className="flex items-center gap-3 p-4">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold text-slate-900">{s.value}</p></div>
            </Card>
          ))}
        </div>
      )}

      {/* Active job banner */}
      {activeJob && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center animate-pulse">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-blue-900">Active Job #{activeJob.id}</p>
              <p className="text-sm text-blue-700">{activeJob.address}, {activeJob.city}</p>
            </div>
          </div>
          <span className="badge badge-blue capitalize">{activeJob.status.replace("_", " ")}</span>
        </div>
      )}

      {/* Open jobs pool */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" /> Open Jobs ({pendingJobs.length})
        </h2>
        {pendingJobs.length === 0 ? (
          <Card className="text-center py-8 text-slate-400">No open jobs right now. Stay online to receive new jobs.</Card>
        ) : (
          <div className="space-y-3">
            {pendingJobs.map(job => (
              <Card key={job.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-bold text-slate-900">#{job.id}</span>
                      <span className="badge badge-orange capitalize">{job.serviceType}</span>
                      <span className="badge badge-blue capitalize">{job.bookingType}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> {job.address}, {job.city}
                    </div>
                    {job.symptoms && <p className="text-xs text-slate-500 mt-1">🔧 {job.symptoms}</p>}
                    {job.userName && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone className="w-3 h-3" /> {job.userName} · {job.userPhone}
                      </div>
                    )}
                    {job.estimatedCost && <p className="text-xs text-primary font-medium mt-1">Est. ₹{job.estimatedCost}</p>}
                  </div>
                  <Button size="sm" onClick={() => accept(job.id)} loading={actionLoading === job.id}>Accept</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* My jobs */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" /> My Jobs ({myJobs.length})
        </h2>
        {myJobs.length === 0 ? (
          <Card className="text-center py-8 text-slate-400">Accept a job above to get started!</Card>
        ) : (
          <div className="space-y-3">
            {myJobs.map(job => (
              <Card key={job.id} className="p-0 overflow-hidden">
                {/* Job header */}
                <div className="p-4 flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">#{job.id}</span>
                      <span className={`badge ${job.status === "completed" ? "badge-green" : job.status === "cancelled" ? "badge-red" : "badge-blue"}`}>
                        {job.status.replace("_", " ")}
                      </span>
                      <span className="badge badge-gray capitalize">{job.serviceType}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin className="w-3.5 h-3.5" /> {job.address}, {job.city}
                    </div>
                    {job.finalAmount && <p className="text-sm font-bold text-primary mt-1">Bill: ₹{job.finalAmount}</p>}
                  </div>
                  {expandedJob === job.id ? <ChevronUp className="w-5 h-5 text-slate-400 mt-1" /> : <ChevronDown className="w-5 h-5 text-slate-400 mt-1" />}
                </div>

                {/* Expanded job details */}
                {expandedJob === job.id && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500">Customer</span><p className="font-medium">{job.userName}</p></div>
                      <div><span className="text-slate-500">Phone</span><p className="font-medium">{job.userPhone}</p></div>
                      <div><span className="text-slate-500">Booked</span><p className="font-medium">{formatDate(job.createdAt)}</p></div>
                      <div><span className="text-slate-500">Type</span><p className="font-medium capitalize">{job.bookingType}</p></div>
                    </div>
                    {job.symptoms && <p className="text-sm text-slate-600">🔧 <strong>Symptoms:</strong> {job.symptoms}</p>}
                    {job.description && <p className="text-sm text-slate-600">📝 {job.description}</p>}
                    {job.notes && <p className="text-sm text-slate-600">💬 <strong>Notes:</strong> {job.notes}</p>}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {job.status === "accepted" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(job.id, "in_progress")} loading={actionLoading === job.id}>
                          <Navigation className="w-4 h-4" /> On the Way
                        </Button>
                      )}
                      {job.status === "in_progress" && !billingJob && (
                        <Button size="sm" onClick={() => openBilling(job.id)}>
                          <FileText className="w-4 h-4" /> Generate Bill
                        </Button>
                      )}
                      {job.status === "in_progress" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(job.id, "completed")} loading={actionLoading === job.id}>
                          Mark Complete (no parts)
                        </Button>
                      )}
                    </div>

                    {/* Bill Generator */}
                    {billingJob === job.id && (
                      <div className="bg-white rounded-xl border border-slate-200 p-4 mt-2">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" /> Generate Service Bill
                        </h4>

                        {generatedBill ? (
                          /* ── Generated bill preview ── */
                          <div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                              <p className="font-bold text-emerald-800 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Bill Generated Successfully</p>
                              <div className="space-y-1.5">
                                {generatedBill.parts.map((p: any) => (
                                  <div key={p.partId} className="flex justify-between text-sm">
                                    <span className="text-slate-700">{p.partName} × {p.quantity}</span>
                                    <span className="font-medium">₹{p.totalPrice}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm border-t border-emerald-200 pt-2 mt-2">
                                  <span className="text-slate-700">Service Charge</span>
                                  <span className="font-medium">₹{generatedBill.serviceCharge}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base text-emerald-800">
                                  <span>Total</span>
                                  <span>₹{generatedBill.totalAmount}</span>
                                </div>
                              </div>
                              {generatedBill.tdsBefore && generatedBill.tdsAfter && (
                                <div className="mt-3 pt-3 border-t border-emerald-200">
                                  <p className="text-xs font-semibold text-blue-800 mb-1">💧 TDS Reading</p>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-red-600 font-medium">{generatedBill.tdsBefore} ppm</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-emerald-600 font-bold">{generatedBill.tdsAfter} ppm</span>
                                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">-{generatedBill.tdsBefore - generatedBill.tdsAfter} ppm ✅</span>
                                  </div>
                                  <p className="text-xs text-blue-600 mt-1">Auto-logged to customer's TDS trend</p>
                                </div>
                              )}
                            </div>
                            <Button size="sm" className="w-full" onClick={() => { setBillingJob(null); setGeneratedBill(null); }}>Done</Button>
                          </div>
                        ) : (
                          /* ── Bill builder ── */
                          <div className="space-y-4">
                            {/* Parts selector */}
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Add Parts Used:</p>
                              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {allParts.map(part => (
                                  <button key={part.id} type="button" onClick={() => addPart(part)}
                                    className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all text-xs">
                                    <p className="font-medium text-slate-800 truncate">{part.name}</p>
                                    <p className="text-slate-500">₹{part.minPrice}{part.minPrice !== part.maxPrice ? `–${part.maxPrice}` : ""}</p>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Selected parts */}
                            {billLines.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-700">Selected Parts:</p>
                                {billLines.map(line => (
                                  <div key={line.partId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-slate-800">{line.partName}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs text-slate-500">₹</span>
                                        <input
                                          type="number"
                                          value={line.customPrice}
                                          onChange={e => updatePrice(line.partId, parseFloat(e.target.value) || 0)}
                                          className="w-20 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-primary"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => updateQty(line.partId, -1)} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                      <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                                      <button onClick={() => updateQty(line.partId, 1)} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <button onClick={() => removePart(line.partId)} className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* TDS Readings */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                              <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                                💧 TDS Readings <span className="font-normal text-blue-600">(optional but recommended)</span>
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="label text-xs">TDS Before Service (ppm)</label>
                                  <input type="number" value={tdsBefore} onChange={e => setTdsBefore(e.target.value)} placeholder="e.g. 320" className="input text-sm py-2" />
                                </div>
                                <div>
                                  <label className="label text-xs">TDS After Service (ppm)</label>
                                  <input type="number" value={tdsAfter} onChange={e => setTdsAfter(e.target.value)} placeholder="e.g. 95" className="input text-sm py-2" />
                                </div>
                              </div>
                              {tdsBefore && tdsAfter && (
                                <p className="text-xs mt-2 font-medium text-emerald-700">
                                  ✅ Improvement: {parseInt(tdsBefore) - parseInt(tdsAfter)} ppm reduction — auto-saved to customer's TDS trend
                                </p>
                              )}
                            </div>

                            {/* Service charge and notes */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label text-xs">Service Charge (₹)</label>
                                <input type="number" value={billServiceCharge} onChange={e => setBillServiceCharge(parseInt(e.target.value) || 0)} className="input text-sm py-2" />
                              </div>
                              <div className="flex items-end">
                                <div className="w-full bg-primary/5 rounded-xl px-3 py-2 text-center">
                                  <p className="text-xs text-slate-500">Total Bill</p>
                                  <p className="text-xl font-bold text-primary">₹{billTotal}</p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="label text-xs">Technician Notes (optional)</label>
                              <textarea value={billNotes} onChange={e => setBillNotes(e.target.value)} rows={2} className="input resize-none text-sm" placeholder="E.g. Replaced membrane and carbon filter. System working normally." />
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setBillingJob(null)} className="flex-1">Cancel</Button>
                              <Button size="sm" onClick={submitBill} loading={billSubmitting} className="flex-1" disabled={billLines.length === 0 && billServiceCharge === 0}>
                                <FileText className="w-4 h-4" /> Submit Bill
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Reviews section */}
      <TechnicianReviews />
    </div>
  );
}