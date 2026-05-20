// src/components/AddFoodModal.tsx
import { useState, useEffect } from 'react';
import { Food } from '../types';
import CreateFoodModal from './CreateFoodModal';
import AddPreviousFoodModal from './AddPreviousFoodModal';
import BarcodeScanner from './BarcodeScanner';
import { updateFood } from '../services/database'; // NEW IMPORT
import './AddFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onFoodDeleted?: () => void; 
  selectedDate?: string; 
  isVitaminMode?: boolean; 
  initialMealType?: string; 
  remainingCalories?: number; 
  onOpenRecipe?: (foodToEdit?: Food) => void;
}

export default function AddFoodModal({ foods, onAdd, onClose, onFoodDeleted, selectedDate, isVitaminMode, initialMealType, remainingCalories, onOpenRecipe }: Props) {
  
  // Added 'link-existing' to mode states
  const [mode, setMode] = useState<'create' | 'previous' | 'choose-scan-type' | 'link-existing'>('previous');
  
  const [newFood, setNewFood] = useState<Food | null>(null);
  const [scanVitaminMode, setScanVitaminMode] = useState<boolean | undefined>(undefined);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [localInitialFood, setLocalInitialFood] = useState<Food | null>(null);
  const [localInitialUpc, setLocalInitialUpc] = useState<string | null>(null);
  
  const [linkSearch, setLinkSearch] = useState(''); // Search state for linking

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const activeVitaminMode = scanVitaminMode !== undefined ? scanVitaminMode : !!isVitaminMode;
  const filteredFoods = foods.filter(f => activeVitaminMode ? f.isVitamin : !f.isVitamin);

  const handleFoodCreated = async (payload: any) => {
    if (payload && payload.mealType !== undefined) {
      await onAdd(payload);
    }
    onClose();
  };

  const handleScanSuccess = (code: string) => {
    setIsScannerOpen(false);
    
    // UPDATED: Check both standard upc and upcs array
    const matchedFood = foods.find(f => f.upc === code || f.upcs?.includes(code));
    
    if (matchedFood) {
      setLocalInitialFood({ ...matchedFood }); 
      setLocalInitialUpc(null);
      setScanVitaminMode(!!matchedFood.isVitamin);
      setMode('previous');
    } else {
      setLocalInitialFood(null);
      setLocalInitialUpc(code);
      setMode('choose-scan-type');
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          
          {mode === 'choose-scan-type' && (
            <div className="choose-mode">
              <h3>Barcode Not Found</h3>
              <p style={{color: '#64748b', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem', padding: '0 1rem'}}>
                We didn't recognize the barcode <br/>
                <strong style={{color: '#1e293b', fontSize: '1rem', display: 'inline-block', margin: '0.5rem 0'}}>{localInitialUpc}</strong><br/>
                What type of item are you scanning?
              </p>
              <div className="button-group">
                <button className="btn btn-primary" onClick={() => { setScanVitaminMode(false); setMode('create'); }}>
                  🍎 Food
                </button>
                <button className="btn btn-primary" style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={() => { setScanVitaminMode(true); setMode('create'); }}>
                  💊 Vitamin
                </button>
              </div>
              <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => setMode('link-existing')}>
                🔗 Add to Existing Food
              </button>
              <button className="btn btn-outline cancel-btn" onClick={() => setMode('previous')}>
                Cancel
              </button>
            </div>
          )}

          {/* NEW LINKING FLOW */}
          {mode === 'link-existing' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Link to Existing Food</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                Select a food from your library to link the barcode <strong>{localInitialUpc}</strong> to.
              </p>
              
              <input 
                type="text" 
                placeholder="Search your foods..." 
                value={linkSearch} 
                onChange={(e) => setLinkSearch(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}
              />
              
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', maxHeight: '50vh' }}>
                {foods.filter(f => f.name.toLowerCase().includes(linkSearch.toLowerCase())).map(f => (
                  <div 
                    key={f.id} 
                    onClick={async () => {
                      if (!localInitialUpc) return;
                      const currentUpcs = f.upcs ? [...f.upcs] : (f.upc ? [f.upc] : []);
                      if (!currentUpcs.includes(localInitialUpc)) {
                        currentUpcs.push(localInitialUpc);
                        
                        // Save directly to db
                        await updateFood(f.id, { upcs: currentUpcs, upc: currentUpcs[0] });
                        
                        // Force a refresh so library lists know about it
                        window.dispatchEvent(new Event('foodLibraryChanged'));
                        
                        // Update local object immediately for logging flow
                        f.upcs = currentUpcs;
                        f.upc = currentUpcs[0];
                      }
                      
                      // Push user into logging flow with this newly updated item
                      setLocalInitialFood({ ...f });
                      setLocalInitialUpc(null);
                      setScanVitaminMode(!!f.isVitamin);
                      setMode('previous');
                    }}
                    style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{f.brand}</span>
                  </div>
                ))}
                {foods.filter(f => f.name.toLowerCase().includes(linkSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No foods match your search.</div>
                )}
              </div>
              
              <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setMode('choose-scan-type')}>
                ← Back
              </button>
            </div>
          )}

          {mode === 'create' && (
            <CreateFoodModal 
              onCreated={handleFoodCreated} 
              onClose={() => setMode('previous')} 
              initialDate={selectedDate} 
              isVitaminMode={activeVitaminMode}
              initialUpc={localInitialUpc || undefined}
              initialMealType={initialMealType}
              foods={foods} 
            />
          )}

          {mode === 'previous' && (
            <AddPreviousFoodModal
              foods={newFood ? [newFood, ...filteredFoods] : filteredFoods}
              onAdd={onAdd}
              onClose={onClose}
              onBack={onClose} 
              onFoodDeleted={onFoodDeleted} 
              initialDate={selectedDate}
              isVitaminMode={activeVitaminMode}
              initialFood={localInitialFood || undefined}
              initialMealType={initialMealType} 
              remainingCalories={remainingCalories} 
              onEditRecipe={onOpenRecipe}
              onCreateNew={() => setMode('create')}
              onCreateRecipe={() => onOpenRecipe && onOpenRecipe()}
              onOpenScanner={() => setIsScannerOpen(true)} 
            />
          )}
        </div>
      </div>
      
      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}
    </>
  );
}