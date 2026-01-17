
import React from 'react';
import { User } from '../types';

const Account: React.FC<{ user: User }> = ({ user }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Photo de profil</h3>
        <div className="flex items-center gap-8">
          <img 
            src={user.avatarUrl} 
            className="w-24 h-24 rounded-full ring-4 ring-slate-100" 
            alt="Profil"
          />
          <div className="space-y-2">
            <button className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2">
              <i className="fa-solid fa-camera"></i> Changer la photo
            </button>
            <p className="text-xs text-slate-400">JPG, PNG ou GIF. Max 2MB</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-800">Informations personnelles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 ml-1">Prénom</label>
            <input type="text" defaultValue={user.firstName} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 ml-1">Nom</label>
            <input type="text" defaultValue={user.lastName} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 ml-1">Email professionnel</label>
            <input type="email" defaultValue={user.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 ml-1">Téléphone</label>
            <input type="text" defaultValue={user.phone} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all">
            <i className="fa-solid fa-save"></i> Sauvegarder
          </button>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-slate-800">Changer le mot de passe</h3>
        <div className="space-y-4">
          <input type="password" placeholder="Ancien mot de passe" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="password" placeholder="Nouveau mot de passe" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="password" placeholder="Confirmer le nouveau mot de passe" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex justify-end pt-4">
          <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all">
            <i className="fa-solid fa-key"></i> Mettre à jour le mot de passe
          </button>
        </div>
      </section>
    </div>
  );
};

export default Account;
