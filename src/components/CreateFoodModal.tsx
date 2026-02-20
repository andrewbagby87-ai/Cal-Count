import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFood } from '../services/database';
import { Food } from '../types';
import './CreateFoodModal.css';

interface Props {
  onCreated: (food: Food) => void;
  onClose: () => void;
}

export default function CreateFoodModal({ onCreated, onClose }: Props) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    calories: '',
    protein: '',
    fiber: '',
    servingSize: '',
    servingUnit: 'g' as const,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('User not found');
      if (!formData.name.trim()) throw new Error('Food name is required');
      if (!formData.calories) throw new Error('Calories is required');
      if (!formData.servingSize) throw new Error('Serving size is required');

      const foodId = await createFood(user.uid, {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        calories: parseFloat(formData.calories),
        protein: formData.protein ? parseFloat(formData.protein) : undefined,
        fiber: formData.fiber ? parseFloat(formData.fiber) : undefined,
        servingSize: parseFloat(formData.servingSize),
        servingUnit: formData.servingUnit,
      });

      onCreated({
        id: foodId,
        userId: user.uid,
        name: formData.name,
        brand: formData.brand || undefined,
        calories: parseFloat(formData.calories),
        protein: formData.protein ? parseFloat(formData.protein) : undefined,
        fiber: formData.fiber ? parseFloat(formData.fiber) : undefined,
        servingSize: parseFloat(formData.servingSize),
        servingUnit: formData.servingUnit,
        createdAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-food-modal">
      <h3>Create New Food</h3>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Food Name *</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Grilled Chicken Breast"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="brand">Brand (Optional)</label>
          <input
            id="brand"
            type="text"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            placeholder="e.g., Tyson"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="calories">Calories *</label>
            <input
              id="calories"
              type="number"
              name="calories"
              value={formData.calories}
              onChange={handleChange}
              placeholder="165"
              required
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="protein">Protein (g)</label>
            <input
              id="protein"
              type="number"
              name="protein"
              value={formData.protein}
              onChange={handleChange}
              placeholder="31"
              min="0"
              step="0.1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="fiber">Fiber (g)</label>
            <input
              id="fiber"
              type="number"
              name="fiber"
              value={formData.fiber}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.1"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="servingSize">Serving Size *</label>
          <input
            id="servingSize"
            type="number"
            name="servingSize"
            value={formData.servingSize}
            onChange={handleChange}
            placeholder="100"
            required
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="servingUnit">Volume Unit (Optional)</label>
          <select
            id="servingUnit"
            name="servingUnit"
            value={formData.servingUnit}
            onChange={handleChange}
          >
            <option value="g">Grams (g)</option>
            <option value="oz">Ounces (oz)</option>
            <option value="cup">Cup</option>
            <option value="ml">Milliliters (ml)</option>
            <option value="serving">Serving</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Food'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
