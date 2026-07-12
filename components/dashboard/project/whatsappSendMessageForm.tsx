'use client';

import { useState } from 'react';

export default function WhatsAppForm() {
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message }),
            });

            if (!response.ok) throw new Error('Erreur');

            setStatus('success');
            setMessage(''); // On vide le message après l'envoi
        } catch (e) {
            setStatus('error');
            console.error('Erreur lors de l\'envoi du message:', e);

        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-md space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Contacter ExtravertyAI</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Numéro WhatsApp (avec indicatif)</label>
                    <input
                        type="text"
                        placeholder="Ex: 33612345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Votre message</label>
                    <textarea
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                >
                    {status === 'loading' ? 'Envoi en cours...' : 'Envoyer via WhatsApp'}
                </button>
            </form>

            {status === 'success' && <p className="text-green-600 text-sm">Message envoyé avec succès !</p>}
            {status === 'error' && <p className="text-red-600 text-sm">Une erreur est survenue lors de l&apos;envoi.</p>}
        </div>
    );
}