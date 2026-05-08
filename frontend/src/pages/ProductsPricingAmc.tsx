// Products Page
import { useEffect, useState } from "react";
import { Card, Button, Spinner, Badge } from "../components/ui";
import { ShoppingBag, Star } from "lucide-react";
import { Link } from "wouter";
import api from "../lib/api";

export function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/products").then(r => setProducts(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">RO Systems & Products</h1>
      <p className="text-slate-500 mb-8">Top brands, free installation support, 1-year warranty</p>
      {products.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No products found. Add some from the database.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(p => (
            <Card key={p.id} className="overflow-hidden p-0 flex flex-col">
              <div className="h-48 bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-4" /> : <ShoppingBag className="w-16 h-16 text-slate-300" />}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-slate-500">{p.brand}</p>
                    <h3 className="font-bold text-slate-900 leading-tight">{p.name}</h3>
                  </div>
                  <span className={`badge ${p.inStock ? "badge-green" : "badge-red"}`}>{p.inStock ? "In Stock" : "Out"}</span>
                </div>
                <p className="text-sm text-slate-500 mb-3 flex-1 line-clamp-2">{p.description}</p>
                {p.rating && (
                  <div className="flex items-center gap-1 mb-3">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium text-slate-700">{parseFloat(p.rating).toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-primary">₹{parseInt(p.price).toLocaleString("en-IN")}</span>
                  <Link href="/booking"><Button size="sm">Install Now</Button></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Pricing Page
export function Pricing() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/parts").then(r => setParts(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Transparent Pricing</h1>
      <p className="text-slate-500 mb-8">No hidden charges. Every part priced upfront.</p>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        💡 <strong>How it works:</strong> Technician visits for ₹199. Diagnoses the issue on-site. Shows you exact part costs. You approve before anything is replaced.
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Part / Service</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-700">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} className="text-center py-8"><Spinner className="w-6 h-6 mx-auto" /></td></tr>
            ) : (
              parts.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-6 py-3 text-right font-semibold text-slate-900">₹{p.minPrice}{p.minPrice !== p.maxPrice ? `–₹${p.maxPrice}` : ""}</td>
                </tr>
              ))
            )}
            <tr className="bg-primary/5 border-t-2 border-primary/20">
              <td className="px-6 py-3 font-bold text-primary">Service Visit Charge</td>
              <td className="px-6 py-3 text-right font-bold text-primary">₹199</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <div className="mt-6 text-center">
        <Link href="/booking"><Button size="lg">Book a Technician</Button></Link>
      </div>
    </div>
  );
}

// AMC Plans Page
export function AmcPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.get("/amc-plans").then(r => setPlans(r.data)).finally(() => setLoading(false));
  }, []);

  const subscribe = async (planId: number, planName: string) => {
    setSubscribing(planId);
    try {
      await api.post("/amc-plans/subscribe", { planId });
      setSuccess(`✅ Subscribed to ${planName} plan!`);
    } catch (e: any) {
      alert(e.response?.data?.error || "Please sign in to subscribe");
    } finally { setSubscribing(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">AMC Plans</h1>
      <p className="text-slate-500 mb-8">Annual Maintenance Contract — Save money, never worry about your RO</p>
      {success && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-emerald-700 font-medium">{success}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <Card key={plan.id} className={`flex flex-col ${i === 1 ? "border-primary border-2 relative" : ""}`}>
            {i === 1 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>}
            <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
            <p className="text-3xl font-extrabold text-primary mb-1">₹{parseInt(plan.price).toLocaleString("en-IN")}<span className="text-sm font-normal text-slate-500">/year</span></p>
            <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {(plan.features || []).map((f: string) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><span className="text-emerald-500 mt-0.5">✓</span>{f}</li>
              ))}
              <li className="flex items-center gap-2 text-sm text-slate-700"><span className="text-emerald-500">✓</span>{plan.servicesIncluded} service visit{plan.servicesIncluded > 1 ? "s" : ""}/year</li>
            </ul>
            <Button onClick={() => subscribe(plan.id, plan.name)} loading={subscribing === plan.id} className="w-full" variant={i === 1 ? "primary" : "outline"}>
              Get {plan.name} Plan
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
