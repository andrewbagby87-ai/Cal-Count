import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFood, createFoodLog } from '../services/database';
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
    fat: '',
    saturatedFat: '',
    transFat: '',
    cholesterol: '',
    sodium: '',
    carbs: '',
    fiber: '',
    sugar: '',
    protein: '',
    servingSize: '',
    volume: '',
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

      // Build the nutrition object without undefined fields
      const nutritionData: any = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        calories: parseFloat(formData.calories),
        fat: formData.fat ? parseFloat(formData.fat) : undefined,
        saturatedFat: formData.saturatedFat ? parseFloat(formData.saturatedFat) : undefined,
        transFat: formData.transFat ? parseFloat(formData.transFat) : undefined,
        cholesterol: formData.cholesterol ? parseFloat(formData.cholesterol) : undefined,
        sodium: formData.sodium ? parseFloat(formData.sodium) : undefined,
        carbs: formData.carbs ? parseFloat(formData.carbs) : undefined,
        fiber: formData.fiber ? parseFloat(formData.fiber) : undefined,
        sugar: formData.sugar ? parseFloat(formData.sugar) : undefined,
        protein: formData.protein ? parseFloat(formData.protein) : undefined,
        servingSize: parseFloat(formData.servingSize),
        servingUnit: formData.servingUnit,
      };

      if (formData.volume && formData.volume.trim() !== '') {
        nutritionData.volume = parseFloat(formData.volume);
      }

      // 1. Create the base food definition
      const foodId = await createFood(user.uid, nutritionData);
      
      const foodObject: Food = {
        id: foodId,
        userId: user.uid,
        ...nutritionData,
        createdAt: Date.now(),
      };

      // 2. Save to consolidated foodLogs (HealthLog style)
      const today = new Date().toISOString().split('T')[0];
      await createFoodLog(user.uid, {
        date: today,
        foodId: foodId,
        food: foodObject,
        amount: nutritionData.servingSize,
        unit: nutritionData.servingUnit,
        ...nutritionData
      });

      onCreated(foodObject);
      onClose();
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

        {/* Nutrients - Each on its own line in specified order */}
        <div className="form-group">
          <label htmlFor="calories">Calories *</label>
          <input
            id="calories"
            type="number"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            placeholder="0"
            required
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="fat">Fat (g)</label>
          <input
            id="fat"
            type="number"
            name="fat"
            value={formData.fat}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="saturatedFat">Saturated Fat (g)</label>
          <input
            id="saturatedFat"
            type="number"
            name="saturatedFat"
            value={formData.saturatedFat}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="transFat">Trans Fat (g)</label>
          <input
            id="transFat"
            type="number"
            name="transFat"
            value={formData.transFat}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="cholesterol">Cholesterol (mg)</label>
          <input
            id="cholesterol"
            type="number"
            name="cholesterol"
            value={formData.cholesterol}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="sodium">Sodium (mg)</label>
          <input
            id="sodium"
            type="number"
            name="sodium"
            value={formData.sodium}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="carbs">Carbs (g)</label>
          <input
            id="carbs"
            type="number"
            name="carbs"
            value={formData.carbs}
            onChange={handleChange}
            placeholder="0"
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

        <div className="form-group">
          <label htmlFor="sugar">Sugar (g)</label>
          <input
            id="sugar"
            type="number"
            name="sugar"
            value={formData.sugar}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.1"
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
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        {/* Serving and Volume Information */}
        <div className="form-group">
          <label htmlFor="servingSize">Serving Size * (e.g., 1)</label>
          <input
            id="servingSize"
            type="number"
            name="servingSize"
            value={formData.servingSize}
            onChange={handleChange}
            placeholder="1"
            required
            min="0"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="volume">Volume (Optional)</label>
          <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="volume"
              type="number"
              name="volume"
              style={{ flex: 1 }}
              value={formData.volume}
              onChange={handleChange}
              placeholder="100"
              min="0"
              step="0.1"
            />
            <select
              id="servingUnit"
              name="servingUnit"
              style={{ width: 'auto', padding: '0.75rem' }}
              value={formData.servingUnit}
              onChange={handleChange}
            >
              <option value="g">Grams (g)</option>
              <option value="oz">Ounces (oz)</option>
              <option value="cup">Cup(s)</option>
              <option value="ml">Milliliters (ml)</option>
              <option value="serving">Serving</option>
            </select>
          </div>
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