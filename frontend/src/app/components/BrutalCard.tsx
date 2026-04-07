export function BrutalCard() {
  return (
    <div className="relative w-full max-w-[550px] aspect-[1.6/1] bg-white border-[3px] border-black p-6 md:p-8 flex flex-col shadow-[12px_12px_0_0_rgba(0,0,0,1)] hover:-translate-y-3 hover:-rotate-1 hover:scale-[1.02] hover:shadow-[20px_24px_0_0_rgba(0,0,0,1)] transition-all duration-500 ease-out">
      <div className="flex justify-between items-start mb-8 md:mb-12">
        <div className="border-b-[4px] border-blue-600 pb-1 inline-block">
          <span className="font-black text-2xl md:text-3xl tracking-tighter text-black uppercase">CREDIT.</span>
        </div>
        <div className="border-[2px] border-black px-2 py-1 text-[10px] md:text-xs font-bold uppercase">
          CC-01
        </div>
      </div>
      
      <div className="font-mono text-xl md:text-2xl font-bold tracking-[0.2em] mb-4 text-black w-full text-left">
        **** **** **** ****
      </div>
      <div className="font-mono text-base md:text-lg font-bold text-black mb-auto">
        0422
      </div>
      
      <div className="flex justify-between items-end border-t-[1px] border-gray-300 pt-4 md:pt-6 mt-6 md:mt-8">
        <div>
          <div className="text-[10px] md:text-xs text-gray-400 font-bold tracking-widest mb-1.5 uppercase">CARD HOLDER</div>
          <div className="font-black text-base md:text-lg text-black uppercase tracking-wide">SANJIT THOMBARE</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="w-5 h-5 md:w-6 md:h-6 bg-black" />
          <div className="text-[10px] md:text-xs font-bold text-black uppercase">03/28</div>
        </div>
      </div>
    </div>
  );
}
