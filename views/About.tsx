
import React from 'react';

const About: React.FC = () => {
  return (
    <div className="relative min-h-[calc(100vh-10rem)] animate-slide-up">
      <div className="max-w-4xl mx-auto space-y-16 relative z-10">
        <section className="text-center space-y-6 pt-10">
          <div className="inline-flex px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-4">
            Notre Mission
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
            Simplifier l'IT <br/> 
            <span className="text-indigo-600">par l'Intelligence.</span>
          </h2>
          <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            Procedio est né d'un constat simple : les techniciens passent trop de temps à chercher l'information. Nous transformons vos documents statiques en experts dynamiques.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-500/5 space-y-6 group hover:-translate-y-2 transition-all">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">
              <i className="fa-solid fa-robot"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-900">IA Contextuelle</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Grâce à l'indexation n8n et aux modèles Gemini, notre assistant comprend le contenu exact de vos procédures PDF pour répondre à vos questions en quelques secondes.
            </p>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-500/5 space-y-6 group hover:-translate-y-2 transition-all">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-900">Sécurité & Privé</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Vos données sont stockées sur des instances Supabase sécurisées. L'accès aux notes confidentielles est protégé par un double verrouillage de session.
            </p>
          </div>
        </div>

        <section className="bg-slate-900 rounded-[3.5rem] p-12 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-3xl font-black text-white tracking-tight">Envie de contribuer ?</h3>
            <p className="text-slate-400 font-medium text-lg mb-8 max-w-md mx-auto">
              Procedio est un projet évolutif. Retrouvez le code source et la documentation technique sur GitHub.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="https://github.com/RomainGRAS42/Procedio-AI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 hover:text-white transition-all shadow-2xl"
              >
                <i className="fa-brands fa-github text-lg"></i>
                Voir sur GitHub
              </a>
            </div>
          </div>
        </section>

        <footer className="text-center py-10 opacity-30">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">
            Procedio © 2024 • Making Digital Impact
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;
