import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, UserRole, Mission, MissionStatus, MissionUrgency, Procedure } from '../types';
import InfoTooltip from '../components/InfoTooltip';
import LoadingState from '../components/LoadingState';
import CustomToast from '../components/CustomToast';
import { createPortal } from 'react-dom';

interface MissionsProps {
  user: User;
  onSelectProcedure?: (procedure: Procedure) => void;
}

const Missions: React.FC<MissionsProps> = ({ user, onSelectProcedure }) => {
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form State
  const [newMission, setNewMission] = useState({
    title: '',
    description: '',
    xp_reward: 50,
    urgency: 'medium' as MissionUrgency,
  });

  useEffect(() => {
    fetchMissions();
  }, [user]);

  const fetchMissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('missions')
        .select(`
          *,
          assignee:user_profiles!assigned_to(first_name, last_name),
          creator:user_profiles!created_by(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setMissions(data.map(m => ({
          ...m,
          assignee_name: m.assignee ? `${m.assignee.first_name} ${m.assignee.last_name}` : undefined,
          creator_name: m.creator ? `${m.creator.first_name} ${m.creator.last_name}` : undefined,
        })));
      }
    } catch (err) {
      console.error("Error fetching missions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async () => {
    if (!newMission.title.trim()) return;
    try {
      const { error } = await supabase
        .from('missions')
        .insert([{
          ...newMission,
          created_by: user.id,
          status: 'open'
        }]);

      if (error) throw error;

      setToast({ message: "Mission stratégique crée !", type: "success" });
      setShowCreateModal(false);
      setNewMission({ title: '', description: '', xp_reward: 50, urgency: 'medium' });
      fetchMissions();
    } catch (err) {
      setToast({ message: "Erreur lors de la création.", type: "error" });
    }
  };

  const handleClaimMission = async (missionId: string) => {
    try {
      const { error } = await supabase
        .from('missions')
        .update({ assigned_to: user.id, status: 'assigned' })
        .eq('id', missionId)
        .eq('status', 'open');

      if (error) throw error;

      setToast({ message: "Mission acceptée ! À vous de jouer.", type: "success" });
      fetchMissions();
    } catch (err) {
      setToast({ message: "Impossible de réclamer cette mission.", type: "error" });
    }
  };

  const handleStatusUpdate = async (missionId: string, newStatus: MissionStatus) => {
    try {
      const { error } = await supabase
        .from('missions')
        .update({ status: newStatus })
        .eq('id', missionId);

      if (error) throw error;

      setToast({ 
        message: newStatus === 'completed' ? "Mission validée ! XP versée." : "Statut mis à jour.", 
        type: "success" 
      });
      fetchMissions();
    } catch (err) {
      setToast({ message: "Erreur lors de la mise à jour.", type: "error" });
    }
  };

  const UrgencyBadge = ({ urgency }: { urgency: MissionUrgency }) => {
    const config = {
      critical: { color: 'text-rose-600', bg: 'bg-rose-50', icon: 'fa-triangle-exclamation', label: 'Urgent' },
      high: { color: 'text-orange-600', bg: 'bg-orange-50', icon: 'fa-fire', label: 'Prioritaire' },
      medium: { color: 'text-indigo-600', bg: 'bg-indigo-50', icon: 'fa-calendar', label: 'Standard' },
      low: { color: 'text-slate-500', bg: 'bg-slate-50', icon: 'fa-clock', label: 'Libre' }
    }[urgency];

    return (
      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bg} ${config.color} text-[9px] font-black uppercase tracking-widest border border-current opacity-70`}>
        <i className={`fa-solid ${config.icon}`}></i>
        {config.label}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: MissionStatus }) => {
    const config = {
      open: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Disponible' },
      assigned: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'En cours' },
      in_review: { color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'À réviser' },
      completed: { color: 'text-slate-400', bg: 'bg-slate-50', label: 'Terminé' },
      cancelled: { color: 'text-rose-400', bg: 'bg-rose-50', label: 'Annulé' }
    }[status];

    return (
      <span className={`px-2 py-0.5 rounded-lg ${config.bg} ${config.color} text-[8px] font-black uppercase tracking-widest`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Tableau des Missions
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-compass"></i>
            </div>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            {user.role === UserRole.MANAGER 
              ? "Pilotez le flux de connaissances en assignant des quêtes stratégiques à votre équipe."
              : "Relevez des défis, complétez votre savoir et gagnez de l'XP pour monter en grade."}
          </p>
        </div>
        
        {user.role === UserRole.MANAGER && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3 group"
          >
            <i className="fa-solid fa-plus group-hover:rotate-90 transition-transform"></i>
            Mission Stratégique
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Préparation du tableau des quêtes..." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Pipeline/List */}
          <div className="xl:col-span-2 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-4">
              {user.role === UserRole.MANAGER ? "Pipeline des Missions" : "Missions Disponibles"}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {missions.filter(m => user.role === UserRole.MANAGER ? true : (m.status === 'open' || m.assigned_to === user.id)).map((mission) => (
                <div key={mission.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden">
                  {/* Urgency accent border */}
                  <div className={`absolute top-0 left-0 w-2 h-full ${
                    mission.urgency === 'critical' ? 'bg-rose-500' :
                    mission.urgency === 'high' ? 'bg-orange-500' :
                    mission.urgency === 'medium' ? 'bg-indigo-500' : 'bg-slate-200'
                  } opacity-20`}></div>

                  <div className="flex justify-between items-start mb-6">
                    <UrgencyBadge urgency={mission.urgency} />
                    <StatusBadge status={mission.status} />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
                      {mission.title}
                    </h4>
                    <p className="text-sm text-slate-500 font-medium line-clamp-3 leading-relaxed">
                      {mission.description}
                    </p>
                  </div>

                  <div className="mt-8 flex items-end justify-between">
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Récompense</span>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs border border-amber-100 font-black">
                          {mission.xp_reward}
                        </div>
                        <span className="text-xs font-black text-slate-600 uppercase tracking-tight">XP</span>
                      </div>
                    </div>

                    {mission.status === 'open' && user.role === UserRole.TECHNICIAN && (
                      <button 
                        onClick={() => handleClaimMission(mission.id)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                      >
                        Réclamer
                      </button>
                    )}

                    {mission.status === 'in_review' && user.role === UserRole.MANAGER && (
                      <button 
                        onClick={() => handleStatusUpdate(mission.id, 'completed')}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        Valider XP
                      </button>
                    )}
                  </div>

                  {mission.assignee_name && (
                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                        {mission.assignee_name.substring(0, 2)}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        En cours par <span className="text-slate-700">{mission.assignee_name}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {missions.length === 0 && (
                <div className="md:col-span-2 py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <i className="fa-solid fa-box-open text-4xl text-slate-300 mb-4 opacity-50"></i>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucune mission pour le moment</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Info & Stats */}
          <div className="space-y-8">
             <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20">
                <h3 className="text-xl font-black tracking-tight mb-4">Pourquoi les Missions ?</h3>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed opacity-90">
                  Les missions permettent de cibler les manques de connaissances identifiés par notre IA. En les relevant, vous participez directement à l'excellence opérationnelle de l'équipe.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                   <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                      <span className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total XP</span>
                      <span className="text-2xl font-black">{missions.reduce((acc, m) => acc + (m.status === 'completed' ? m.xp_reward : 0), 0)}</span>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                      <span className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Missions OK</span>
                      <span className="text-2xl font-black">{missions.filter(m => m.status === 'completed').length}</span>
                   </div>
                </div>
             </section>

             <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Légende</h3>
                <div className="space-y-4">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-sm">
                         <i className="fa-solid fa-fire"></i>
                      </div>
                      <div>
                         <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Priorité Haute</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action sous 48h</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm">
                         <i className="fa-solid fa-medal"></i>
                      </div>
                      <div>
                         <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Récompense XP</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selon la complexité</p>
                      </div>
                   </div>
                </div>
             </section>
          </div>
        </div>
      )}

      {/* MODAL CREATION MISSION */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    <i className="fa-solid fa-bolt"></i>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nouvelle Mission</h3>
               </div>
               <button onClick={() => setShowCreateModal(false)} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark text-2xl"></i>
               </button>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre de la mission</label>
                  <input 
                    type="text" 
                    placeholder="ex: Rédiger la procédure VPN"
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    value={newMission.title}
                    onChange={(e) => setNewMission({...newMission, title: e.target.value})}
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description & Objectif</label>
                  <textarea 
                    placeholder="Expliquez ce qui est attendu..."
                    className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none"
                    value={newMission.description}
                    onChange={(e) => setNewMission({...newMission, description: e.target.value})}
                  />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Récompense XP</label>
                    <input 
                      type="number" 
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                      value={newMission.xp_reward}
                      onChange={(e) => setNewMission({...newMission, xp_reward: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Urgence</label>
                    <select 
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                      value={newMission.urgency}
                      onChange={(e) => setNewMission({...newMission, urgency: e.target.value as MissionUrgency})}
                    >
                       <option value="low">Libre</option>
                       <option value="medium">Standard</option>
                       <option value="high">Prioritaire</option>
                       <option value="critical">Urgent</option>
                    </select>
                  </div>
               </div>

               <button 
                 onClick={handleCreateMission}
                 className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-slate-900 transition-all active:scale-95"
               >
                 Lancer la Mission
               </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <CustomToast 
          message={toast.message} 
          type={toast.type} 
          visible={!!toast}
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default Missions;
