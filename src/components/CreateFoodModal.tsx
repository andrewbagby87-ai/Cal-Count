import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFoodLog } from '../services/database';
import { Food } from '../types';
import './CreateFoodModal.css';

interface Props {
  onCreated: (food: Food) => void;
  onClose: () => void;
  initialDate?: string; // NEW: Accepts the date from the Food Log view
}

export default function CreateFoodModal({ onCreated, onClose, initialDate }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'meal'>('form');
  
  // NEW: State for the log date, defaulting to the viewed date or today
  const [logDate, setLogDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  
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
    
    if (name !== 'name' && name !== 'brand' && name !== 'servingUnit') {
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

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) { setError('Food name is required'); return; }
    if (!formData.calories) { setError('Calories is required'); return; }
    if (!formData.servingSize) { setError('Serving size is required'); return; }

    setStep('meal');
  };

  const handleFinalSubmit = async (mealType: string) => {
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('User not found');

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
        servingSize: safeParse(formData.servingSize) || 1,
        servingUnit: formData.servingUnit,
      };

      if (formData.volume && formData.volume.trim() !== '') {
        rawNutritionData.volume = safeParse(formData.volume);
      }

      const cleanNutritionData = Object.fromEntries(
        Object.entries(rawNutritionData).filter(([_, v]) => v !== undefined)
      ) as any;
      
      const foodId = crypto.randomUUID();

      const foodObject: Food = {
        id: foodId,
        userId: user.uid,
        ...cleanNutritionData,
        createdAt: Date.now(),
      };

      // NEW: Uses logDate instead of today
      await createFoodLog(user.uid, {
        date: logDate, 
        foodId: foodId,
        food: foodObject,
        amount: cleanNutritionData.servingSize,
        unit: cleanNutritionData.servingUnit,
        mealType: mealType, 
        ...cleanNutritionData
      });

      onCreated(foodObject);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('form'); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-food-modal">
      {step === 'form' ? (
        <>
          <h3>Create New Food</h3>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleContinue}>
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
              <input
                id="fat"
                type="text"
                inputMode="decimal"
                name="fat"
                value={formData.fat}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="saturatedFat">Saturated Fat (g)</label>
              <input
                id="saturatedFat"
                type="text"
                inputMode="decimal"
                name="saturatedFat"
                value={formData.saturatedFat}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="transFat">Trans Fat (g)</label>
              <input
                id="transFat"
                type="text"
                inputMode="decimal"
                name="transFat"
                value={formData.transFat}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cholesterol">Cholesterol (mg)</label>
              <input
                id="cholesterol"
                type="text"
                inputMode="decimal"
                name="cholesterol"
                value={formData.cholesterol}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sodium">Sodium (mg)</label>
              <input
                id="sodium"
                type="text"
                inputMode="decimal"
                name="sodium"
                value={formData.sodium}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="carbs">Carbs (g)</label>
              <input
                id="carbs"
                type="text"
                inputMode="decimal"
                name="carbs"
                value={formData.carbs}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fiber">Fiber (g)</label>
              <input
                id="fiber"
                type="text"
                inputMode="decimal"
                name="fiber"
                value={formData.fiber}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sugar">Sugar (g)</label>
              <input
                id="sugar"
                type="text"
                inputMode="decimal"
                name="sugar"
                value={formData.sugar}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="protein">Protein (g)</label>
              <input
                id="protein"
                type="text"
                inputMode="decimal"
                name="protein"
                value={formData.protein}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="servingSize">Serving Size * (e.g., 1)</label>
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
              <label htmlFor="volume">Volume (Optional)</label>
              <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="volume"
                  type="text"
                  inputMode="decimal"
                  name="volume"
                  style={{ flex: 1 }}
                  value={formData.volume}
                  onChange={handleChange}
                  placeholder="100"
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
                Continue
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h3 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Select Date & Meal</h3>
          
          {/* NEW: Date Picker Input */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="logDate" style={{ textAlign: 'center', display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#334155' }}>
              Date
            </label>
            <input 
              type="date" 
              id="logDate"
              value={logDate} 
              onChange={(e) => setLogDate(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>
            Which meal would you like to log <strong>{formData.name}</strong> under?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={() => handleFinalSubmit('Breakfast')} className="btn btn-primary" disabled={loading}>
              🌅 Breakfast
            </button>
            <button onClick={() => handleFinalSubmit('Lunch')} className="btn btn-primary" disabled={loading}>
              ☀️ Lunch
            </button>
            <button onClick={() => handleFinalSubmit('Dinner')} className="btn btn-primary" disabled={loading}>
              🌙 Dinner
            </button>
            <button onClick={() => handleFinalSubmit('Snack')} className="btn btn-primary" disabled={loading}>
              🍎 Snack
            </button>
            
            <button 
              onClick={() => setStep('form')} 
              className="btn btn-secondary" 
              style={{ marginTop: '0.5rem', width: '100%' }} 
              disabled={loading}
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}