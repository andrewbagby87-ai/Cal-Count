import { useState } from 'react';
import { FoodLog } from '../types';
import './EditFoodLogModal.css';

interface Props {
  log: FoodLog;
  onSave: (updates: any) => Promise<void>;
  onClose: () => void;
}

export default function EditFoodLogModal({ log, onSave, onClose }: Props) {
  const [calories, setCalories] = useState(String(log.editedNutrition?.calories ?? log.calories));
  const [protein, setProtein] = useState(String(log.editedNutrition?.protein ?? log.protein ?? ''));
  const [fiber, setFiber] = useState(String(log.editedNutrition?.fiber ?? log.fiber ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!calories) throw new Error('Calories is required');
      const caloriesNum = parseFloat(calories);
      if (isNaN(caloriesNum) || caloriesNum < 0) throw new Error('Please enter a valid calorie amount');

      setLoading(true);
      await onSave({
        editedNutrition: {
          calories: caloriesNum,
          ...(protein && { protein: parseFloat(protein) }),
          ...(fiber && { fiber: parseFloat(fiber) }),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal">
          <h3>Edit {log.food.name}</h3>
          <p className="edit-info">Modify the nutrition values for this entry only</p>

          {error && <div className="error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="edit-calories">Calories *</label>
              <input
                id="edit-calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                required
                min="0"
                step="0.1"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-protein">Protein (g)</label>
                <input
                  id="edit-protein"
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-fiber">Fiber (g)</label>
                <input
                  id="edit-fiber"
                  type="number"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
