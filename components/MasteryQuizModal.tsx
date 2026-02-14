import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User, Procedure } from '../types';

interface MasteryQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  procedure: Procedure;
  user: User;
  quizData: any; // The JSON with questions
  masteryRequestId: string;
  onSuccess: (score: number, level: number) => void;
}

const TIMER_SECONDS = 45;

const MasteryQuizModal: React.FC<MasteryQuizModalProps> = ({
  isOpen,
  onClose,
  procedure,
  user,
  quizData,
  masteryRequestId,
  onSuccess
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Normalisation des données du quiz (supporte tableau direct, objet {questions: []} et noms de clés variés)
  const questions = React.useMemo(() => {
    let rawQuestions = [];
    
    if (Array.isArray(quizData)) {
      rawQuestions = quizData;
    } else if (quizData?.questions && Array.isArray(quizData.questions)) {
      rawQuestions = quizData.questions;
    } else {
      console.warn("MasteryQuizModal: Format de données invalide ou vide.", quizData);
      return [];
    }

    return rawQuestions.map((item: any) => ({
      q: item.q || item.question || "Question manquante",
      options: Array.isArray(item.options) ? item.options : ["Option A", "Option B", "Option C", "Option D"],
      correct: typeof item.correct === 'number' ? item.correct : (typeof item.correctAnswer === 'number' ? item.correctAnswer : 0)
    }));
  }, [quizData]);

  useEffect(() => {
    if (isOpen && !isFinished) {
      startTimer();
    }
    return () => stopTimer();
  }, [isOpen, currentQuestionIndex, isFinished]);

  const startTimer = () => {
    stopTimer();
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNextQuestion(-1); // Auto-fail the question
          return TIMER_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleNextQuestion = (selectedOptionIndex: number) => {
    const newAnswers = [...answers, selectedOptionIndex];
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers: number[]) => {
    stopTimer();
    setIsFinished(true);

    // Calculate score
    let correctCount = 0;
    finalAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].correct) correctCount++;
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    setScore(finalScore);

    // Determine Level
    let level = 1;
    if (finalScore === 100) level = 4;
    else if (finalScore >= 85) level = 3;
    else if (finalScore >= 70) level = 2;

    setIsSubmitting(true);
    try {
      // 1. Update mastery_request
      await supabase
        .from('mastery_requests')
        .update({
          status: 'completed',
          score: finalScore,
          completed_at: new Date().toISOString(),
          user_answers: finalAnswers,
          is_read_by_manager: false // Reset so manager sees new alert
        })
        .eq('id', masteryRequestId);

      // 2. Update user_expertise
      const userProfileId = user.id;
      const procUuid = procedure.db_id || procedure.uuid;

      if (procUuid) {
        await supabase
          .from('user_expertise')
          .upsert({
            user_id: userProfileId,
            procedure_id: procUuid,
            level: level,
            achieved_score: finalScore,
            last_tested_at: new Date().toISOString()
          });

        // 3. Notify Manager with summary (Details are available in Pilotage Center)
        await supabase.from("notes").insert([
          {
            title: `CLAIM_MASTERY_RESULT_${masteryRequestId}`,
            content: `${user.firstName} a terminé l'examen de maîtrise sur "${procedure.title}" avec un score de ${finalScore}%. (Détails disponibles dans le Centre de Pilotage)`,
            is_protected: false,
            user_id: user.id,
            tags: ["MASTERY_RESULT", "COMPLETED"],
            viewed: false
          },
        ]);

        // 4. Grant XP Reward
        if (finalScore >= 70) {
          const xpReward = finalScore === 100 ? 100 : finalScore >= 85 ? 75 : 50;
          await supabase.rpc('increment_user_xp', {
            target_user_id: user.id,
            xp_amount: xpReward,
            reason: `Maîtrise validée : ${procedure.title} (${finalScore}%)`
          });
        }
      }

      onSuccess(finalScore, level);
    } catch (err) {
      console.error("Error saving quiz results:", err);
      alert("Erreur lors de la sauvegarde de vos résultats. Veuillez vérifier votre connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden relative">
        
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 h-1.5 bg-slate-100 w-full">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          ></div>
        </div>

        {!isFinished ? (
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Question {currentQuestionIndex + 1} / {questions.length}
              </span>
              
              {/* Chrono */}
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                     <circle
                       cx="24" cy="24" r="20"
                       stroke="currentColor" strokeWidth="3" fill="transparent"
                       className="text-slate-100"
                     />
                     <circle
                       cx="24" cy="24" r="20"
                       stroke="currentColor" strokeWidth="3" fill="transparent"
                       strokeDasharray={126}
                       strokeDashoffset={126 - (126 * timeLeft) / TIMER_SECONDS}
                       className={`${timeLeft < 10 ? 'text-rose-500 animate-pulse' : timeLeft < 20 ? 'text-amber-500' : 'text-emerald-500'} transition-all duration-1000`}
                     />
                   </svg>
                   <span className={`absolute text-xs font-black ${timeLeft < 10 ? 'text-rose-600' : 'text-slate-700'}`}>
                     {timeLeft}
                   </span>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-black text-slate-800 leading-tight mb-10">
              {questions[currentQuestionIndex].q}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {questions[currentQuestionIndex].options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleNextQuestion(idx)}
                  className="group p-5 rounded-2xl border-2 border-slate-50 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-left flex items-center gap-4 active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-xs font-black transition-all border border-slate-100">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="font-bold text-slate-700 group-hover:text-indigo-900 transition-colors">
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className={`w-24 h-24 rounded-[2rem] mx-auto flex items-center justify-center text-4xl mb-8 shadow-xl ${score >= 70 ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-rose-500 text-white shadow-rose-200'}`}>
              <i className={`fa-solid ${score >= 70 ? 'fa-award' : 'fa-circle-xmark'}`}></i>
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 mb-2">
              {score >= 70 ? 'Félicitations !' : 'Oups...'}
            </h2>
            <p className="text-slate-500 font-bold mb-8">
              Examen sur : <span className="text-slate-900">{procedure.title}</span><br/>
              Vous avez obtenu un score de <span className="text-indigo-600 font-black">{score}%</span>
            </p>

            <div className="bg-slate-50 rounded-3xl p-6 mb-10 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Niveau Attribué</p>
              <div className="flex items-center justify-center gap-3">
                 <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xl font-black text-slate-800">Niveau {
                      score === 100 ? '4 (Référent)' :
                      score >= 85 ? '3 (Expert)' :
                      score >= 70 ? '2 (Pratique)' : '1 (Apprentissage)'
                    }</span>
                 </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
            >
              Terminer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasteryQuizModal;
