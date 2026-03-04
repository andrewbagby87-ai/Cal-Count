// src/components/AddFoodModal.tsx
import { useState } from 'react';
import { Food } from '../types';
import CreateFoodModal from './CreateFoodModal';
import AddPreviousFoodModal from './AddPreviousFoodModal';
import './AddFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onFoodDeleted?: () => void; 
  selectedDate?: string; 
  isVitaminMode?: boolean; 
  initialFood?: Food | null; 
  initialUpc?: string | null; 
  onOpenRecipe?: () => void; // <-- THE TYPESCRIPT FIX
}

export default function AddFoodModal({ foods, onAdd, onClose, onFoodDeleted, selectedDate, isVitaminMode, initialFood, initialUpc, onOpenRecipe }: Props) {
  
  // If scanner found a match, jump straight to 'previous' view. 
  // If no match but UPC is present, jump to our new prompt screen!
  const [mode, setMode] = useState<'choose' | 'create' | 'previous' | 'choose-scan-type'>(
    initialFood ? 'previous' : (initialUpc ? 'choose-scan-type' : 'choose')
  );
  
  const [newFood, setNewFood] = useState<Food | null>(null);
  
  // Tracks if the user chose Food or Vitamin on the prompt screen
  const [scanVitaminMode, setScanVitaminMode] = useState<boolean | undefined>(undefined);

  // If they made a choice in the scan prompt, use it. Otherwise, rely on the main tab's choice.
  const activeVitaminMode = scanVitaminMode !== undefined ? scanVitaminMode : !!isVitaminMode;

  const filteredFoods = foods.filter(f => activeVitaminMode ? f.isVitamin : !f.isVitamin);

  const handleFoodCreated = (food: Food) => {
    setNewFood(food);
    setMode('previous');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        {mode === 'choose' && (
          <div className="choose-mode">
            <h3>{activeVitaminMode ? 'Add Vitamin' : 'Add Food'}</h3>
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => setMode('create')}>
                ➕ Create New {activeVitaminMode ? 'Vitamin' : 'Food'}
              </button>
              
              {/* --- THE NEW RECIPE BUTTON --- */}
              {!activeVitaminMode && onOpenRecipe && (
                <button className="btn btn-primary" style={{ backgroundColor: '#0f766e', borderColor: '#0f766e' }} onClick={onOpenRecipe}>
                  🥘 Create Recipe
                </button>
              )}

              {filteredFoods.length > 0 && (
                <button className="btn btn-secondary" onClick={() => setMode('previous')}>
                  ⏱️ Add Previous {activeVitaminMode ? 'Vitamin' : 'Food'}
                </button>
              )}
            </div>
            <button className="btn btn-outline cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {/* --- THE NEW INTERCEPT PROMPT --- */}
        {mode === 'choose-scan-type' && (
          <div className="choose-mode">
            <h3>Barcode Not Found</h3>
            <p style={{color: '#64748b', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem', padding: '0 1rem'}}>
              We didn't recognize the barcode <br/>
              <strong style={{color: '#1e293b', fontSize: '1rem', display: 'inline-block', margin: '0.5rem 0'}}>{initialUpc}</strong><br/>
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
            <button className="btn btn-outline cancel-btn" style={{marginTop: '1rem'}} onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'create' && (
          <CreateFoodModal 
            onCreated={handleFoodCreated} 
            onClose={onClose} 
            initialDate={selectedDate} 
            isVitaminMode={activeVitaminMode}
            initialUpc={initialUpc || undefined}
          />
        )}

        {mode === 'previous' && (
          <AddPreviousFoodModal
            // If newFood exists, throw it at the top of the list so they can easily pick it
            foods={newFood ? [newFood, ...filteredFoods] : filteredFoods}
            onAdd={onAdd}
            onClose={onClose}
            onBack={() => setMode('choose')}
            onFoodDeleted={onFoodDeleted} 
            initialDate={selectedDate}
            isVitaminMode={activeVitaminMode}
            // If they just created a new item, auto-select it instantly!
            initialFood={initialFood || newFood || undefined}
          />
        )}
      </div>
    </div>
  );
}