import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplets, Activity, AlertTriangle, CheckCircle, Clock, Thermometer, Wind, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "../components/ui";
import api from "../lib/api";

interface HealthRecord {
  id: number;
  score: number;
  status: string;
  recommendation: string;
  roAge: number;
  lastServiceMonths: number;
  currentTds: number;
  waterTaste: string;
  flowSpeed: string;
  createdAt: string;
}

interface FormData {
  roAge: string;
  lastServiceMonths: string;
  currentTds: string;
  waterTaste: string;
  flowSpeed: string;
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: "stroke-green-500", text: "text-green-600", bg: "bg-green-50 border-green-200" };
  if (score >= 60) return { ring: "stroke-blue-500",  text: "text-blue-600",  bg: "bg-blue-50 border-blue-200"  };
  if (score >= 40) return { ring: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
  return             { ring: "stroke-red-500",   text: "text-red-600",   bg: "bg-red-50 border-red-200"   };
}

function statusIcon(status: string) {
  if (status === "Excellent")       return <CheckCircle  className="w-5 h-5 text-green-500" />;
  if (status === "Good")            return <Activity      className="w-5 h-5 text-blue-500"  />;
  if (status === "Needs Attention") return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return                                   <AlertTriangle className="w-5 h-5 text-red-500"   />;
}

function ScoreGauge({ score, status }: { score: number; status: string }) {
  const colors = scoreColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" className={colors.ring} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${colors.bg} ${colors.text}`}>
        {statusIcon(status)}
        {status}
      </div>
    </div>
  );
}

function OptionCard({ label, value, selected, onClick }: { label: string; value: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${selected ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary"}`}>
      {label}
    </button>
  );
}

export default function RoHealth() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>({ roAge: "", lastServiceMonths: "", currentTds: "", waterTaste: "", flowSpeed: "" });
  const [result, setResult] = useState<HealthRecord | null>(null);

  const { data: latest, isLoading } = useQuery<HealthRecord | null>({
    queryKey: ["ro-health"],
    queryFn: async () => { const res = await api.get("/ro-health"); return res.data; },
  });

  const submit = useMutation({
    mutationFn: (data: FormData) => api.post("/ro-health", {
      roAge: parseInt(data.roAge), lastServiceMonths: parseInt(data.lastServiceMonths),
      currentTds: parseInt(data.currentTds), waterTaste: data.waterTaste, flowSpeed: data.flowSpeed,
    }),
    onSuccess: (res) => { setResult(res.data); qc.invalidateQueries({ queryKey: ["ro-health"] }); setShowForm(false); },
  });

  const isFormValid = form.roAge && form.lastServiceMonths && form.currentTds && form.waterTaste && form.flowSpeed;
  const displayed = result ?? latest;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
          <Droplets className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">RO Health Check</h1>
        <p className="text-slate-500 mt-1 text-sm">Answer a few quick questions to get your purifier's health score</p>
      </div>

      {!showForm && displayed && (
        <div className="card mb-6">
          <ScoreGauge score={displayed.score} status={displayed.status} />
          <div className={`mt-5 p-4 rounded-xl border text-sm ${scoreColor(displayed.score).bg} ${scoreColor(displayed.score).text}`}>
            {displayed.recommendation}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"><Clock className="w-4 h-4 text-slate-400" /><span>Age: {displayed.roAge} months</span></div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"><Activity className="w-4 h-4 text-slate-400" /><span>TDS: {displayed.currentTds} ppm</span></div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"><Thermometer className="w-4 h-4 text-slate-400" /><span>Taste: {displayed.waterTaste}</span></div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"><Wind className="w-4 h-4 text-slate-400" /><span>Flow: {displayed.flowSpeed.replace("_", " ")}</span></div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(true)}><RotateCcw className="w-4 h-4" /> Re-check</Button>
            <Button className="flex-1" onClick={() => window.location.href = "/booking"}>Book Service <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {!showForm && !displayed && !isLoading && (
        <div className="card text-center py-10">
          <Droplets className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-5">No health check done yet. Take the quick assessment.</p>
          <Button onClick={() => setShowForm(true)}>Start Health Check</Button>
        </div>
      )}

      {isLoading && !showForm && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {showForm && (
        <div className="card space-y-6">
          <div>
            <label className="label flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />How old is your RO purifier? (months)</label>
            <input type="number" min={0} placeholder="e.g. 24" className="input" value={form.roAge} onChange={(e) => setForm({ ...form, roAge: e.target.value })} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary" />Months since last service</label>
            <input type="number" min={0} placeholder="e.g. 6" className="input" value={form.lastServiceMonths} onChange={(e) => setForm({ ...form, lastServiceMonths: e.target.value })} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Thermometer className="w-4 h-4 text-primary" />Current TDS reading (ppm)</label>
            <input type="number" min={0} placeholder="e.g. 120" className="input" value={form.currentTds} onChange={(e) => setForm({ ...form, currentTds: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">Check your RO's TDS meter. Ideal range: 50–150 ppm.</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Droplets className="w-4 h-4 text-primary" />How does the water taste?</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[{ label: "Good", value: "good" }, { label: "Okay", value: "ok" }, { label: "Bad / Unpleasant", value: "bad" }].map((opt) => (
                <OptionCard key={opt.value} label={opt.label} value={opt.value} selected={form.waterTaste === opt.value} onClick={() => setForm({ ...form, waterTaste: opt.value })} />
              ))}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Wind className="w-4 h-4 text-primary" />Water flow speed</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[{ label: "Fast", value: "fast" }, { label: "Normal", value: "normal" }, { label: "Slow", value: "slow" }, { label: "Very Slow", value: "very_slow" }].map((opt) => (
                <OptionCard key={opt.value} label={opt.label} value={opt.value} selected={form.flowSpeed === opt.value} onClick={() => setForm({ ...form, flowSpeed: opt.value })} />
              ))}
            </div>
          </div>
          {submit.isError && <p className="text-sm text-red-500 text-center">Something went wrong. Please try again.</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setForm({ roAge: "", lastServiceMonths: "", currentTds: "", waterTaste: "", flowSpeed: "" }); }}>Cancel</Button>
            <Button className="flex-1" disabled={!isFormValid} loading={submit.isPending} onClick={() => submit.mutate(form)}>Get My Score</Button>
          </div>
        </div>
      )}
    </div>
  );
}
