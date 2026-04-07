import React from 'react';

export const FloatingCoin: React.FC = () => {
  return (
    <div className="hidden lg:flex fixed right-[15%] top-1/2 -translate-y-1/2 z-0 pointer-events-none">
      <div 
        className="relative w-32 h-32 md:w-48 md:h-48 rounded-full bg-white border-[1.5px] border-black flex items-center justify-center animate-float pointer-events-auto cursor-pointer group transition-transform duration-500 hover:scale-105"
        style={{
          boxShadow: '0 0 40px rgba(13, 110, 253, 0.4)',
        }}
      >
        <span className="text-5xl md:text-7xl font-black text-black select-none group-hover:rotate-12 transition-transform duration-500">₹</span>
        
        {/* Subtle inner ring */}
        <div className="absolute inset-2 border border-black/5 rounded-full" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};
