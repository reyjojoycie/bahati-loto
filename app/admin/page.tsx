'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [winningNumbers, setWinningNumbers] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [winners, setWinners] = useState<any[]>([])
  const [monthlyCode, setMonthlyCode] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [soldTickets, setSoldTickets] = useState<any[]>([])
  const [availableTickets, setAvailableTickets] = useState<any[]>([])
  const [generateCount, setGenerateCount] = useState<number>(20000)
  const [generateDrawDate, setGenerateDrawDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [generateType, setGenerateType] = useState<'normal' | 'booster'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // États pour la date du prochain tirage
  const [nextDrawDate, setNextDrawDate] = useState<string>('')
  const [drawDateLoading, setDrawDateLoading] = useState(false)

  const supabase = createClient()
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'bahati2026'

  // Vérifier la session au chargement
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setCheckingAuth(false)
    }
    checkSession()
  }, [])

  // Charger toutes les données
  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Tickets vendus
      const { data: sold, error: soldErr } = await supabase
        .from('tickets')
        .select('*, profiles(full_name, phone), ticket_type')
      if (soldErr) throw soldErr
      setSoldTickets(sold || [])

      // Tickets disponibles
      const { data: available, error: availErr } = await supabase
        .from('physical_tickets')
        .select('*')
        .eq('status', 'disponible')
      if (availErr) throw availErr
      setAvailableTickets(available || [])

      // Code mensuel actif
      const { data: codeData, error: codeErr } = await supabase
        .from('monthly_ticket_code')
        .select('code')
        .eq('active', true)
        .maybeSingle()
      if (codeErr) throw codeErr
      setMonthlyCode(codeData?.code || '')

      // Tous les profils
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
      if (usersErr) throw usersErr
      setUsers(usersData || [])

      // Date du prochain tirage
      const { data: drawDateData, error: drawDateErr } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle()
      if (drawDateErr) throw drawDateErr
      if (drawDateData?.value) {
        // Formater pour l'input datetime-local (YYYY-MM-DDTHH:mm)
        const date = new Date(drawDateData.value)
        const formatted = format(date, "yyyy-MM-dd'T'HH:mm")
        setNextDrawDate(formatted)
      } else {
        // Valeur par défaut si absente
        setNextDrawDate('2026-03-31T19:00')
      }
    } catch (err: any) {
      setError('Erreur chargement des données : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Connexion admin (mot de passe uniquement)
  const loginAdmin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true)
      loadAllData()
    } else {
      setError('Mot de passe admin incorrect')
    }
  }

  // Mettre à jour le code mensuel
  const updateMonthlyCode = async () => {
    if (!/^\d{6}$/.test(monthlyCode)) {
      setError('Le code doit être exactement 6 chiffres')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      // Désactiver l'ancien code
      await supabase
        .from('monthly_ticket_code')
        .update({ active: false })
        .eq('active', true)
      // Insérer le nouveau
      const { error } = await supabase
        .from('monthly_ticket_code')
        .insert({
          code: monthlyCode,
          month_year: format(new Date(), 'yyyy-MM'),
          active: true,
        })
      if (error) throw error
      setSuccess('Code mensuel mis à jour avec succès')
    } catch (err: any) {
      setError("Erreur lors de la mise à jour : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Mettre à jour la date du prochain tirage
  const updateNextDrawDate = async () => {
    setDrawDateLoading(true)
    setError(null)
    setSuccess(null)
    try {
      // Convertir la date locale en format ISO
      const dateObj = new Date(nextDrawDate)
      const isoString = dateObj.toISOString()

      const { error } = await supabase
        .from('config')
        .upsert({ key: 'next_draw_date', value: isoString }, { onConflict: 'key' })
      if (error) throw error
      setSuccess('Date du prochain tirage mise à jour')
    } catch (err: any) {
      setError('Erreur : ' + err.message)
    } finally {
      setDrawDateLoading(false)
    }
  }

  // Valider un tirage
  const validerTirage = async () => {
    if (new Set(winningNumbers).size !== 6 || winningNumbers.some(n => n < 1 || n > 45)) {
      setError('Les 6 numéros doivent être uniques et compris entre 1 et 45')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: tickets, error: ticketsErr } = await supabase
        .from('tickets')
        .select('id, numbers, ticket_type, profiles(full_name, phone)')
      if (ticketsErr) throw ticketsErr

      const calculated = tickets
        ?.map(ticket => {
          const matches = ticket.numbers.filter((n: number) => winningNumbers.includes(n)).length
          let prize = 0
          if (ticket.ticket_type === 'booster') {
            if (matches === 6) prize = 15000000
            else if (matches === 5) prize = 700000
            else if (matches === 4) prize = 25000
            else if (matches === 3) prize = 5000
          } else {
            if (matches === 6) prize = 5000000
            else if (matches === 5) prize = 300000
            else if (matches === 4) prize = 10000
            else if (matches === 3) prize = 2000
          }
          return { ...ticket, matches, prize, rang: matches + '/6' }
        })
        .filter(t => t.prize > 0) || []
      setWinners(calculated)
      setSuccess(`Tirage validé ! ${calculated.length} gagnant(s) trouvé(s).`)
    } catch (err: any) {
      setError('Erreur lors du calcul des gagnants : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Générer des tickets en masse
  const generateTickets = async () => {
    if (generateCount < 1 || generateCount > 50000) {
      setError('Le nombre doit être entre 1 et 50 000')
      return
    }
    if (!generateDrawDate) {
      setError('Veuillez choisir une date de tirage')
      return
    }
    if (!confirm(`Générer ${generateCount} tickets ${generateType === 'booster' ? 'BOOSTER' : 'NORMAL'} ? Cette action est irréversible.`)) {
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      // Récupérer le code mensuel actif
      const { data: codeData, error: codeErr } = await supabase
        .from('monthly_ticket_code')
        .select('code')
        .eq('active', true)
        .maybeSingle()
      if (codeErr) throw codeErr
      if (!codeData) throw new Error('Aucun code mensuel actif trouvé. Veuillez d\'abord définir un code.')
      const code = codeData.code

      const tickets = []
      for (let i = 0; i < generateCount; i++) {
        const randomId = Math.random().toString(36).substring(2, 12).toUpperCase()
        tickets.push({
          id: randomId,
          draw_date: generateDrawDate,
          status: 'disponible',
          otp_code: code,
          ticket_type: generateType,
        })
      }

      // Insertion par lots de 1000
      for (let i = 0; i < tickets.length; i += 1000) {
        const batch = tickets.slice(i, i + 1000)
        const { error: insertErr } = await supabase.from('physical_tickets').insert(batch)
        if (insertErr) throw insertErr
      }

      setSuccess(`${generateCount} tickets ${generateType.toUpperCase()} générés avec succès.`)

      // Télécharger le CSV
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        'id,draw_date,status,otp_code,ticket_type\n' +
        tickets.map(t => `${t.id},${t.draw_date},${t.status},${t.otp_code},${t.ticket_type}`).join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `tickets_${generateType}_${generateCount}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      await loadAllData()
    } catch (err: any) {
      setError('Erreur génération : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Supprimer un utilisateur
  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Supprimer définitivement l'utilisateur ${userName} et tous ses tickets ?`)) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await supabase.from('tickets').delete().eq('user_id', userId)
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
      setSuccess('Utilisateur supprimé')
      await loadAllData()
    } catch (err: any) {
      setError('Erreur suppression : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Supprimer tous les tickets (zone dangereuse)
  const deleteAllTickets = async () => {
    if (!confirm('⚠️ Êtes-vous absolument sûr de vouloir supprimer TOUS les tickets (physiques et enregistrés) ? Cette action est définitive.')) return
    if (!confirm('Dernière confirmation : vous allez perdre toutes les données de tickets. Continuer ?')) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Supprimer tous les tickets enregistrés
      const { error: deleteTicketsError } = await supabase
        .from('tickets')
        .delete()
        .neq('id', '0')
      if (deleteTicketsError) throw deleteTicketsError

      // Supprimer tous les tickets physiques
      const { error: deletePhysicalError } = await supabase
        .from('physical_tickets')
        .delete()
        .neq('id', '0')
      if (deletePhysicalError) throw deletePhysicalError

      setSuccess('Tous les tickets ont été supprimés avec succès.')
      await loadAllData()
    } catch (err: any) {
      setError('Erreur lors de la suppression : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(
    u =>
      (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm)
  )

  const formatNumber = (num: number) => num.toLocaleString('fr-CD')
  const totalRevenue = soldTickets.reduce((acc, t) => acc + (t.ticket_type === 'booster' ? 3000 : 1000), 0)

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">Vérification...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
          <h1 className="text-4xl font-bold text-center text-white mb-8">🔐 Espace Admin</h1>
          {error && (
            <div className="bg-red-500/20 border border-red-400 text-white p-4 rounded-xl mb-6 text-center">
              {error}
            </div>
          )}
          <p className="text-white/70 text-center mb-4">
            Veuillez entrer le mot de passe administrateur.
          </p>
          <input
            type="password"
            placeholder="Mot de passe admin"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            className="w-full p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 text-xl mb-6 focus:outline-none focus:ring-4 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && loginAdmin()}
          />
          <button
            onClick={loginAdmin}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl text-xl shadow-lg transition transform hover:scale-105"
          >
            Accéder à l'administration
          </button>
        </div>
      </div>
    )
  }

  // Interface admin principale
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Bahati-Loto Admin
          </h1>
          <div className="flex gap-4">
            {session && (
              <span className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm">
                Connecté: {session.user?.phone}
              </span>
            )}
            <button
              onClick={() => setIsAdmin(false)}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-xl mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-800 font-bold">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-xl mb-6 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-800 font-bold">✕</button>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Tickets vendus" value={soldTickets.length} color="blue" />
          <StatCard label="Booster vendus" value={soldTickets.filter(t => t.ticket_type === 'booster').length} color="purple" />
          <StatCard label="Standard vendus" value={soldTickets.filter(t => t.ticket_type === 'normal').length} color="green" />
          <StatCard label="Disponibles" value={availableTickets.length} color="orange" />
          <StatCard label="Revenu total" value={totalRevenue.toLocaleString() + ' FC'} color="yellow" />
        </div>

        {/* Prochain tirage */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">📅 Prochain tirage</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="datetime-local"
              value={nextDrawDate}
              onChange={e => setNextDrawDate(e.target.value)}
              className="flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={updateNextDrawDate}
              disabled={drawDateLoading}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {drawDateLoading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </div>

        {/* Code mensuel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">📅 Code mensuel du ticket</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              maxLength={6}
              value={monthlyCode}
              onChange={e => setMonthlyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 chiffres"
              className="flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-xl text-2xl text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={updateMonthlyCode}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </div>

        {/* Génération de tickets */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">🎟️ Générer des tickets physiques</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input
                type="number"
                min="1"
                max="50000"
                value={generateCount}
                onChange={e => setGenerateCount(parseInt(e.target.value) || 0)}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date tirage</label>
              <input
                type="date"
                value={generateDrawDate}
                onChange={e => setGenerateDrawDate(e.target.value)}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={generateType}
                onChange={e => setGenerateType(e.target.value as 'normal' | 'booster')}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
              >
                <option value="normal">Normal</option>
                <option value="booster">Booster</option>
              </select>
            </div>
            <button
              onClick={generateTickets}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Génération...' : 'Générer et exporter CSV'}
            </button>
          </div>
        </div>

        {/* Validation tirage */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">🎲 Valider un tirage</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {winningNumbers.map((num, idx) => (
              <input
                key={idx}
                type="number"
                min="1"
                max="45"
                value={num || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value)
                  const newNums = [...winningNumbers]
                  newNums[idx] = val
                  setWinningNumbers(newNums)
                }}
                className="p-4 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
                placeholder="N°"
              />
            ))}
          </div>
          <button
            onClick={validerTirage}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-xl text-xl shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Calcul en cours...' : 'Valider le tirage et voir les gagnants'}
          </button>
        </div>

        {/* Liste des gagnants */}
        {winners.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-green-300 dark:border-green-700">
            <h2 className="text-2xl font-bold mb-4 text-green-700 dark:text-green-300">🏆 Gagnants ({winners.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Téléphone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rang</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gain</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {winners.map((w, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-mono text-sm">{w.id}</td>
                      <td className="px-4 py-3">{w.profiles?.full_name || '—'}</td>
                      <td className="px-4 py-3">{w.profiles?.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          w.ticket_type === 'booster' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {w.ticket_type === 'booster' ? 'BOOSTER' : 'NORMAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{w.rang}</td>
                      <td className="px-4 py-3 font-bold text-green-600">{formatNumber(w.prize)} FC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gestion des utilisateurs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">👥 Utilisateurs</h2>
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-xl mb-6 bg-white dark:bg-gray-700"
          />
          {filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun utilisateur trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Téléphone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">{user.full_name || '—'}</td>
                      <td className="px-4 py-3">{user.phone}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteUser(user.id, user.full_name || user.phone)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Zone dangereuse - Suppression massive */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-red-200 dark:border-red-800 mt-8">
          <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">⚠️ Zone dangereuse</h2>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Supprimer définitivement tous les tickets physiques et enregistrés. Cette action est irréversible.
          </p>
          <button
            onClick={deleteAllTickets}
            disabled={loading}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Suppression...' : '🗑️ Supprimer tous les tickets'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Composant pour les cartes de statistiques
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    yellow: 'from-yellow-500 to-yellow-600',
  }[color]

  return (
    <div className={`bg-gradient-to-br ${colorClasses} rounded-2xl shadow-lg p-6 text-white`}>
      <p className="text-sm opacity-90 mb-2">{label}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  )
}