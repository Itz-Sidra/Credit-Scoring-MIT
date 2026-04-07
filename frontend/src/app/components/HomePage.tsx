import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { BrutalCard } from "./BrutalCard";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-blue-600 selection:text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b-[1.5px] border-black">
        <div className="flex items-center gap-1.5">
          <span className="text-xl md:text-2xl font-black tracking-tighter uppercase">CREDIT</span>
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-600 mb-1" />
        </div>
        <div className="hidden md:flex gap-10 text-xs md:text-sm font-bold uppercase tracking-[0.2em]">
          <a href="#about" className="hover:opacity-70 transition-opacity">About</a>
          <a href="#logic" className="hover:opacity-70 transition-opacity">How it works</a>
          <a href="#secure" className="hover:opacity-70 transition-opacity">Security</a>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="bg-black text-white hover:bg-black/90 rounded-none border-[1.5px] border-transparent font-black text-[10px] md:text-xs px-6 py-2 uppercase tracking-[0.2em] transition-all"
        >
          START &rarr;
        </button>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col md:flex-row items-center justify-center min-h-[80vh] px-8 md:px-12 xl:px-24 py-12 md:py-0 border-b-[1.5 ; border-black relative overflow-hidden">
        <div className="w-full md:w-1/2 flex flex-col justify-center z-10">
          <h1 className="text-[12vw] md:text-[8vw] lg:text-[7rem] leading-[0.85] font-black tracking-tighter uppercase mb-10">
            CREDIT IS<br />
            <span className="text-blue-600">BROKEN.</span><br />
            WE FIX IT.
          </h1>
          <div className="font-bold text-xl md:text-2xl lg:text-3xl mb-12 max-w-xl leading-tight">
            NO CIBIL? NO PROBLEM.<br />
            WE USE REAL FINANCIAL BEHAVIOR.
          </div>
          <div>
            <Button
              onClick={() => navigate("/login")}
              className="bg-black text-white hover:bg-black/80 rounded-none border-2 border-transparent font-black text-base md:text-lg px-8 py-7 uppercase tracking-[0.1em] transition-all w-full md:w-auto"
            >
              CHECK YOUR SCORE &rarr;
            </Button>
          </div>
        </div>
        <div className="w-full md:w-1/2 flex justify-center py-16 md:py-0 z-10">
          <BrutalCard />
        </div>
      </main>

      {/* Removed the blue/white footer stripe here */}

      {/* Section 1: BEHAVIORAL FEED (Replacing comparison table) */}
      <section id="about" className="w-full border-b-[1.5px] border-black py-24 md:py-40 px-8 md:px-12 xl:px-24 bg-white overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-0 lg:divide-x-[1.5px] lg:divide-black -mx-8 md:-mx-12 xl:-mx-24 px-8 md:px-12 xl:px-24">
          <div className="lg:pr-20">
            <h2 className="text-[10vw] md:text-[6vw] lg:text-[6rem] leading-[0.85] font-black tracking-tighter uppercase mb-8">
              NO CREDIT HISTORY?<br />
              <span className="text-blue-600">GOOD.</span>
            </h2>
            <p className="font-black text-2xl md:text-4xl max-w-4xl leading-tight opacity-90 mb-12">
              Traditional systems reject you. We don't.
            </p>
          </div>

          {/* Real-time Behavioral Logic Feed */}
          <div className="lg:pl-20">
            <div className="flex flex-col border-[2px] border-black h-fit bg-white p-6 md:p-8 shadow-[12px_12px_0_0_rgba(0,0,0,1)] hover:shadow-[16px_16px_0_0_rgba(0,0,0,1)] transition-all">
              <div className="flex justify-between items-center mb-10 pb-4 border-b border-black/10">
                <span className="font-black text-xs tracking-[0.3em] uppercase opacity-40">SIGNAL_STREAM</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span className="font-bold text-[10px] uppercase">LIVE ANALYSIS</span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase">RENT_PAYMENT_LOOP</span>
                    <span className="text-[10px] font-bold text-gray-400">03 SUCCESSIVE MONTHS</span>
                  </div>
                  <span className="font-black text-blue-600">+18 PTS</span>
                </div>
                <div className="h-[1px] bg-black/5" />
                <div className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase">UTILITY_SETTLEMENT</span>
                    <span className="text-[10px] font-bold text-gray-400">ON-TIME VERIFIED</span>
                  </div>
                  <span className="font-black text-blue-600">+12 PTS</span>
                </div>
                <div className="h-[1px] bg-black/5" />
                <div className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase">CASH_FLOW_STABILITY</span>
                    <span className="text-[10px] font-bold text-gray-400">POSITIVE NET MARGIN</span>
                  </div>
                  <span className="font-black text-blue-600">+24 PTS</span>
                </div>
                <div className="h-[1px] bg-black/5" />
                <div className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase">SUB_RENEWAL_CONSISTENCY</span>
                    <span className="text-[10px] font-bold text-gray-400">DIGITAL FOOTPRINT SCAN</span>
                  </div>
                  <span className="font-black text-blue-600">+08 PTS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Data Signals Grid (Adding Hover Effect) */}
      <section className="w-full border-b-[1.5px] border-black py-24 md:py-40 px-8 md:px-12 xl:px-24 bg-black text-white overflow-hidden selection:bg-white selection:text-black">
        <div className="flex flex-col lg:flex-row gap-16 lg:items-end mb-24">
          <div className="flex-1">
            <h2 className="text-[10vw] md:text-[6vw] lg:text-[6rem] leading-[0.85] font-black tracking-tighter uppercase mb-6">
              EVALUATES TRUE POTENTIAL.<br />
              <span className="text-blue-600">BEYOND CREDIT SCORES.</span>
            </h2>
            <p className="font-black text-2xl md:text-4xl max-w-4xl leading-tight opacity-90 text-gray-400">
              Beyond the score. Into the flow.
            </p>
          </div>
        </div>

        {/* Data Signals Grid with Hover Effects */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-[1.5px] border-white/20 divide-y-[1.5px] md:divide-y-0 md:divide-x-[1.5px] divide-white/20">
          <div className="p-8 flex flex-col gap-4 hover:bg-blue-600 transition-all duration-300 group cursor-default">
            <div className="text-blue-500 font-mono text-sm group-hover:text-white transition-colors">01</div>
            <div className="font-black text-xl uppercase italic group-hover:text-white transition-colors">UTILITIES</div>
            <p className="text-[10px] md:text-xs text-gray-500 font-bold tracking-widest uppercase group-hover:text-white/80 transition-colors">REGULAR BILL PAYMENTS AS TRUST SIGNALS.</p>
          </div>
          <div className="p-8 flex flex-col gap-4 hover:bg-blue-600 transition-all duration-300 group cursor-default">
            <div className="text-blue-500 font-mono text-sm group-hover:text-white transition-colors">02</div>
            <div className="font-black text-xl uppercase italic group-hover:text-white transition-colors">CASH FLOW</div>
            <div className="text-[10px] md:text-xs text-gray-500 font-bold tracking-widest uppercase group-hover:text-white/80 transition-colors">REAL-TIME LIQUIDITY ANALYSIS.</div>
          </div>
          <div className="p-8 flex flex-col gap-4 hover:bg-blue-600 transition-all duration-300 group cursor-default">
            <div className="text-blue-500 font-mono text-sm group-hover:text-white transition-colors">03</div>
            <div className="font-black text-xl uppercase italic group-hover:text-white transition-colors">RENTAL DATA</div>
            <div className="text-[10px] md:text-xs text-gray-500 font-bold tracking-widest uppercase group-hover:text-white/80 transition-colors">CONSISTENT RECURRING BEHAVIOR.</div>
          </div>
          <div className="p-8 flex flex-col gap-4 hover:bg-blue-600 transition-all duration-300 group cursor-default">
            <div className="text-blue-500 font-mono text-sm group-hover:text-white transition-colors">04</div>
            <div className="font-black text-xl uppercase italic group-hover:text-white transition-colors">SUBSCRIPTIONS</div>
            <div className="text-[10px] md:text-xs text-gray-500 font-bold tracking-widest uppercase group-hover:text-white/80 transition-colors">DIGITAL RESPONSIBILITY FOOTPRINT.</div>
          </div>
        </div>
      </section>

      {/* Section 3: Instant Decision (Kept as is, but slightly tweaked for flow) */}
      <section className="w-full border-b-[1.5px] border-black py-24 md:py-40 px-8 md:px-12 xl:px-24 bg-white overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 mb-16">
          <h2 className="text-[10vw] md:text-[6vw] lg:text-[7rem] leading-[0.85] font-black tracking-tighter uppercase">
            INSTANT DECISION.<br />
            <span className="text-blue-600">NO WAITING.</span>
          </h2>

          {/* Small Decision Card Mockup */}
          <div className="w-full max-w-sm border-[3px] border-black p-6 bg-white shadow-[12px_12px_0_0_rgba(0,0,0,1)] flex flex-col gap-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span>CREDIT REPORT</span>
              <span className="text-green-600">SUCCESS</span>
            </div>
            <div className="text-5xl font-black text-black">742</div>
            <div className="h-2 bg-gray-100 w-full">
              <div className="h-full bg-blue-600 w-[78%]"></div>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase">Decision processed in 2.4s</div>
          </div>
        </div>
        <p className="font-black text-2xl md:text-4xl max-w-4xl leading-tight opacity-90 text-black">
          Seconds, not days. Automated for speed.
        </p>
      </section>

      {/* How it Works Section */}
      <section id="logic" className="w-full border-b-[1.5px] border-black py-24 md:py-40 px-8 md:px-12 xl:px-24 bg-white">
        <div className="max-w-6xl">
          <h3 className="text-xs md:text-sm font-black tracking-[0.3em] uppercase mb-16 md:mb-24 text-black/40">HOW IT WORKS</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x-[1.5px] divide-black border-y-[1.5px] border-black -mx-8 md:mx-0">
            <div className="px-8 md:px-10 py-12 md:py-16 hover:bg-gray-50 transition-colors">
              <div className="text-4xl font-black text-blue-600 mb-6 font-mono tracking-tighter italic opacity-80 decoration-blue-600 underline underline-offset-8">01</div>
              <h4 className="text-2xl md:text-3xl font-black tracking-tighter uppercase mb-4">CONNECT</h4>
              <p className="font-bold text-xs md:text-sm tracking-widest uppercase text-gray-500 mb-6">LINK ACCOUNTS SECURELY.</p>
              <p className="text-[10px] md:text-xs text-black/60 font-bold leading-relaxed">Securely connect your financial data via encrypted channels. No credentials stored.</p>
            </div>
            <div className="px-8 md:px-10 py-12 md:py-16 hover:bg-gray-50 transition-colors">
              <div className="text-4xl font-black text-blue-600 mb-6 font-mono tracking-tighter italic opacity-80 decoration-blue-600 underline underline-offset-8">02</div>
              <h4 className="text-2xl md:text-3xl font-black tracking-tighter uppercase mb-4">ANALYZE</h4>
              <p className="font-bold text-xs md:text-sm tracking-widest uppercase text-gray-500 mb-6">AI DETECTS PATTERNS.</p>
              <p className="text-[10px] md:text-xs text-black/60 font-bold leading-relaxed">Our AI engine scans thousands of behavioral signals to build your unique trust profile.</p>
            </div>
            <div className="px-8 md:px-10 py-12 md:py-16 hover:bg-gray-50 transition-colors">
              <div className="text-4xl font-black text-blue-600 mb-6 font-mono tracking-tighter italic opacity-80 decoration-blue-600 underline underline-offset-8">03</div>
              <h4 className="text-2xl md:text-3xl font-black tracking-tighter uppercase mb-4">UNLOCK</h4>
              <p className="font-bold text-xs md:text-sm tracking-widest uppercase text-gray-500 mb-6">GET YOUR REAL SCORE.</p>
              <p className="text-[10px] md:text-xs text-black/60 font-bold leading-relaxed">Instant decisioning based on current merit, unlocking fair credit access in seconds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Secure Segment */}
      <section id="secure" className="w-full px-8 md:px-12 xl:px-24 py-24 md:py-40 bg-white border-b-[1.5px] border-black">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 lg:mb-32">
          <h2 className="text-[12vw] md:text-[6vw] lg:text-[7rem] leading-[0.85] font-black tracking-tighter uppercase mb-12 md:mb-0">
            SECURE.<br />PRIVATE.<br />ENCRYPTED.
          </h2>
          <div className="flex flex-col items-start md:items-end text-right">
            <div className="w-12 h-1 bg-blue-600 mb-6"></div>
            <div className="font-black italic text-sm md:text-base tracking-[0.2em] uppercase text-left md:text-right flex flex-col gap-2">
              <span>256-BIT SECURITY</span>
              <span>RBI COMPLIANT</span>
              <span>ISO CERTIFIED</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <div className="border-[1.5px] border-black p-6 flex items-center justify-center font-black text-[10px] md:text-xs uppercase text-black italic">BANK GRADE PROTECTION</div>
          <div className="border-[1.5px] border-black p-6 flex items-center justify-center font-black text-[10px] md:text-xs uppercase text-black italic">ENCRYPTED DATA FLOW</div>
          <div className="border-[1.5px] border-black p-6 flex items-center justify-center font-black text-[10px] md:text-xs uppercase text-black italic">ZERO KNOWLEDGE POLICY</div>
          <div className="border-[1.5px] border-black p-6 flex items-center justify-center font-black text-[10px] md:text-xs uppercase text-black italic">REGULATORY COMPLIANCE</div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="w-full py-12 md:py-20 px-8 md:px-12 xl:px-24 bg-black text-white selection:bg-white selection:text-black">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="text-4xl font-black tracking-tighter">CREDIT</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12 md:gap-24 font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase text-gray-500">
            <div className="flex flex-col gap-4">
              <span className="text-white mb-2">Product</span>
              <a href="#" className="hover:text-white">API Docs</a>
              <a href="#" className="hover:text-white">Coverage</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-white mb-2">Company</span>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Security</a>
            </div>
            <div className="flex flex-col justify-between items-start md:items-end">
              <a href="#" className="text-white border-b-2 border-white pb-1 mb-8">TWITTER / X</a>
              <div className="text-[9px] opacity-30 tracking-normal">&copy; 2026 CREDIT SYSTEMS</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}