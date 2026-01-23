
import React, { useState, useEffect } from 'react';
import { User, Procedure, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewHistory: () => void;
}

interface Announcement {
  id: string;
  content: string;
  author_name: string;
  author_initials: string;
  created_at: string;
  author_id?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onQuickNote, onSelectProcedure, onViewHistory }) => {
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  
  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(true);

  const stats = [
    { label: 'Consultations', value: '42', icon: 'fa-book-open', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Suggestions', value: '7', icon: 'fa-check-circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mes Notes', value: '12', icon: 'fa-note-sticky', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];

  useEffect(() => {
    fetchLatestAnnouncement();
    fetchRecentProcedures();
  }, []);

  const fetchRecentProcedures = async () => {
    setLoadingProcedures(true);
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (data) {
        setRecentProcedures(data.map(p => ({
          id: p.uuid,
          file_id: p.uuid,
          title: p.title || "Sans titre",
          category: p.Type || "GÉNÉRAL",
          fileUrl: p.file_url,
          createdAt: p.created_at,
          views: p.views || 0,
          status: p.status || 'validated'
        })));
      }
    } catch (err) {
      console.error("Erreur fetch procedures:", err);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const fetchLatestAnnouncement = async () => {
    setLoadingAnnouncement(true);
    try {
      const { data, error } = await supabase
        .from('team_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAnnouncement(data);
        setEditContent(data.content);
      } else {
        const defaultAnn = {
          id: 'default',
          content: "Bienvenue sur Procedio. Aucune annonce d'équipe pour le moment.",
          author_name: "Système",
          author_initials: "SY",
          created_at: new Date().toISOString()
        };
        setAnnouncement(defaultAnn);
        setEditContent(defaultAnn.content);
      }
    } catch (err) {
      console.error("Erreur annonces:", err);
    } finally {
      setLoadingAnnouncement(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_announcements')
        .insert([{
          content: editContent,
          author_name: user.firstName,
          author_initials: user.firstName.substring(0, 2).toUpperCase(),
          author_id: user.id
        }]);

      if (error) throw error;
      
      setIsEditing(false);
      await fetchLatestAnnouncement();
      setIsRead(false);
    } catch (err) {
      alert("Erreur lors de l'enregistrement de l'annonce");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!announcement) return;
    setIsRead(true);

    try {
      await supabase.from('notes').insert([{
        title: `LOG_READ_${announcement.id}`,
        content: `L'annonce "${announcement.content.substring(0, 30)}..." a été lue par ${user.firstName} ${user.lastName || ''}.`,
        is_protected: false,
        user_id: user.id,
        tags: ['NOTIFICATION', 'SYSTEM']
      }]);
    } catch (err) {
      console.error("Erreur log lecture:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Format Invalide';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-10 animate-slide-up pb-12">
      <section className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-2 text-center md:text-left">
          <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Hello, <span className="text-indigo-600">{user.firstName}</span>
          </h2>
          <p className="text-slate-400 font-medium text-lg">Prêt à simplifier le support IT aujourd'hui ?</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8">
        <section className={`relative border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-between items-start gap-10 transition-all duration-500 ${
          isRead ? 'bg-slate-50 opacity-60' : 'bg-white shadow-xl shadow-indigo-500/5'
        }`}>
          {loadingAnnouncement ? (
            <div className="w-full py-10 flex items-center justify-center gap-4">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Récupération de l'annonce...</span>
            </div>
          ) : isEditing ? (
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Édition de l'annonce équipe</h4>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <textarea 
                className="w-full h-32 p-6 bg-slate-50 border-2 border-indigo-100 rounded-3xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-bold text-slate-700 text-lg transition-all"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Écrivez votre message à l'équipe ici..."
              />
              <div className="flex justify-end gap-4">
                <button 
                  onClick={handleSaveAnnouncement}
                  disabled={saving || !editContent.trim()}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 shadow-lg disabled:opacity-50 transition-all"
                >
                  {saving ? "Publication..." : "Publier l'annonce"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-6 w-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xl border border-indigo-100">
                  {announcement?.author_initials || '??'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annonce Équipe • Par {announcement?.author_name}</h4>
                    {user.role === UserRole.MANAGER && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-black text-indigo-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-2"
                      >
                        <i className="fa-solid fa-pen-to-square"></i> Modifier
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-semibold leading-relaxed tracking-tight text-slate-700 mt-2">
                    "{announcement?.content}"
                  </p>
                </div>
              </div>
              <div className="w-full flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  Posté le {announcement ? new Date(announcement.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '...'}
                </span>
                {user.role === UserRole.TECHNICIAN && !isRead && (
                  <button onClick={handleMarkAsRead} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                    Lu et compris
                  </button>
                )}
                {isRead && (
                  <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-circle-check"></i> Lu et notifié
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <article key={idx} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8 hover:shadow-md transition-all group">
            <div className={`w-20 h-20 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">{stat.label}</h3>
            </div>
          </article>
        ))}
      </section>

      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <h3 className="font-black text-slate-900 text-xl tracking-tight">Activité Récente</h3>
          <button onClick={onViewHistory} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">Tout voir</button>
        </div>
        <div className="divide-y divide-slate-50">
           {loadingProcedures ? (
             <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement des fichiers...</p>
             </div>
           ) : recentProcedures.length > 0 ? (
             recentProcedures.map(proc => (
               <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="p-10 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all group">
                  <div className="flex items-center gap-8">
                     <div className="w-16 h-16 bg-white border border-slate-100 text-slate-300 rounded-2xl flex items-center justify-center group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                       <i className="fa-regular fa-file-lines text-2xl"></i>
                     </div>
                     <div className="space-y-2">
                       <h4 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors leading-tight">{proc.title}</h4>
                       <div className="flex items-center gap-3">
                         <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg">{proc.category}</span>
                         <span className="text-[10px] text-indigo-400 font-black tracking-widest uppercase bg-indigo-50 px-3 py-1 rounded-lg flex items-center gap-2">
                           <i className="fa-solid fa-clock-rotate-left"></i>
                           {formatDate(proc.createdAt)}
                         </span>
                       </div>
                     </div>
                  </div>
                  <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
               </div>
             ))
           ) : (
             <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
                <i className="fa-solid fa-folder-open text-4xl opacity-20"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">Aucune activité récente détectée</p>
             </div>
           )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
