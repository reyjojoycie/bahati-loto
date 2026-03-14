'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function EnregistrerTicketPage() {
  // États existants
  const [ticketId, setTicketId] = useState('')
  const [numbers, setNumbers] = useState<number[]>([])
  const [ticketType, setTicketType] = useState<'standard' | 'booster'>('standard')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [availableTypes] = useState({ standard: true, booster: true }) // Non utilisé ici

  // Nouveaux états
  const [nextDrawDate, setNextDrawDate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [ticketCheckStatus, setTicketCheckStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'used'>('idle')
  const [ticketInfo, setTicketInfo] = useState<{ draw_date: string; ticket_type: string } | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  // Vérifier l'authentification au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setIsAuthenticated(true)
      }
    }
    checkAuth()
  }, [router, supabase])

  // Charger la date du prochain tirage
  useEffect(() => {
    const loadNextDrawDate = async () => {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle()
      if (!error && data?.value) {
        setNextDrawDate(new Date(data.value))
      } else {
        setNextDrawDate(new Date('2026-03-31T19:00:00+02:00'))
      }
    }
    loadNextDrawDate()
  }, [supabase])

  // Mise à jour du compte à rebours
  useEffect(() => {
    if (!nextDrawDate) return
    const calculateCountdown = () => {
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
    calculateCountdown()
    const timer = setInterval(calculateCountdown, 1000)
    return () => clearInterval(timer)
  }, [nextDrawDate])

  // Vérification en temps réel de l'ID du ticket (quand l'utilisateur quitte le champ)
  const checkTicketId = async (id: string) => {
    if (!id.trim()) {
      setTicketCheckStatus('idle')
      setTicketInfo(null)
      return
    }
    setTicketCheckStatus('checking')
    const formattedId = id.trim().toUpperCase()
    const { data, error } = await supabase
      .from('physical_tickets')
      .select('id, status, draw_date, ticket_type')
      .eq('id', formattedId)
      .maybeSingle()

    if (error || !data) {
      setTicketCheckStatus('invalid')
      setTicketInfo(null)
    } else if (data.status !== 'disponible') {
      setTicketCheckStatus('used')
      setTicketInfo({ draw_date: data.draw_date, ticket_type: data.ticket_type })
    } else {
      setTicketCheckStatus('valid')
      setTicketInfo({ draw_date: data.draw_date, ticket_type: data.ticket_type })
    }
  }

  // Générateur aléatoire de 6 numéros uniques entre 1 et 45
  const generateRandomNumbers = () => {
    const randomSet = new Set<number>()
    while (randomSet.size < 6) {
      randomSet.add(Math.floor(Math.random() * 45) + 1)
    }
    setNumbers(Array.from(randomSet).sort((a, b) => a - b))
  }

  // Ajouter un numéro
  const addNumber = (num: number) => {
    if (numbers.length < 6 && !numbers.includes(num)) {
      setNumbers([...numbers, num].sort((a, b) => a - b))
    }
  }

  // Retirer un numéro
  const removeNumber = (num: number) => {
    setNumbers(numbers.filter(n => n !== num))
  }

  // Réinitialiser
  const clearNumbers = () => {
    setNumbers([])
  }

  // Ouvrir la modale de confirmation
  const handleConfirm = async () => {
    // Validation de base
    if (!ticketId.trim()) {
      setMessage({ type: 'error', text: 'Veuillez saisir l\'ID du ticket' })
      return
    }
    if (numbers.length !== 6) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner exactement 6 numéros' })
      return
    }
    if (ticketCheckStatus !== 'valid') {
      setMessage({ type: 'error', text: 'Le ticket n\'est pas valide ou a déjà été utilisé' })
      return
    }
    setShowConfirmModal(true)
  }

  // Soumission finale après confirmation
  const enregistrer = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setMessage({ type: 'error', text: 'Vous devez être connecté' })
        setLoading(false)
        return
      }

      const formattedId = ticketId.trim().toUpperCase()

      // Vérifier à nouveau l'état du ticket (au cas où)
      const { data: physicalTicket, error: checkError } = await supabase
        .from('physical_tickets')
        .select('id, status, draw_date, ticket_type')
        .eq('id', formattedId)
        .maybeSingle()

      if (checkError || !physicalTicket) {
        setMessage({ type: 'error', text: 'Ticket introuvable' })
        setLoading(false)
        return
      }

      if (physicalTicket.status !== 'disponible') {
        setMessage({ type: 'error', text: 'Ce ticket a déjà été utilisé' })
        setLoading(false)
        return
      }

      if (physicalTicket.ticket_type !== ticketType) {
        setMessage({
          type: 'error',
          text: `Ce ticket est de type ${physicalTicket.ticket_type === 'booster' ? 'Booster' : 'standard'}. Veuillez sélectionner le bon type.`
        })
        setLoading(false)
        return
      }

      // Enregistrer le ticket joué
      const { error: insertError } = await supabase
        .from('tickets')
        .insert({
          id: formattedId,
          user_id: session.user.id,
          numbers: numbers,
          draw_date: physicalTicket.draw_date,
          status: 'joué',
          prize: 0,
          ticket_type: ticketType,
        })

      if (insertError) {
        if (insertError.code === '23505') {
          setMessage({ type: 'error', text: 'Ce ticket est déjà enregistré' })
        } else {
          setMessage({ type: 'error', text: `Erreur : ${insertError.message}` })
        }
        setLoading(false)
        return
      }

      // Marquer le ticket physique comme utilisé
      await supabase
        .from('physical_tickets')
        .update({ status: 'utilisé', sold_at: new Date().toISOString() })
        .eq('id', formattedId)

      setMessage({
        type: 'success',
        text: `Ticket ${ticketType === 'booster' ? 'BOOSTER' : 'standard'} enregistré avec succès ! 🎉`,
      })

      // Réinitialiser le formulaire
      setTicketId('')
      setNumbers([])
      setTicketType('standard')
      setTicketCheckStatus('idle')
      setTicketInfo(null)
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Une erreur inattendue est survenue' })
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl">Redirection vers la connexion...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-indigo-950 to-black text-gray-100 font-sans selection:bg-amber-500/30 selection:text-white">
      {/* Éléments de fond */}
      <div className="fixed inset-0 bg-[url('/pattern-luxe.png')] opacity-5 pointer-events-none" />
      <div className="fixed top-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/50" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Bouton retour */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-400 hover:text-amber-400 mb-6 transition group"
        >
          <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour à l'accueil
        </Link>

        {/* Carte principale */}
        <div className="max-w-3xl mx-auto">
          {/* Compte à rebours */}
          {nextDrawDate && (
            <div className="mb-8 p-6 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-amber-500/30 text-center">
              <p className="text-amber-400 text-sm uppercase tracking-widest mb-2">Prochain tirage</p>
              <div className="text-3xl font-serif text-white">{countdown}</div>
              <p className="text-gray-400 text-sm mt-2">
                {format(nextDrawDate, "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
              </p>
            </div>
          )}

          <div className="bg-gray-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-amber-500/20">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-center text-white mb-2">
              Enregistrer mon ticket
            </h1>
            <p className="text-center text-amber-400 mb-8 italic">
              Choisissez vos 6 numéros et validez
            </p>

            {/* Message de retour */}
            {message && (
              <div
                className={`mb-6 p-4 rounded-xl text-center font-medium ${
                  message.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-200'
                    : 'bg-red-500/20 border border-red-500/30 text-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Type de ticket */}
            <div className="mb-8">
              <label className="block text-lg font-medium text-amber-300 mb-3 text-center">
                Type de ticket
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setTicketType('standard')}
                  className={`p-6 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 ${
                    ticketType === 'standard'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-2 border-amber-400 shadow-xl shadow-blue-500/30'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600'
                  }`}
                >
                  Standard
                  <span className="block text-sm mt-2 opacity-90">1 000 FC</span>
                  <span className="block text-xs mt-1 opacity-75">Jackpot 5 000 000 FC</span>
                </button>

                <button
                  onClick={() => setTicketType('booster')}
                  className={`p-6 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 ${
                    ticketType === 'booster'
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-amber-400 shadow-xl shadow-purple-500/30'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600'
                  }`}
                >
                  Booster
                  <span className="block text-sm mt-2 opacity-90">3 000 FC</span>
                  <span className="block text-xs mt-1 opacity-75">Jackpot 15 000 000 FC</span>
                </button>
              </div>
            </div>

            {/* ID du ticket avec vérification */}
            <div className="mb-8">
              <label htmlFor="ticketId" className="block text-lg font-medium text-amber-300 mb-2">
                ID du ticket physique
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="ticketId"
                  value={ticketId}
                  onChange={e => setTicketId(e.target.value.toUpperCase())}
                  onBlur={() => checkTicketId(ticketId)}
                  placeholder="ex: A3D5F6U7G4"
                  autoCapitalize="characters"
                  className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 text-lg focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                />
                {ticketCheckStatus === 'checking' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {ticketCheckStatus === 'valid' && ticketInfo && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-xl">✓</div>
                )}
                {ticketCheckStatus === 'invalid' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 text-xl">✗</div>
                )}
                {ticketCheckStatus === 'used' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 text-xl">⚠️</div>
                )}
              </div>
              {ticketCheckStatus === 'valid' && ticketInfo && (
                <p className="mt-2 text-sm text-green-400">
                  ✓ Ticket valide pour le tirage du {format(new Date(ticketInfo.draw_date), 'PPP', { locale: fr })}
                </p>
              )}
              {ticketCheckStatus === 'used' && ticketInfo && (
                <p className="mt-2 text-sm text-red-400">
                  ⚠️ Ce ticket a déjà été utilisé (tirage du {format(new Date(ticketInfo.draw_date), 'PPP', { locale: fr })})
                </p>
              )}
              {ticketCheckStatus === 'invalid' && (
                <p className="mt-2 text-sm text-red-400">✗ Ticket introuvable. Vérifiez l'ID.</p>
              )}
            </div>

            {/* Sélection des numéros */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <label className="text-lg font-medium text-amber-300">
                  Choisissez vos 6 numéros (1 à 45)
                </label>
                <div className="space-x-2">
                  <button
                    onClick={generateRandomNumbers}
                    className="text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-full transition"
                  >
                    🎲 Aléatoire
                  </button>
                  {numbers.length > 0 && (
                    <button
                      onClick={clearNumbers}
                      className="text-sm text-gray-400 hover:text-red-400 transition"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Grille des numéros */}
              <div className="grid grid-cols-5 sm:grid-cols-9 gap-2 mb-4">
                {Array.from({ length: 45 }, (_, i) => i + 1).map(num => {
                  const isSelected = numbers.includes(num)
                  return (
                    <button
                      key={num}
                      onClick={() => (isSelected ? removeNumber(num) : addNumber(num))}
                      disabled={!isSelected && numbers.length >= 6}
                      className={`
                        aspect-square rounded-lg font-bold text-lg transition-all
                        ${
                          isSelected
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black shadow-lg scale-105 border border-amber-400'
                            : numbers.length >= 6
                            ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-700'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600 hover:border-amber-500/50'
                        }
                      `}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>

              {/* Récapitulatif */}
              <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-700 text-center">
                <p className="text-amber-300 mb-2">Vos numéros :</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {numbers.length === 0 ? (
                    <span className="text-gray-400">Aucun numéro sélectionné</span>
                  ) : (
                    numbers.map(num => (
                      <span
                        key={num}
                        className="w-10 h-10 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center shadow-md"
                      >
                        {num}
                      </span>
                    ))
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {numbers.length}/6 numéros
                </p>
              </div>
            </div>

            {/* Bouton d'enregistrement */}
            <button
              onClick={handleConfirm}
              disabled={loading || numbers.length !== 6 || !ticketId.trim() || ticketCheckStatus !== 'valid'}
              className="w-full py-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-bold rounded-2xl text-xl shadow-xl shadow-amber-500/20 transition transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : `Enregistrer (${ticketType === 'booster' ? '3 000 FC' : '1 000 FC'})`}
            </button>

            {/* Note d'information */}
            <p className="text-xs text-center text-gray-400 mt-6">
              En enregistrant votre ticket, vous confirmez avoir pris connaissance du{' '}
              <button onClick={() => {}} className="text-amber-400 hover:underline">règlement du jeu</button>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 text-center text-sm text-gray-500 border-t border-gray-800 pt-8">
          <p>© {new Date().getFullYear()} Bahati-Loto Pro – Tous droits réservés. Kinshasa, RDC</p>
        </footer>
      </div>

      {/* Modale de confirmation */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl max-w-md w-full p-6 border border-amber-500/20 shadow-2xl">
            <h2 className="text-2xl font-serif font-bold text-white mb-4 text-center">Confirmez votre ticket</h2>
            <div className="space-y-3 text-gray-300">
              <p><span className="text-amber-400">ID :</span> {ticketId}</p>
              <p><span className="text-amber-400">Type :</span> {ticketType === 'booster' ? 'Booster 🔥' : 'Standard'}</p>
              <p><span className="text-amber-400">Numéros :</span> {numbers.join(' - ')}</p>
              {ticketInfo && (
                <p><span className="text-amber-400">Tirage :</span> {format(new Date(ticketInfo.draw_date), 'PPP', { locale: fr })}</p>
              )}
              <p><span className="text-amber-400">Montant :</span> {ticketType === 'booster' ? '3 000 FC' : '1 000 FC'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={enregistrer}
                disabled={loading}
                className="py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}