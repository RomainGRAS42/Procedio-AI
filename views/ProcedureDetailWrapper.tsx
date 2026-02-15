import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Procedure } from "../types";
import { supabase } from "../lib/supabase";
import ProcedureDetail from "./ProcedureDetail";

const ProcedureDetailWrapper: React.FC<{ user: User }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProcedure = async () => {
      if (!id) return;
      setLoading(true);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let query = supabase.from("procedures").select("*");
      
      if (isUUID) {
        query = query.or(`uuid.eq.${id},file_id.eq.${id}`);
      } else {
        query = query.eq("id", id);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (data) {
        setProcedure({
          id: data.uuid,
          uuid: data.uuid,
          file_id: data.file_id || data.uuid,
          title: data.title || "Sans titre",
          category: data.Type || "GÉNÉRAL",
          fileUrl: data.file_url,
          pinecone_document_id: data.pinecone_document_id,
          createdAt: data.created_at,
          views: data.views || 0,
          status: data.status || "validated",
        });
      }
      setLoading(false);
    };
    fetchProcedure();
  }, [id]);

  if (loading) return (
    <div className="flex justify-center p-20">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
    </div>
  );
  
  if (!procedure) return (
    <div className="text-center p-20 text-slate-500 font-bold">
      Procédure introuvable.
    </div>
  );

  return (
    <ProcedureDetail
      procedure={procedure}
      user={user}
      onBack={() => navigate(-1)}
    />
  );
};

export default ProcedureDetailWrapper;
