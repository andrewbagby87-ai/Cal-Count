import { useState } from 'react';
import { Food } from '../types';
import './AddPreviousFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}

export default function AddPreviousFoodModal({ foods, onAdd, onBack }: Props) {
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'serving' | 'g' | 'oz' | 'cup' | 'ml'>('serving');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood || !amount) {
      setError('Please select a food and enter an amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Calculate nutritional info based on amount
      const multiplier = unit === selectedFood.servingUnit
        ? amountNum / selectedFood.servingSize
        : amountNum / selectedFood.servingSize; // Simplified - would need conversion

      await onAdd({
        foodId: selectedFood.id,
        food: selectedFood,
        amount: amountNum,
        unit,
        calories: selectedFood.calories * multiplier,
        protein: selectedFood.protein ? selectedFood.protein * multiplier : undefined,
        fiber: selectedFood.fiber ? selectedFood.fiber * multiplier : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add food');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedFood) {
    return (
      <div className="previous-food-modal">
        <h3>Add Previous Food</h3>
        <div className="food-list">
          {foods.map((food) => (
            <button
              key={food.id}
              className="food-option"
              onClick={() => setSelectedFood(food)}
            >
              <div className="food-name">{food.name}</div>
              {food.brand && <div className="food-brand">{food.brand}</div>}
              <div className="food-serving">
                {food.servingSize}{food.servingUnit} - {food.calories} cal
              </div>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="previous-food-modal">
      <h3>Add {selectedFood.name}</h3>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleAddFood}>
        <div className="food-details">
          <p>
            <strong>Standard serving:</strong> {selectedFood.servingSize}{selectedFood.servingUnit}
          </p>
          <p>
            <strong>Calories per serving:</strong> {selectedFood.calories}
          </p>
          {selectedFood.protein && (
            <p>
              <strong>Protein per serving:</strong> {selectedFood.protein}g
            </p>
          )}
          {selectedFood.fiber && (
            <p>
              <strong>Fiber per serving:</strong> {selectedFood.fiber}g
            </p>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="amount">Amount *</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1"
              required
              min="0"
              step="0.1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unit *</label>
            <select
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
            >
              <option value="serving">Serving</option>
              <option value="g">Grams (g)</option>
              <option value="oz">Ounces (oz)</option>
              <option value="cup">Cup</option>
              <option value="ml">Milliliters (ml)</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding...' : 'Add to Log'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelectedFood(null)}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
