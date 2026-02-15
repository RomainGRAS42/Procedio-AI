import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Procedure } from "../types";

export const useSearchSuggestions = (localSearch: string, onSearch: (term: string) => void, onSelectProcedure?: (proc: any) => void) => {
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (localSearch.trim().length < 2) {
        setAutocompleteSuggestions([]);
        return;
      }

      const { data } = await supabase
        .from('procedures')
        .select('*')
        .ilike('title', `%${localSearch}%`)
        .limit(5);
      
      if (data) {
        const formattedData: Procedure[] = data.map((f: any, index: number) => ({
          id: f.uuid || f.id || `webhook-${index}`,
          db_id: f.uuid || f.id,
          file_id: f.uuid || f.id || `webhook-${index}`,
          title: f.title || "Sans titre",
          category: f.Type || 'NON CLASSÉ',
          fileUrl: f.file_url,
          createdAt: f.created_at,
          views: f.views || 0,
          status: f.status || 'validated'
        }));
        setAutocompleteSuggestions(formattedData);
        setSelectedIndex(-1);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [localSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocompleteSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const selected = autocompleteSuggestions[selectedIndex];
        setAutocompleteSuggestions([]);
        if (onSelectProcedure) {
          onSelectProcedure(selected);
        } else {
          onSearch(selected.title);
        }
        return true; // Handled
      }
    }
    return false; // Not handled
  };

  return {
    autocompleteSuggestions,
    setAutocompleteSuggestions,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown
  };
};
