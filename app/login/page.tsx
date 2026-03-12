'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState<string | undefined>()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [ticketMonthlyCode, setTicketMonthlyCode] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/')
    }
    checkUser()
  }, [router, supabase])

  const getCurrentMonthlyCode = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('monthly_ticket_code')
        .select('code')
        .eq('active', true)
        .maybeSingle()
      if (error || !data) return null
      return data.code
    } catch {
      return null
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    if (!phone) {
      setError("Veuillez saisir votre numéro de téléphone")
      setLoading(false)
      return
    }

    const formattedPhone = phone.startsWith('+') ? phone : '+243' + phone.replace(/^0+/, '')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password,
      })
      if (error) {
        setError("Numéro ou mot de passe incorrect.")
      } else {
        router.push('/')
      }
    } else {
      const { error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) {
        if (error.message.includes('already registered')) {
          setError("Ce numéro est déjà utilisé.")
        } else {
          setError(error.message)
        }
      } else {
        setStep('otp')
        setSuccess("Un code de vérification vous a été envoyé par SMS.")
      }
    }

    setLoading(false)
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError(null)

    if (!phone) {
      setError("Numéro de téléphone manquant")
      setLoading(false)
      return
    }

    const formattedPhone = phone.startsWith('+') ? phone : '+243' + phone.replace(/^0+/, '')

    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setError("Code OTP incorrect.")
    } else {
      await handleAutoAssignTicket()
      router.push('/')
    }
    setLoading(false)
  }

  const handleAutoAssignTicket = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ticket } = await supabase
        .from('physical_tickets')
        .select('id, draw_date')
        .eq('status', 'disponible')
        .limit(1)
        .maybeSingle()
      if (ticket) {
        await supabase.from('tickets').insert({
          id: ticket.id,
          user_id: user.id,
          numbers: [],
          draw_date: ticket.draw_date,
          status: 'joué',
          prize: 0,
          ticket_type: 'normal'
        })
        await supabase
          .from('physical_tickets')
          .update({ status: 'utilisé', sold_at: new Date().toISOString() })
          .eq('id', ticket.id)
        setSuccess("Un ticket vous a été automatiquement attribué !")
      }
    } catch (err) {
      console.error('Erreur attribution automatique de ticket:', err)
    }
  }

  const handleRegisterWithMonthlyTicketCode = async () => {
    setLoading(true)
    setError(null)

    if (!fullName.trim()) {
      setError("Veuillez saisir votre nom complet")
      setLoading(false)
      return
    }
    if (!phone) {
      setError("Veuillez saisir votre numéro de téléphone")
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      setLoading(false)
      return
    }

    const formattedPhone = phone.startsWith('+') ? phone : '+243' + phone.replace(/^0+/, '')
    const validCode = await getCurrentMonthlyCode()
    if (!validCode) {
      setError("Aucun code mensuel actif trouvé. Contactez l'administrateur.")
      setLoading(false)
      return
    }
    if (ticketMonthlyCode !== validCode) {
      setError("Code mensuel incorrect.")
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) throw signUpError

      await handleAutoAssignTicket()
      setSuccess("Compte créé avec succès ! Redirection...")
      setTimeout(() => router.push('/'), 2000)
    } catch (err: any) {
      setError("Erreur : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2">
            Bahati<span className="text-yellow-400">-Loto</span>
          </h1>
          <p className="text-yellow-200 text-lg">Connexion • Inscription</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400 rounded-xl text-white text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-400 rounded-xl text-white text-center">
              {success}
            </div>
          )}

          <div className="flex rounded-xl bg-white/5 p-1 mb-8">
            <button
              onClick={() => { setMode('login'); setStep('credentials'); setError(null); }}
              className={`flex-1 py-3 rounded-lg font-bold transition ${
                mode === 'login' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >Connexion</button>
            <button
              onClick={() => { setMode('register'); setStep('credentials'); setError(null); }}
              className={`flex-1 py-3 rounded-lg font-bold transition ${
                mode === 'register' ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >Inscription</button>
          </div>

          {step === 'credentials' && (
            <div className="space-y-5">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500"
                    placeholder="Jean Mpiana"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">Numéro de téléphone</label>
                <PhoneInput
                  international
                  defaultCountry="CD"
                  value={phone}
                  onChange={setPhone}
                  className="w-full px-4 py-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500"
                  placeholder="+243 81 234 5678"
                  limitMaxLength
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 disabled:opacity-50"
              >
                {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center text-white">
                <p className="mb-2">Un code de vérification a été envoyé à</p>
                <p className="font-bold text-xl">{phone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Code OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-4 text-center text-2xl tracking-widest bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-4 focus:ring-green-500"
                  placeholder="123456"
                />
              </div>

              <button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Vérification...' : 'Valider le code'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-white/70">Ou</span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <p className="text-white text-center mb-4">
                  Vous n'avez pas reçu le code ?<br />
                  Entrez le code à 6 chiffres du mois inscrit sur votre ticket.
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={ticketMonthlyCode}
                  onChange={e => setTicketMonthlyCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-4 text-center text-2xl tracking-widest bg-white/20 border border-white/30 rounded-xl text-white mb-4"
                  placeholder="XXXXXX"
                />
                <button
                  onClick={handleRegisterWithMonthlyTicketCode}
                  disabled={loading || ticketMonthlyCode.length !== 6}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
                >
                  {loading ? 'Création...' : "Créer mon compte avec ce code"}
                </button>
              </div>
            </div>
          )}

          {step === 'credentials' && (
            <p className="text-center text-white/70 mt-6">
              {mode === 'login' ? (
                <>Pas encore de compte ? <button onClick={() => { setMode('register'); setError(null); }} className="text-yellow-300 hover:underline font-medium">Inscrivez-vous</button></>
              ) : (
                <>Déjà inscrit ? <button onClick={() => { setMode('login'); setError(null); }} className="text-yellow-300 hover:underline font-medium">Connectez-vous</button></>
              )}
            </p>
          )}
        </div>

        <p className="text-center text-white/50 text-sm mt-6">© 2026 Bahati-Loto. Tous droits réservés.</p>
      </div>
    </div>
  )
}