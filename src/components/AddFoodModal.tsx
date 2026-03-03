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
  onFoodDeleted?: () => void; // NEW
  selectedDate?: string; 
  isVitaminMode?: boolean; 
}

export default function AddFoodModal({ foods, onAdd, onClose, onFoodDeleted, selectedDate, isVitaminMode }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'previous'>('choose');
  const [newFood, setNewFood] = useState<Food | null>(null);

  // Filters perfectly: Only show vitamins in Vitamin mode, only show foods in Food mode
  const filteredFoods = foods.filter(f => isVitaminMode ? f.isVitamin : !f.isVitamin);

  const handleFoodCreated = (food: Food) => {
    setNewFood(food);
    setMode('previous');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {mode === 'choose' && (
          <div className="choose-mode">
            <h3>{isVitaminMode ? 'Add Vitamin' : 'Add Food'}</h3>
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => setMode('create')}>
                ➕ Create New {isVitaminMode ? 'Vitamin' : 'Food'}
              </button>
              {filteredFoods.length > 0 && (
                <button className="btn btn-secondary" onClick={() => setMode('previous')}>
                  ⏱️ Add Previous {isVitaminMode ? 'Vitamin' : 'Food'}
                </button>
              )}
            </div>
            <button className="btn btn-outline cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'create' && (
          <CreateFoodModal 
            onCreated={handleFoodCreated} 
            onClose={onClose} 
            initialDate={selectedDate} 
            isVitaminMode={isVitaminMode}
          />
        )}

        {mode === 'previous' && (
          <AddPreviousFoodModal
            foods={newFood ? [newFood, ...filteredFoods] : filteredFoods}
            onAdd={onAdd}
            onClose={onClose}
            onBack={() => setMode('choose')}
            onFoodDeleted={onFoodDeleted} // NEW: Pass the handler down
            initialDate={selectedDate}
            isVitaminMode={isVitaminMode}
          />
        )}
      </div>
    </div>
  );
}