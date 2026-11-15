import { BookOpen } from 'lucide-react';

interface ScienceModalProps {
  onClose: () => void;
}

export function ScienceModal({ onClose }: ScienceModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-2xl w-full bg-[#160d0b] border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-xs sm:text-sm">
        <div className="flex items-center justify-between border-b border-[#4d261b] pb-3">
          <h2 className="font-display text-lg sm:text-xl font-bold text-amber-300 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Mars Science Notes &amp; NASA Facts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-[#2a1712] text-slate-100 hover:bg-[#3b2019] border border-[#54291c] text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-xs leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-cyan-300 mb-1">
              1. MOXIE O₂ ISRU (Perseverance Rover)
            </div>
            <p className="text-slate-200">
              Based on NASA's <em>Mars mission research</em>, each
              astronaut consumes <strong>0.84 kg O₂/sol</strong> (3.36 kg/sol for a 4-person crew).
              MOXIE splits Martian CO₂ at <strong>800°C</strong> via solid-oxide electrolysis.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-amber-300 mb-1">
              2. -90°C Night Thermal &amp; KRUSTY Nuclear
            </div>
            <p className="text-slate-200">
              Martian surface temperatures plunge near <strong>-90°C</strong> at night and during
              dust storms (τ = 10.8), blocking solar arrays right when habitat heaters draw peak
              power. Multi-layer insulation and <strong>KRUSTY Kilopower</strong> prevent pipes from
              freezing.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-emerald-300 mb-1">
              3. Perchlorate (ClO₄⁻) Regolith &amp; Crops
            </div>
            <p className="text-slate-200">
              Martian soil contains <strong>0.5–1% toxic perchlorates (ClO₄⁻)</strong> discovered by
              NASA's Phoenix lander. Water-only hydroponics avoids soil toxins, while real Martian
              regolith beds must be washed with water first or crops become toxic to the crew.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-indigo-300 mb-1">
              4. Curiosity Sol 4190 X12 Flare (May 20, 2024)
            </div>
            <p className="text-slate-200">
              Mars lacks a global magnetic field. Curiosity's RAD detector measures{' '}
              <strong>0.64 mSv/sol</strong> baseline GCRs, but on May 20, 2024, an X12 flare spiked
              surface radiation to <strong>8,100 µGy (8.1 mSv)</strong>, threatening EVA astronauts.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-sky-300 mb-1">5. Buried Ice &amp; the Rodwell</div>
            <p className="text-slate-200">
              NASA's <strong>Subsurface Water Ice Mapping (SWIM)</strong> project combines orbital
              radar (SHARAD) and thermal data to find ice, some under less than a meter of soil.
              Phoenix scraped real ice in 2008. A <strong>Rodwell</strong> drills down and melts ice
              in place with hot water, then pumps it up.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-violet-300 mb-1">6. Sabatier Fuel for the Trip Home</div>
            <p className="text-slate-200">
              <strong>CO₂ + 4H₂ → CH₄ + 2H₂O</strong>. Hydrogen comes from electrolyzing mined
              water; CO₂ comes from Mars's 95% CO₂ air. Making ascent propellant on Mars saves tons
              of launch mass from Earth. Earth–Mars launch windows open about every 26 months.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-orange-300 mb-1">7. Spares, Printing &amp; Dust</div>
            <p className="text-slate-200">
              No resupply arrives mid-mission, so crews rely on spares and in-space manufacturing.
              The ISS has tested 3D printers and a <strong>Refabricator</strong> that recycles
              plastic. Fine, electrostatic Mars dust wears seals and coats solar panels.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1f1310] border border-[#4d261b]">
            <div className="font-bold text-rose-300 mb-1">8. Water Recycling &amp; Dose Limits</div>
            <p className="text-slate-200">
              The ISS water system recovers about <strong>98%</strong> of crew water, so a little is
              always lost. NASA's 2022 standard caps an astronaut career at{' '}
              <strong>600 mSv</strong>; EVAs on Mars get far less shielding than the habitat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
