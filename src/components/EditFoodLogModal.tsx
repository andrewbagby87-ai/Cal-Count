import { useState } from 'react';
import { FoodLog } from '../types';
import './CreateFoodModal.css';

interface Props {
  log: FoodLog;
  onSave: (updates: Partial<FoodLog>) => void;
  onClose: () => void;
}

export default function EditFoodLogModal({ log, onSave, onClose }: Props) {
  // Helper to safely convert existing numbers to strings for the text inputs
  const toStr = (val: any) => (val !== undefined && val !== null ? String(val) : '');

  // Aliases to bypass TypeScript errors for our newly added nutrition fields
  const f = log.food as any;
  const l = log as any;
const [formData, setFormData] = useState({
    name: log.food?.name || l.name || '',
    brand: log.food?.brand || l.brand || '',
    calories: toStr(log.editedNutrition?.calories ?? log.food?.calories ?? l.calories),
    fat: toStr(log.food?.fat ?? l.fat),
    saturatedFat: toStr(f?.saturatedFat ?? l.saturatedFat),
    transFat: toStr(f?.transFat ?? l.transFat),
    cholesterol: toStr(f?.cholesterol ?? l.cholesterol),
    sodium: toStr(f?.sodium ?? l.sodium),
    carbs: toStr(log.food?.carbs ?? l.carbs),
    fiber: toStr(f?.fiber ?? l.fiber),
    sugar: toStr(f?.sugar ?? l.sugar),
    protein: toStr(log.food?.protein ?? l.protein),
    
    servingSize: toStr(log.amount ?? '1'),
    volume: toStr(f?.volume ?? l.volume),
    volumeUnit: f?.volumeUnit ?? l.volumeUnit ?? 'g',
    
    date: log.date || new Date().toISOString().split('T')[0],
    mealType: l.mealType && l.mealType !== 'Uncategorized' ? l.mealType : '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Stop letters/symbols from being typed into our text-based number fields
    if (name !== 'name' && name !== 'brand' && name !== 'volumeUnit' && name !== 'date' && name !== 'mealType') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        return; 
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const safeParse = (val: string) => {
    if (!val) return undefined;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : Number(parsed.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.name.trim()) throw new Error('Food name is required');
      if (!formData.calories) throw new Error('Calories is required');
      if (!formData.servingSize) throw new Error('Number of servings is required');
      if (!formData.mealType) throw new Error('A meal category is required');

      const rawNutritionData: any = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        calories: safeParse(formData.calories) || 0,
        fat: safeParse(formData.fat),
        saturatedFat: safeParse(formData.saturatedFat),
        transFat: safeParse(formData.transFat),
        cholesterol: safeParse(formData.cholesterol),
        sodium: safeParse(formData.sodium),
        carbs: safeParse(formData.carbs),
        fiber: safeParse(formData.fiber),
        sugar: safeParse(formData.sugar),
        protein: safeParse(formData.protein),
        
        // Ensure amount is saved as a numeric value
        servingSize: safeParse(formData.servingSize) || 1,
      };

      if (formData.volume && formData.volume.trim() !== '') {
        rawNutritionData.volume = safeParse(formData.volume);
        rawNutritionData.volumeUnit = formData.volumeUnit;
      }

      // Strip out all undefined values so Firebase doesn't crash
      const cleanNutritionData = Object.fromEntries(
        Object.entries(rawNutritionData).filter(([_, v]) => v !== undefined)
      ) as any;

      // Make sure we update the nested `food` object so the UI reflects the changes instantly
      const updatedFood = {
        ...log.food,
        ...cleanNutritionData
      };

      onSave({
        date: formData.date,
        mealType: formData.mealType,
        amount: cleanNutritionData.servingSize,
        unit: 'serving',
        food: updatedFood,
        ...cleanNutritionData,
        editedNutrition: { calories: cleanNutritionData.calories } // Fallback for backwards compatibility
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="create-food-modal" style={{ maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
          
          <h3 style={{ marginTop: 0 }}>Edit Logged Food</h3>
          {error && <div className="error">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            
            {/* --- CORE INFO --- */}
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

            {/* --- NUTRITION --- */}
            <div className="form-group">
              <label htmlFor="calories">Calories *</label>
              <input
                id="calories"
                type="text"
                inputMode="decimal"
                name="calories"
                value={formData.calories}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fat">Fat (g)</label>
              <input id="fat" type="text" inputMode="decimal" name="fat" value={formData.fat} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="saturatedFat">Saturated Fat (g)</label>
              <input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={formData.saturatedFat} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="transFat">Trans Fat (g)</label>
              <input id="transFat" type="text" inputMode="decimal" name="transFat" value={formData.transFat} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="cholesterol">Cholesterol (mg)</label>
              <input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={formData.cholesterol} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="sodium">Sodium (mg)</label>
              <input id="sodium" type="text" inputMode="decimal" name="sodium" value={formData.sodium} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="carbs">Carbs (g)</label>
              <input id="carbs" type="text" inputMode="decimal" name="carbs" value={formData.carbs} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="fiber">Fiber (g)</label>
              <input id="fiber" type="text" inputMode="decimal" name="fiber" value={formData.fiber} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="sugar">Sugar (g)</label>
              <input id="sugar" type="text" inputMode="decimal" name="sugar" value={formData.sugar} onChange={handleChange} placeholder="0" />
            </div>

            <div className="form-group">
              <label htmlFor="protein">Protein (g)</label>
              <input id="protein" type="text" inputMode="decimal" name="protein" value={formData.protein} onChange={handleChange} placeholder="0" />
            </div>

            {/* --- SERVINGS AND VOLUME --- */}
            <div className="form-group">
              <label htmlFor="servingSize">Number of Servings *</label>
              <input
                id="servingSize"
                type="text"
                inputMode="decimal"
                name="servingSize"
                value={formData.servingSize}
                onChange={handleChange}
                placeholder="1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="volume">Volume per Serving (Optional)</label>
              <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="volume"
                  type="text"
                  inputMode="decimal"
                  name="volume"
                  style={{ flex: 1 }}
                  value={formData.volume}
                  onChange={handleChange}
                  placeholder="e.g., 100"
                />
                <select
                  id="volumeUnit"
                  name="volumeUnit"
                  style={{ width: 'auto', padding: '0.75rem' }}
                  value={formData.volumeUnit}
                  onChange={handleChange}
                >
                  <option value="g">Grams (g)</option>
                  <option value="oz">Ounces (oz)</option>
                  <option value="cup">Cup(s)</option>
                  <option value="ml">Milliliters (ml)</option>
                </select>
              </div>
            </div>

            {/* --- LOGISTICS (DATE AND MEAL TYPE) --- */}
            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="date">Log Date *</label>
              <input 
                type="date" 
                id="date"
                name="date"
                value={formData.date} 
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="mealType">Meal Type *</label>
              <select
                id="mealType"
                name="mealType"
                value={formData.mealType}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                required
              >
                <option value="" disabled>Select a Category...</option>
                <option value="Breakfast">🌅 Breakfast</option>
                <option value="Lunch">☀️ Lunch</option>
                <option value="Dinner">🌙 Dinner</option>
                <option value="Snack">🍎 Snack</option>
              </select>
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