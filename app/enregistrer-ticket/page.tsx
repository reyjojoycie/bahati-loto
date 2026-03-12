'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EnregistrerTicketPage() {
  const [ticketId, setTicketId] = useState('')
  const [numbers, setNumbers] = useState<number[]>([])
  const [ticketType, setTicketType] = useState<'standard' | 'booster'>('standard')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [availableTypes, setAvailableTypes] = useState<{ standard: boolean; booster: boolean }>({
    standard: true,
    booster: true,
  })

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

  // Ajouter un numéro à la sélection
  const addNumber = (num: number) => {
    if (numbers.length < 6 && !numbers.includes(num)) {
      setNumbers([...numbers, num].sort((a, b) => a - b))
    }
  }

  // Retirer un numéro de la sélection
  const removeNumber = (num: number) => {
    setNumbers(numbers.filter(n => n !== num))
  }

  // Réinitialiser la sélection
  const clearNumbers = () => {
    setNumbers([])
  }

  // Vérifier la disponibilité du ticket avant soumission (optionnel, peut être fait dans la soumission)
  // Soumission du formulaire
  const enregistrer = async () => {
    // Validation
    if (!ticketId.trim()) {
      setMessage({ type: 'error', text: 'Veuillez saisir l\'ID du ticket' })
      return
    }
    if (numbers.length !== 6) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner exactement 6 numéros' })
      return
    }

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

      // Vérifier que le ticket physique existe et est disponible
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

      // Vérifier que le type sélectionné correspond au type du ticket physique
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Bouton retour */}
        <Link
          href="/"
          className="inline-flex items-center text-white mb-6 hover:text-yellow-300 transition group"
        >
          <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour à l'accueil
        </Link>

        {/* Carte principale */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">
          <h1 className="text-3xl md:text-4xl font-bold text-center text-white mb-2">
            🎟️ Enregistrer mon ticket
          </h1>
          <p className="text-center text-yellow-200 mb-8">
            Choisissez vos 6 numéros et validez
          </p>

          {/* Message de retour */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl text-center font-medium ${
                message.type === 'success'
                  ? 'bg-green-500/20 border border-green-400 text-green-100'
                  : 'bg-red-500/20 border border-red-400 text-red-100'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Type de ticket */}
          <div className="mb-8">
            <label className="block text-lg font-medium text-white mb-3 text-center">
              Type de ticket
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setTicketType('standard')}
                className={`p-6 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 ${
                  ticketType === 'standard'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-2 border-white shadow-xl'
                    : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                }`}
              >
                standard
                <span className="block text-sm font-standard mt-2 opacity-90">1 000 FC</span>
                <span className="block text-xs mt-1 opacity-75">Jackpot 5 000 000 FC</span>
              </button>

              <button
                onClick={() => setTicketType('booster')}
                className={`p-6 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 ${
                  ticketType === 'booster'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-2 border-white shadow-xl'
                    : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                }`}
              >
                Booster
                <span className="block text-sm font-standard mt-2 opacity-90">3 000 FC</span>
                <span className="block text-xs mt-1 opacity-75">Jackpot 15 000 000 FC</span>
              </button>
            </div>
          </div>

          {/* ID du ticket */}
          <div className="mb-8">
            <label htmlFor="ticketId" className="block text-lg font-medium text-white mb-2">
              ID du ticket physique
            </label>
            <input
              type="text"
              id="ticketId"
              value={ticketId}
              onChange={e => setTicketId(e.target.value.toUpperCase())}
              placeholder="ex: A3D5F6U7G4"
              className="w-full px-4 py-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 text-lg focus:outline-none focus:ring-4 focus:ring-blue-500"
            />
          </div>

          {/* Sélection des numéros */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <label className="text-lg font-medium text-white">
                Choisissez vos 6 numéros (1 à 45)
              </label>
              {numbers.length > 0 && (
                <button
                  onClick={clearNumbers}
                  className="text-sm text-yellow-300 hover:text-yellow-400 transition"
                >
                  Effacer tout
                </button>
              )}
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
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-105'
                          : numbers.length >= 6
                          ? 'bg-white/10 text-white/30 cursor-not-allowed'
                          : 'bg-white/20 text-white hover:bg-white/30 active:bg-white/40'
                      }
                    `}
                  >
                    {num}
                  </button>
                )
              })}
            </div>

            {/* Récapitulatif des numéros sélectionnés */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-white mb-2">Vos numéros :</p>
              <div className="flex flex-wrap justify-center gap-2">
                {numbers.length === 0 ? (
                  <span className="text-white/50">Aucun numéro sélectionné</span>
                ) : (
                  numbers.map(num => (
                    <span
                      key={num}
                      className="w-10 h-10 rounded-full bg-yellow-500 text-gray-900 font-bold flex items-center justify-center"
                    >
                      {num}
                    </span>
                  ))
                )}
              </div>
              <p className="text-sm text-white/70 mt-2">
                {numbers.length}/6 numéros
              </p>
            </div>
          </div>

          {/* Bouton d'enregistrement */}
          <button
            onClick={enregistrer}
            disabled={loading || numbers.length !== 6 || !ticketId.trim()}
            className="w-full py-5 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-xl shadow-xl transition transform hover:scale-105 disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : `Enregistrer (${ticketType === 'booster' ? '3 000 FC' : '1 000 FC'})`}
          </button>

          {/* Note d'information */}
          <p className="text-xs text-center text-white/50 mt-6">
            En enregistrant votre ticket, vous confirmez avoir pris connaissance du règlement du jeu.
          </p>
        </div>
      </div>
    </div>
  )
}