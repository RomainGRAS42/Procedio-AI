import re

# Read the file
with open(r'c:\Users\romai\Downloads\procedio\views\Statistics.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the opportunity card div and add delete button after it
delete_button = '''                      {/* Delete Button */}
                      <button 
                        onClick={async () => {
                          try {
                            await supabase
                              .from('search_opportunities')
                              .update({ status: 'dismissed' })
                              .eq('term', opp.term);
                            
                            await fetchMissedOpportunities();
                            setToast({ message: 'Opportunité supprimée', type: 'success' });
                          } catch (error) {
                            console.error('Error dismissing opportunity:', error);
                            setToast({ message: 'Erreur lors de la suppression', type: 'error' });
                          }
                        }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-rose-200 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center shadow-sm z-20"
                        title="Supprimer cette opportunité"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>

'''

# Pattern to find the card div and insert delete button
pattern = r'(<div key={idx} className="p-5 rounded-\[1\.5rem\] bg-rose-50/50 border border-rose-100 hover:border-rose-300 transition-all group relative overflow-hidden">\n)(                      <div className="relative z-10">)'

replacement = r'\1' + delete_button + r'\2'

content = re.sub(pattern, replacement, content)

# Write back
with open(r'c:\Users\romai\Downloads\procedio\views\Statistics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Delete button added successfully')
