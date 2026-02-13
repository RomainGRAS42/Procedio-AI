import React from 'react';

interface MasteryResultDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: any;
}

const MasteryResultDetailModal: React.FC<MasteryResultDetailModalProps> = ({ isOpen, onClose, claim }) => {
  if (!isOpen || !claim) return null;

  const quizData = claim.quiz_data || {};
  const questions = quizData.questions || [];
  const userAnswers = claim.user_answers || [];
  const score = claim.score || 0;
  const isSuccess = score >= 70;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {isSuccess ? 'Succès' : 'Échec'} • {score}%
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Examen de Maîtrise
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {claim.procedures?.title || 'Détails de l\'examen'}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1">
              Passé par {claim.user_profiles?.first_name} {claim.user_profiles?.last_name} le {new Date(claim.completed_at).toLocaleDateString()} à {new Date(claim.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-12 text-center">#</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Question</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Réponse Technicien</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Réponse Attendue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {questions.map((q: any, idx: number) => {
                  const userIdx = userAnswers[idx];
                  const isCorrect = userIdx === q.correct;
                  const userText = userIdx !== undefined ? q.options[userIdx] : 'Pas de réponse';
                  const correctText = q.options[q.correct];

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5 text-xs font-black text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-800 leading-snug">{q.q}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                          isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                        }`}>
                          <i className={`fa-solid ${isCorrect ? 'fa-check' : 'fa-xmark'} text-[10px]`}></i>
                          <span className="text-xs font-black">{userText}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
                          <i className="fa-solid fa-check text-[10px]"></i>
                          <span className="text-xs font-black">{correctText}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Fermer l'Analyse
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasteryResultDetailModal;
