// src/components/CreateFoodModal.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFoodLog, createFood } from '../services/database';
import { Food } from '../types';
import './CreateFoodModal.css';

interface Props {
  onCreated?: (food: Food) => void;
  onClose: () => void;
  initialDate?: string; 
  isVitaminMode?: boolean; 
  initialUpc?: string;
  // --- NEW RECIPE MODE PROPS ---
  isRecipeIngredientMode?: boolean;
  onIngredientCalculated?: (foodObject: Food, consumedNutrition: any, amount: number, unit: string) => void;
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

export default function CreateFoodModal({ onCreated, onClose, initialDate, isVitaminMode, initialUpc, isRecipeIngredientMode, onIngredientCalculated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'meal'>('form');
  
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    upc: initialUpc || '', 
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
    labelVolumes: [{ amount: '', unit: 'g' }] as { amount: string, unit: string }[],
  });

  const [logDetails, setLogDetails] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    mealType: isVitaminMode ? 'Vitamins' : '', 
    consumptionMethod: 'serving', 
    servingsConsumed: '1',
    volumeConsumed: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'upc' && value !== '' && !/^\d*$/.test(value)) return;
    if (name === 'upc' && value.length > 12) return; 
    if (name !== 'name' && name !== 'brand' && name !== 'upc' && value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVolumeChange = (index: number, field: 'amount' | 'unit', value: string) => {
    if (field === 'amount' && value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setFormData(prev => {
      const newVolumes = [...prev.labelVolumes];
      newVolumes[index] = { ...newVolumes[index], [field]: value };
      return { ...prev, labelVolumes: newVolumes };
    });
  };

  const addVolume = () => {
    setFormData(prev => {
      const usedUnits = prev.labelVolumes.map(v => v.unit);
      const nextAvailableUnit = ALL_UNITS.find(u => !usedUnits.includes(u));
      if (!nextAvailableUnit) return prev; 
      return { ...prev, labelVolumes: [...prev.labelVolumes, { amount: '', unit: nextAvailableUnit }] };
    });
  };

  const removeVolume = (index: number) => {
    setFormData(prev => {
      const newVolumes = [...prev.labelVolumes];
      newVolumes.splice(index, 1);
      return { ...prev, labelVolumes: newVolumes };
    });
  };

  const handleLogDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if ((name === 'servingsConsumed' || name === 'volumeConsumed') && value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
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
    if (!formData.name.trim()) { setError('Name is required'); return; }
    if (formData.upc.trim() && formData.upc.trim().length !== 12) { setError('UPC must be exactly 12 digits'); return; }
    if (!formData.calories) { setError('Calories is required'); return; }
    if (!formData.labelServings) { setError('Number of servings on the label is required'); return; }
    setStep('meal');
  };

  const calculatePreview = () => {
    let multiplier = 1;
    const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

    if (logDetails.consumptionMethod === 'serving') {
      const labelServings = parseFloat(formData.labelServings) || 1;
      const consumedServings = parseFloat(logDetails.servingsConsumed) || 0;
      multiplier = consumedServings / labelServings;
    } else if (isVolumeSelected) {
      const volIndex = parseInt(logDetails.consumptionMethod.split('-')[1]);
      const selectedVol = formData.labelVolumes[volIndex];
      if (selectedVol && selectedVol.amount) {
        const labelVol = parseFloat(selectedVol.amount) || 1;
        const consumedVol = parseFloat(logDetails.volumeConsumed) || 0;
        multiplier = labelVol === 0 ? 0 : consumedVol / labelVol;
      } else {
        multiplier = 0;
      }
    }

    const calc = (val: string) => {
      const parsed = parseFloat(val);
      if (isNaN(parsed)) return 0;
      return Number((parsed * multiplier).toFixed(1));
    };

    return {
      calories: calc(formData.calories), protein: calc(formData.protein), carbs: calc(formData.carbs), fat: calc(formData.fat),
      saturatedFat: calc(formData.saturatedFat), transFat: calc(formData.transFat), cholesterol: calc(formData.cholesterol),
      sodium: calc(formData.sodium), fiber: calc(formData.fiber), sugar: calc(formData.sugar),
    };
  };

  const preview = step === 'meal' ? calculatePreview() : null;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('User not found');
      if (!isVitaminMode && !isRecipeIngredientMode && !logDetails.mealType) throw new Error('Please select a meal category');

      let multiplier = 1;
      let finalAmount = 1;
      let finalUnit = 'serving';
      const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

      if (logDetails.consumptionMethod === 'serving') {
        if (!logDetails.servingsConsumed) throw new Error(`Please enter how many servings you ${isRecipeIngredientMode ? 'added' : 'ate'}`);
        const labelServings = parseFloat(formData.labelServings) || 1;
        const consumedServings = parseFloat(logDetails.servingsConsumed) || 1;
        multiplier = consumedServings / labelServings;
        finalAmount = consumedServings;
        finalUnit = 'serving';
      } else if (isVolumeSelected) {
        if (!logDetails.volumeConsumed) throw new Error(`Please enter the amount you ${isRecipeIngredientMode ? 'added' : 'ate'}`);
        const volIndex = parseInt(logDetails.consumptionMethod.split('-')[1]);
        const selectedVol = formData.labelVolumes[volIndex];
        if (!selectedVol || !selectedVol.amount) throw new Error('Cannot calculate based on an invalid volume');
        const labelVol = parseFloat(selectedVol.amount);
        const consumedVol = parseFloat(logDetails.volumeConsumed) || 0;
        if (labelVol === 0) throw new Error('Label volume cannot be zero');
        multiplier = consumedVol / labelVol;
        finalAmount = consumedVol;
        finalUnit = selectedVol.unit; 
      }

      const validVolumes = formData.labelVolumes
        .filter(v => v.amount.trim() !== '' && !isNaN(parseFloat(v.amount)))
        .map(v => ({ amount: Number(parseFloat(v.amount).toFixed(2)), unit: v.unit }));

      const baseNutrition: any = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        upc: formData.upc.trim() || undefined,
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
        isVitamin: isVitaminMode ? true : false,
      };

      if (validVolumes.length > 0) {
        baseNutrition.volumes = validVolumes;
        baseNutrition.volume = validVolumes[0].amount;
        baseNutrition.volumeUnit = validVolumes[0].unit;
      }

      const cleanBaseNutrition = JSON.parse(JSON.stringify(baseNutrition));
      const newFoodId = await createFood(user.uid, cleanBaseNutrition);

      const calcConsumed = (val: string) => {
        const parsed = parseFloat(val);
        if (isNaN(parsed)) return undefined;
        return Number((parsed * multiplier).toFixed(2));
      };

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

      if (isVolumeSelected) {
        consumedNutrition.volume = finalAmount;
        consumedNutrition.volumeUnit = finalUnit;
      }

      const foodObject: Food = {
        id: newFoodId,
        userId: user.uid,
        ...cleanBaseNutrition,
        createdAt: Date.now(),
      };

      // --- RECIPE INGREDIENT MODE INTERCEPT ---
      if (isRecipeIngredientMode && onIngredientCalculated) {
        onIngredientCalculated(foodObject, consumedNutrition, finalAmount, finalUnit);
        return; 
      }

      const payload = {
        date: logDetails.date, 
        foodId: newFoodId,
        food: foodObject, 
        amount: finalAmount, 
        unit: finalUnit,
        mealType: logDetails.mealType, 
        ...consumedNutrition 
      };

      const cleanPayload = JSON.parse(JSON.stringify(payload));
      await createFoodLog(user.uid, cleanPayload);

      if (onCreated) onCreated(foodObject);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = selectedVolIndex >= 0 ? formData.labelVolumes[selectedVolIndex] : null;

  return (
    <div className="create-food-modal">
      {step === 'form' ? (
        <>
          <h3 style={{ marginBottom: '0.25rem' }}>{isRecipeIngredientMode ? 'Create Recipe Ingredient' : 'Step 1: Nutrition Label'}</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Enter the exact values shown on the nutrition label.
          </p>

          {error && <div className="error">{error}</div>}
          
          <form onSubmit={handleContinue}>
            <div className="form-group">
              <label htmlFor="name">{isVitaminMode ? 'Vitamin Name *' : 'Food Name *'}</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder={isVitaminMode ? "e.g., Vitamin C" : "e.g., Grilled Chicken Breast"} required />
            </div>

            <div className="form-group">
              <label htmlFor="brand">Brand (Optional)</label>
              <input id="brand" type="text" name="brand" value={formData.brand} onChange={handleChange} placeholder="e.g., Nature Made" />
            </div>

            <div className="form-group">
              <label htmlFor="upc">UPC / Barcode (Optional)</label>
              <input id="upc" type="text" name="upc" value={formData.upc} onChange={handleChange} placeholder="e.g., 012345678901" />
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="labelServings">Number of Servings on Label *</label>
              <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={formData.labelServings} onChange={handleChange} placeholder="1" required />
            </div>

            <div className="form-group">
              <label>Volume/Weight/Amount on Label (Optional)</label>
              {formData.labelVolumes.map((vol, index) => {
                const usedUnits = formData.labelVolumes.map(v => v.unit);
                return (
                  <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <input type="text" inputMode="decimal" style={{ flex: 1 }} value={vol.amount} onChange={(e) => handleVolumeChange(index, 'amount', e.target.value)} placeholder="e.g., 100" />
                    <select style={{ width: 'auto', padding: '0.75rem' }} value={vol.unit} onChange={(e) => handleVolumeChange(index, 'unit', e.target.value)}>
                      <option value="g" disabled={usedUnits.includes('g') && vol.unit !== 'g'}>Grams (g)</option>
                      <option value="oz" disabled={usedUnits.includes('oz') && vol.unit !== 'oz'}>Ounces (oz)</option>
                      <option value="cup" disabled={usedUnits.includes('cup') && vol.unit !== 'cup'}>Cup(s)</option>
                      <option value="ml" disabled={usedUnits.includes('ml') && vol.unit !== 'ml'}>Milliliters (ml)</option>
                      <option value="each" disabled={usedUnits.includes('each') && vol.unit !== 'each'}>Each</option>
                    </select>
                    {formData.labelVolumes.length > 1 && (
                      <button type="button" onClick={() => removeVolume(index)} style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', flexShrink: 0 }}>X</button>
                    )}
                  </div>
                );
              })}
              {formData.labelVolumes.length < ALL_UNITS.length && (
                <button type="button" onClick={addVolume} style={{ background: 'none', border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '0.5rem', color: '#64748b', cursor: 'pointer', width: '100%', marginTop: '5px' }}>+ Add Another Option</button>
              )}
            </div>

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group"><label htmlFor="calories">Calories (from label) *</label><input id="calories" type="text" inputMode="decimal" name="calories" value={formData.calories} onChange={handleChange} placeholder="0" required /></div>
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
          <h3 style={{ marginBottom: '0.25rem' }}>{isRecipeIngredientMode ? 'Ingredient Amount' : 'Step 2: Log Details'}</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {isRecipeIngredientMode ? 'How much of this went into the recipe?' : `When did you ${isVitaminMode ? 'take' : 'eat'} this, and how much did you have?`}
          </p>

          {error && <div className="error">{error}</div>}

          <form onSubmit={handleFinalSubmit}>
            
            {!isRecipeIngredientMode && (
              <>
                <div className="form-group">
                  <label htmlFor="date">Date *</label>
                  <input type="date" id="date" name="date" value={logDetails.date} onChange={handleLogDetailsChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }} required />
                </div>

                {!isVitaminMode && (
                  <div className="form-group">
                    <label htmlFor="mealType">Meal Category *</label>
                    <select id="mealType" name="mealType" value={logDetails.mealType} onChange={handleLogDetailsChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }} required>
                      <option value="" disabled>Select a Category...</option>
                      <option value="Breakfast">🌅 Breakfast</option>
                      <option value="Lunch">☀️ Lunch</option>
                      <option value="Dinner">🌙 Dinner</option>
                      <option value="Snack">🍎 Snack</option>
                    </select>
                  </div>
                )}
                <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />
              </>
            )}

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>How do you want to add this? *</label>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                  <input type="radio" name="consumptionMethod" value="serving" checked={logDetails.consumptionMethod === 'serving'} onChange={handleLogDetailsChange} style={{ width: 'auto', margin: 0 }} /> By Servings
                </label>
                {formData.labelVolumes.map((vol, index) => {
                  if (!vol.amount.trim()) return null;
                  return (
                    <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                      <input type="radio" name="consumptionMethod" value={`volume-${index}`} checked={logDetails.consumptionMethod === `volume-${index}`} onChange={handleLogDetailsChange} style={{ width: 'auto', margin: 0 }} /> By {vol.unit}
                    </label>
                  );
                })}
              </div>
            </div>

            {logDetails.consumptionMethod === 'serving' || !selectedVol ? (
              <div className="form-group">
                <label htmlFor="servingsConsumed">Number of Servings {isRecipeIngredientMode ? 'Added' : (isVitaminMode ? 'Taken' : 'Eaten')} *</label>
                <input id="servingsConsumed" type="text" inputMode="decimal" name="servingsConsumed" value={logDetails.servingsConsumed} onChange={handleLogDetailsChange} placeholder="1" required />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="volumeConsumed">Amount {isRecipeIngredientMode ? 'Added' : (isVitaminMode ? 'Taken' : 'Eaten')} *</label>
                <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input id="volumeConsumed" type="text" inputMode="decimal" name="volumeConsumed" style={{ flex: 1 }} value={logDetails.volumeConsumed} onChange={handleLogDetailsChange} placeholder={`e.g., ${selectedVol.amount}`} required />
                  <span style={{ padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '3rem' }}>{selectedVol.unit}</span>
                </div>
              </div>
            )}

            {preview && (
              <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>Nutrition Preview</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {[
                    { label: 'Calories', value: `${preview.calories} cal`, isHighlight: true, indent: false },
                    { label: 'Total Fat', value: `${preview.fat}g`, isHighlight: false, indent: false },
                    { label: 'Saturated Fat', value: `${preview.saturatedFat}g`, isHighlight: false, indent: true },
                    { label: 'Trans Fat', value: `${preview.transFat}g`, isHighlight: false, indent: true },
                    { label: 'Cholesterol', value: `${preview.cholesterol}mg`, isHighlight: false, indent: false },
                    { label: 'Sodium', value: `${preview.sodium}mg`, isHighlight: false, indent: false },
                    { label: 'Total Carbohydrate', value: `${preview.carbs}g`, isHighlight: false, indent: false },
                    { label: 'Dietary Fiber', value: `${preview.fiber}g`, isHighlight: false, indent: true },
                    { label: 'Total Sugars', value: `${preview.sugar}g`, isHighlight: false, indent: true },
                    { label: 'Protein', value: `${preview.protein}g`, isHighlight: false, indent: false },
                  ].map((nutrient, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      borderBottom: idx !== 9 ? '1px solid #e2e8f0' : 'none', 
                      paddingBottom: idx !== 9 ? '0.2rem' : '0' 
                    }}>
                      <span style={{ 
                        fontSize: nutrient.isHighlight ? '0.75rem' : '0.65rem', 
                        textTransform: 'uppercase', 
                        color: nutrient.isHighlight ? '#475569' : '#94a3b8', 
                        fontWeight: nutrient.isHighlight ? 700 : 400,
                        paddingLeft: nutrient.indent ? '0.75rem' : '0'
                      }}>
                        {nutrient.label}
                      </span>
                      <span style={{ 
                        fontWeight: 700, 
                        color: nutrient.isHighlight ? '#2563eb' : '#1e293b', 
                        fontSize: nutrient.isHighlight ? '1rem' : '0.8rem' 
                      }}>
                        {nutrient.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '2.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (isRecipeIngredientMode ? 'Add Ingredient' : 'Save Food Log')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>Back</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}