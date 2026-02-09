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
    targetType: 'team' as 'team' | 'individual',
    assigned_to: '',
    hasDeadline: false,
    deadline: '',
  });

  // Lifecycle Modals State
  const [completingMission, setCompletingMission] = useState<Mission | null>(null);
  const [cancellingMission, setCancellingMission] = useState<Mission | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [technicians, setTechnicians] = useState<{id: string, email: string, first_name: string, last_name: string}[]>([]);

  useEffect(() => {
    fetchMissions();
    if (user.role === UserRole.MANAGER) {
      fetchTechnicians();
    }
  }, [user]);

  const fetchTechnicians = async () => {
    try {
      // On récupère tout et on filtre côté JS pour éviter les erreurs 400 
      // si un type ENUM Postgres ne reconnaît pas une valeur (ex: technicien vs TECHNICIAN)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, role');
      
      if (error) {
        console.error("DEBUG: Erreur Supabase fetchTechnicians:", error);
        throw error;
      }

      if (data) {
        // Filtrage flexible (ignore la casse)
        const techList = data.filter(u => 
          u.role && (u.role.toLowerCase() === 'technicien' || u.role.toLowerCase() === 'technician')
        );
        console.log("DEBUG: Techniciens filtrés:", techList);
        setTechnicians(techList);
      }
    } catch (err) {
      console.error("Error fetching technicians:", err);
    }
  };

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
      let assigned_to = null;

      if (newMission.targetType === 'individual' && newMission.assigned_to) {
        assigned_to = newMission.assigned_to;
      }

      const { error } = await supabase
        .from('missions')
        .insert([{
          title: newMission.title,
          description: newMission.description,
          xp_reward: newMission.xp_reward,
          urgency: newMission.urgency,
          deadline: newMission.hasDeadline ? newMission.deadline : null,
          assigned_to: assigned_to,
          created_by: user.id,
          status: assigned_to ? 'assigned' : 'open'
        }]);

      if (error) throw error;

      // Trigger Notification for the assigned technician
      if (assigned_to) {
        await supabase.from('notifications').insert({
          user_id: assigned_to,
          type: 'mission',
          title: 'Nouvelle mission assignée',
          content: `On vous a confié la mission : ${newMission.title}`,
          link: '/missions' // Navigate to missions view
        });
      }

      setToast({ message: "Mission stratégique crée !", type: "success" });
      setShowCreateModal(false);
      setNewMission({ 
        title: '', 
        description: '', 
        xp_reward: 50, 
        urgency: 'medium',
        targetType: 'team',
        assigned_to: '',
        hasDeadline: false,
        deadline: ''
      });
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

  const handleStatusUpdate = async (missionId: string, newStatus: MissionStatus, notes?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'completed') updateData.completion_notes = notes;
      if (newStatus === 'cancelled') updateData.cancellation_reason = notes;

      const { error } = await supabase
        .from('missions')
        .update(updateData)
        .eq('id', missionId);

      if (error) throw error;

      setToast({ 
        message: newStatus === 'completed' ? "Mission validée ! XP versée." : 
                 newStatus === 'cancelled' ? "Mission annulée." : "Statut mis à jour.", 
        type: "success" 
      });
      
      setCompletingMission(null);
      setCancellingMission(null);
      setReasonText("");
      fetchMissions();

      // Lifecycle Notifications AND SCORING (Secure RPC)
      const mission = missions.find(m => m.id === missionId);
      if (mission) {
        
        // 1. Manager validates -> +50 XP via Secure RPC
        if (newStatus === 'completed' && user.role === UserRole.MANAGER && mission.assigned_to) {
           // Call the RPC
           const { data: xpData, error: xpError } = await supabase.rpc('increment_user_xp', {
             target_user_id: mission.assigned_to,
             xp_amount: mission.xp_reward || 50,
             reason: `Mission accomplie : ${mission.title}`
           });

           if (xpError) console.error("Error giving XP:", xpError);
           
           // Notify user
           await supabase.from('notifications').insert({
            user_id: mission.assigned_to,
            type: 'mission',
            title: 'Mission validée !',
            content: `Votre mission "${mission.title}" a été validée. +${mission.xp_reward || 50} XP accordés !`,
            link: '/missions'
          });
        }

        // 2. Manager cancels -> Notify technician
        if (newStatus === 'cancelled' && mission.assigned_to && mission.assigned_to !== user.id) {
          await supabase.from('notifications').insert({
            user_id: mission.assigned_to,
            type: 'mission',
            title: 'Mission annulée',
            content: `La mission "${mission.title}" a été annulée par le manager.`,
            link: '/missions'
          });
        }
        
        // 3. Technician finishes -> Notify manager
        if (newStatus === 'completed' && user.role === UserRole.TECHNICIAN && mission.created_by !== user.id) {
          await supabase.from('notifications').insert({
            user_id: mission.created_by,
            type: 'mission',
            title: 'Bilan déposé',
            content: `${user.firstName} a terminé la mission : ${mission.title}`,
            link: '/missions'
          });
        }
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la mise à jour.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real-time Sync
  useEffect(() => {
    const channel = supabase
      .channel('missions_view_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMissions(prev => [payload.new as Mission, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const newMission = payload.new as Mission;
            setMissions(prev => prev.map(m => m.id === newMission.id ? { ...m, ...newMission } : m));
          } else if (payload.eventType === 'DELETE') {
            setMissions(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStartMission = async (missionId: string) => {
    // Optimistic Update
    const previousMissions = [...missions];
    setMissions(prev => prev.map(m => m.id === missionId ? { ...m, status: 'in_progress' } : m));
    setToast({ message: "Mission démarrée !", type: "success" });

    try {
      const { error } = await supabase
        .from('missions')
        .update({ status: 'in_progress' })
        .eq('id', missionId);
      
      if (error) throw error;
      // No need to fetchMissions() if subscription works, but keeping it as backup or for consistency if payload implies heavy data not in payload? 
      // Payload usually has all columns. 
      // Actually, payload might lack joined fields (assignee, creator).
      // So fetching might be safer for complex views, OR we just update status which is fine.
      // But let's rely on subscription for other clients, and this local update for self.
      // The subscription will also trigger an update coming from own change?
      // Yes, Supabase sends back the change. We should handle it gracefully (idempotent map).

      // Notify Creator
      const mission = missions.find(m => m.id === missionId);
      if (mission && mission.created_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: mission.created_by,
          type: 'mission',
          title: 'Mission démarrée',
          content: `${user.firstName} a démarré la mission : ${mission.title}`,
          link: '/missions'
        });
      }
    } catch (err) {
      // Revert
      setMissions(previousMissions);
      setToast({ message: "Erreur lors du démarrage.", type: "error" });
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
      assigned: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Assignée' },
      in_progress: { color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'En cours' },
      in_review: { color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'À réviser' },
      completed: { color: 'text-slate-400', bg: 'bg-slate-50', label: 'Terminée' },
      cancelled: { color: 'text-rose-400', bg: 'bg-rose-50', label: 'Annulée' }
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
              ? "Pilotez le flux de connaissances en assignant des missions stratégiques à votre équipe."
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
        <LoadingState message="Préparation du tableau des missions..." />
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

                  {mission.deadline && (
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 w-fit">
                      <i className="fa-solid fa-calendar-day"></i>
                      À rendre avant : {new Date(mission.deadline).toLocaleDateString('fr-FR')}
                    </div>
                  )}

                  {mission.assignee_name && (
                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                          {mission.assignee_name.substring(0, 2)}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {mission.status === 'completed' ? 'Complétée par' : mission.status === 'cancelled' ? 'Assignée à' : 'En cours par'} <span className="text-slate-700">{mission.assignee_name}</span>
                        </p>
                      </div>

                      {/* Action Buttons for Lifecycle */}
                      <div className="flex gap-2">
                        {mission.status === 'assigned' && mission.assigned_to === user.id && (
                          <button 
                            onClick={() => handleStartMission(mission.id)}
                            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-slate-900 transition-all"
                          >
                            Démarrer
                          </button>
                        )}
                        {mission.status === 'in_progress' && mission.assigned_to === user.id && (
                          <button 
                            onClick={() => {
                              setCompletingMission(mission);
                              setReasonText("");
                            }}
                            className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-emerald-600 transition-all"
                          >
                            Terminer
                          </button>
                        )}
                        {(mission.status === 'assigned' || mission.status === 'in_progress') && user.role === UserRole.MANAGER && (
                          <button 
                            onClick={() => {
                              setCancellingMission(mission);
                              setReasonText("");
                            }}
                            className="px-4 py-1.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-rose-100 transition-all"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Display Reasons */}
                  {mission.status === 'completed' && mission.completion_notes && (
                    <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                       <span className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Bilan d'expertise</span>
                       <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">{mission.completion_notes}</p>
                    </div>
                  )}
                  {mission.status === 'cancelled' && mission.cancellation_reason && (
                    <div className="mt-4 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
                       <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1 italic">Motif d'annulation</span>
                       <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">{mission.cancellation_reason}</p>
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
             <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-sm font-black tracking-tight uppercase">Performance Missions</h3>
                   <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold text-indigo-200 bg-indigo-900/30 px-3 py-1 rounded-full border border-white/5">
                      <i className="fa-solid fa-chart-line"></i>
                      <span>Live</span>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                      <span className="text-2xl font-black">{missions.reduce((acc, m) => acc + (m.status === 'completed' ? m.xp_reward : 0), 0)}</span>
                      <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest leading-tight mt-1">XP Gagné</span>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                      <span className="text-2xl font-black">{missions.filter(m => m.status === 'completed').length}</span>
                      <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest leading-tight mt-1">Complétées</span>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Echéance</label>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          id="noDeadline"
                          className="w-5 h-5 accent-indigo-600 rounded-lg cursor-pointer"
                          checked={!newMission.hasDeadline}
                          onChange={(e) => setNewMission({...newMission, hasDeadline: !e.target.checked})}
                        />
                        <label htmlFor="noDeadline" className="text-xs font-bold text-slate-600 cursor-pointer">Pas de délai</label>
                      </div>
                      {newMission.hasDeadline && (
                        <input 
                          type="date"
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700"
                          value={newMission.deadline}
                          onChange={(e) => setNewMission({...newMission, deadline: e.target.value})}
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destinataire</label>
                    <div className="flex flex-col gap-3">
                      <select 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                        value={newMission.targetType}
                        onChange={(e) => setNewMission({...newMission, targetType: e.target.value as 'team' | 'individual'})}
                      >
                         <option value="team">Toute l'équipe</option>
                         <option value="individual">Individu spécifique</option>
                      </select>
                      {newMission.targetType === 'individual' && (
                        <select 
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                          value={newMission.assigned_to}
                          onChange={(e) => setNewMission({...newMission, assigned_to: e.target.value})}
                        >
                           <option value="">Sélectionner un technicien</option>
                           {technicians.map(tech => (
                             <option key={tech.id} value={tech.id}>
                               {tech.first_name} {tech.last_name} ({tech.email})
                             </option>
                           ))}
                        </select>
                      )}
                    </div>
                  </div>
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

      {/* MODAL COMPLETION MISSION */}
      {completingMission && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Mission Terminée</h3>
            <p className="text-xs font-bold text-slate-400 uppercase mb-6 tracking-widest">Décrivez brièvement ce qui a été fait</p>
            
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Notes de clôture..."
              className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-600 resize-none mb-6"
            />
            
            <div className="flex gap-3">
              <button onClick={() => setCompletingMission(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                Annuler
              </button>
              <button 
                onClick={() => handleStatusUpdate(completingMission.id, 'completed', reasonText)}
                disabled={!reasonText.trim() || isSubmitting}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CANCELLATION MISSION */}
      {cancellingMission && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Annuler la Mission</h3>
            <p className="text-xs font-bold text-slate-400 uppercase mb-6 tracking-widest">Pourquoi arrêter cette mission ?</p>
            
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Motif d'annulation..."
              className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-rose-500 outline-none transition-all font-medium text-slate-600 resize-none mb-6"
            />
            
            <div className="flex gap-3">
              <button onClick={() => setCancellingMission(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                Fermer
              </button>
              <button 
                onClick={() => handleStatusUpdate(cancellingMission.id, 'cancelled', reasonText)}
                disabled={!reasonText.trim() || isSubmitting}
                className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                Confirmer l'Annulation
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
