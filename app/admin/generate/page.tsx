'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import Ticket from '@/components/Ticket';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function GenerateTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawDate, setDrawDate] = useState('31/03/2026 à 19h00');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      // Vérifier l'authentification (optionnel, adaptez selon votre système)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Charger le fichier CSV depuis /public
      try {
        const response = await fetch('/tickets.csv');
        if (!response.ok) throw new Error('Fichier CSV introuvable');
        const csvText = await response.text();
        const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        setTickets(result.data);
      } catch (err: any) {
        setError('Erreur lors du chargement du CSV : ' + err.message);
      }

      // Récupérer la date du prochain tirage depuis Supabase
      const { data: configData } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'next_draw_date')
        .maybeSingle();

      if (configData?.value) {
        const date = new Date(configData.value);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        setDrawDate(`${day}/${month}/${year} à 19h00`);
      }

      setLoading(false);
    };

    fetchData();
  }, [supabase, router]);

  const handlePrint = () => {
    window.print();
  };

  // Découper les tickets en lots de 4 pour créer plusieurs pages A4
  const chunkSize = 4;
  const pages = [];
  for (let i = 0; i < tickets.length; i += chunkSize) {
    pages.push(tickets.slice(i, i + chunkSize));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Préparation des tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-red-400 text-xl">Erreur : {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h1 className="text-4xl font-serif text-white">Génération de tickets</h1>
          <button
            onClick={handlePrint}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-105"
          >
            🖨️ Imprimer / PDF
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center text-gray-300 border border-amber-500/30">
            <p className="text-2xl mb-4">📭 Aucun ticket dans le fichier CSV</p>
            <p className="text-sm">Placez un fichier <code className="bg-black/30 px-2 py-1 rounded">tickets.csv</code> dans le dossier <code>public</code>.</p>
          </div>
        ) : (
          <>
            {/* Conteneur des pages A4 */}
            <div className="space-y-8 print:space-y-0">
              {pages.map((pageTickets, pageIndex) => (
                <div
                  key={pageIndex}
                  className="bg-white p-4 rounded-2xl shadow-2xl print:p-0 print:shadow-none print:break-after-page"
                  style={{ width: '210mm', minHeight: '297mm' }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    {pageTickets.map((ticket: any) => (
                      <Ticket
                        key={ticket.id}
                        id={ticket.id}
                        otpCode={ticket.otp_code}
                        ticketType={ticket.ticket_type}
                        drawDate={drawDate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-gray-400 text-sm mt-4 print:hidden">
              ⚡ {tickets.length} tickets répartis sur {pages.length} page(s). Utilisez le bouton d'impression, puis choisissez "Enregistrer au format PDF" (portrait, échelle 100%, marges minimales).
            </p>
          </>
        )}
      </div>
    </div>
  );
}