'use client';

import QRCode from 'react-qr-code';

interface TicketProps {
  id: string;
  otpCode: string;
  ticketType: 'standard' | 'booster';
  numbers?: number[];
  drawDate: string;
}

export default function Ticket({ id, otpCode, ticketType, numbers, drawDate }: TicketProps) {
  const ticketNumbers = numbers || Array.from({ length: 6 }, () => Math.floor(Math.random() * 45) + 1).sort((a, b) => a - b);
  const prix = ticketType === 'booster' ? '2 000 FC' : '1 000 FC';
  const gains = ticketType === 'booster'
    ? [['6/6', '15 000 000 FC'], ['5/6', '700 000 FC'], ['4/6', '25 000 FC'], ['3/6', '5 000 FC']]
    : [['6/6', '5 000 000 FC'], ['5/6', '300 000 FC'], ['4/6', '10 000 FC'], ['3/6', '2 000 FC']];

  const design = ticketType === 'booster'
    ? {
        container: 'from-[#2c1a0f] via-[#4a2c1a] to-[#6b3f2a] border-amber-600',
        badge: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white',
        accent: 'text-amber-300',
        border: 'border-amber-600/30',
        numberBg: 'bg-amber-600',
        bandeau: 'from-amber-600 to-amber-800',
      }
    : {
        container: 'from-[#0b1a2e] via-[#1a2f4a] to-[#23456b] border-blue-400',
        badge: 'bg-gradient-to-r from-blue-400 to-blue-500 text-white',
        accent: 'text-blue-300',
        border: 'border-blue-400/30',
        numberBg: 'bg-blue-500',
        bandeau: 'from-blue-500 to-blue-700',
      };

  // Motif SVG de vagues (verseau)
  const patternSvg = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 15,30 30 T60 30' stroke='%23ffffff' fill='none' stroke-width='0.5' opacity='0.3' /%3E%3C/svg%3E`;

  return (
    <div className={`relative w-[90mm] h-[130mm] bg-gradient-to-br ${design.container} text-white rounded-3xl shadow-2xl border overflow-hidden font-sans`}>
      {/* Motif de fond */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url('${patternSvg}')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '30px 30px',
          opacity: 0.15,
        }}
      />

      {/* Effet de brillance */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />

      {/* Bandeau supérieur avec motif */}
      <div className={`h-3 w-full bg-gradient-to-r ${design.bandeau} relative`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovLbc1q5mlw63yd2u2cn0hs6jnzf2gljhr486u3dkgm2yPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cGF0aCBkPSJNMjAgMjBhMTAgMTAgMCAwIDEgMTAgMTAgMTAgMTAgMCAwIDEtMTAgMTAgMTAgMTAgMCAwIDEtMTAtMTAgMTAgMTAgMCAwIDEgMTAtMTB6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-20" />
      </div>

      <div className="relative px-4 py-3 z-10">
        {/* Logo et titre */}
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-2xl font-serif font-bold tracking-wider">
            BAHATI<span className={design.accent}>-LOTO</span>
          </h1>
          <span className="text-[8px] uppercase tracking-widest bg-white/10 px-2 py-1 rounded-full">
            🇨🇩 RDC
          </span>
        </div>
        <p className="text-[9px] text-gray-300 italic border-b border-white/10 pb-2">
          {ticketType === 'booster' ? 'Puissance & Prestige' : 'Élégance & Chance'}
        </p>

        {/* Type et prix */}
        <div className="flex justify-between items-center mt-3">
          <div className={`${design.badge} text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1`}>
            {ticketType === 'booster' ? '🔥 BOOSTER' : '✨ STANDARD'}
          </div>
          <span className={`text-base font-black ${design.accent}`}>{prix}</span>
        </div>

        {/* ID et Code OTP */}
        <div className="flex justify-between items-center mt-3 text-[9px] bg-black/20 p-2 rounded-xl border border-white/10">
          <span className="font-mono">ID: {id}</span>
          <span className="font-mono bg-black/30 px-2 py-0.5 rounded-lg">OTP: {otpCode}</span>
        </div>

        {/* Date du tirage */}
        <div className="mt-3 text-center">
          <span className="text-[10px] uppercase tracking-wider text-red-400 bg-red-900/30 px-3 py-1 rounded-full">
            Tirage {drawDate}
          </span>
        </div>

        {/* Ligne décorative */}
        <div className={`relative my-3 h-px bg-gradient-to-r from-transparent via-${design.accent.replace('text-', '')} to-transparent`} />

        {/* Numéros automatiques */}
        <div className="mt-2">
          <p className="text-[9px] font-semibold text-gray-300 mb-2">✨ NUMÉROS CHANCEUX</p>
          <div className="flex gap-1.5 justify-center">
            {ticketNumbers.map((num, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full ${design.numberBg} text-white text-sm font-black flex items-center justify-center shadow-lg border border-white/30`}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* Espace pour écrire (agrandi) */}
        <div className="mt-3">
          <p className="text-[9px] font-semibold text-gray-300 mb-2">✍️ VOS NUMÉROS</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="w-9 h-9 bg-white border-2 border-gray-300 rounded-lg flex items-end justify-center text-[12px] font-bold text-gray-700 shadow-md"
              >
                {i}
              </div>
            ))}
          </div>
        </div>

        {/* Gains - Jackpot XL */}
        <div className="mt-3 text-center">
          <p className={`text-[10px] font-bold ${design.accent} mb-1`}>🎁 JACKPOT</p>
          <p className="text-xl font-black text-red-500 drop-shadow-glow">
            {gains[0][1]}
          </p>
          <div className="grid grid-cols-3 gap-1 mt-2 text-[7px] text-gray-300">
            {gains.slice(1).map(([comb, gain], idx) => (
              <div key={idx} className="bg-white/5 p-1 rounded">
                <span className="font-bold">{comb}</span>
                <span className="block">{gain}</span>
              </div>
            ))}
          </div>
        </div>

        {/* QR Code agrandi et infos */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="text-left">
            <div className="text-[6px] text-gray-400">🌐 bahati-loto.vercel.app</div>
            <div className="text-[6px] text-amber-400 mt-1">📞 +243 973 868 195</div>
            <div className="text-[5px] text-gray-500 mt-1">Jeu responsable</div>
          </div>
          <div className="flex flex-col items-end">
            <QRCode value="https://bahati-loto.vercel.app" size={45} bgColor="#1f2937" fgColor="#fbbf24" level="L" />
            <span className={`text-[6px] ${design.accent} mt-1`}>scannez</span>
          </div>
        </div>
      </div>
    </div>
  );
}