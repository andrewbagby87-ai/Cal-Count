import { useState } from 'react';
import { Food } from '../types';
import CreateFoodModal from './CreateFoodModal';
import AddPreviousFoodModal from './AddPreviousFoodModal';
import './AddFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  selectedDate?: string; // NEW: Accepts the date from the Food Log view
}

export default function AddFoodModal({ foods, onAdd, onClose, selectedDate }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'previous'>('choose');
  const [newFood, setNewFood] = useState<Food | null>(null);

  const handleFoodCreated = (food: Food) => {
    setNewFood(food);
    setMode('previous');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {mode === 'choose' && (
          <div className="choose-mode">
            <h3>Add Food</h3>
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => setMode('create')}>
                ➕ Create New Food
              </button>
              {foods.length > 0 && (
                <button className="btn btn-secondary" onClick={() => setMode('previous')}>
                  ⏱️ Add Previous Food
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
            initialDate={selectedDate} // NEW: Passes the date down to the Create Food modal
          />
        )}

        {mode === 'previous' && (
          <AddPreviousFoodModal
            foods={newFood ? [newFood, ...foods] : foods}
            onAdd={onAdd}
            onClose={onClose}
            onBack={() => setMode('choose')}
          />
        )}
      </div>
    </div>
  );
}