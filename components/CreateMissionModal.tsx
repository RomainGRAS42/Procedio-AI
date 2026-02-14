import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { MissionUrgency } from '../types';

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
  const [newMission, setNewMission] = useState({
    title: prefillTitle,
    description: prefillDescription,
    xp_reward: 50,
    urgency: 'medium' as MissionUrgency,
    targetType: 'team' as 'team' | 'individual',
    assigned_to: '',
    hasDeadline: false,
    deadline: '',
    needs_attachment: true, // Default to true for opportunity delegations
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

  const handleCreateMission = async () => {
    if (!newMission.title.trim()) return;

    try {
      let assigned_to = null;

      if (newMission.targetType === 'individual' && newMission.assigned_to) {
        assigned_to = newMission.assigned_to;
      }

      const { error } = await supabase.from('missions').insert([
        {
          title: newMission.title,
          description: newMission.description,
          xp_reward: newMission.xp_reward,
          urgency: newMission.urgency,
          deadline: newMission.hasDeadline ? newMission.deadline : null,
          assigned_to: assigned_to,
          created_by: userId,
          status: assigned_to ? 'assigned' : 'open',
          needs_attachment: newMission.needs_attachment,
        },
      ]);

      if (error) throw error;

      // Trigger Notification for the assigned technician
      if (assigned_to) {
        await supabase.from('notifications').insert({
          user_id: assigned_to,
          type: 'mission',
          title: 'Nouvelle mission assignée',
          content: `On vous a confié la mission : ${newMission.title}`,
          link: '/missions',
        });
      }

      // Reset form
      setNewMission({
        title: '',
        description: '',
        xp_reward: 50,
        urgency: 'medium',
        targetType: 'team',
        assigned_to: '',
        hasDeadline: false,
        deadline: '',
        needs_attachment: true,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating mission:', err);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Nouvelle Mission
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-rose-500 transition-colors">
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Titre de la mission
            </label>
            <input
              type="text"
              placeholder="ex: Rédiger la procédure VPN"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
              value={newMission.title}
              onChange={(e) => setNewMission({ ...newMission, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Description & Objectif
            </label>
            <textarea
              placeholder="Expliquez ce qui est attendu..."
              className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none"
              value={newMission.description}
              onChange={(e) => setNewMission({ ...newMission, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Echéance
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="noDeadline"
                    className="w-5 h-5 accent-indigo-600 rounded-lg cursor-pointer"
                    checked={!newMission.hasDeadline}
                    onChange={(e) =>
                      setNewMission({ ...newMission, hasDeadline: !e.target.checked })
                    }
                  />
                  <label
                    htmlFor="noDeadline"
                    className="text-xs font-bold text-slate-600 cursor-pointer">
                    Pas de délai
                  </label>
                </div>
                {newMission.hasDeadline && (
                  <input
                    type="date"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700"
                    value={newMission.deadline}
                    onChange={(e) =>
                      setNewMission({ ...newMission, deadline: e.target.value })
                    }
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Destinataire
              </label>
              <div className="flex flex-col gap-3">
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                  value={newMission.targetType}
                  onChange={(e) =>
                    setNewMission({
                      ...newMission,
                      targetType: e.target.value as 'team' | 'individual',
                    })
                  }>
                  <option value="team">Toute l'équipe</option>
                  <option value="individual">Individu spécifique</option>
                </select>
                {newMission.targetType === 'individual' && (
                  <select
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                    value={newMission.assigned_to}
                    onChange={(e) =>
                      setNewMission({ ...newMission, assigned_to: e.target.value })
                    }>
                    <option value="">Sélectionner un technicien</option>
                    {technicians.map((tech) => (
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Récompense XP
              </label>
              <input
                type="number"
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                value={newMission.xp_reward}
                onChange={(e) =>
                  setNewMission({ ...newMission, xp_reward: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Urgence
              </label>
              <select
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                value={newMission.urgency}
                onChange={(e) =>
                  setNewMission({ ...newMission, urgency: e.target.value as MissionUrgency })
                }>
                <option value="low">Libre</option>
                <option value="medium">Standard</option>
                <option value="high">Prioritaire</option>
                <option value="critical">Urgent</option>
              </select>
            </div>
          </div>

          <div
            className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between group/toggle hover:border-indigo-200 transition-all cursor-pointer"
            onClick={() =>
              setNewMission({ ...newMission, needs_attachment: !newMission.needs_attachment })
            }>
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all ${newMission.needs_attachment ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                <i className="fa-solid fa-paperclip"></i>
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                  Preuve de travail requise
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  Le technicien devra uploader un fichier pour valider.
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-6 rounded-full transition-all relative ${newMission.needs_attachment ? 'bg-indigo-600' : 'bg-slate-200'}`}>
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newMission.needs_attachment ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          <button
            onClick={handleCreateMission}
            disabled={!newMission.title.trim()}
            className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            Lancer la Mission
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateMissionModal;
