import { Link } from "wouter";
import { Droplets, Zap, Shield, Star, ChevronRight, Wrench, ShoppingBag, Bot, Phone } from "lucide-react";
import { Button } from "../components/ui";

const FEATURES = [
  { icon: <Zap className="w-6 h-6 text-primary" />, title: "Instant Booking", desc: "Get a technician at your door within 60 minutes" },
  { icon: <Shield className="w-6 h-6 text-primary" />, title: "Transparent Pricing", desc: "See exact part costs before approving any repair" },
  { icon: <Star className="w-6 h-6 text-primary" />, title: "Verified Technicians", desc: "All technicians are background-checked and trained" },
  { icon: <Bot className="w-6 h-6 text-primary" />, title: "AI Diagnosis", desc: "Describe your problem and get an instant diagnosis" },
];

const SERVICES = [
  { icon: "🔧", title: "RO Repair", desc: "Fix any issue — pump, membrane, filters", href: "/booking" },
  { icon: "💧", title: "Installation", desc: "New RO system installed in 1-2 hours", href: "/booking" },
  { icon: "🔄", title: "AMC Plans", desc: "Annual maintenance contract from ₹1,499", href: "/amc" },
  { icon: "🛒", title: "Buy Products", desc: "Top RO brands with installation support", href: "/products" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-50 via-white to-blue-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <Droplets className="w-4 h-4" /> India's #1 RO Service Platform
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
            RO Not Working?<br />
            <span className="text-primary">We Fix It Fast.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Book a certified RO technician in minutes. Transparent pricing, instant diagnosis, and same-day service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/booking">
              <Button size="lg" className="w-full sm:w-auto">
                <Wrench className="w-5 h-5" /> Book Service Now
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Bot className="w-5 h-5" /> Chat with AI
              </Button>
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-4">⚡ Technician arrives within 60 minutes</p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-3">Our Services</h2>
          <p className="text-center text-slate-500 mb-10">Everything your RO needs, in one place</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s) => (
              <Link key={s.title} href={s.href}>
                <div className="card p-6 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="text-4xl mb-4">{s.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">{s.title}</h3>
                  <p className="text-sm text-slate-500">{s.desc}</p>
                  <ChevronRight className="w-4 h-4 text-primary mt-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-3">Why AquaCare?</h2>
          <p className="text-center text-slate-500 mb-10">Built for trust, speed, and transparency</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">{f.icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Transparent Pricing</h2>
          <p className="text-slate-500 mb-8">No hidden charges. You see the cost before we start.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {[["Carbon Filter", "₹450"], ["Membrane", "₹1,250–1,650"], ["RO Pump", "₹1,650–1,850"], ["Sediment Filter", "₹450"], ["UV Lamp", "₹350"], ["Filter Kit", "₹1,050"]].map(([name, price]) => (
              <div key={name} className="card p-4 text-left">
                <p className="text-xs text-slate-500 mb-1">{name}</p>
                <p className="font-bold text-slate-900">{price}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing">
            <Button variant="outline">View Full Price List <ChevronRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to fix your RO?</h2>
          <p className="text-sky-100 mb-8">Book in 60 seconds. Same-day service available.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/booking">
              <Button className="bg-white text-primary hover:bg-sky-50 w-full sm:w-auto">
                <Wrench className="w-5 h-5" /> Book Now
              </Button>
            </Link>
            <Link href="/chat">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white w-full sm:w-auto">
                <Bot className="w-5 h-5" /> Chat with AquaBot
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
