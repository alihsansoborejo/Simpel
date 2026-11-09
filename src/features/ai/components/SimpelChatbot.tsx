import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  RotateCcw,
  BookOpen,
  Heart,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { ChatMessage } from '../../../types/ai.types';
import { aiService } from '../../../services/aiService';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SimpelChatbot: React.FC<Props> = ({ onNotify }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Assalamu’alaikum Warahmatullahi Wabarakatuh, ${user?.profile?.full_name ? `Bapak/Ibu ${user.profile.full_name}` : 'Sahabat Guru'}!

Saya adalah **Asisten SIMPEL**, asisten cerdas untuk **MI Ma’arif Al Ihsan Soborejo**. Saya siap membantu Bapak/Ibu seputar:
1. **Panduan Aplikasi SIMPEL** (Presensi harian, modul ajar, LKPD, jurnal, supervisi, dan analisis nilai).
2. **Kurikulum Merdeka & Kemenag** (Perumusan Capaian Pembelajaran, TP, ATP, dan asesmen).
3. **Pembelajaran Mendalam (Deep Learning)**: Membangun tahapan Mindful, Meaningful, dan Joyful Learning di kelas.
4. **Kurikulum Berbasis Cinta (KBC)**: Menanamkan kasih sayang, keteladanan akhlak, dan iklim madrasah yang ramah anak.

Ada yang bisa saya bantu hari ini?`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsTyping(true);

    try {
      const assistantMessage = await aiService.sendChatMessage(
        newHistory.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages([...newHistory, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Gagal mengirim pesan chat.', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopyMessage = async (content: string) => {
    const ok = await aiService.copyText(content);
    if (ok) onNotify?.('Jawaban berhasil disalin ke clipboard!', 'success');
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Percakapan telah direset. Silakan ajukan pertanyaan atau konsultasi seputar pembelajaran madrasah, Kurikulum Merdeka, atau fitur SIMPEL lainnya.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    onNotify?.('Riwayat percakapan dibersihkan.', 'info');
  };

  const quickPrompts = [
    'Bagaimana cara menerapkan Mindful Learning di kelas 4 MI?',
    'Apa perbedaan kalimat transitif dan intransitif dalam kurikulum merdeka?',
    'Bagaimana langkah merancang remedial yang efektif dan tidak membebani murid?',
    'Jelaskan 4 pilar utama Kurikulum Berbasis Cinta (KBC) di MI Al Ihsan!',
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold shadow-md shrink-0">
            <Bot className="w-6 h-6 text-emerald-950" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Asisten SIMPEL - Tanya Jawab Cerdas</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-amber-300 text-[10px] font-semibold">
                Online
              </span>
            </h2>
            <p className="text-xs text-emerald-100">
              Konsultan Cerdas Kurikulum Merdeka, Deep Learning & Kurikulum Berbasis Cinta MI Al Ihsan Soborejo
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-100 hover:text-white hover:bg-emerald-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Sesi</span>
        </button>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-emerald-700 text-amber-300 shadow-xs'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed space-y-1.5 relative group ${
                  msg.role === 'user'
                    ? 'bg-emerald-700 text-white rounded-tr-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-70 mb-1">
                  <span className="font-semibold">
                    {msg.role === 'user' ? user?.profile?.full_name || 'Bapak/Ibu Guru' : 'Asisten SIMPEL'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.content}
                </div>

                {msg.role === 'assistant' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleCopyMessage(msg.content)}
                      className="text-[10px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Jawaban</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-amber-300 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-500 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>Asisten SIMPEL sedang merumuskan jawaban terbaik...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-200 flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 self-center mr-1">Pertanyaan Cepat:</span>
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 text-[11px] font-medium transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ketik pertanyaan seputar Kurikulum Merdeka, Pembelajaran Mendalam, atau penggunaan SIMPEL... (Tekan Enter untuk mengirim)"
            className="flex-1 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            className="h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer shrink-0 shadow-md"
          >
            <Send className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </div>
      </div>
    </div>
  );
};
