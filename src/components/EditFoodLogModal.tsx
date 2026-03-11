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

  // Safely grab existing data, prioritizing the root log values to avoid the broken nested object
  const f = log.food as any;
  const l = log as any;
  const en = (log.editedNutrition || {}) as any; 
  
  const [formData, setFormData] = useState({
    name: en.name || f?.name || l.name || '',
    brand: en.brand || f?.brand || l.brand || '',
    calories: toStr(en.calories ?? l.calories ?? f?.calories),
    fat: toStr(en.fat ?? l.fat ?? f?.fat),
    saturatedFat: toStr(en.saturatedFat ?? l.saturatedFat ?? f?.saturatedFat),
    transFat: toStr(en.transFat ?? l.transFat ?? f?.transFat),
    cholesterol: toStr(en.cholesterol ?? l.cholesterol ?? f?.cholesterol),
    sodium: toStr(en.sodium ?? l.sodium ?? f?.sodium),
    carbs: toStr(en.carbs ?? l.carbs ?? f?.carbs),
    fiber: toStr(en.fiber ?? l.fiber ?? f?.fiber),
    sugar: toStr(en.sugar ?? l.sugar ?? f?.sugar),
    protein: toStr(en.protein ?? l.protein ?? f?.protein),
    
    servingSize: toStr(l.amount ?? '1'),
    volume: toStr(en.volume ?? l.volume ?? f?.volume),
    volumeUnit: en.volumeUnit ?? l.volumeUnit ?? f?.volumeUnit ?? 'g',
    
    date: l.date || new Date().toISOString().split('T')[0],
    mealType: l.mealType && l.mealType !== 'Uncategorized' ? l.mealType : '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name !== 'name' && name !== 'brand' && name !== 'volumeUnit' && name !== 'date' && name !== 'mealType') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Force all empty values to strict numbers so Firebase array operations never fail
  const safeParseNum = (val: string | number | undefined | null) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
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

      // 1. Build a strict, flat object for all numeric macros
      const consumedMacros = {
        calories: safeParseNum(formData.calories),
        fat: safeParseNum(formData.fat),
        saturatedFat: safeParseNum(formData.saturatedFat),
        transFat: safeParseNum(formData.transFat),
        cholesterol: safeParseNum(formData.cholesterol),
        sodium: safeParseNum(formData.sodium),
        carbs: safeParseNum(formData.carbs),
        fiber: safeParseNum(formData.fiber),
        sugar: safeParseNum(formData.sugar),
        protein: safeParseNum(formData.protein),
      };

      // 2. Build the updated base food object
      const updatedFood: any = {
        ...log.food,
        name: formData.name.trim(),
        brand: formData.brand.trim() || '',
        ...consumedMacros,
      };

      // 3. Build the final flat payload for the log
      const rawPayload: any = {
        date: formData.date,
        mealType: formData.mealType,
        amount: safeParseNum(formData.servingSize),
        unit: 'serving',
        food: updatedFood,
        ...consumedMacros,
        // THE NUCLEAR FIX: We are intentionally setting this to null to destroy the broken nested object
        // This forces your UI to safely fall back to the root macros we just saved above!
        editedNutrition: null, 
      };

      // Handle volume
      if (formData.volume && formData.volume.trim() !== '') {
        rawPayload.volume = safeParseNum(formData.volume);
        rawPayload.volumeUnit = formData.volumeUnit || 'g';
        updatedFood.volume = rawPayload.volume;
        updatedFood.volumeUnit = rawPayload.volumeUnit;
      } else {
        rawPayload.volume = 0;
        rawPayload.volumeUnit = 'g';
        updatedFood.volume = 0;
        updatedFood.volumeUnit = 'g';
      }

      // JSON parsing guarantees absolutely zero 'undefined' properties sneak into Firebase
      const cleanFirebasePayload = JSON.parse(JSON.stringify(rawPayload));

      onSave(cleanFirebasePayload);

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
            <div className="form-group">
              <label htmlFor="name">Food Name *</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor="brand">Brand (Optional)</label>
              <input id="brand" type="text" name="brand" value={formData.brand} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="calories">Calories *</label>
              <input id="calories" type="text" inputMode="decimal" name="calories" value={formData.calories} onChange={handleChange} required />
            </div>

            <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={formData.fat} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="saturatedFat">Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={formData.saturatedFat} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="transFat">Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={formData.transFat} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="cholesterol">Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={formData.cholesterol} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="sodium">Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={formData.sodium} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={formData.carbs} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="fiber">Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={formData.fiber} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="sugar">Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={formData.sugar} onChange={handleChange} /></div>
            <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={formData.protein} onChange={handleChange} /></div>

            <div className="form-group">
              <label htmlFor="servingSize">Number of Servings *</label>
              <input id="servingSize" type="text" inputMode="decimal" name="servingSize" value={formData.servingSize} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor="volume">Volume per Serving (Optional)</label>
              <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input id="volume" type="text" inputMode="decimal" name="volume" style={{ flex: 1 }} value={formData.volume} onChange={handleChange} />
                <select id="volumeUnit" name="volumeUnit" style={{ width: 'auto', padding: '0.75rem' }} value={formData.volumeUnit} onChange={handleChange}>
                  <option value="g">Grams (g)</option>
                  <option value="oz">Ounces (oz)</option>
                  <option value="cup">Cup(s)</option>
                  <option value="ml">Milliliters (ml)</option>
                </select>
              </div>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="date">Log Date *</label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }} required />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="mealType">Meal Type *</label>
              <select id="mealType" name="mealType" value={formData.mealType} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }} required>
                <option value="" disabled>Select a Category...</option>
                <option value="Breakfast">🌅 Breakfast</option>
                <option value="Lunch">☀️ Lunch</option>
                <option value="Dinner">🌙 Dinner</option>
                <option value="Snack">🍎 Snack</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}