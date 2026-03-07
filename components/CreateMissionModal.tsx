import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { MissionUrgency, MissionType } from '../types';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  prefillTitle?: string;
  prefillDescription?: string;
  technicians?: { id: string; email: string; first_name: string; last_name: string }[];
}

const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  prefillTitle = '',
  prefillDescription = '',
  technicians = [],
}) => {
  console.log("CreateMissionModal rendered (v2.1.2)", { isOpen, userId }); // DEBUG: Verify component version
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [newMission, setNewMission] = useState({
    title: prefillTitle,
    description: prefillDescription,
    xp_reward: 50,
    urgency: 'medium' as MissionUrgency,
    mission_type: 'solo' as MissionType,
    assigned_to: '',
    participants: [] as string[],
    hasDeadline: false,
    deadline: '',
    needs_attachment: true,
    recurrence: 'once', // 'once', 'weekly', 'monthly'
  });

  // Update form when prefill props change
  useEffect(() => {
    if (prefillTitle || prefillDescription) {
      setNewMission(prev => ({
        ...prev,
        title: prefillTitle,
        description: prefillDescription,
      }));
    }
  }, [prefillTitle, prefillDescription]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(scrollHeight, 200)}px`;
    }
  }, [newMission.description, isOpen]);

  const handleCreateMission = async () => {
    if (!newMission.title.trim()) return;

    // Check for required fields based on mission type
    if (newMission.mission_type === 'solo' && !newMission.assigned_to) {
        // You might want to show a toast or error message here
        alert("Veuillez assigner la mission à un technicien.");
        return;
    }

    try {
      let assigned_to = null;
      let status = 'open';

      // Determine status and assignments
      if (newMission.mission_type === 'solo') {
          if (newMission.assigned_to) {
              assigned_to = newMission.assigned_to;
              status = 'assigned';
          }
      } else if (newMission.mission_type === 'team') {
          // Team mission logic
          if (newMission.participants.length > 0) {
              status = 'assigned'; // Assigned to specific participants
          } else {
              status = 'open'; // Open to all (default)
          }
      }

      const { data: insertedMission, error } = await supabase.from('missions').insert([
        {
          title: newMission.title,
          description: newMission.description,
          xp_reward: newMission.xp_reward,
          urgency: newMission.urgency,
          deadline: newMission.hasDeadline ? newMission.deadline : null,
          assigned_to: assigned_to,
          created_by: userId,
          status: status,
          needs_attachment: newMission.needs_attachment,
          mission_type: newMission.mission_type,
          recurrence_rule: newMission.recurrence !== 'once' ? newMission.recurrence : null,
        },
      ]).select().single();

      if (error) throw error;

      // Handle Team Participants
      if (newMission.mission_type === 'team' && newMission.participants.length > 0) {
          const participantsData = newMission.participants.map(uid => ({
              mission_id: insertedMission.id,
              user_id: uid,
              status: 'pending'
          }));
          
          const { error: partError } = await supabase
            .from('mission_participants')
            .insert(participantsData);
            
          if (partError) console.error("Error adding participants:", partError);
          
          // Notify Participants
           for (const uid of newMission.participants) {
                await supabase.from("notifications").insert({
                  user_id: uid,
                  type: "mission_assigned",
                  title: "Mission d'Équipe 🤝",
                  content: `Vous avez été ajouté à la mission d'équipe : ${newMission.title}`,
                  link: "/missions",
                  is_read: false,
                });
           }
      }

      // Reset form
      setNewMission({
        title: '',
        description: '',
        xp_reward: 50,
        urgency: 'medium',
        mission_type: 'solo',
        assigned_to: '',
        participants: [],
        hasDeadline: false,
        deadline: '',
        needs_attachment: true,
        recurrence: 'once',
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating mission:', err);
    }
  };

  const handleIncrementXP = () => {
    setNewMission(prev => ({ ...prev, xp_reward: prev.xp_reward + 5 }));
  };

  const handleDecrementXP = () => {
    setNewMission(prev => ({ ...prev, xp_reward: Math.max(0, prev.xp_reward - 5) }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[90vh] max-h-[800px] shadow-2xl animate-scale-up flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-200 shrink-0">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Nouvelle Mission
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Créer une opportunité pour l'équipe
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-4 shrink-0">
             <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center mb-2">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

             {/* Tabs - Mission Type */}
             <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button
                  onClick={() => setNewMission({ ...newMission, mission_type: 'solo' })}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    newMission.mission_type === 'solo'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-user mr-2"></i>
                  Solo
                </button>
                <button
                  onClick={() => setNewMission({ ...newMission, mission_type: 'team' })}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    newMission.mission_type === 'team'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-users mr-2"></i>
                  Équipe
                </button>
                <button
                  onClick={() => setNewMission({ ...newMission, mission_type: 'challenge' })}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    newMission.mission_type === 'challenge'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <i className="fa-solid fa-trophy mr-2"></i>
                  Défis
                </button>
             </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
           {/* LEFT COLUMN - Description */}
           <div className="flex-1 p-8 overflow-y-auto custom-scrollbar border-r border-slate-100 bg-slate-50/30">
              <div className="space-y-6 h-full flex flex-col">
                  
                  {/* TITLE INPUT MOVED HERE */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                        Titre de la mission <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Rédiger la procédure VPN..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-800 placeholder:text-slate-400 text-lg"
                        value={newMission.title}
                        onChange={(e) => setNewMission({ ...newMission, title: e.target.value })}
                        autoFocus
                      />
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">
                      Description & Objectif
                    </label>
                    <textarea
                      ref={textareaRef}
                      placeholder="Détaillez les objectifs, les étapes clés et les critères de réussite..."
                      className="w-full h-full min-h-[300px] p-6 bg-white border border-slate-200 rounded-3xl focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none text-base leading-relaxed shadow-sm"
                      value={newMission.description}
                      onChange={(e) => setNewMission({ ...newMission, description: e.target.value })}
                    />
                  </div>

                  {/* Preuve Requise Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Preuve Requise</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Fichier obligatoire</p>
                      </div>
                      <div
                        className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${newMission.needs_attachment ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        onClick={() => setNewMission({ ...newMission, needs_attachment: !newMission.needs_attachment })}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${newMission.needs_attachment ? 'right-1' : 'left-1'}`}></div>
                      </div>
                  </div>
              </div>
           </div>

           {/* RIGHT COLUMN - Settings */}
           <div className="w-full lg:w-[400px] p-8 overflow-y-auto custom-scrollbar bg-white shrink-0 space-y-6">
              
              {/* Technician Selector (For SOLO & TEAM) */}
              {(newMission.mission_type === 'solo' || newMission.mission_type === 'team') && (
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assignation</label>
                   
                   {newMission.mission_type === 'team' ? (
                     <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-3 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                              <i className="fa-solid fa-users"></i>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-indigo-900">Ouvert à toute l'équipe</p>
                              <p className="text-[10px] font-medium text-indigo-600/80">Chacun peut renvoyer un résultat</p>
                            </div>
                        </div>
                        
                        {/* Checkbox "Tout l'équipe" */}
                         <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-indigo-100/50 hover:border-indigo-200 transition-colors shadow-sm">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${newMission.participants.length === 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                {newMission.participants.length === 0 && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={newMission.participants.length === 0}
                              onChange={() => setNewMission(prev => ({ ...prev, participants: [] }))}
                            />
                            <span className={`text-xs font-bold ${newMission.participants.length === 0 ? 'text-indigo-700' : 'text-slate-500'}`}>Envoyer à toute l'équipe</span>
                         </label>

                         {/* List of Technicians */}
                         <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 mt-2">
                            {technicians.map(tech => (
                                <label key={tech.id} className="flex items-center gap-2 p-1.5 hover:bg-white/50 rounded-lg cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="accent-indigo-600 rounded w-3 h-3"
                                        checked={newMission.participants.includes(tech.id)} 
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                // Add to participants (this automatically unchecks "All Team")
                                                setNewMission(prev => ({ ...prev, participants: [...prev.participants, tech.id] }));
                                            } else {
                                                setNewMission(prev => ({ ...prev, participants: prev.participants.filter(id => id !== tech.id) }));
                                            }
                                        }} 
                                    />
                                    <span className="text-xs font-medium text-slate-600">{tech.first_name} {tech.last_name}</span>
                                </label>
                            ))}
                         </div>
                     </div>
                   ) : (
                       /* SOLO Mode - Dropdown */
                       <div className="relative">
                          <select
                            className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer text-sm"
                            value={newMission.assigned_to}
                            onChange={(e) => setNewMission({ ...newMission, assigned_to: e.target.value })}
                          >
                            <option value="">Sélectionner un technicien</option>
                            {technicians.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.first_name} {tech.last_name}
                              </option>
                            ))}
                          </select>
                          <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500"></i>
                          <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                       </div>
                   )}
                </div>
              )}

              {/* CHALLENGE INFO BOX (Read-only) */}
              {newMission.mission_type === 'challenge' && (
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode Défi</label>
                   <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg shrink-0">
                         <i className="fa-solid fa-trophy"></i>
                      </div>
                      <div>
                         <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Premier Arrivé, Premier Servi</h4>
                         <p className="text-xs font-medium text-amber-700/80 mt-1 leading-relaxed">
                           Haute compétition. Le défi disparaît dès qu'un technicien le réclame. Une seule personne pourra remporter la mise.
                         </p>
                      </div>
                   </div>
                </div>
              )}

              {/* REWARD INPUT - CUSTOM DESIGN */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Récompense</label>
                 <div className="relative flex items-center bg-white border-2 border-indigo-100 rounded-2xl p-1 shadow-sm hover:border-indigo-300 transition-all group focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50/50">
                    <div className="pl-4">
                       <i className="fa-solid fa-star text-amber-400 text-xl drop-shadow-sm"></i>
                    </div>
                    <input
                      type="number"
                      className="w-full text-center font-black text-2xl text-slate-800 outline-none bg-transparent py-3"
                      value={newMission.xp_reward}
                      onChange={(e) => setNewMission({ ...newMission, xp_reward: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-[10px] font-black text-slate-300 uppercase mr-3">XP</span>
                    
                    {/* Custom Spinners */}
                    <div className="flex flex-col border-l border-slate-100 h-full">
                       <button 
                         onClick={handleIncrementXP}
                         className="px-3 flex-1 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-tr-xl transition-colors active:bg-indigo-100"
                       >
                          <i className="fa-solid fa-chevron-up text-[10px]"></i>
                       </button>
                       <button 
                         onClick={handleDecrementXP}
                         className="px-3 flex-1 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-br-xl transition-colors active:bg-indigo-100"
                       >
                          <i className="fa-solid fa-chevron-down text-[10px]"></i>
                       </button>
                    </div>
                 </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priorité</label>
                 <div className="relative">
                    <select
                      className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer text-sm"
                      value={newMission.urgency}
                      onChange={(e) => setNewMission({ ...newMission, urgency: e.target.value as MissionUrgency })}
                    >
                      <option value="low">Faible</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                      <option value="critical">Critique</option>
                    </select>
                    <i className={`fa-solid fa-fire absolute left-4 top-1/2 -translate-y-1/2 ${
                      newMission.urgency === 'critical' ? 'text-rose-500' : 
                      newMission.urgency === 'high' ? 'text-orange-500' : 
                      'text-slate-400'
                    }`}></i>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                 </div>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Répétition</label>
                 <div className="relative">
                    <select
                      className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer text-sm"
                      value={newMission.recurrence}
                      onChange={(e) => setNewMission({ ...newMission, recurrence: e.target.value })}
                    >
                      <option value="once">Une seule fois</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuel</option>
                    </select>
                    <i className="fa-solid fa-rotate absolute left-4 top-1/2 -translate-y-1/2 text-purple-500"></i>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                 </div>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Limite</label>
                 <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center justify-between pl-4 pr-2 py-2">
                    <div className="flex items-center gap-3">
                       <i className="fa-regular fa-calendar text-slate-400"></i>
                       {newMission.hasDeadline ? (
                          <input 
                            type="date" 
                            className="bg-transparent font-bold text-slate-700 outline-none text-sm"
                            value={newMission.deadline}
                            onChange={(e) => setNewMission({ ...newMission, deadline: e.target.value })}
                          />
                       ) : (
                          <span className="text-xs font-black text-slate-400 uppercase">Pas de date</span>
                       )}
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-all relative cursor-pointer shrink-0 ${newMission.hasDeadline ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      onClick={() => setNewMission({ ...newMission, hasDeadline: !newMission.hasDeadline })}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${newMission.hasDeadline ? 'right-1' : 'left-1'}`}></div>
                    </div>
                 </div>
              </div>

           </div>
        </div>

        {/* FOOTER */}
        <div className="p-8 border-t border-slate-100 bg-white shrink-0">
           <button
            onClick={handleCreateMission}
            disabled={!newMission.title.trim() || (newMission.mission_type === 'solo' && !newMission.assigned_to)}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99]"
          >
            <span>Lancer la mission</span>
            <i className="fa-solid fa-paper-plane group-hover:translate-x-1 transition-transform"></i>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CreateMissionModal;
