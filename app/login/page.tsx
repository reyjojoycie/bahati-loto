'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [step, setStep] = useState<'credentials' | 'otp' | 'forgot'>('credentials')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // États pour les fonctionnalités améliorées
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0) // 0-100
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    match: false,
  })

  const otpInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()
  const router = useRouter()

  // Rediriger si déjà connecté
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/')
    }
    checkUser()
  }, [router, supabase])

  // Auto-focus sur le champ OTP quand l'étape change
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus()
    }
  }, [step])

  // Gestion du compte à rebours pour renvoyer le code
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpCountdown])

  // Validation en temps réel du mot de passe
  useEffect(() => {
    if (mode === 'register') {
      setPasswordValidations({
        length: password.length >= 6,
        match: password === confirmPassword && password !== '',
      })
      // Calcul de la force du mot de passe (simple)
      let strength = 0
      if (password.length >= 6) strength += 30
      if (password.length >= 8) strength += 20
      if (/[A-Z]/.test(password)) strength += 20
      if (/[0-9]/.test(password)) strength += 15
      if (/[^A-Za-z0-9]/.test(password)) strength += 15
      setPasswordStrength(Math.min(strength, 100))
    }
  }, [password, confirmPassword, mode])

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

  // Gestion de l'envoi du formulaire (connexion / inscription initiale)
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
      // Inscription
      const { error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) {
        if (error.message.includes('already registered')) {
          setError("Ce numéro est déjà associé à un compte. Veuillez vous connecter.")
        } else {
          setError(error.message)
        }
      } else {
        setStep('otp')
        setOtpCountdown(60)
        setSuccess("Un code de vérification vous a été envoyé par SMS.")
      }
    }

    setLoading(false)
  }

  // Vérification OTP
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

  // Attribution automatique d'un ticket à l'inscription
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
          ticket_type: 'standard'
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

  // Inscription avec code mensuel (cas où l'OTP n'est pas reçu)
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
      const { error: signUpError } = await supabase.auth.signUp({
        phone: formattedPhone,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError("Ce numéro est déjà utilisé. Veuillez vous connecter.")
        } else {
          setError(signUpError.message)
        }
        setLoading(false)
        return
      }

      await handleAutoAssignTicket()
      setSuccess("Compte créé avec succès ! Redirection...")
      setTimeout(() => router.push('/'), 2000)
    } catch (err: any) {
      setError("Erreur : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Demande de réinitialisation du mot de passe
  const handleForgotPassword = async () => {
    if (!phone) {
      setError("Veuillez saisir votre numéro de téléphone")
      return
    }
    setLoading(true)
    setError(null)
    const formattedPhone = phone.startsWith('+') ? phone : '+243' + phone.replace(/^0+/, '')

    // Utiliser signInWithOtp pour envoyer un OTP de réinitialisation
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        shouldCreateUser: false, // Ne pas créer de compte si inexistant
        // Option pour indiquer que c'est une réinitialisation ? Supabase ne gère pas directement.
        // On suppose que l'utilisateur existe et on lui envoie un OTP qu'il pourra utiliser pour se connecter et changer son mot de passe.
      }
    })
    if (error) {
      setError("Erreur lors de la demande de réinitialisation.")
    } else {
      setStep('otp')
      setOtpCountdown(60)
      setSuccess("Un code de réinitialisation vous a été envoyé par SMS.")
    }
    setLoading(false)
  }

  // Renvoyer le code OTP
  const resendOtp = async () => {
    if (otpCountdown > 0) return
    setLoading(true)
    const formattedPhone = phone?.startsWith('+') ? phone : '+243' + phone?.replace(/^0+/, '')
    if (step === 'otp') {
      // Renvoyer un OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone!,
        options: { shouldCreateUser: false }
      })
      if (!error) {
        setOtpCountdown(60)
        setSuccess("Un nouveau code a été envoyé.")
      } else {
        setError("Erreur lors de l'envoi du code.")
      }
    } else if (step === 'forgot') {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone!,
        options: { shouldCreateUser: false }
      })
      if (!error) {
        setOtpCountdown(60)
        setSuccess("Un nouveau code a été envoyé.")
      } else {
        setError("Erreur lors de l'envoi du code.")
      }
    }
    setLoading(false)
  }

  // Retour à l'étape des identifiants
  const backToCredentials = () => {
    setStep('credentials')
    setOtp('')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-indigo-950 to-black text-gray-100 font-sans selection:bg-amber-500/30 selection:text-white relative overflow-hidden">
      {/* Éléments de fond */}
      <div className="absolute inset-0 bg-[url('/pattern-luxe.png')] opacity-5 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/50" />

      {/* Image de fond aspirationnelle (optionnelle) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/villa-luxe.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }} />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* Badge officiel */}
          <div className="text-center mb-6">
            <span className="inline-block bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase shadow-lg shadow-amber-500/30">
              Officiel RDC
            </span>
          </div>

          {/* Conteneur principal avec animation simple */}
          <div className="bg-gray-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-amber-500/20 transition-all duration-500 opacity-100 translate-y-0">
            <h1 className="text-4xl font-serif font-bold text-center text-white mb-2">
              Bahati-<span className="text-amber-400">Loto</span>
            </h1>
            <p className="text-center text-amber-400/80 mb-8 italic">
              {mode === 'login' ? 'Bon retour parmi nous' : 'Rejoignez la chance'}
            </p>

            {/* Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-center transition-opacity duration-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-200 text-center transition-opacity duration-300">
                {success}
              </div>
            )}

            {/* Sélecteur de mode (Connexion / Inscription) */}
            {step === 'credentials' && (
              <div className="flex rounded-xl bg-gray-700/30 p-1 mb-8 border border-gray-700">
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                    mode === 'login' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Connexion
                </button>
                <button
                  onClick={() => { setMode('register'); setError(null); }}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                    mode === 'register' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Inscription
                </button>
              </div>
            )}

            {/* Étape credentials (login ou register) */}
            {step === 'credentials' && (
              <div className="space-y-5">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-amber-300 mb-2">
                      Nom complet
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                      placeholder="Jean Mpiana"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-amber-300 mb-2">
                    Numéro de téléphone
                  </label>
                  <PhoneInput
                    international
                    defaultCountry="CD"
                    value={phone}
                    onChange={setPhone}
                    className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                    placeholder="+243 81 234 5678"
                    limitMaxLength
                    inputComponent={({ value, onChange, ...rest }) => (
                      <input
                        {...rest}
                        value={value}
                        onChange={onChange}
                        className="bg-transparent outline-none w-full"
                      />
                    )}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-amber-300 mb-2">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50 pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-400 transition"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      )}
                    </button>
                  </div>
                  {mode === 'register' && (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {passwordStrength < 30 ? 'Faible' : passwordStrength < 60 ? 'Moyen' : 'Fort'}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${passwordValidations.length ? 'text-green-400' : 'text-red-400'}`}>
                        {passwordValidations.length ? '✓ 6 caractères minimum' : '✗ 6 caractères minimum'}
                      </p>
                    </>
                  )}
                </div>

                {mode === 'register' && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-amber-300 mb-2">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50 pr-12"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-400 transition"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                    <p className={`text-xs mt-1 ${passwordValidations.match ? 'text-green-400' : 'text-red-400'}`}>
                      {passwordValidations.match ? '✓ Mots de passe identiques' : '✗ Mots de passe différents'}
                    </p>
                  </div>
                )}

                {/* Case "Se souvenir de moi" pour la connexion */}
                {mode === 'login' && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
                      />
                      Se souvenir de moi
                    </label>
                    <button
                      onClick={() => setStep('forgot')}
                      className="text-sm text-amber-400 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {/* Bouton principal */}
                <button
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    (mode === 'register' && (!passwordValidations.length || !passwordValidations.match)) ||
                    !phone
                  }
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg shadow-amber-500/30 transition transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Chargement...</span>
                    </>
                  ) : (
                    mode === 'login' ? 'Se connecter' : "S'inscrire"
                  )}
                </button>

                {/* Message marketing pour l'inscription */}
                {mode === 'register' && (
                  <div className="mt-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-center">
                    <p className="text-amber-300 font-bold flex items-center justify-center gap-2">
                      <span>🎁</span> Inscrivez-vous aujourd'hui et recevez
                    </p>
                    <p className="text-white text-2xl font-serif">1 ticket GRATUIT</p>
                    <p className="text-xs text-gray-400 mt-1">pour le prochain tirage</p>
                  </div>
                )}
              </div>
            )}

            {/* Étape OTP (vérification) */}
            {step === 'otp' && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-300 mb-2">Un code de vérification a été envoyé à</p>
                  <p className="font-bold text-xl text-amber-400">{phone}</p>
                </div>

                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-amber-300 mb-2">
                    Code OTP
                  </label>
                  <input
                    ref={otpInputRef}
                    id="otp"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-4 text-center text-2xl tracking-widest bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                    placeholder="123456"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={resendOtp}
                    disabled={otpCountdown > 0 || loading}
                    className="text-sm text-amber-400 hover:underline disabled:text-gray-500 disabled:no-underline"
                  >
                    {otpCountdown > 0 ? `Renvoyer dans ${otpCountdown}s` : 'Renvoyer le code'}
                  </button>
                  <button
                    onClick={backToCredentials}
                    className="text-sm text-gray-400 hover:text-amber-400"
                  >
                    Modifier le numéro
                  </button>
                </div>

                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl shadow-lg transition transform hover:scale-105 disabled:opacity-50"
                >
                  {loading ? 'Vérification...' : 'Valider le code'}
                </button>

                {/* Option code mensuel */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-800/50 text-gray-400">Ou</span>
                  </div>
                </div>

                <div className="bg-gray-700/30 rounded-xl p-6 border border-amber-500/20">
                  <p className="text-white text-center mb-4">
                    Vous n'avez pas reçu le code ?<br />
                    Entrez le <span className="text-amber-400 font-bold">code à 6 chiffres</span> du mois inscrit sur votre ticket.
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={ticketMonthlyCode}
                    onChange={e => setTicketMonthlyCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-4 text-center text-2xl tracking-widest bg-gray-700/50 border border-gray-600 rounded-xl text-white mb-4 focus:outline-none focus:ring-4 focus:ring-amber-500/50"
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

            {/* Étape Mot de passe oublié */}
            {step === 'forgot' && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-300 mb-2">Un code de réinitialisation sera envoyé à</p>
                  <p className="font-bold text-xl text-amber-400">{phone || 'votre numéro'}</p>
                </div>

                <div>
                  <label htmlFor="forgotPhone" className="block text-sm font-medium text-amber-300 mb-2">
                    Numéro de téléphone
                  </label>
                  <PhoneInput
                    international
                    defaultCountry="CD"
                    value={phone}
                    onChange={setPhone}
                    className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                    placeholder="+243 81 234 5678"
                    limitMaxLength
                  />
                </div>

                <button
                  onClick={handleForgotPassword}
                  disabled={loading || !phone}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-black font-bold rounded-xl shadow-lg transition transform hover:scale-105 disabled:opacity-50"
                >
                  {loading ? 'Envoi...' : 'Envoyer le code'}
                </button>

                <button
                  onClick={backToCredentials}
                  className="w-full text-sm text-gray-400 hover:text-amber-400"
                >
                  Retour à la connexion
                </button>
              </div>
            )}

            {/* Pied de page avec preuve sociale */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                + de 10 000 parieurs à Kinshasa nous font confiance
              </p>
              <p className="text-xs text-gray-600 mt-2">© 2026 Bahati-Loto. Tous droits réservés.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}