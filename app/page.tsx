'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState<string>('')
  const [tickets, setTickets] = useState<any[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [lastDraw, setLastDraw] = useState<any>(null)
  const [historicalDraws, setHistoricalDraws] = useState<any[]>([])
  const [drawsMap, setDrawsMap] = useState<Map<string, any>>(new Map())
  const [nextDrawDate, setNextDrawDate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)

  const supabase = createClient()

  const calculateCountdown = () => {
    if (!nextDrawDate) return
    const now = new Date()
    const diff = nextDrawDate.getTime() - now.getTime()
    if (diff <= 0) {
      setCountdown('Tirage en cours ou terminé !')
      return
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    setCountdown(`${days}j ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`)
  }

  const countMatches = (ticketNumbers: number[], winning: number[]) => {
    return ticketNumbers.filter(n => winning.includes(n)).length
  }

  const calculatePrize = (matches: number, ticketType: 'standard' | 'booster') => {
    if (ticketType === 'booster') {
      if (matches === 6) return 15000000
      if (matches === 5) return 700000
      if (matches === 4) return 25000
      if (matches === 3) return 5000
      return 0
    } else {
      if (matches === 6) return 5000000
      if (matches === 5) return 300000
      if (matches === 4) return 10000
      if (matches === 3) return 2000
      return 0
    }
  }

  const fetchDrawWinners = async (drawId: string) => {
    // À remplacer par un vrai appel Supabase
    return {
      winners_3: Math.floor(Math.random() * 50),
      winners_4: Math.floor(Math.random() * 20),
      winners_5: Math.floor(Math.random() * 5),
      winners_6: Math.floor(Math.random() * 2)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      if (session?.user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('balance, full_name')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profileErr) throw new Error('Erreur chargement profil')
        setBalance(profile?.balance || 0)
        setUserName(profile?.full_name || '')

        const { data: ticketsData, error: ticketsErr } = await supabase
          .from('tickets')
          .select('*')
          .eq('user_id', session.user.id)
          .order('draw_date', { ascending: false })
        if (ticketsErr) throw new Error('Erreur chargement tickets')
        setTickets(ticketsData || [])

        const { data: lastDrawData, error: lastDrawErr } = await supabase
          .from('draws')
          .select('*')
          .order('draw_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastDrawErr) throw new Error('Erreur chargement dernier tirage')
        setLastDraw(lastDrawData || null)

        const { data: histData, error: histErr } = await supabase
          .from('draws')
          .select('*')
          .order('draw_date', { ascending: false })
          .range(1, 5)
        if (histErr) throw new Error('Erreur chargement historique')

        if (histData) {
          const enriched = await Promise.all(histData.map(async (draw) => {
            const winners = await fetchDrawWinners(draw.id)
            return { ...draw, ...winners }
          }))
          setHistoricalDraws(enriched)
        } else {
          setHistoricalDraws([])
        }

        const allDraws = [lastDrawData, ...(histData || [])].filter(Boolean)
        const map = new Map()
        allDraws.forEach(draw => map.set(draw.draw_date, draw))
        setDrawsMap(map)
      }

      const { data: drawDateData, error: drawDateErr } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle()
      if (drawDateErr) throw new Error('Erreur chargement date tirage')
      
      if (drawDateData?.value) {
        setNextDrawDate(new Date(drawDateData.value))
      } else {
        setNextDrawDate(new Date('2026-03-31T19:00:00+02:00'))
      }

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Impossible de charger les données. Veuillez rafraîchir.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!nextDrawDate) return
    const timer = setInterval(calculateCountdown, 1000)
    calculateCountdown()
    return () => clearInterval(timer)
  }, [nextDrawDate])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'PPP', { locale: fr })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern-luxe.png')] opacity-5" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-20 h-20 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin shadow-2xl" />
          <div className="text-amber-400 text-2xl font-serif tracking-widest animate-pulse">
            Vesta Loto
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-indigo-950 to-black text-gray-100 font-sans selection:bg-amber-500/30 selection:text-white">
      {/* Éléments de fond */}
      <div className="fixed inset-0 bg-[url('/pattern-luxe.png')] opacity-5 pointer-events-none" />
      <div className="fixed top-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/50" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header Premium */}
        <header className="text-center mb-20 relative">
          <button
            onClick={() => setShowHelpModal(true)}
            className="absolute top-2 right-0 md:right-4 bg-white/5 hover:bg-amber-500/20 text-gray-400 hover:text-amber-300 rounded-full p-4 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:scale-110 group"
            aria-label="Aide"
          >
            <span className="text-xl group-hover:scale-110 inline-block transition-transform">💡</span>
          </button>
          <div className="inline-block mb-4">
            <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase shadow-lg shadow-amber-500/30">
              Officiel RDC
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-serif font-black mb-4 tracking-tight text-white">
            Vesta-<span className="bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Loto</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-light italic">
            Le prochain millionnaire, c'est peut-être vous.
          </p>
        </header>

        {/* Compte à rebours - Design Luxe */}
        <div className="relative mb-24 max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-gray-800/50 via-gray-900/50 to-black/50 backdrop-blur-xl rounded-[3rem] p-10 border border-amber-500/20 shadow-2xl shadow-amber-500/5 text-center transform hover:scale-[1.02] transition-all duration-700">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-8 py-3 rounded-full text-sm font-bold tracking-widest uppercase shadow-lg shadow-amber-500/50">
              Prochain Tirage
            </div>
            <div className="text-5xl md:text-7xl font-serif font-light tracking-widest text-white mt-8 mb-6">
              {countdown}
            </div>
            <div className="inline-flex items-center justify-center gap-2 bg-black/30 backdrop-blur-sm px-8 py-4 rounded-2xl text-amber-300 font-medium border border-amber-500/30">
              <span>📅</span>
              {nextDrawDate ? format(nextDrawDate, "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'Date non définie'}
            </div>
          </div>
        </div>

        {/* Tableau des gains - Prestige */}
        <div className="grid md:grid-cols-2 gap-8 mb-24 max-w-5xl mx-auto">
          {/* Carte Standard */}
          <div className="group relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-[2.5rem] p-8 border border-amber-500/10 shadow-2xl hover:border-amber-500/30 transition-all duration-500 hover:shadow-amber-500/10">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/20 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-serif font-bold text-white">Standard</h3>
                  <p className="text-gray-400 mt-1">L'essentiel pour gagner</p>
                </div>
                <span className="bg-gradient-to-br from-amber-500 to-amber-600 text-black text-2xl font-bold px-6 py-3 rounded-2xl shadow-lg">1 000 FC</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                  <span className="text-amber-300 font-medium">Jackpot (6/6)</span>
                  <span className="text-2xl font-bold text-amber-400">5 000 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-amber-500/10">
                  <span className="text-gray-300">5 Numéros</span>
                  <span className="text-xl font-semibold text-white">300 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-amber-500/10">
                  <span className="text-gray-300">4 Numéros</span>
                  <span className="text-xl font-semibold text-white">10 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-gray-300">3 Numéros</span>
                  <span className="text-xl font-semibold text-white">2 000 FC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Carte Booster */}
          <div className="group relative bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent backdrop-blur-lg rounded-[2.5rem] p-8 border border-amber-500/30 shadow-2xl hover:border-amber-400 transition-all duration-500 hover:shadow-amber-500/20">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2.5rem] opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-serif font-bold text-white flex items-center gap-2">
                    Booster <span className="text-3xl">🔥</span>
                  </h3>
                  <p className="text-amber-300/80 mt-1">Multipliez vos chances</p>
                </div>
                <span className="bg-gradient-to-br from-amber-400 to-amber-500 text-black text-2xl font-bold px-6 py-3 rounded-2xl shadow-lg shadow-amber-500/30">3 000 FC</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 bg-amber-500/10 rounded-2xl border border-amber-500/40">
                  <span className="text-amber-200 font-medium">Super Jackpot (6/6)</span>
                  <span className="text-2xl font-bold text-amber-400">15 000 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-amber-500/20">
                  <span className="text-gray-300">5 Numéros</span>
                  <span className="text-xl font-semibold text-white">700 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-amber-500/20">
                  <span className="text-gray-300">4 Numéros</span>
                  <span className="text-xl font-semibold text-white">25 000 FC</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-gray-300">3 Numéros</span>
                  <span className="text-xl font-semibold text-white">5 000 FC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border-l-4 border-red-500 text-red-200 p-6 rounded-r-xl mb-12 shadow-lg max-w-2xl mx-auto flex items-center gap-4 backdrop-blur-sm">
            <span className="text-2xl">⚠️</span>
            <p className="font-medium">{error}</p>
          </div>
        )}

        {user ? (
          <div className="space-y-20">
            {/* Carte Membre VIP */}
            <div className="relative group bg-gradient-to-br from-gray-800/60 via-gray-900/60 to-black/60 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 border border-amber-500/20 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 text-center md:text-left">
                <p className="text-amber-400 text-sm uppercase tracking-widest font-bold mb-2">Espace Joueur</p>
                <h2 className="text-3xl md:text-4xl font-serif text-white mb-1">{userName || 'Membre Vesta'}</h2>
                <p className="text-gray-400">{user.phone}</p>
              </div>
              
              <div className="relative z-10 bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-amber-500/20 text-center min-w-[250px]">
                <p className="text-amber-300 text-sm uppercase tracking-widest mb-2">Solde Actuel</p>
                <p className="text-4xl md:text-5xl font-bold text-white">
                  {balance.toLocaleString()} <span className="text-2xl text-amber-400 font-medium">FC</span>
                </p>
              </div>
            </div>

            {/* Actions Rapides - Boutons Prestige */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Link
                href="/enregistrer-ticket"
                className="group relative col-span-2 lg:col-span-1 bg-gradient-to-br from-amber-500 to-amber-600 text-black font-bold py-6 px-4 rounded-2xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🎫</div>
                <span>Jouer un ticket</span>
              </Link>
              <button
                onClick={loadData}
                className="group bg-gray-800/50 backdrop-blur-sm text-gray-200 font-medium py-6 px-4 rounded-2xl border border-gray-700 hover:border-amber-500/30 hover:bg-gray-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center text-2xl text-amber-400 group-hover:rotate-180 transition-transform duration-500">🔄</div>
                <span>Actualiser</span>
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="group bg-gray-800/50 backdrop-blur-sm text-gray-200 font-medium py-6 px-4 rounded-2xl border border-gray-700 hover:border-amber-500/30 hover:bg-gray-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center text-2xl text-amber-400 group-hover:scale-110 transition-transform">📖</div>
                <span>Comment jouer</span>
              </button>
              <button
                onClick={logout}
                className="group bg-gray-800/50 backdrop-blur-sm text-gray-200 font-medium py-6 px-4 rounded-2xl border border-gray-700 hover:border-red-500/30 hover:bg-red-500/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center text-2xl text-red-400 group-hover:scale-110 transition-transform">🚪</div>
                <span>Déconnexion</span>
              </button>
            </div>

            {/* Dernier tirage */}
            {lastDraw && (
              <section className="relative bg-gradient-to-br from-gray-800/50 via-gray-900/50 to-black/50 backdrop-blur-xl rounded-[2.5rem] p-10 border border-amber-500/20 shadow-2xl text-center">
                <span className="inline-block bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase mb-4 shadow-lg">
                  Résultat Officiel
                </span>
                <p className="text-xl text-gray-400 font-medium mb-10">{formatDate(lastDraw.draw_date)}</p>
                
                <div className="flex justify-center gap-3 md:gap-5 flex-wrap mb-10">
                  {lastDraw.winning_numbers.map((num: number, idx: number) => (
                    <div key={idx} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-4 border-amber-500/50 shadow-2xl flex items-center justify-center text-2xl md:text-3xl font-black text-amber-400 transform hover:scale-110 hover:border-amber-400 transition-all cursor-default">
                      {num}
                    </div>
                  ))}
                </div>
                
                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 inline-block min-w-[300px] border border-amber-500/20">
                  <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Jackpot Remporté</p>
                  <p className="text-3xl font-bold text-white">
                    {lastDraw.jackpot?.toLocaleString() || '5 000 000'} <span className="text-amber-400">FC</span>
                  </p>
                </div>
              </section>
            )}

            {/* Mes tickets */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-serif font-bold text-white">Mes Tickets</h2>
                <span className="bg-amber-500/20 text-amber-300 px-4 py-1 rounded-full text-sm font-bold border border-amber-500/30">{tickets.length}</span>
              </div>

              {tickets.length === 0 ? (
                <div className="relative bg-gray-800/30 backdrop-blur-sm rounded-[2rem] p-16 text-center border border-dashed border-amber-500/20">
                  <div className="text-6xl mb-4 opacity-30">🎫</div>
                  <p className="text-xl text-gray-400 mb-8 font-medium">Vous n'avez pas encore joué pour ce tirage.</p>
                  <Link
                    href="/enregistrer-ticket"
                    className="inline-block bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium py-4 px-8 rounded-full shadow-lg hover:shadow-amber-500/30 hover:-translate-y-1 transition-all"
                  >
                    Tenter ma chance
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {tickets.map(ticket => {
                    const draw = drawsMap.get(ticket.draw_date)
                    const matches = draw ? countMatches(ticket.numbers, draw.winning_numbers) : null
                    const prize = draw ? calculatePrize(matches!, ticket.ticket_type) : 0
                    const isPast = draw ? true : false
                    const isUpcoming = !draw && new Date(ticket.draw_date) > new Date()
                    const isBooster = ticket.ticket_type === 'booster'

                    return (
                      <div
                        key={ticket.id}
                        className={`group relative bg-gray-800/30 backdrop-blur-sm rounded-3xl p-6 md:p-8 border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                          isBooster ? 'border-amber-500/30 hover:border-amber-400' : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 blur transition-opacity" />
                        <div className="relative">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <span className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">ID: {ticket.id.slice(-8)}</span>
                              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                isBooster ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-gray-700 text-gray-300'
                              }`}>
                                {isBooster ? '🔥 Booster' : 'Standard'}
                              </span>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                              ticket.status === 'joué' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          
                          <p className="text-gray-300 font-medium mb-4 flex items-center gap-2">
                            <span className="text-lg">📅</span> {formatDate(ticket.draw_date)}
                          </p>
                          
                          <div className="flex flex-wrap gap-2 mb-8">
                            {ticket.numbers.map((num: number, i: number) => (
                              <span key={i} className="w-10 h-10 rounded-full bg-gray-700/50 text-gray-200 text-sm font-bold flex items-center justify-center border border-gray-600 shadow-sm">
                                {num}
                              </span>
                            ))}
                          </div>

                          {isPast && draw && (
                            <div className={`rounded-2xl p-4 text-center border ${prize > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-700/30 border-gray-600'}`}>
                              <p className="text-sm text-gray-400 mb-1 font-medium">{matches} numéro(s) gagnant(s)</p>
                              <p className={`text-xl font-bold ${prize > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                {prize > 0 ? `${prize.toLocaleString()} FC` : 'Aucun gain'}
                              </p>
                            </div>
                          )}
                          {isUpcoming && (
                            <div className="bg-amber-500/10 rounded-2xl p-4 text-center border border-amber-500/30">
                              <p className="text-amber-300 font-medium flex items-center justify-center gap-2">
                                <span className="animate-pulse">⏳</span> En attente du tirage
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Historique */}
            {historicalDraws.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-white mb-8">Archives des tirages</h2>
                <div className="space-y-4">
                  {historicalDraws.map(draw => (
                    <div key={draw.id} className="relative bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-amber-500/20 transition-colors flex flex-col lg:flex-row items-center justify-between gap-6">
                      <div className="text-center lg:text-left min-w-[200px]">
                        <p className="text-lg text-white font-bold">{formatDate(draw.draw_date)}</p>
                        <p className="text-sm text-amber-400 font-medium mt-1">Jackpot: {draw.jackpot?.toLocaleString() || '5 000 000'} FC</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {draw.winning_numbers.map((num: number, i: number) => (
                          <span key={i} className="w-10 h-10 rounded-full bg-gray-700 text-amber-400 font-bold flex items-center justify-center border border-amber-500/30">
                            {num}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-6 text-sm text-center bg-black/30 rounded-xl p-3 border border-gray-700">
                        <div>
                          <p className="font-bold text-gray-400 text-xs uppercase">6/6</p>
                          <p className="font-bold text-amber-400">{draw.winners_6 ?? 0}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-400 text-xs uppercase">5/6</p>
                          <p className="font-bold text-amber-400">{draw.winners_5 ?? 0}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-400 text-xs uppercase">4/6</p>
                          <p className="font-bold text-amber-400">{draw.winners_4 ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          // Landing pour non connectés
          <div className="py-24 text-center relative z-10">
            <div className="relative bg-gradient-to-br from-gray-800/50 via-gray-900/50 to-black/50 backdrop-blur-xl rounded-[3rem] p-12 md:p-20 border border-amber-500/20 shadow-2xl max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">
                La chance n'attend plus que <span className="text-amber-400">vous.</span>
              </h2>
              <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
                Rejoignez la plateforme officielle Vesta-Loto. Enregistrez vos tickets, suivez les tirages et retirez vos gains en toute sécurité.
              </p>
              <Link
                href="/login"
                className="inline-block bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-5 px-12 rounded-full text-lg shadow-xl shadow-amber-500/30 hover:scale-105 hover:shadow-amber-500/50 transition-all duration-300"
              >
                Connectez-vous pour jouer
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-32 pt-10 border-t border-gray-800 text-center">
          <div className="flex flex-wrap justify-center gap-8 mb-8 text-sm font-medium text-gray-400">
            <button onClick={() => setShowRulesModal(true)} className="hover:text-amber-400 transition-colors">Conditions Générales</button>
            <button onClick={() => setShowHelpModal(true)} className="hover:text-amber-400 transition-colors">Comment jouer</button>
            <a href="https://www.facebook.com/share/172QncYbmL/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Facebook</a>
            <a href="https://wa.me/243973868195" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">Service Client WhatsApp</a>
          </div>
          <p className="text-gray-500 text-sm mb-2">© {new Date().getFullYear()} Vesta-Loto Pro. Tous droits réservés à Kinshasa, RDC.</p>
          <p className="text-gray-600 text-xs uppercase tracking-widest font-bold">Jeu responsable • Interdit aux mineurs</p>
        </footer>
      </div>

      {/* Floating Action Buttons - Version Luxe */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-40">
        <a
          href="https://www.facebook.com/share/172QncYbmL/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/80 backdrop-blur-sm border border-amber-500/30 text-amber-400 rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-amber-500/20 transition-all duration-300 hover:scale-110 hover:border-amber-400 group"
          aria-label="Facebook"
        >
          <svg className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a
          href="https://wa.me/243973868195"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-tr from-green-500 to-emerald-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all duration-300 hover:scale-110 group"
          aria-label="WhatsApp"
        >
          <svg className="w-7 h-7 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        </a>
      </div>

      {/* Modale d'aide */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowHelpModal(false)}>
          <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-2xl w-full p-8 md:p-12 border border-amber-500/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-serif font-bold mb-8 text-white border-b border-amber-500/30 pb-4">Guide du Joueur</h2>
            <div className="space-y-6 text-gray-300">
              <div className="flex gap-4"><span className="text-amber-500 font-bold bg-amber-500/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">1</span><p><strong className="text-white">Enregistrez votre ticket</strong> : Saisissez l'ID et le code OTP de votre ticket physique.</p></div>
              <div className="flex gap-4"><span className="text-amber-500 font-bold bg-amber-500/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">2</span><p><strong className="text-white">Choisissez vos numéros</strong> : 6 numéros entre 1 et 49. Optez pour le système aléatoire si vous vous sentez chanceux.</p></div>
              <div className="flex gap-4"><span className="text-amber-500 font-bold bg-amber-500/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">3</span><p><strong className="text-white">Rechargement</strong> : Directement via Mobile Money (M-Pesa, Orange, Airtel).</p></div>
              <div className="flex gap-4"><span className="text-amber-500 font-bold bg-amber-500/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">4</span><p><strong className="text-white">Résultats</strong> : Les tirages hebdomadaires sont notifiés directement sur la plateforme.</p></div>
              <div className="flex gap-4"><span className="text-amber-500 font-bold bg-amber-500/10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">5</span><p><strong className="text-white">Gains</strong> : Crédités automatiquement, retirables rapidement sur votre Mobile Money.</p></div>
            </div>
            <button onClick={() => setShowHelpModal(false)} className="mt-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale des règles */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowRulesModal(false)}>
          <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-2xl w-full p-8 md:p-12 border border-amber-500/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-serif font-bold mb-8 text-white border-b border-amber-500/30 pb-4">Conditions Générales</h2>
            <div className="space-y-4 text-sm text-gray-300 max-h-[50vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-amber-500/30 scrollbar-track-transparent">
              <p><strong className="text-white">1. Éligibilité</strong> : L'application est strictement réservée aux personnes majeures (18+).</p>
              <p><strong className="text-white">2. Sécurité des Tickets</strong> : L'ID et l'OTP sont uniques. Vesta-Loto décline toute responsabilité en cas de perte du ticket physique.</p>
              <p><strong className="text-white">3. Transactions</strong> : Dépôts et retraits gérés via les réseaux certifiés (M-Pesa, Orange, Airtel).</p>
              <p><strong className="text-white">4. Tirages</strong> : Générés de manière transparente. Les résultats publiés font autorité.</p>
              <p><strong className="text-white">5. Retraits</strong> : Disponibles dès 2 000 FC avec les frais de réseau applicables.</p>
              <p><strong className="text-white">6. Confidentialité</strong> : Vos données sont chiffrées et protégées.</p>
            </div>
            <button onClick={() => setShowRulesModal(false)} className="mt-8 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all">
              J'accepte les conditions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}