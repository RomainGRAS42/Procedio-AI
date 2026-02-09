import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source?: string;
}

interface RSSFeed {
  id: string;
  url: string;
  title: string;
  icon: string;
  is_global: boolean;
}

interface RSSWidgetProps {
  user: User;
}

const RSSWidget: React.FC<RSSWidgetProps> = ({ user }) => {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [items, setItems] = useState<RSSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newFeed, setNewFeed] = useState({ url: '', title: '', is_global: false });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    try {
      const { data, error } = await supabase
        .from('rss_feeds')
        .select('*');
      
      if (error) throw error;
      setFeeds(data || []);
      if (data && data.length > 0) {
        fetchAllItems(data);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching feeds:", err);
      setLoading(false);
    }
  };

  const fetchAllItems = async (feedList: RSSFeed[]) => {
    setLoading(true);
    try {
      const allItems: RSSItem[] = [];
      
      const fetchPromises = feedList.map(async (feed) => {
        try {
          // Use rss2json for robust CORS handling and pre-parsed JSON data
          const apiKey = ""; // Free tier doesn't strictly need one for low volume
          const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
          
          const res = await fetch(apiUrl);
          const data = await res.json();
          
          if (data.status !== 'ok') throw new Error(data.message);
          
          return data.items.slice(0, 5).map((item: any) => ({
            title: item.title || '',
            link: item.link || '',
            pubDate: item.pubDate || '',
            description: item.description?.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' || '',
            source: data.feed.title || feed.title
          }));
        } catch (e) {
          console.error(`Failed to fetch feed: ${feed.url}`, e);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(res => allItems.push(...res));
      
      // Sort by date
      allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      
      setItems(allItems.slice(0, 15));
    } catch (err) {
      console.error("Error fetching RSS items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeed = async () => {
    if (!newFeed.url.trim()) return;
    
    try {
      const payload = {
        url: newFeed.url.trim(),
        title: newFeed.title.trim() || "Nouveau flux",
        user_id: user.id,
        is_global: user.role === UserRole.MANAGER ? newFeed.is_global : false
      };

      const { data, error } = await supabase
        .from('rss_feeds')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // If tech added, notify manager via activity/note logic
      if (user.role === UserRole.TECHNICIAN) {
        await supabase.from('notes').insert([{
           user_id: user.id,
           title: `NOUVEAU_FLUX_RSS`,
           content: `💡 ${user.firstName} a ajouté une nouvelle source de veille : ${payload.title}.`,
           is_protected: false
        }]);
      }

      setFeeds([...feeds, data]);
      setIsAdding(false);
      setNewFeed({ url: '', title: '', is_global: false });
      fetchAllItems([...feeds, data]);
    } catch (err) {
      console.error("Error adding feed:", err);
    }
  };

  const deleteFeed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rss_feeds')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const updated = feeds.filter(f => f.id !== id);
      setFeeds(updated);
      fetchAllItems(updated);
    } catch (err) {
      console.error("Error deleting feed:", err);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col hover:border-indigo-100 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg border border-orange-100 shadow-sm">
            <i className="fa-solid fa-rss"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Veille Info</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Actualités & Tech</p>
          </div>
        </div>
        <button 
          onClick={() => setShowManageModal(true)}
          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-slate-100 transition-all flex items-center justify-center"
          title="Gérer les flux"
        >
          <i className="fa-solid fa-gear text-xs"></i>
        </button>
      </div>

      <div className="overflow-y-auto pr-2 scrollbar-hide space-y-3 h-[420px]">
        {loading ? (
          <div className="h-full flex items-center justify-center py-10 gap-3">
             <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Récupération des flux...</span>
          </div>
        ) : items.length > 0 ? (
          items.map((item, idx) => (
            <div 
              key={idx} 
              className="group block p-4 bg-slate-50/50 hover:bg-white border border-transparent hover:border-indigo-100 rounded-2xl transition-all relative"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {item.source}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-slate-400">
                    {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-5 h-5 rounded-md bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                    title="Ouvrir le lien externe"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  </a>
                </div>
              </div>
              <h4 className="font-bold text-slate-800 text-[13px] leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors mb-2">
                {item.title}
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-3 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                {item.description}
              </p>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center opacity-50">
             <i className="fa-solid fa-newspaper text-3xl text-slate-200 mb-3"></i>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aucun article à afficher</p>
             <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Ajoutez un flux pour commencer</p>
          </div>
        )}
      </div>

      <div 
        onClick={() => setShowManageModal(true)}
        className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between cursor-pointer group/manage"
      >
         <div className="flex -space-x-2">
            {feeds.slice(0, 3).map(f => (
              <div key={f.id} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 shadow-sm group-hover/manage:border-indigo-300 transition-colors" title={f.title}>
                 <i className={`fa-solid ${f.icon}`}></i>
              </div>
            ))}
            {feeds.length > 3 && (
              <div className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-400 group-hover/manage:bg-indigo-50 transition-colors">
                +{feeds.length - 3}
              </div>
            )}
            <div className="w-6 h-6 ml-4 opacity-0 group-hover/manage:opacity-100 transition-opacity flex items-center justify-center text-indigo-500">
              <i className="fa-solid fa-plus-circle text-[10px]"></i>
            </div>
         </div>
         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest group-hover/manage:text-indigo-400 transition-colors">Gérer les sources</span>
      </div>

      {/* Modal Gestion Flux */}
      {showManageModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-scale-up border border-slate-100 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-3 uppercase tracking-tight leading-none">
                  <i className="fa-solid fa-rss text-orange-500"></i> Gestion des Flux
                </h3>
                <button 
                  onClick={() => { setShowManageModal(false); setIsAdding(false); }}
                  className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all flex items-center justify-center"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
                <div className="space-y-2">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Sources Actives</p>
                   {feeds.map((feed) => (
                      <div key={feed.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/feed hover:bg-white transition-all">
                         <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover/feed:text-indigo-500 transition-colors">
                               <i className={`fa-solid ${feed.icon}`}></i>
                            </div>
                            <div className="min-w-0">
                               <p className="text-[11px] font-black text-slate-700 truncate capitalize">{feed.title}</p>
                               <div className="flex items-center gap-2">
                                  <p className="text-[8px] font-bold text-slate-400 truncate max-w-[150px]">{feed.url}</p>
                                  {feed.is_global && (
                                     <span className="text-[7px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Global</span>
                                  )}
                               </div>
                            </div>
                         </div>
                         <button 
                           onClick={() => deleteFeed(feed.id)}
                           className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                           title="Supprimer ce flux"
                         >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                         </button>
                      </div>
                   ))}
                   {feeds.length === 0 && (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aucun flux enregistré</p>
                      </div>
                   )}
                </div>

                {!isAdding ? (
                   <button 
                     onClick={() => setIsAdding(true)}
                     className="w-full py-4 mt-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-3"
                   >
                      <i className="fa-solid fa-plus-circle"></i>
                      Ajouter une nouvelle source
                   </button>
                ) : (
                   <div className="bg-white border-t border-slate-100 pt-6 mt-6 animate-fade-in space-y-4">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-4">Nouvelle Source</p>
                      <div>
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">URL du flux</label>
                         <input 
                           type="text" 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-xs font-bold text-slate-700 transition-all"
                           placeholder="https://.../rss.xml"
                           value={newFeed.url}
                           onChange={e => setNewFeed({...newFeed, url: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nom (Optionnel)</label>
                         <input 
                           type="text" 
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-xs font-bold text-slate-700 transition-all"
                           placeholder="Ex: Veille Cybersécurité"
                           value={newFeed.title}
                           onChange={e => setNewFeed({...newFeed, title: e.target.value})}
                         />
                      </div>
                      
                      {user.role === UserRole.MANAGER && (
                        <div className="pt-2">
                           <button 
                             onClick={() => setNewFeed({...newFeed, is_global: !newFeed.is_global})}
                             className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-full ${newFeed.is_global ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                           >
                              <i className={`fa-solid ${newFeed.is_global ? 'fa-check-circle' : 'fa-circle'}`}></i>
                              <span className="text-[10px] font-black uppercase tracking-widest">Diffuser à l'équipe</span>
                           </button>
                        </div>
                      )}

                      <div className="flex gap-3 mt-4">
                         <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all font-inter">Annuler</button>
                         <button 
                           onClick={handleAddFeed}
                           disabled={!newFeed.url}
                           className="flex-1 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-slate-900 transition-all disabled:opacity-50"
                          >
                            Ajouter
                          </button>
                      </div>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RSSWidget;
