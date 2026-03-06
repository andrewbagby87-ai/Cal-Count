// src/components/AddFoodModal.tsx
import { useState } from 'react';
import { Food } from '../types';
import CreateFoodModal from './CreateFoodModal';
import AddPreviousFoodModal from './AddPreviousFoodModal';
import BarcodeScanner from './BarcodeScanner';
import './AddFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onFoodDeleted?: () => void; 
  selectedDate?: string; 
  isVitaminMode?: boolean; 
  initialMealType?: string; 
  onOpenRecipe?: (foodToEdit?: Food) => void;
}

export default function AddFoodModal({ foods, onAdd, onClose, onFoodDeleted, selectedDate, isVitaminMode, initialMealType, onOpenRecipe }: Props) {
  
  // Default directly to the 'previous' list unless a brand new barcode was scanned
  const [mode, setMode] = useState<'create' | 'previous' | 'choose-scan-type'>(
    // Note: Assuming initialUpc logic was passed here in your implementation
    'previous'
  );
  
  const [newFood, setNewFood] = useState<Food | null>(null);
  const [scanVitaminMode, setScanVitaminMode] = useState<boolean | undefined>(undefined);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [localInitialFood, setLocalInitialFood] = useState<Food | null>(null);
  const [localInitialUpc, setLocalInitialUpc] = useState<string | null>(null);

  const activeVitaminMode = scanVitaminMode !== undefined ? scanVitaminMode : !!isVitaminMode;
  const filteredFoods = foods.filter(f => activeVitaminMode ? f.isVitamin : !f.isVitamin);

  const handleFoodCreated = (food: Food) => {
    setNewFood(food);
    setLocalInitialFood(food);
    setMode('previous');
  };

  const handleScanSuccess = (code: string) => {
    setIsScannerOpen(false);
    const matchedFood = foods.find(f => f.upc === code);
    
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
      {/* DISABLED BACKGROUND CLICK WHEN CREATING A FOOD */}
      <div className="modal-overlay" onClick={mode === 'create' ? undefined : onClose}>
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
              <button className="btn btn-outline cancel-btn" style={{marginTop: '1rem'}} onClick={() => setMode('previous')}>
                Cancel
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