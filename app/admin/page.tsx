'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

// Imports conditionnels pour les bibliothèques optionnelles (Excel/PDF)
let XLSX: any, jsPDF: any, autoTable: any
try {
  XLSX = require('xlsx')
  jsPDF = require('jspdf').default
  autoTable = require('jspdf-autotable').default
} catch (e) {
  console.warn('Certaines bibliothèques ne sont pas installées. Les fonctionnalités d\'export seront désactivées.')
}

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
  const [generateType, setGenerateType] = useState<'standard' | 'booster'>('standard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)

  // États pour la date du prochain tirage
  const [nextDrawDate, setNextDrawDate] = useState<string>('')
  const [drawDateLoading, setDrawDateLoading] = useState(false)

  // États pour les logs d'audit
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)

  // États pour les bannières
  const [banners, setBanners] = useState<any[]>([])
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerUploading, setBannerUploading] = useState(false)

  // États pour les dépôts manuels
  const [selectedUserId, setSelectedUserId] = useState('')
  const [depositAmount, setDepositAmount] = useState<number>(0)
  const [depositLoading, setDepositLoading] = useState(false)

  // États pour la pagination des utilisateurs
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage] = useState(20)

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
    setDataLoaded(false)
    try {
      // Tickets vendus
      const { data: sold, error: soldErr } = await supabase
        .from('tickets')
        .select('*, profiles(full_name, phone), ticket_type')
        .order('id', { ascending: false })
      if (soldErr) throw new Error(`Erreur tickets vendus: ${soldErr.message}`)
      setSoldTickets(sold || [])

      // Tickets disponibles
      const { data: available, error: availErr } = await supabase
        .from('physical_tickets')
        .select('*')
        .eq('status', 'disponible')
      if (availErr) throw new Error(`Erreur tickets disponibles: ${availErr.message}`)
      setAvailableTickets(available || [])

      // Code mensuel actif
      const { data: codeData, error: codeErr } = await supabase
        .from('monthly_ticket_code')
        .select('code')
        .eq('active', true)
        .maybeSingle()
      if (codeErr) throw new Error(`Erreur code mensuel: ${codeErr.message}`)
      setMonthlyCode(codeData?.code || '')

      // Tous les profils
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone, balance, created_at')
        .order('created_at', { ascending: false })
      if (usersErr) throw new Error(`Erreur profils: ${usersErr.message}`)
      setUsers(usersData || [])

      // Date du prochain tirage
      const { data: drawDateData, error: drawDateErr } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle()
      if (drawDateErr) throw new Error(`Erreur config: ${drawDateErr.message}`)
      if (drawDateData?.value) {
        const date = new Date(drawDateData.value)
        const formatted = format(date, "yyyy-MM-dd'T'HH:mm")
        setNextDrawDate(formatted)
      } else {
        setNextDrawDate('2026-03-31T19:00')
      }

      // Logs d'audit
      const { data: logsData, error: logsErr } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (logsErr) throw new Error(`Erreur logs: ${logsErr.message}`)
      setLogs(logsData || [])

      // Bannières
      const { data: bannersData, error: bannersErr } = await supabase
        .from('banners')
        .select('*')
        .order('created_at', { ascending: false })
      if (bannersErr) throw new Error(`Erreur bannières: ${bannersErr.message}`)
      setBanners(bannersData || [])

      setDataLoaded(true)
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  // Ajouter un log d'audit
  const addLog = async (action: string, details: any) => {
    try {
      await supabase.from('admin_logs').insert({
        admin_id: session?.user?.id,
        action,
        details: JSON.stringify(details),
      })
    } catch (err) {
      console.error('Erreur lors de l’ajout du log', err)
    }
  }

  // Connexion admin
  const loginAdmin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true)
      loadAllData()
      addLog('ADMIN_LOGIN', { method: 'password' })
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
      addLog('UPDATE_MONTHLY_CODE', { newCode: monthlyCode })
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
      const dateObj = new Date(nextDrawDate)
      const isoString = dateObj.toISOString()

      const { error } = await supabase
        .from('config')
        .upsert({ key: 'next_draw_date', value: isoString }, { onConflict: 'key' })
      if (error) throw error
      setSuccess('Date du prochain tirage mise à jour')
      addLog('UPDATE_DRAW_DATE', { newDate: isoString })
    } catch (err: any) {
      setError('Erreur : ' + err.message)
    } finally {
      setDrawDateLoading(false)
    }
  }

  // Valider un tirage (avec double confirmation)
  const confirmAndValidateDraw = () => {
    if (new Set(winningNumbers).size !== 6 || winningNumbers.some(n => n < 1 || n > 45)) {
      setError('Les 6 numéros doivent être uniques et compris entre 1 et 45')
      return
    }
    if (!confirm('⚠️ Êtes-vous sûr de vouloir valider ce tirage ? Cette action calculera les gains de tous les tickets et est irréversible.')) return
    if (!confirm('Dernière confirmation : les résultats seront publiés. Continuer ?')) return
    validerTirage()
  }

  const validerTirage = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: tickets, error: ticketsErr } = await supabase
        .from('tickets')
        .select('id, user_id, numbers, ticket_type, profiles(full_name, phone)')
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

      // Mettre à jour les soldes des gagnants
      for (const winner of calculated) {
        await supabase.rpc('add_to_balance', { user_id: winner.user_id, amount: winner.prize })
      }

      setSuccess(`Tirage validé ! ${calculated.length} gagnant(s) trouvé(s).`)
      addLog('DRAW_VALIDATED', { winningNumbers, winnersCount: calculated.length })
    } catch (err: any) {
      setError('Erreur lors du calcul des gagnants : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Générer des tickets en masse (utilise la fonction RPC pour contourner RLS)
  const generateTickets = async () => {
    if (generateCount < 1 || generateCount > 50000) {
      setError('Le nombre doit être entre 1 et 50 000')
      return
    }
    if (!generateDrawDate) {
      setError('Veuillez choisir une date de tirage')
      return
    }
    if (!confirm(`Générer ${generateCount} tickets ${generateType === 'booster' ? 'BOOSTER' : 'STANDARD'} ? Cette action est irréversible.`)) {
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
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

      // Appel à la fonction RPC pour insérer en masse
      const { error: rpcError } = await supabase.rpc('insert_physical_tickets', {
        tickets: tickets
      })

      if (rpcError) throw rpcError

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

      addLog('GENERATE_TICKETS', { count: generateCount, type: generateType, drawDate: generateDrawDate })
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
      addLog('DELETE_USER', { userId, userName })
      await loadAllData()
    } catch (err: any) {
      setError('Erreur suppression : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Supprimer tous les tickets
  const deleteAllTickets = async () => {
    if (!confirm('⚠️ Êtes-vous absolument sûr de vouloir supprimer TOUS les tickets (physiques et enregistrés) ? Cette action est définitive.')) return
    if (!confirm('Dernière confirmation : vous allez perdre toutes les données de tickets. Continuer ?')) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: deleteTicketsError } = await supabase
        .from('tickets')
        .delete()
        .neq('id', '0')
      if (deleteTicketsError) throw deleteTicketsError

      const { error: deletePhysicalError } = await supabase
        .from('physical_tickets')
        .delete()
        .neq('id', '0')
      if (deletePhysicalError) throw deletePhysicalError

      setSuccess('Tous les tickets ont été supprimés avec succès.')
      addLog('DELETE_ALL_TICKETS', {})
      await loadAllData()
    } catch (err: any) {
      setError('Erreur lors de la suppression : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Exporter les gagnants en Excel (uniquement si XLSX est disponible)
  const exportWinnersToExcel = () => {
    if (!XLSX) {
      setError('La bibliothèque XLSX n’est pas installée.')
      return
    }
    if (winners.length === 0) {
      setError('Aucun gagnant à exporter')
      return
    }
    const wsData = winners.map(w => ({
      ID: w.id,
      Nom: w.profiles?.full_name || '',
      Téléphone: w.profiles?.phone || '',
      Type: w.ticket_type === 'booster' ? 'Booster' : 'Standard',
      Rang: w.rang,
      Gain: w.prize,
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gagnants')
    XLSX.writeFile(wb, `gagnants_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  // Exporter les gagnants en PDF (uniquement si jsPDF est disponible)
  const exportWinnersToPDF = () => {
    if (!jsPDF || !autoTable) {
      setError('La bibliothèque jsPDF n’est pas installée.')
      return
    }
    if (winners.length === 0) {
      setError('Aucun gagnant à exporter')
      return
    }
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Liste des gagnants', 14, 22)
    const tableColumn = ['ID', 'Nom', 'Téléphone', 'Type', 'Rang', 'Gain']
    const tableRows = winners.map(w => [
      w.id,
      w.profiles?.full_name || '',
      w.profiles?.phone || '',
      w.ticket_type === 'booster' ? 'Booster' : 'Standard',
      w.rang,
      w.prize + ' FC',
    ])
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    })
    doc.save(`gagnants_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  // Créditer manuellement un utilisateur
  const handleManualDeposit = async () => {
    if (!selectedUserId) {
      setError('Veuillez sélectionner un utilisateur')
      return
    }
    if (depositAmount <= 0) {
      setError('Le montant doit être supérieur à 0')
      return
    }
    if (!confirm(`Créditer ${depositAmount} FC à cet utilisateur ?`)) return
    setDepositLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await supabase.rpc('add_to_balance', { user_id: selectedUserId, amount: depositAmount })
      if (error) throw error
      setSuccess('Crédit effectué avec succès')
      addLog('MANUAL_DEPOSIT', { userId: selectedUserId, amount: depositAmount })
      await loadAllData()
      setSelectedUserId('')
      setDepositAmount(0)
    } catch (err: any) {
      setError('Erreur lors du crédit : ' + err.message)
    } finally {
      setDepositLoading(false)
    }
  }

  // Upload d'une bannière
  const uploadBanner = async () => {
    if (!bannerFile) {
      setError('Veuillez sélectionner une image')
      return
    }
    setBannerUploading(true)
    setError(null)
    setSuccess(null)
    try {
      const fileExt = bannerFile.name.split('.').pop()
      const fileName = `banner_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, bannerFile)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      const { error: insertError } = await supabase
        .from('banners')
        .insert({ image_url: publicUrl, active: true })
      if (insertError) throw insertError

      setSuccess('Bannière ajoutée avec succès')
      addLog('UPLOAD_BANNER', { fileName })
      await loadAllData()
      setBannerFile(null)
    } catch (err: any) {
      setError('Erreur upload : ' + err.message)
    } finally {
      setBannerUploading(false)
    }
  }

  // Activer/désactiver une bannière
  const toggleBanner = async (bannerId: string, active: boolean) => {
    try {
      await supabase.from('banners').update({ active }).eq('id', bannerId)
      await loadAllData()
    } catch (err) {
      console.error(err)
    }
  }

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(
    u =>
      (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm)
  )

  // Pagination
  const indexOfLastUser = currentPage * usersPerPage
  const indexOfFirstUser = indexOfLastUser - usersPerPage
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage)

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
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-indigo-950 to-black text-gray-100 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern-luxe.png')] opacity-5 pointer-events-none" />
        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
        <div className="relative flex items-center justify-center min-h-screen p-4">
          <div className="bg-gray-800/30 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-amber-500/20 shadow-2xl">
            <h1 className="text-4xl font-serif font-bold text-center text-white mb-2">🔐 Espace Admin</h1>
            <p className="text-center text-amber-400/80 mb-8">Accès restreint</p>
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-center">
                {error}
              </div>
            )}
            <input
              type="password"
              placeholder="Mot de passe admin"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 text-xl mb-6 focus:outline-none focus:ring-4 focus:ring-amber-500/50"
              onKeyDown={e => e.key === 'Enter' && loginAdmin()}
            />
            <button
              onClick={loginAdmin}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold py-4 rounded-xl text-xl shadow-lg transition transform hover:scale-105"
            >
              Accéder
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-indigo-950 to-black text-gray-100 font-sans selection:bg-amber-500/30 selection:text-white">
      <div className="absolute inset-0 bg-[url('/pattern-luxe.png')] opacity-5 pointer-events-none" />
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* En-tête */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">
            Bahati-<span className="text-amber-400">Admin</span>
          </h1>
          <div className="flex gap-4">
            {session && (
              <span className="px-4 py-2 bg-green-600/20 border border-green-500/30 text-green-300 rounded-xl text-sm">
                {session.user?.phone}
              </span>
            )}
            <button
              onClick={() => setIsAdmin(false)}
              className="px-6 py-3 bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 font-bold rounded-xl transition"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 font-bold">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500/30 text-green-200 p-4 rounded-xl mb-6 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 font-bold">✕</button>
          </div>
        )}

        {/* Indicateur de chargement des données */}
        {loading && !dataLoaded && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
            <p className="text-amber-400 mt-2">Chargement des données...</p>
          </div>
        )}

        {dataLoaded && (
          <>
            {/* Statistiques */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <StatCard label="Tickets vendus" value={soldTickets.length} color="blue" />
              <StatCard label="Booster vendus" value={soldTickets.filter(t => t.ticket_type === 'booster').length} color="purple" />
              <StatCard label="Standard vendus" value={soldTickets.filter(t => t.ticket_type === 'standard').length} color="green" />
              <StatCard label="Disponibles" value={availableTickets.length} color="orange" />
              <StatCard label="Revenu total" value={formatNumber(totalRevenue) + ' FC'} color="yellow" />
            </div>

            {/* Lien vers la génération de tickets PDF */}
            <div className="mb-8">
              <Link
                href="/admin/generate"
                className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:scale-105 transition"
              >
                🎫 Générer des tickets PDF
              </Link>
            </div>

            {/* Prochain tirage */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">📅 Prochain tirage</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="datetime-local"
                  value={nextDrawDate}
                  onChange={e => setNextDrawDate(e.target.value)}
                  className="flex-1 p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-4 focus:ring-amber-500/50"
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
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">📅 Code mensuel</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  maxLength={6}
                  value={monthlyCode}
                  onChange={e => setMonthlyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 chiffres"
                  className="flex-1 p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-2xl text-center focus:ring-4 focus:ring-amber-500/50"
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
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">🎟️ Générer des tickets physiques</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-amber-300 mb-1">Nombre</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={generateCount}
                    onChange={e => setGenerateCount(parseInt(e.target.value) || 0)}
                    className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-300 mb-1">Date tirage</label>
                  <input
                    type="date"
                    value={generateDrawDate}
                    onChange={e => setGenerateDrawDate(e.target.value)}
                    className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-300 mb-1">Type</label>
                  <select
                    value={generateType}
                    onChange={e => setGenerateType(e.target.value as 'standard' | 'booster')}
                    className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                  >
                    <option value="standard">Standard</option>
                    <option value="booster">Booster</option>
                  </select>
                </div>
                <button
                  onClick={generateTickets}
                  disabled={loading}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Génération...' : 'Générer + CSV'}
                </button>
              </div>
            </div>

            {/* Validation tirage */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">🎲 Valider un tirage</h2>
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
                    className="p-4 text-center text-2xl font-bold bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                    placeholder="N°"
                  />
                ))}
              </div>
              <button
                onClick={confirmAndValidateDraw}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-xl text-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Calcul...' : 'Valider le tirage'}
              </button>
            </div>

            {/* Liste des gagnants */}
            {winners.length > 0 && (
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-green-500/30">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-serif font-bold text-green-400">🏆 Gagnants ({winners.length})</h2>
                  <div className="flex gap-2">
                    {XLSX && (
                      <button
                        onClick={exportWinnersToExcel}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold"
                      >
                        Excel
                      </button>
                    )}
                    {jsPDF && autoTable && (
                      <button
                        onClick={exportWinnersToPDF}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold"
                      >
                        PDF
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nom</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Téléphone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rang</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Gain</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                      {winners.map((w, i) => (
                        <tr key={i} className="hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-mono text-sm">{w.id}</td>
                          <td className="px-4 py-3">{w.profiles?.full_name || '—'}</td>
                          <td className="px-4 py-3">{w.profiles?.phone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              w.ticket_type === 'booster' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
                            }`}>
                              {w.ticket_type === 'booster' ? 'BOOSTER' : 'STANDARD'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold">{w.rang}</td>
                          <td className="px-4 py-3 font-bold text-green-400">{formatNumber(w.prize)} FC</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dépôt manuel */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">💰 Créditer un utilisateur</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="flex-1 p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.phone} (solde: {u.balance} FC)</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={depositAmount}
                  onChange={e => setDepositAmount(parseInt(e.target.value) || 0)}
                  placeholder="Montant (FC)"
                  className="w-48 p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white"
                />
                <button
                  onClick={handleManualDeposit}
                  disabled={depositLoading}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {depositLoading ? 'Crédit...' : 'Créditer'}
                </button>
              </div>
            </div>

            {/* Gestion des bannières */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">🖼️ Bannières promotionnelles</h2>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setBannerFile(e.target.files?.[0] || null)}
                  className="flex-1 p-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-600"
                />
                <button
                  onClick={uploadBanner}
                  disabled={bannerUploading}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {bannerUploading ? 'Upload...' : 'Ajouter'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {banners.map(b => (
                  <div key={b.id} className="relative bg-gray-700/50 rounded-xl p-2 border border-gray-600">
                    <img src={b.image_url} alt="banner" className="w-full h-32 object-cover rounded-lg" />
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${b.active ? 'bg-green-600' : 'bg-gray-600'}`}>
                        {b.active ? 'Actif' : 'Inactif'}
                      </span>
                      <button
                        onClick={() => toggleBanner(b.id, !b.active)}
                        className="text-xs text-amber-400 hover:underline"
                      >
                        {b.active ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logs d'audit */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-amber-500/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-serif font-bold text-amber-300">📋 Logs d'audit</h2>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-sm text-amber-400 hover:underline"
                >
                  {showLogs ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showLogs && (
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Admin</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Action</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Détails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {logs.map(log => (
                        <tr key={log.id} className="text-sm">
                          <td className="px-4 py-2">{format(new Date(log.created_at), 'dd/MM/yy HH:mm')}</td>
                          <td className="px-4 py-2">{log.admin_id ? log.admin_id.slice(0, 8) : 'Admin'}</td>
                          <td className="px-4 py-2 font-mono">{log.action}</td>
                          <td className="px-4 py-2 truncate max-w-xs">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gestion des utilisateurs */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/20">
              <h2 className="text-2xl font-serif font-bold mb-4 text-amber-300">👥 Utilisateurs ({filteredUsers.length})</h2>
              <input
                type="text"
                placeholder="Rechercher par nom ou téléphone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-4 bg-gray-700/50 border border-gray-600 rounded-xl mb-6 text-white"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Téléphone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Solde</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Inscrit le</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                    {currentUsers.map(user => (
                      <tr key={user.id} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3">{user.full_name || '—'}</td>
                        <td className="px-4 py-3">{user.phone}</td>
                        <td className="px-4 py-3">{formatNumber(user.balance || 0)} FC</td>
                        <td className="px-4 py-3">{user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy') : '—'}</td>
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
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="px-4 py-2">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>

            {/* Zone dangereuse */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-red-500/30 mt-8">
              <h2 className="text-2xl font-serif font-bold mb-4 text-red-400">⚠️ Zone dangereuse</h2>
              <p className="mb-4 text-gray-300">
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
          </>
        )}
      </div>
    </div>
  )
}

// Composant StatCard
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-700',
    purple: 'from-purple-600 to-purple-700',
    green: 'from-green-600 to-green-700',
    orange: 'from-orange-600 to-orange-700',
    yellow: 'from-yellow-600 to-yellow-700',
  }[color]

  return (
    <div className={`bg-gradient-to-br ${colorClasses} rounded-2xl shadow-lg p-6 text-white border border-amber-500/20`}>
      <p className="text-sm opacity-90 mb-2">{label}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  )
}