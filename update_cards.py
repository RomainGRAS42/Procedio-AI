import re

# Read the file
with open(r'c:\Users\romai\Downloads\procedio\views\Statistics.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and modify the opportunity cards section
in_opportunity_section = False
modified_lines = []

for i, line in enumerate(lines):
    # Detect start of opportunity card
    if 'missedOpportunities.slice(0, layoutMode' in line:
        in_opportunity_section = True
    
    # Remove cursor-pointer
    if in_opportunity_section and 'cursor-pointer' in line:
        line = line.replace('cursor-pointer ', '')
    
    # Change flex to grid for buttons container
    if in_opportunity_section and 'flex items-center gap-2 mt-4' in line:
        line = line.replace('flex items-center gap-2 mt-4', 'grid grid-cols-2 gap-2')
    
    # Update h3 styling
    if in_opportunity_section and 'font-black text-slate-900 text-lg capitalize mb-3' in line:
        line = line.replace('mb-3 leading-tight truncate', 'mb-4 leading-tight truncate pr-6')
    
    # Update primary button styling
    if in_opportunity_section and 'flex-1 flex items-center justify-center gap-2 text-[10px]' in line:
        line = line.replace('flex-1 flex items-center justify-center gap-2 text-[10px] font-black text-white uppercase tracking-widest', 
                          'flex items-center justify-center gap-1.5 text-[9px] font-black text-white uppercase tracking-wider')
        line = line.replace('px-3 py-2.5', 'px-3 py-3')
    
    # Update secondary button styling
    if in_opportunity_section and 'flex items-center justify-center gap-2 text-[10px] font-black text-indigo-600' in line:
        line = line.replace('gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest', 
                          'gap-1.5 text-[9px] font-black text-indigo-600 uppercase tracking-wider')
        line = line.replace('px-3 py-2.5', 'px-3 py-3')
    
    # Update icon sizes and button text
    if in_opportunity_section and 'fa-solid fa-plus"></i>' in line:
        line = line.replace('fa-solid fa-plus"></i>', 'fa-solid fa-plus text-xs"></i>')
        # Next line should have CRÉER
        if i + 1 < len(lines) and 'CRÉER' in lines[i + 1]:
            lines[i + 1] = lines[i + 1].replace('CRÉER', '<span>Créer</span>')
    
    if in_opportunity_section and 'fa-solid fa-paper-plane"></i>' in line:
        line = line.replace('fa-solid fa-paper-plane"></i>', 'fa-solid fa-paper-plane text-xs"></i>\n                            <span>Déléguer</span>')
    
    # Remove title attribute
    if in_opportunity_section and 'title="Déléguer la création en mission"' in line:
        line = line.replace('\n                            title="Déléguer la création en mission"', '')
    
    modified_lines.append(line)

# Write back
with open(r'c:\Users\romai\Downloads\procedio\views\Statistics.tsx', 'w', encoding='utf-8', newline='') as f:
    f.writelines(modified_lines)

print('File updated successfully')
