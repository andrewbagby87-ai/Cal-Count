import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFoodLog } from '../services/database';
import { Food } from '../types';
import './CreateFoodModal.css';

interface Props {
  onCreated: (food: Food) => void;
  onClose: () => void;
  initialDate?: string; 
}

export default function CreateFoodModal({ onCreated, onClose, initialDate }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'meal'>('form');
  
  // Step 1 State: The raw nutrition label data
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
    labelServings: '1',
    labelVolume: '',
    labelVolumeUnit: 'g',
  });

  // Step 2 State: What the user actually consumed
  const [logDetails, setLogDetails] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    mealType: '', 
    consumptionMethod: 'serving' as 'serving' | 'volume', 
    servingsConsumed: '1',
    volumeConsumed: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handler for Step 1 (Nutrition Label)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name !== 'name' && name !== 'brand' && name !== 'labelVolumeUnit') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler for Step 2 (Consumption Details)
  const handleLogDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'servingsConsumed' || name === 'volumeConsumed') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setLogDetails(prev => ({ ...prev, [name]: value }));
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
    if (!formData.labelServings) { setError('Number of servings on the label is required'); return; }

    setStep('meal');
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('User not found');
      if (!logDetails.mealType) throw new Error('Please select a meal category');

      let multiplier = 1;
      let finalAmount = 1;
      let finalUnit = 'serving';

      // 1. Calculate the math multiplier based on the CHOSEN method
      if (logDetails.consumptionMethod === 'serving') {
        if (!logDetails.servingsConsumed) throw new Error('Please enter how many servings you ate');
        const labelServings = parseFloat(formData.labelServings) || 1;
        const consumedServings = parseFloat(logDetails.servingsConsumed) || 1;
        
        multiplier = consumedServings / labelServings;
        finalAmount = consumedServings;
        finalUnit = 'serving';
      } else {
        if (!logDetails.volumeConsumed) throw new Error('Please enter the volume/weight you ate');
        if (!formData.labelVolume) throw new Error('Cannot calculate by volume because no volume was provided on the label');
        
        const labelVol = parseFloat(formData.labelVolume);
        const consumedVol = parseFloat(logDetails.volumeConsumed) || 0;
        
        if (labelVol === 0) throw new Error('Label volume cannot be zero');
        
        multiplier = consumedVol / labelVol;
        finalAmount = consumedVol;
        finalUnit = formData.labelVolumeUnit; // Locks perfectly to the Step 1 unit
      }

      // 2. Build the BASE object to save inside the log's 'food' dictionary
      const baseNutrition: any = {
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
        servingSize: parseFloat(formData.labelServings) || 1, 
        servingUnit: 'serving',
      };

      if (formData.labelVolume && formData.labelVolume.trim() !== '') {
        baseNutrition.volume = safeParse(formData.labelVolume);
        baseNutrition.volumeUnit = formData.labelVolumeUnit;
      }

      const cleanBaseNutrition = Object.fromEntries(
        Object.entries(baseNutrition).filter(([_, v]) => v !== undefined)
      ) as any;

      // 3. Helper to multiply the label values by what you actually ate
      const calcConsumed = (val: string) => {
        const parsed = parseFloat(val);
        if (isNaN(parsed)) return undefined;
        return Number((parsed * multiplier).toFixed(2));
      };

      // 4. Build the CONSUMED object with the multiplied math applied
      const consumedNutrition: any = {
        calories: calcConsumed(formData.calories) || 0,
        fat: calcConsumed(formData.fat),
        saturatedFat: calcConsumed(formData.saturatedFat),
        transFat: calcConsumed(formData.transFat),
        cholesterol: calcConsumed(formData.cholesterol),
        sodium: calcConsumed(formData.sodium),
        carbs: calcConsumed(formData.carbs),
        fiber: calcConsumed(formData.fiber),
        sugar: calcConsumed(formData.sugar),
        protein: calcConsumed(formData.protein),
      };

      const cleanConsumedNutrition = Object.fromEntries(
        Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)
      ) as any;

      // Add the final converted volume directly to the log if they used the volume method
      if (logDetails.consumptionMethod === 'volume') {
        cleanConsumedNutrition.volume = finalAmount;
        cleanConsumedNutrition.volumeUnit = finalUnit;
      }

      const foodId = crypto.randomUUID();

      const foodObject: Food = {
        id: foodId,
        userId: user.uid,
        ...cleanBaseNutrition,
        createdAt: Date.now(),
      };

      // 5. Save the final calculated log to the database
      await createFoodLog(user.uid, {
        date: logDetails.date, 
        foodId: foodId,
        food: foodObject, 
        amount: finalAmount, 
        unit: finalUnit,
        mealType: logDetails.mealType, 
        ...cleanConsumedNutrition 
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
      {step === 'form' ? (
        <>
          <h3 style={{ marginBottom: '0.25rem' }}>Step 1: Nutrition Label</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Enter the exact values shown on the nutrition label.
          </p>

          {error && <div className="error">{error}</div>}
          
          <form onSubmit={handleContinue}>
            <div className="form-group">
              <label htmlFor="name">Food Name *</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Grilled Chicken Breast" required />
            </div>

            <div className="form-group">
              <label htmlFor="brand">Brand (Optional)</label>
              <input id="brand" type="text" name="brand" value={formData.brand} onChange={handleChange} placeholder="e.g., Tyson" />
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="labelServings">Number of Servings on Label *</label>
              <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={formData.labelServings} onChange={handleChange} placeholder="1" required />
            </div>

            <div className="form-group">
              <label htmlFor="labelVolume">Volume/Weight on Label (Optional)</label>
              <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="labelVolume"
                  type="text"
                  inputMode="decimal"
                  name="labelVolume"
                  style={{ flex: 1 }}
                  value={formData.labelVolume}
                  onChange={handleChange}
                  placeholder="e.g., 100"
                />
                <select
                  id="labelVolumeUnit"
                  name="labelVolumeUnit"
                  style={{ width: 'auto', padding: '0.75rem' }}
                  value={formData.labelVolumeUnit}
                  onChange={handleChange}
                >
                  <option value="g">Grams (g)</option>
                  <option value="oz">Ounces (oz)</option>
                  <option value="cup">Cup(s)</option>
                  <option value="ml">Milliliters (ml)</option>
                </select>
              </div>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="calories">Calories (from label) *</label>
              <input id="calories" type="text" inputMode="decimal" name="calories" value={formData.calories} onChange={handleChange} placeholder="0" required />
            </div>

            <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={formData.fat} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="saturatedFat">Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={formData.saturatedFat} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="transFat">Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={formData.transFat} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="cholesterol">Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={formData.cholesterol} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="sodium">Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={formData.sodium} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={formData.carbs} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="fiber">Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={formData.fiber} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="sugar">Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={formData.sugar} onChange={handleChange} placeholder="0" /></div>
            <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={formData.protein} onChange={handleChange} placeholder="0" /></div>

            <div className="form-actions" style={{ marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>Continue</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h3 style={{ marginBottom: '0.25rem' }}>Step 2: Log Details</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            When did you eat this, and how much did you have?
          </p>

          {error && <div className="error">{error}</div>}

          <form onSubmit={handleFinalSubmit}>
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input 
                type="date" 
                id="date"
                name="date"
                value={logDetails.date} 
                onChange={handleLogDetailsChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="mealType">Meal Category *</label>
              <select
                id="mealType"
                name="mealType"
                value={logDetails.mealType}
                onChange={handleLogDetailsChange}
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

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>How do you want to log this? *</label>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                  <input 
                    type="radio" 
                    name="consumptionMethod" 
                    value="serving" 
                    checked={logDetails.consumptionMethod === 'serving'} 
                    onChange={handleLogDetailsChange} 
                  /> 
                  By Servings
                </label>
                
                {formData.labelVolume && formData.labelVolume.trim() !== '' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input 
                      type="radio" 
                      name="consumptionMethod" 
                      value="volume" 
                      checked={logDetails.consumptionMethod === 'volume'} 
                      onChange={handleLogDetailsChange} 
                    /> 
                    By {formData.labelVolumeUnit}
                  </label>
                )}
              </div>
              {!formData.labelVolume && (
                 <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem', display: 'block' }}>
                   * Logging by weight/volume is disabled because you did not enter a label volume in Step 1.
                 </span>
              )}
            </div>

            {logDetails.consumptionMethod === 'serving' ? (
              <div className="form-group">
                <label htmlFor="servingsConsumed">Number of Servings Eaten *</label>
                <input
                  id="servingsConsumed"
                  type="text"
                  inputMode="decimal"
                  name="servingsConsumed"
                  value={logDetails.servingsConsumed}
                  onChange={handleLogDetailsChange}
                  placeholder="1"
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="volumeConsumed">Amount Eaten *</label>
                <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    id="volumeConsumed"
                    type="text"
                    inputMode="decimal"
                    name="volumeConsumed"
                    style={{ flex: 1 }}
                    value={logDetails.volumeConsumed}
                    onChange={handleLogDetailsChange}
                    placeholder={`e.g., ${formData.labelVolume}`}
                    required
                  />
                  {/* NEW: Replaced the dropdown with a solid, unchangeable badge showing the locked unit */}
                  <span style={{ 
                    padding: '0.75rem 1rem', 
                    backgroundColor: '#f1f5f9', 
                    borderRadius: '0.5rem', 
                    border: '1px solid #cbd5e1', 
                    color: '#475569', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '3rem'
                  }}>
                    {formData.labelVolumeUnit}
                  </span>
                </div>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '2.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Food Log'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>
                Back
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}