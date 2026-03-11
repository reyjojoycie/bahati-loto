'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [lastDraw, setLastDraw] = useState<any>(null)
  const [historicalDraws, setHistoricalDraws] = useState<any[]>([])
  const [drawsMap, setDrawsMap] = useState<Map<string, any>>(new Map())
  const [nextDrawDate, setNextDrawDate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Calcul du compte à rebours (utilise nextDrawDate)
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

  // Compter les correspondances
  const countMatches = (ticketNumbers: number[], winning: number[]) => {
    return ticketNumbers.filter(n => winning.includes(n)).length
  }

  // Calculer le gain selon le type
  const calculatePrize = (matches: number, ticketType: 'normal' | 'booster') => {
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

  // Charger toutes les données
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      if (session?.user) {
        // Profil utilisateur
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profileErr) throw new Error('Erreur chargement profil')
        setBalance(profile?.balance || 0)

        // Tickets de l'utilisateur
        const { data: ticketsData, error: ticketsErr } = await supabase
          .from('tickets')
          .select('*')
          .eq('user_id', session.user.id)
          .order('draw_date', { ascending: false })
        if (ticketsErr) throw new Error('Erreur chargement tickets')
        setTickets(ticketsData || [])

        // Dernier tirage
        const { data: lastDrawData, error: lastDrawErr } = await supabase
          .from('draws')
          .select('*')
          .order('draw_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastDrawErr) throw new Error('Erreur chargement dernier tirage')
        setLastDraw(lastDrawData || null)

        // Historique (5 tirages précédents)
        const { data: histData, error: histErr } = await supabase
          .from('draws')
          .select('*')
          .order('draw_date', { ascending: false })
          .range(1, 5)
        if (histErr) throw new Error('Erreur chargement historique')
        setHistoricalDraws(histData || [])

        // Construire une map date -> tirage
        const allDraws = [lastDrawData, ...(histData || [])].filter(Boolean)
        const map = new Map()
        allDraws.forEach(draw => map.set(draw.draw_date, draw))
        setDrawsMap(map)
      }

      // Charger la date du prochain tirage depuis la table config
      const { data: drawDateData, error: drawDateErr } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle()
      if (drawDateErr) throw new Error('Erreur chargement date tirage')
      if (drawDateData?.value) {
        setNextDrawDate(new Date(drawDateData.value))
      } else {
        // Date par défaut si non définie
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

  // Mettre à jour le compte à rebours chaque seconde quand nextDrawDate est disponible
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-4xl font-bold animate-pulse">Bahati-Loto se réveille...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 text-white">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("/pattern-rdc.png")' }} />

      <div className="relative max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-green-300 to-blue-300">
              Bahati-Loto
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-yellow-200 font-light">
            🇨🇩 Le loto qui rend riche à Kinshasa 🇨🇩
          </p>
        </header>

        {/* Compte à rebours */}
        <div className="relative mb-16">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-3xl blur-2xl opacity-50" />
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-2 border-white/20 shadow-2xl text-center">
            <h2 className="text-3xl font-bold mb-4 text-yellow-200">Prochain tirage dans</h2>
            <div className="text-5xl md:text-7xl font-mono font-black tracking-widest text-white drop-shadow-glow">
              {countdown}
            </div>
            <p className="text-xl mt-6 text-gray-200">
              {nextDrawDate ? format(nextDrawDate, "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr }) : 'Date non définie'}
            </p>
          </div>
        </div>

        {/* Tableau des gains */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 shadow-2xl border border-blue-400 transform hover:scale-105 transition">
            <h3 className="text-3xl font-bold mb-4 text-center">🎟️ Ticket Normal</h3>
            <p className="text-xl text-center mb-4">1 000 FC</p>
            <div className="space-y-3">
              <div className="flex justify-between text-lg"><span>6/6</span><span className="font-bold text-yellow-300">5 000 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>5/6</span><span className="font-bold text-yellow-300">300 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>4/6</span><span className="font-bold text-yellow-300">10 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>3/6</span><span className="font-bold text-yellow-300">2 000 FC</span></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-pink-700 rounded-3xl p-6 shadow-2xl border border-purple-400 transform hover:scale-105 transition">
            <h3 className="text-3xl font-bold mb-4 text-center">🔥 Ticket Booster</h3>
            <p className="text-xl text-center mb-4">3 000 FC</p>
            <div className="space-y-3">
              <div className="flex justify-between text-lg"><span>6/6</span><span className="font-bold text-yellow-300">15 000 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>5/6</span><span className="font-bold text-yellow-300">700 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>4/6</span><span className="font-bold text-yellow-300">25 000 FC</span></div>
              <div className="flex justify-between text-lg"><span>3/6</span><span className="font-bold text-yellow-300">5 000 FC</span></div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400 text-white p-4 rounded-2xl mb-8 text-center">
            {error}
          </div>
        )}

        {user ? (
          <div className="space-y-12">
            {/* Carte utilisateur */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <p className="text-2xl opacity-80">Bienvenue,</p>
                  <p className="text-4xl font-bold">{user.phone}</p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-2xl">Solde</p>
                  <p className="text-5xl font-extrabold text-yellow-300">
                    {balance.toLocaleString()} <span className="text-xl">FC</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/enregistrer-ticket"
                className="group bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-6 rounded-2xl text-xl text-center shadow-xl transition transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300"
              >
                <span className="block text-3xl mb-2">🎟️</span>
                Enregistrer un ticket
              </Link>
              <button
                onClick={loadData}
                className="group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-6 rounded-2xl text-xl shadow-xl transition transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
              >
                <span className="block text-3xl mb-2">🔄</span>
                Rafraîchir
              </button>
              <button
                onClick={logout}
                className="group bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-6 rounded-2xl text-xl shadow-xl transition transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300"
              >
                <span className="block text-3xl mb-2">🚪</span>
                Déconnexion
              </button>
            </div>

            {/* Dernier tirage */}
            {lastDraw && (
              <section className="bg-gradient-to-br from-yellow-600/30 to-orange-600/30 backdrop-blur-lg rounded-3xl p-8 border border-yellow-400/50 shadow-2xl">
                <h2 className="text-4xl font-bold text-center mb-6 text-yellow-200">🎲 Dernier tirage</h2>
                <p className="text-2xl text-center mb-4">{formatDate(lastDraw.draw_date)}</p>
                <div className="flex justify-center gap-4 flex-wrap mb-6">
                  {lastDraw.winning_numbers.map((num: number, idx: number) => (
                    <span key={idx} className="w-16 h-16 rounded-full bg-white text-indigo-900 text-3xl font-black flex items-center justify-center shadow-lg">
                      {num}
                    </span>
                  ))}
                </div>
                <p className="text-2xl text-center">
                  Jackpot : <span className="font-bold text-yellow-300">{lastDraw.jackpot?.toLocaleString() || '5 000 000'} FC</span>
                </p>
              </section>
            )}

            {/* Mes tickets */}
            <section>
              <h2 className="text-4xl font-bold mb-8 text-center">🎫 Mes tickets ({tickets.length})</h2>
              {tickets.length === 0 ? (
                <div className="bg-white/5 backdrop-blur rounded-3xl p-16 text-center border border-white/10">
                  <p className="text-2xl mb-6">Vous n'avez encore aucun ticket enregistré.</p>
                  <Link
                    href="/enregistrer-ticket"
                    className="inline-block bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold py-5 px-10 rounded-2xl text-xl shadow-xl hover:scale-105 transition"
                  >
                    Enregistrer mon premier ticket →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tickets.map(ticket => {
                    const draw = drawsMap.get(ticket.draw_date)
                    const matches = draw ? countMatches(ticket.numbers, draw.winning_numbers) : null
                    const prize = draw ? calculatePrize(matches!, ticket.ticket_type) : 0
                    const isPast = draw ? true : false
                    const isUpcoming = !draw && new Date(ticket.draw_date) > new Date()

                    return (
                      <div
                        key={ticket.id}
                        className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-sm font-mono opacity-60">#{ticket.id.slice(-8)}</span>
                          <span className={`px-4 py-1 rounded-full text-sm font-bold ${
                            ticket.status === 'joué' ? 'bg-yellow-500/50 text-yellow-100' : 'bg-green-500/50 text-green-100'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-2xl font-bold mb-2">📅 {formatDate(ticket.draw_date)}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {ticket.numbers.map((num: number, i: number) => (
                            <span key={i} className="w-10 h-10 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center">
                              {num}
                            </span>
                          ))}
                        </div>
                        <p className="text-lg mb-2">
                          Type : <span className="font-bold uppercase">{ticket.ticket_type === 'booster' ? '🔥 Booster' : 'Normal'}</span>
                        </p>
                        {isPast && draw && (
                          <div className="bg-black/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold mb-1">{matches} bon(s) numéro(s)</p>
                            <p className="text-3xl font-extrabold text-green-300">
                              {prize > 0 ? `${prize.toLocaleString()} FC` : '─'}
                            </p>
                          </div>
                        )}
                        {isUpcoming && (
                          <div className="bg-indigo-900/50 rounded-xl p-4 text-center">
                            <p className="text-xl">Tirage à venir</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Historique des tirages */}
            {historicalDraws.length > 0 && (
              <section>
                <h2 className="text-4xl font-bold mb-8 text-center">📜 Historique des tirages</h2>
                <div className="space-y-6">
                  {historicalDraws.map(draw => (
                    <div key={draw.id} className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                      <p className="text-2xl font-bold mb-4">{formatDate(draw.draw_date)}</p>
                      <div className="flex justify-center gap-3 flex-wrap mb-6">
                        {draw.winning_numbers.map((num: number, i: number) => (
                          <span key={i} className="w-12 h-12 rounded-full bg-yellow-500 text-gray-900 text-2xl font-black flex items-center justify-center">
                            {num}
                          </span>
                        ))}
                      </div>
                      <p className="text-lg text-center opacity-80">
                        Jackpot : {draw.jackpot?.toLocaleString() || '5 000 000'} FC
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          // Utilisateur non connecté
          <div className="text-center py-24">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-2xl mx-auto border border-white/20">
              <p className="text-3xl mb-8">Connectez-vous pour jouer et gagner gros !</p>
              <Link
                href="/login"
                className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-extrabold py-6 px-12 rounded-2xl text-3xl shadow-2xl hover:scale-105 transition transform"
              >
                Se connecter
              </Link>
            </div>
          </div>
        )}

        <footer className="mt-20 text-center text-sm opacity-60 border-t border-white/10 pt-8">
          <p>© {new Date().getFullYear()} Bahati-Loto – Tous droits réservés. Kinshasa, RDC</p>
          <p className="mt-2">Jouez responsable. La loterie est interdite aux mineurs.</p>
        </footer>
      </div>
    </div>
  )
}