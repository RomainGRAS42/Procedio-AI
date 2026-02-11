import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Mission, MissionStatus } from '../types';

interface MissionsContextType {
  missions: Mission[];
  loading: boolean;
  error: string | null;
  refreshMissions: () => Promise<void>;
  updateMissionStatus: (id: string, status: MissionStatus, notes?: string) => Promise<void>;
}

const MissionsContext = createContext<MissionsContextType | undefined>(undefined);

export const MissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select(`
          *,
          assignee:user_profiles!missions_assigned_to_fkey(first_name, last_name),
          creator:user_profiles!missions_created_by_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMissions(data || []);
    } catch (err: any) {
      console.error('Error fetching missions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();

    const channel = supabase
      .channel('missions_global_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchMissions(); // Refetch to get joined data
          } else if (payload.eventType === 'UPDATE') {
             // Optimistic update or refetch? Refetch is safer for joins
             fetchMissions();
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

  const updateMissionStatus = async (id: string, status: MissionStatus, notes?: string) => {
    try {
      const { error } = await supabase
        .from('missions')
        .update({ 
          status, 
          completion_notes: notes,
          // If status is 'assigned', we might need to set 'assigned_to'. 
          // But usually this logic is handled by specific actions. 
          // For simplicity here we just update fields passed.
        })
        .eq('id', id);

      if (error) throw error;
      // Realtime will handle state update
    } catch (err: any) {
      console.error("Error updating mission:", err);
      throw err;
    }
  };

  return (
    <MissionsContext.Provider value={{ missions, loading, error, refreshMissions: fetchMissions, updateMissionStatus }}>
      {children}
    </MissionsContext.Provider>
  );
};

export const useMissions = () => {
  const context = useContext(MissionsContext);
  if (context === undefined) {
    throw new Error('useMissions must be used within a MissionsProvider');
  }
  return context;
};
