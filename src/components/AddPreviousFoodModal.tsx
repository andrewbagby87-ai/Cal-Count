// src/components/AddPreviousFoodModal.tsx
import { useState, useEffect } from 'react';
import { Food } from '../types';
import './AddPreviousFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
  initialDate?: string;
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddPreviousFoodModal({ foods, onAdd, onBack, initialDate }: Props) {
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  
  // State for what the user actually consumed
  const [logDetails, setLogDetails] = useState({
    date: initialDate || getLocalTodayString(),
    mealType: '', 
    consumptionMethod: 'serving', 
    servingsConsumed: '1',
    volumeConsumed: '',
  });

  // State for editing the base nutrition label
  const [isEditingNutrition, setIsEditingNutrition] = useState(false);
  const [editFormData, setEditFormData] = useState({
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
    labelVolumes: [{ amount: '', unit: 'g' }] as { amount: string, unit: string }[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update date if initialDate prop changes
  useEffect(() => {
    if (initialDate) {
      setLogDetails(prev => ({ ...prev, date: initialDate }));
    }
  }, [initialDate]);

  const handleLogDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'servingsConsumed' || name === 'volumeConsumed') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setLogDetails(prev => ({ ...prev, [name]: value }));
  };

  // --- EDIT NUTRITION HANDLERS ---
  const handleEditClick = () => {
    if (!selectedFood) return;
    setEditFormData({
      name: selectedFood.name || '',
      brand: selectedFood.brand || '',
      calories: selectedFood.calories?.toString() || '',
      fat: selectedFood.fat?.toString() || '',
      saturatedFat: selectedFood.saturatedFat?.toString() || '',
      transFat: (selectedFood as any).transFat?.toString() || '',
      cholesterol: (selectedFood as any).cholesterol?.toString() || '',
      sodium: (selectedFood as any).sodium?.toString() || '',
      carbs: selectedFood.carbs?.toString() || '',
      fiber: selectedFood.fiber?.toString() || '',
      sugar: selectedFood.sugar?.toString() || '',
      protein: selectedFood.protein?.toString() || '',
      labelServings: selectedFood.servingSize?.toString() || '1',
      labelVolumes: selectedFood.volumes?.length 
        ? selectedFood.volumes.map(v => ({ amount: v.amount?.toString() || '', unit: v.unit })) 
        : [{ amount: '', unit: 'g' }]
    });
    setIsEditingNutrition(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name !== 'name' && name !== 'brand') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditVolumeChange = (index: number, field: 'amount' | 'unit', value: string) => {
    if (field === 'amount' && value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setEditFormData(prev => {
      const newVolumes = [...prev.labelVolumes];
      newVolumes[index] = { ...newVolumes[index], [field]: value };
      return { ...prev, labelVolumes: newVolumes };
    });
  };

  const addEditVolume = () => {
    setEditFormData(prev => {
      const usedUnits = prev.labelVolumes.map(v => v.unit);
      const nextAvailableUnit = ALL_UNITS.find(u => !usedUnits.includes(u));
      if (!nextAvailableUnit) return prev; 
      return {
        ...prev,
        labelVolumes: [...prev.labelVolumes, { amount: '', unit: nextAvailableUnit }]
      };
    });
  };

  const removeEditVolume = (index: number) => {
    setEditFormData(prev => {
      const newVolumes = [...prev.labelVolumes];
      newVolumes.splice(index, 1);
      return { ...prev, labelVolumes: newVolumes };
    });
  };

  const handleSaveNutrition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;

    if (!editFormData.name.trim()) { setError('Food name is required'); return; }
    if (!editFormData.calories) { setError('Calories is required'); return; }

    const safeParse = (val: string) => {
      if (!val) return undefined;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : Number(parsed.toFixed(2));
    };

    const validVolumes = editFormData.labelVolumes
      .filter(v => v.amount.trim() !== '')
      .map(v => ({ amount: safeParse(v.amount)!, unit: v.unit }));

    const updatedFood: Food = {
      ...selectedFood,
      name: editFormData.name.trim() || selectedFood.name,
      brand: editFormData.brand.trim() || selectedFood.brand,
      calories: safeParse(editFormData.calories) || 0,
      fat: safeParse(editFormData.fat),
      saturatedFat: safeParse(editFormData.saturatedFat),
      transFat: safeParse(editFormData.transFat),
      cholesterol: safeParse(editFormData.cholesterol),
      sodium: safeParse(editFormData.sodium),
      carbs: safeParse(editFormData.carbs),
      fiber: safeParse(editFormData.fiber),
      sugar: safeParse(editFormData.sugar),
      protein: safeParse(editFormData.protein),
      servingSize: parseFloat(editFormData.labelServings) || 1,
      volumes: validVolumes.length > 0 ? validVolumes : undefined,
    };

    setSelectedFood(updatedFood);
    setIsEditingNutrition(false);
    setError('');
    
    // Reset consumption to default serving to avoid math mismatch errors
    setLogDetails(prev => ({
      ...prev,
      consumptionMethod: 'serving',
      servingsConsumed: '1',
      volumeConsumed: ''
    }));
  };

  // --- DYNAMIC PREVIEW ---
  const calculatePreview = () => {
    if (!selectedFood) return null;
    
    let multiplier = 1;
    const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

    if (logDetails.consumptionMethod === 'serving') {
      const labelServings = selectedFood.servingSize || 1;
      const consumedServings = parseFloat(logDetails.servingsConsumed) || 0;
      multiplier = consumedServings / labelServings;
    } else if (isVolumeSelected && selectedFood.volumes) {
      const volIndex = parseInt(logDetails.consumptionMethod.split('-')[1]);
      const selectedVol = selectedFood.volumes[volIndex];
      if (selectedVol && selectedVol.amount) {
        const labelVol = selectedVol.amount;
        const consumedVol = parseFloat(logDetails.volumeConsumed) || 0;
        multiplier = labelVol === 0 ? 0 : consumedVol / labelVol;
      } else {
        multiplier = 0;
      }
    }

    const calc = (val: number | undefined) => {
      if (val === undefined || isNaN(val)) return 0;
      return Number((val * multiplier).toFixed(1));
    };

    return {
      calories: calc(selectedFood.calories),
      protein: calc(selectedFood.protein),
      carbs: calc(selectedFood.carbs),
      fat: calc(selectedFood.fat),
      saturatedFat: calc(selectedFood.saturatedFat),
      transFat: calc((selectedFood as any).transFat),
      cholesterol: calc((selectedFood as any).cholesterol),
      sodium: calc((selectedFood as any).sodium),
      fiber: calc(selectedFood.fiber),
      sugar: calc(selectedFood.sugar),
    };
  };

  const preview = selectedFood ? calculatePreview() : null;

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;

    setError('');
    
    try {
      if (!logDetails.mealType) throw new Error('Please select a meal category');

      let multiplier = 1;
      let finalAmount = 1;
      let finalUnit = 'serving';

      const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

      if (logDetails.consumptionMethod === 'serving') {
        if (!logDetails.servingsConsumed) throw new Error('Please enter how many servings you ate');
        const labelServings = selectedFood.servingSize || 1;
        const consumedServings = parseFloat(logDetails.servingsConsumed) || 1;
        
        multiplier = consumedServings / labelServings;
        finalAmount = consumedServings;
        finalUnit = 'serving';
      } else if (isVolumeSelected && selectedFood.volumes) {
        if (!logDetails.volumeConsumed) throw new Error('Please enter the volume/amount you ate');
        
        const volIndex = parseInt(logDetails.consumptionMethod.split('-')[1]);
        const selectedVol = selectedFood.volumes[volIndex];

        if (!selectedVol || !selectedVol.amount) throw new Error('Cannot calculate based on an invalid volume');
        
        const labelVol = selectedVol.amount;
        const consumedVol = parseFloat(logDetails.volumeConsumed) || 0;
        
        if (labelVol === 0) throw new Error('Label volume cannot be zero');
        
        multiplier = consumedVol / labelVol;
        finalAmount = consumedVol;
        finalUnit = selectedVol.unit; 
      }

      const calcConsumed = (val: number | undefined) => {
        if (val === undefined || isNaN(val)) return undefined;
        return Number((val * multiplier).toFixed(2));
      };

      const consumedNutrition: any = {
        calories: calcConsumed(selectedFood.calories) || 0,
        fat: calcConsumed(selectedFood.fat),
        saturatedFat: calcConsumed(selectedFood.saturatedFat),
        transFat: calcConsumed((selectedFood as any).transFat),
        cholesterol: calcConsumed((selectedFood as any).cholesterol),
        sodium: calcConsumed((selectedFood as any).sodium),
        carbs: calcConsumed(selectedFood.carbs),
        fiber: calcConsumed(selectedFood.fiber),
        sugar: calcConsumed(selectedFood.sugar),
        protein: calcConsumed(selectedFood.protein),
      };

const cleanConsumedNutrition = Object.fromEntries(
        Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)
      ) as any;

      if (isVolumeSelected) {
        cleanConsumedNutrition.volume = finalAmount;
        cleanConsumedNutrition.volumeUnit = finalUnit;
      }

      setLoading(true);

      // Create the raw payload
      const payload = {
        date: logDetails.date,
        foodId: selectedFood.id,
        food: selectedFood,
        amount: finalAmount,
        unit: finalUnit,
        mealType: logDetails.mealType,
        ...cleanConsumedNutrition,
      };

      // Strip all undefined values (Firebase rejects undefined fields)
      const cleanPayload = JSON.parse(JSON.stringify(payload));

      await onAdd(cleanPayload);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add food');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING VIEWS ---

  if (!selectedFood) {
    return (
      <div className="previous-food-modal">
        <h3>Add Previous Food</h3>
        <div className="food-list">
          {foods.map((food) => (
            <button
              key={food.id}
              className="food-option"
              onClick={() => {
                setSelectedFood(food);
                setLogDetails(prev => ({
                    ...prev,
                    consumptionMethod: 'serving',
                    servingsConsumed: '1',
                    volumeConsumed: ''
                }));
              }}
            >
              <div className="food-name">{food.name}</div>
              {food.brand && <div className="food-brand">{food.brand}</div>}
              <div className="food-serving">
                {food.servingSize}{food.servingUnit} - {food.calories} cal
              </div>
            </button>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (isEditingNutrition) {
    return (
      <div className="previous-food-modal">
        <h3 style={{ marginBottom: '0.25rem' }}>Edit Nutrition Label</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Update the base nutrition for this entry.
        </p>

        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleSaveNutrition}>
          <div className="form-group">
            <label htmlFor="name">Food Name *</label>
            <input id="name" type="text" name="name" value={editFormData.name} onChange={handleEditChange} placeholder="e.g., Grilled Chicken Breast" required />
          </div>

          <div className="form-group">
            <label htmlFor="brand">Brand (Optional)</label>
            <input id="brand" type="text" name="brand" value={editFormData.brand} onChange={handleEditChange} placeholder="e.g., Tyson" />
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

          <div className="form-group">
            <label htmlFor="labelServings">Number of Servings on Label *</label>
            <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={editFormData.labelServings} onChange={handleEditChange} placeholder="1" required />
          </div>

          <div className="form-group">
            <label>Volume/Weight/Amount on Label (Optional)</label>
            {editFormData.labelVolumes.map((vol, index) => {
              const usedUnits = editFormData.labelVolumes.map(v => v.unit);
              return (
                <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    style={{ flex: 1 }}
                    value={vol.amount}
                    onChange={(e) => handleEditVolumeChange(index, 'amount', e.target.value)}
                    placeholder="e.g., 100"
                  />
                  <select
                    style={{ width: 'auto', padding: '0.75rem' }}
                    value={vol.unit}
                    onChange={(e) => handleEditVolumeChange(index, 'unit', e.target.value)}
                  >
                    <option value="g" disabled={usedUnits.includes('g') && vol.unit !== 'g'}>Grams (g)</option>
                    <option value="oz" disabled={usedUnits.includes('oz') && vol.unit !== 'oz'}>Ounces (oz)</option>
                    <option value="cup" disabled={usedUnits.includes('cup') && vol.unit !== 'cup'}>Cup(s)</option>
                    <option value="ml" disabled={usedUnits.includes('ml') && vol.unit !== 'ml'}>Milliliters (ml)</option>
                    <option value="each" disabled={usedUnits.includes('each') && vol.unit !== 'each'}>Each</option>
                  </select>
                  {editFormData.labelVolumes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEditVolume(index)}
                      style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', flexShrink: 0 }}
                    >
                      X
                    </button>
                  )}
                </div>
              );
            })}
            {editFormData.labelVolumes.length < ALL_UNITS.length && (
              <button 
                type="button" 
                onClick={addEditVolume}
                style={{ background: 'none', border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '0.5rem', color: '#64748b', cursor: 'pointer', width: '100%', marginTop: '5px' }}
              >
                + Add Another Option
              </button>
            )}
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

          <div className="form-group">
            <label htmlFor="calories">Calories (from label) *</label>
            <input id="calories" type="text" inputMode="decimal" name="calories" value={editFormData.calories} onChange={handleEditChange} placeholder="0" required />
          </div>

          <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={editFormData.fat} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="saturatedFat">Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={editFormData.saturatedFat} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="transFat">Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={editFormData.transFat} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="cholesterol">Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={editFormData.cholesterol} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="sodium">Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={editFormData.sodium} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={editFormData.carbs} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="fiber">Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={editFormData.fiber} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="sugar">Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={editFormData.sugar} onChange={handleEditChange} placeholder="0" /></div>
          <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={editFormData.protein} onChange={handleEditChange} placeholder="0" /></div>

          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditingNutrition(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // Helper for rendering Log Details view safely
  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = (selectedVolIndex >= 0 && selectedFood.volumes) ? selectedFood.volumes[selectedVolIndex] : null;
  const hasVolumes = selectedFood.volumes && selectedFood.volumes.length > 0;

  return (
    <div className="previous-food-modal">
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Log Details</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem', marginTop: 0 }}>
          When did you eat <strong>{selectedFood.name}</strong>, and how much?
        </p>
        <button 
          type="button" 
          className="btn btn-secondary btn-sm" 
          onClick={handleEditClick}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          ✏️ Edit Label
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleAddFood}>
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
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
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
            
            {hasVolumes && selectedFood.volumes!.map((vol, index) => {
              if (!vol.amount) return null;
              return (
                <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                  <input 
                    type="radio" 
                    name="consumptionMethod" 
                    value={`volume-${index}`} 
                    checked={logDetails.consumptionMethod === `volume-${index}`} 
                    onChange={handleLogDetailsChange} 
                  /> 
                  By {vol.unit}
                </label>
              );
            })}
          </div>
          {!hasVolumes && (
             <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem', display: 'block' }}>
               * Logging by weight/volume/amount is disabled because no volume was entered for this food previously. Use the 'Edit Label' button to add volumes.
             </span>
          )}
        </div>

        {logDetails.consumptionMethod === 'serving' || !selectedVol ? (
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
                placeholder={`e.g., ${selectedVol.amount}`}
                required
              />
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
                {selectedVol.unit}
              </span>
            </div>
          </div>
        )}

        {/* --- Dynamic Nutrient Preview --- */}
        {preview && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1.25rem', 
            backgroundColor: '#f8fafc', 
            borderRadius: '0.75rem', 
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
              Nutrition Preview
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {[
                { label: 'Calories', value: `${preview.calories} cal`, isHighlight: true },
                { label: 'Protein', value: `${preview.protein}g`, isHighlight: false },
                { label: 'Carbs', value: `${preview.carbs}g`, isHighlight: false },
                { label: 'Fat', value: `${preview.fat}g`, isHighlight: false },
                { label: 'Sat Fat', value: `${preview.saturatedFat}g`, isHighlight: false },
                { label: 'Trans Fat', value: `${preview.transFat}g`, isHighlight: false },
                { label: 'Cholesterol', value: `${preview.cholesterol}mg`, isHighlight: false },
                { label: 'Sodium', value: `${preview.sodium}mg`, isHighlight: false },
                { label: 'Fiber', value: `${preview.fiber}g`, isHighlight: false },
                { label: 'Sugar', value: `${preview.sugar}g`, isHighlight: false },
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
                    fontWeight: nutrient.isHighlight ? 700 : 400
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