#!/bin/bash

# Installation des skills pour procedio

# Création du dossier des skills s'il n'existe pas
mkdir -p .agents/skills

# Installation des skills via npx
echo "Installation des skills Vercel (React, Web Design)..."
npx skills add vercel-labs/agent-skills

echo "Installation des skills Supabase (Postgres, Best Practices)..."
npx skills add supabase/agent-skills

echo "Installation terminée !"
