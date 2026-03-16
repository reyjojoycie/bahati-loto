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

  // Motif de fond
  const patternSvg = `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 15,30 30 T60 30' stroke='%23ffffff' fill='none' stroke-width='0.5' opacity='0.3' /%3E%3C/svg%3E`;

  return (
    <div className={`relative w-[90mm] h-[130mm] bg-gradient-to-br ${design.container} text-white rounded-3xl shadow-2xl border overflow-hidden font-sans flex flex-col`}>
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

      {/* Bandeau supérieur */}
      <div className={`h-2 w-full bg-gradient-to-r ${design.bandeau} flex-shrink-0`} />

      {/* Contenu principal - flex-1 pour occuper l'espace */}
      <div className="flex-1 flex flex-col px-3 py-2 relative z-10 overflow-hidden">
        {/* Logo et titre */}
        <div className="flex justify-between items-center mb-0.5">
          <h1 className="text-xl font-serif font-bold tracking-wider">
            VESTA<span className={design.accent}>-LOTO</span>
          </h1>
          <span className="text-[6px] uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded-full">
            🇨🇩 RDC
          </span>
        </div>
        <p className="text-[7px] text-gray-300 italic border-b border-white/10 pb-1">
          {ticketType === 'booster' ? 'Puissance & Prestige' : 'Élégance & Chance'}
        </p>

        {/* Type et prix */}
        <div className="flex justify-between items-center mt-2">
          <div className={`${design.badge} text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-0.5`}>
            {ticketType === 'booster' ? '🔥 BOOSTER' : '✨ STANDARD'}
          </div>
          <span className={`text-sm font-black ${design.accent}`}>{prix}</span>
        </div>

        {/* ID et Code OTP */}
        <div className="flex justify-between items-center mt-2 text-[8px] bg-black/20 p-1.5 rounded-lg border border-white/10">
          <span className="font-mono">ID: {id}</span>
          <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded-md">OTP: {otpCode}</span>
        </div>

        {/* Date du tirage */}
        <div className="mt-2 text-center">
          <span className="text-[8px] uppercase tracking-wider text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
            Tirage {drawDate}
          </span>
        </div>

        {/* Ligne décorative */}
        <div className={`my-1.5 h-px bg-gradient-to-r from-transparent via-${design.accent.replace('text-', '')} to-transparent`} />

        {/* Numéros automatiques */}
        <div className="mt-1">
          <p className="text-[7px] font-semibold text-gray-300 mb-1">✨ NUMÉROS CHANCEUX</p>
          <div className="flex gap-1 justify-center">
            {ticketNumbers.map((num, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full ${design.numberBg} text-white text-xs font-black flex items-center justify-center shadow-md border border-white/30`}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* Espace pour écrire */}
        <div className="mt-2">
          <p className="text-[7px] font-semibold text-gray-300 mb-1">✍️ VOS NUMÉROS</p>
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="w-7 h-7 bg-white border border-gray-300 rounded-md flex items-end justify-center text-[10px] font-bold text-gray-700 shadow-sm"
              >
                {i}
              </div>
            ))}
          </div>
        </div>

        {/* Gains */}
        <div className="mt-2 text-center">
          <p className={`text-[8px] font-bold ${design.accent} mb-0.5`}>🎁 JACKPOT</p>
          <p className="text-lg font-black text-red-500 leading-tight">
            {gains[0][1]}
          </p>
          <div className="grid grid-cols-3 gap-0.5 mt-1 text-[6px] text-gray-300">
            {gains.slice(1).map(([comb, gain], idx) => (
              <div key={idx} className="bg-white/5 p-0.5 rounded">
                <span className="font-bold">{comb}</span>
                <span className="block">{gain}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COMMENT JOUER ? */}
        <div className="mt-2">
          <p className={`text-[8px] font-bold ${design.accent} mb-0.5`}>📋 COMMENT JOUER ?</p>
          <ol className="text-[6px] text-gray-300 list-decimal list-inside space-y-0.5">
            <li>Scannez le QR code</li>
            <li>Rendez-vous sur bahati-loto.vercel.app</li>
            <li>Choisissez vos 6 numéros</li>
            <li>Validez et tentez votre chance</li>
          </ol>
        </div>

        {/* QR Code et infos - en bas avec flex */}
        <div className="mt-auto flex items-end justify-between pt-1">
          <div className="text-left">
            <div className="text-[5px] text-gray-400">🌐 bahati-loto.vercel.app</div>
            <div className="text-[5px] text-amber-400 mt-0.5">📞 +243 973 868 195</div>
            <div className="text-[4px] text-gray-500 mt-0.5">Jeu responsable</div>
          </div>
          <div className="flex flex-col items-end">
            <QRCode value="https://bahati-loto.vercel.app" size={40} bgColor="#1f2937" fgColor="#fbbf24" level="L" />
            <span className={`text-[5px] ${design.accent} mt-0.5`}>scannez</span>
          </div>
        </div>
      </div>
    </div>
  );
}