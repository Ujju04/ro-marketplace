// ── RO Service Knowledge Base ─────────────────────────────────────────────────
// These documents are chunked, embedded, and stored in pgvector for RAG retrieval

export interface KnowledgeDoc {
  title: string;
  source: "troubleshooting" | "faq" | "parts" | "products" | "maintenance" | "water_quality";
  content: string;
  metadata?: Record<string, any>;
}

export const knowledgeDocs: KnowledgeDoc[] = [
  // ── TROUBLESHOOTING GUIDES ─────────────────────────────────────────────────
  {
    title: "No Water Output from RO",
    source: "troubleshooting",
    content: `Problem: RO purifier produces no water output.
Possible Causes:
1. RO pump failure - the pump motor has burned out or seized. Symptoms include complete silence when unit is powered on.
2. Solenoid valve stuck closed - the electronic valve that controls water flow is not opening. Usually caused by voltage fluctuations.
3. Inlet water supply off - check if the main water supply valve to the RO is open.
4. Low inlet water pressure - RO requires minimum 5 PSI inlet pressure to operate.
5. Power adapter failure - the adapter supplying power to the pump has failed.
6. Clogged pre-filters blocking all flow - severely clogged sediment or spun filters can reduce flow to zero.
DIY Steps: Check power LED is on. Listen for pump hum (silence = pump dead). Verify inlet valve is fully open. Check inlet water pressure.
Parts typically needed: RO Pump (Rs 1650-1850), Solenoid Valve (Rs 450), Adapter (Rs 750).
Service charge: Rs 199. Total estimate: Rs 1849-2599.`,
    metadata: { symptom: "no_water", severity: "high" },
  },
  {
    title: "Slow Water Output from RO",
    source: "troubleshooting",
    content: `Problem: RO purifier produces water very slowly, much less than normal.
Normal RO output is 8-10 litres per hour for a standard 75 GPD system.
Possible Causes:
1. Clogged sediment filter - most common cause after 6 months of use. The pre-filter is capturing sediment and becoming blocked.
2. Clogged carbon filter - carbon block filters can become restricted with heavy chlorine water.
3. Degraded RO membrane - after 2-3 years, membrane flux decreases significantly.
4. Low inlet water pressure - pressure below 40 PSI reduces output flow substantially.
5. Partially closed inlet valve - even slightly closed valve reduces output significantly.
6. Clogged flow restrictor - the flow restrictor (waste water regulator) may be blocked.
7. Low water tank pressure - if your tank bladder pressure is too high, it slows production.
DIY Steps: Check if inlet water pressure is normal (turn on tap fully). If filters are older than 6 months, replacement is due.
Parts needed: Sediment Filter (Rs 450), Carbon Filter (Rs 450), Membrane (Rs 1250-1650), Flow Resistor (Rs 100).`,
    metadata: { symptom: "slow_output", severity: "medium" },
  },
  {
    title: "Bad Taste or Smell in RO Water",
    source: "troubleshooting",
    content: `Problem: Water from RO purifier has bad taste, chlorine smell, plastic smell, or musty odor.
Types and causes:
1. Chlorine taste/smell - carbon filter is exhausted and no longer removing chlorine. Replace carbon filter.
2. Musty or earthy smell - algae or bacteria growth in storage tank. Tank needs sanitization.
3. Plastic taste (new unit) - new RO units have plastic taste for first 2-3 days. Drain and refill tank 3-4 times.
4. Sulfur/rotten egg smell - hydrogen sulfide in source water. Requires carbon block filter and aeration.
5. Metallic taste - membrane degradation allowing dissolved metals through. Check TDS - if above 150ppm, membrane needs replacement.
6. Bitter taste - over-purification (TDS below 50ppm) removing essential minerals. Consider mineralizer cartridge.
DIY Steps: Drain and refill the storage tank 2-3 times. If taste persists after 48 hours, carbon filter replacement is needed.
Parts needed: Carbon Filter (Rs 450), Filter Kit (Rs 1050 for all three pre-filters).
Membrane replacement if TDS > 150ppm: Rs 1250-1650.`,
    metadata: { symptom: "bad_taste", severity: "medium" },
  },
  {
    title: "Water Leaking from RO Unit",
    source: "troubleshooting",
    content: `Problem: Water dripping or leaking from the RO purifier or connections.
IMPORTANT: Turn off the inlet water valve immediately to prevent water damage to walls and floors.
Possible leak locations and causes:
1. Push-fit connector joints - most common. Plastic push-fit connectors can loosen over time or with temperature changes. Push tube in firmly or replace connector.
2. Filter housing O-rings - the rubber O-rings in the filter housings dry out and crack after 2-3 years. Requires O-ring replacement.
3. Membrane housing - cracks in the housing from pressure spikes. Housing replacement needed.
4. PTFE tape on threaded connections - tape can deteriorate. Re-wrap with fresh PTFE tape.
5. Cracked tubing - UV damage or age causes plastic tubing to crack. Replace affected section.
6. Solenoid valve body - internal cracks from pressure. Valve replacement needed.
7. Tank valve - the tank shut-off valve can develop small leaks. Replace tank valve.
DIY Steps: Turn off inlet valve immediately. Identify exact leak source with dry paper towel. Push-fit connections can often be fixed by removing tube and reinserting firmly.
Parts: Adapter (Rs 750), Tape (Rs 100). Technician visit strongly recommended for leak repairs.`,
    metadata: { symptom: "leaking", severity: "high" },
  },
  {
    title: "High TDS Reading in RO Water",
    source: "troubleshooting",
    content: `Problem: TDS meter shows high reading in purified water (above 150 ppm).
Understanding TDS (Total Dissolved Solids):
- Below 50 ppm: Too pure, may lack essential minerals, slightly acidic
- 50-150 ppm: IDEAL range for drinking water
- 150-300 ppm: Acceptable but membrane performance is declining
- 300-500 ppm: High - membrane replacement recommended soon
- Above 500 ppm: Critically high - membrane has failed
How to measure properly: Measure source water TDS and output water TDS. Calculate rejection rate = ((source TDS - output TDS) / source TDS) x 100. A healthy membrane should show 90-95% rejection. Below 75% rejection means membrane replacement is due.
Causes of high TDS:
1. Membrane degradation - most common after 2-3 years or high-TDS input water
2. Membrane bypass - membrane O-rings worn allowing unfiltered water bypass
3. Incorrect flow restrictor - wrong flow restrictor causes improper backpressure
DIY check: Compare input vs output TDS with a TDS meter (Rs 150 on Amazon). 
Parts needed: Membrane (Rs 1250-1650), Flow Resistor (Rs 100).`,
    metadata: { symptom: "high_tds", severity: "high" },
  },
  {
    title: "RO Making Noise",
    source: "troubleshooting",
    content: `Problem: RO purifier making unusual sounds - rattling, gurgling, humming loudly.
Types of sounds and causes:
1. Loud constant hum - normal operation sound. RO pump hums during water production. No action needed.
2. Loud vibrating/rattling - pump mounting loose or pump is failing. RO may need stabilizing or pump replacement.
3. Gurgling sound - normal when tank fills and pressure balances. Also occurs when air purges from new filters.
4. High-pitched whine - pump running at high RPM, may indicate low inlet pressure causing pump to work harder.
5. Clicking sound - solenoid valve opening and closing, normal.
6. No sound at all - pump has failed if no sound when unit should be producing water.
7. Sound only when water is running elsewhere - normal, RO runs off water pressure.
DIY Steps: Place RO on flat, stable, padded surface to reduce vibration. Ensure nothing is touching or pressing against the unit. If rattling, check all filter housings are tight.
Parts if pump failing: RO Pump (Rs 1650-1850).`,
    metadata: { symptom: "noisy", severity: "medium" },
  },
  {
    title: "UV Lamp Not Working",
    source: "troubleshooting",
    content: `Problem: UV lamp indicator light is off, or blue UV light not visible inside unit.
UV (Ultraviolet) purification kills bacteria and viruses after RO filtration.
How to check UV lamp: Some units have an indicator light. On most units, you can see a faint blue glow inside the UV chamber when looking at a small viewing window.
Causes of UV lamp failure:
1. UV lamp end of life - UV lamps last approximately 8000-10000 hours (about 11-14 months of continuous use, or 2-3 years with 6-8 hours/day). Lamp gradually loses intensity before complete failure.
2. UV lamp adapter/ballast failure - the electronic driver that powers the lamp has failed.
3. Loose connection - lamp may have come loose from its socket.
4. Power issue - check if the rest of the unit is working properly.
Important: Without working UV, water is still RO-purified but not sterilized against bacteria. While unlikely in normal circumstances, for complete safety get UV lamp replaced promptly.
Parts needed: UV Lamp (Rs 350), UV Adapter (Rs 350).
Service charge: Rs 199. Total estimate: Rs 549-899.`,
    metadata: { symptom: "uv_failure", severity: "medium" },
  },
  {
    title: "Yellow or Discoloured Water",
    source: "troubleshooting",
    content: `Problem: Water appears yellow, brown, or discoloured coming out of RO tap.
STOP drinking this water immediately until the issue is resolved.
Causes:
1. Failed spun/sediment pre-filter - most common cause. When the spun filter (first stage) fails or is bypassed, raw sediment enters the system and contaminates the storage tank. Yellow colour from iron/rust.
2. Tank contamination - storage tank has not been cleaned and has accumulated sediment or biological growth.
3. New installation - first few litres from a new installation may be discoloured from manufacturing residues. Drain completely.
4. Pipe corrosion - iron pipes upstream are corroding and sending rust particles that overwhelm the pre-filter.
5. Carbon fines - new carbon filter releasing fine carbon particles. Rinse by discarding first 2-3 tank fills.
DIY steps: Stop using water. Drain entire tank. Check if spun filter is intact and properly installed.
Parts needed: Spun Filter (Rs 150-250), Sediment Filter (Rs 450), Filter Kit (Rs 1050).
Tank sanitization with dilute food-grade hydrogen peroxide may be needed.`,
    metadata: { symptom: "yellow_water", severity: "high" },
  },

  // ── PARTS & PRICING ────────────────────────────────────────────────────────
  {
    title: "RO Spare Parts Pricing Guide",
    source: "parts",
    content: `Complete pricing for all RO spare parts and components:
FILTERS (replace every 4-6 months):
- Carbon Filter: Rs 450 (removes chlorine, bad taste, odors)
- Sediment Filter: Rs 450 (removes dirt, sand, rust, sediment)
- Spun Filter / PP Filter: Rs 150-250 (pre-filter for large particles)
- Filter Kit (all three pre-filters together): Rs 1050 (save Rs 100 vs buying separately)

MEMBRANE (replace every 2-3 years):
- RO Membrane 75 GPD: Rs 1250-1650 (core filtration, removes TDS, bacteria, viruses)
- Flow Resistor: Rs 100 (regulates waste water ratio, affects membrane performance)

PUMP AND ELECTRICAL:
- RO Pump (booster pump): Rs 1650-1850 (pressurizes water through membrane)
- Adapter / Power Supply: Rs 750 (powers the pump)
- Solenoid Valve: Rs 450 (automatic shut-off when tank is full)

UV COMPONENTS:
- UV Lamp: Rs 350 (kills bacteria/viruses, replace annually)
- UV Adapter / Ballast: Rs 350 (powers UV lamp)

ACCESSORIES:
- PTFE Thread Seal Tape: Rs 100 (sealing threaded connections)

KITS:
- Filter Kit: Rs 1050 (Carbon + Sediment + Spun - annual filter change)
- Full Service Kit: Rs 2250 (includes Filter Kit + Membrane)

SERVICE CHARGES:
- Standard visit charge: Rs 199 (waived for AMC customers)
- Parts charged separately after customer approval
- 30-day warranty on all replaced parts`,
    metadata: { category: "pricing" },
  },

  // ── MAINTENANCE GUIDES ─────────────────────────────────────────────────────
  {
    title: "Annual RO Maintenance Schedule",
    source: "maintenance",
    content: `Recommended maintenance schedule for RO water purifiers in India:

EVERY 3-4 MONTHS (High TDS areas: Delhi, Meerut, Noida, Rohtak):
- Visual check for leaks
- TDS reading check (should be 50-150 ppm output)
- Spun / PP filter replacement

EVERY 6 MONTHS (Standard maintenance):
- Replace Carbon Filter (Rs 450) - removes chlorine, taste, odors
- Replace Sediment Filter (Rs 450) - removes dirt and rust
- Replace Spun/PP Filter (Rs 150-250) - pre-filtration
- TDS check with meter
- Full system inspection for leaks or unusual sounds

ANNUALLY:
- Full service by certified technician
- UV lamp replacement (Rs 350) if applicable
- Flow rate test (should be 8-10 litres/hour for 75 GPD)
- Tank sanitization if needed
- All filter replacements

EVERY 2-3 YEARS:
- RO Membrane replacement (Rs 1250-1650)
- Check pump performance
- Inspect all tubing and connections

SIGNS YOU NEED IMMEDIATE SERVICE:
- TDS above 150 ppm
- Flow rate below 4 litres/hour
- Any visible leaks
- Bad taste or smell that persists
- Yellow or discoloured water
- UV indicator light off

AMC (Annual Maintenance Contract) handles all of this automatically:
- Basic AMC (Rs 1499/year): 1 service visit + filter kit
- Standard AMC (Rs 2499/year): 2 service visits + filter kit + priority support
- Premium AMC (Rs 3999/year): 3 service visits + full kit + 24/7 support`,
    metadata: { category: "maintenance" },
  },
  {
    title: "How to Extend RO Membrane Life",
    source: "maintenance",
    content: `RO membranes are the most expensive component (Rs 1250-1650). Here is how to maximize membrane lifespan:

FACTORS THAT REDUCE MEMBRANE LIFE:
1. High TDS source water (>500 ppm) - membrane works harder, clogs faster
2. Chlorinated water without proper carbon pre-filter - chlorine destroys membrane material within months
3. Not replacing pre-filters on schedule - dirty pre-filters let particles reach membrane
4. Running with low inlet pressure - pump cavitation can damage membrane
5. Long periods of non-use without preservation - bacteria can grow on membrane surface

BEST PRACTICES:
1. Always replace carbon and sediment filters every 6 months - they protect the membrane
2. Test TDS monthly to detect membrane decline early
3. If going on vacation (2+ weeks), drain the tank and shut off the unit
4. Install a sediment pre-filter if your area has very turbid water
5. Use a TDS meter (Rs 150) to monitor output TDS monthly
6. In Delhi/Meerut/Noida areas with TDS 400-600 ppm, expect membrane life of 12-18 months
7. In Mumbai/Pune with TDS 100-200 ppm, membrane can last 3-4 years

WHEN MEMBRANE IS FAILING:
- Output TDS starts rising (check monthly)
- Flow rate decreases (below 6 litres/hour)
- Membrane rejection rate drops below 75%
- Water taste changes despite fresh carbon filter

AMC plans include membrane monitoring and timely replacement recommendations.`,
    metadata: { category: "membrane_care" },
  },

  // ── WATER QUALITY ──────────────────────────────────────────────────────────
  {
    title: "Water Quality by City in India",
    source: "water_quality",
    content: `Water quality data for major Indian cities and implications for RO maintenance:

DELHI: TDS 400-500 ppm. Very High hardness. Groundwater has high fluoride, arsenic traces, and nitrates. RO essential. Membrane replacement every 12 months. Filter change every 4 months.

MEERUT: TDS 450-600 ppm. Very High hardness. Among the highest TDS in North India. Heavy industrial and agricultural contamination. RO absolutely essential. Membrane every 10-12 months. Filter change every 3-4 months.

ROHTAK: TDS 400-550 ppm. Very High. Similar to Meerut. High mineral content from Aravalli aquifer. RO essential. Filter change every 4 months.

NOIDA/GURGAON: TDS 380-480 ppm. Very High. Mix of groundwater and Yamuna-sourced supply. Industrial contamination risk. RO essential. Filter every 4-5 months.

MUMBAI: TDS 100-200 ppm. Moderate/Soft. Treated municipal supply from reservoirs. RO recommended but not critical. Membrane lasts 24-30 months. Filter every 8 months.

BANGALORE: TDS 250-300 ppm. High/Moderate. Mix of Cauvery river and borewells. Hardness varies by area. RO recommended. Filter every 6 months. Membrane 18-24 months.

CHENNAI: TDS 300-400 ppm. High/Hard. Seasonal variation - worse in summer. Coastal areas have higher salinity. RO essential. Filter every 5-6 months.

HYDERABAD: TDS 280-350 ppm. High/Moderate-Hard. Fluoride content a concern in some areas. RO recommended. Filter every 6 months. Membrane 16-20 months.

PUNE: TDS 200-280 ppm. Moderate. Good quality municipal supply. RO recommended. Filter every 7-8 months. Membrane 20-24 months.

SAFE TDS LEVELS: WHO and BIS standard for drinking water is 50-500 ppm acceptable, 50-150 ppm ideal. Below 50 ppm may lack essential minerals. Above 150 ppm from RO output indicates membrane needs attention.`,
    metadata: { category: "water_quality" },
  },

  // ── FAQ ────────────────────────────────────────────────────────────────────
  {
    title: "RO Service FAQ - Common Questions",
    source: "faq",
    content: `Frequently asked questions about RO service and maintenance:

Q: How often should I service my RO?
A: Minimum once a year. Every 6 months in high-TDS areas like Delhi, Meerut, Noida. Carbon and sediment filters need replacement every 6 months. UV lamp annually. Membrane every 2-3 years.

Q: How long does a service visit take?
A: Filter replacement: 30-45 minutes. Pump replacement: 45-60 minutes. Full service with all filter changes: 1-1.5 hours. New installation: 1.5-2.5 hours.

Q: What payment methods are accepted?
A: Cash, UPI (PhonePe, GPay, Paytm, BHIM), Credit/Debit card. Payment is taken only after you approve the bill. No advance payment required.

Q: Is there a warranty on repairs?
A: Yes. 30-day warranty on all replaced parts. If the same issue recurs within 30 days, the technician revisit is free.

Q: What is AMC (Annual Maintenance Contract)?
A: AMC is a yearly plan covering all scheduled maintenance. Basic (Rs 1499/year): 1 service + filter kit. Standard (Rs 2499/year): 2 services + filter kit + priority. Premium (Rs 3999/year): 3 services + full kit + 24/7 support. Saves Rs 1500-3000 vs paying per visit.

Q: Can I get service same day?
A: Yes, instant booking sends a technician within 60 minutes in most areas. Scheduled booking lets you choose a specific date and time.

Q: What brands of RO do you service?
A: We service all major brands including Kent, Aquaguard/Eureka Forbes, Pureit/HUL, Livpure, Blue Star, Havells, AO Smith, Whirlpool, LG, Samsung, Tata Swach, Hindustan Unilever, and all local/unbranded RO systems.

Q: How do I know if my RO needs service?
A: Key signs: TDS above 150 ppm, flow rate below 6 litres/hour, bad taste or smell, any visible leaks, unusual loud sounds, yellow or discoloured water. Use a TDS meter (Rs 150) for monthly monitoring.

Q: Do I need to be home during service?
A: Yes, the technician will show you the diagnosis and get approval before replacing any parts. You will be shown the old and new parts.

Q: What if I am not satisfied with the service?
A: Call our support within 30 days. Technician will revisit free of charge. All work carries 30-day warranty.`,
    metadata: { category: "faq" },
  },
  {
    title: "RO Products Guide - Choosing the Right RO",
    source: "products",
    content: `Guide to choosing the right RO water purifier for Indian homes:

CAPACITY GUIDE:
- 5-7 litre tank: Suitable for 2-3 people, produces 8-10 litres/hour
- 8-10 litre tank: Suitable for 4-6 people (most popular size)
- 15+ litre tank: Large families or offices

PURIFICATION STAGES:
- RO only: Best for TDS 200-500 ppm water
- RO+UV: RO removes dissolved solids, UV kills bacteria/viruses (recommended)
- RO+UV+UF: Additional ultrafiltration for extra safety, works without electricity
- RO+UV+UF+TDS Controller: Best for areas with very high TDS, controls mineral level

TOP BRANDS AND TYPICAL PRICES:
- Kent Grand Plus: Rs 12,000-15,000. 9L tank. RO+UV+UF+TDS control. Very popular in Delhi/NCR.
- Aquaguard Geneus: Rs 15,000-18,000. 8.5L. Smart RO with mineral and copper enrichment.
- Pureit Eco Mineral: Rs 8,000-11,000. 10L. Good for Mumbai/Pune moderate TDS areas.
- Livpure Glo: Rs 6,000-8,000. 7L. Budget option, good for low-moderate TDS areas.
- Blue Star Aristo: Rs 10,000-13,000. 8L. Good after-sales service network.
- AO Smith Z8: Rs 18,000-22,000. High-end, side stream technology, very efficient.

RECOMMENDATION BY CITY:
- Delhi/Meerut/Noida (TDS 400-600): Kent Grand Plus, Aquaguard Geneus, AO Smith
- Mumbai/Pune (TDS 100-250): Pureit Eco, Livpure Glo adequate
- Bangalore/Chennai (TDS 250-400): Kent, Aquaguard, Blue Star recommended

INSTALLATION: Free installation included with purchase from AquaCare. Takes 1.5-2 hours. Includes all fittings and initial setup.`,
    metadata: { category: "product_guide" },
  },
];

// ── Chunk documents into smaller pieces for better retrieval ──────────────────
export function chunkDocument(doc: KnowledgeDoc, chunkSize = 400): { content: string; title: string; source: string; metadata: Record<string, any> }[] {
  const sentences = doc.content.split(/\n+/).filter(s => s.trim().length > 20);
  const chunks: { content: string; title: string; source: string; metadata: Record<string, any> }[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + "\n" + sentence).length > chunkSize && current.length > 0) {
      chunks.push({ content: current.trim(), title: doc.title, source: doc.source, metadata: doc.metadata || {} });
      current = sentence;
    } else {
      current = current ? current + "\n" + sentence : sentence;
    }
  }
  if (current.trim().length > 30) {
    chunks.push({ content: current.trim(), title: doc.title, source: doc.source, metadata: doc.metadata || {} });
  }
  return chunks;
}
