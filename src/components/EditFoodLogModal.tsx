// src/components/EditFoodLogModal.tsx
import { useState, useRef, useEffect } from 'react';
import { FoodLog } from '../types';
import BarcodeScanner from './BarcodeScanner';
import { useAuth } from '../contexts/AuthContext';
import { updateAllPastLogsForFood } from '../services/database';
import './CreateFoodModal.css';

interface Props {
  log: FoodLog;
  onSave: (updates: Partial<FoodLog>) => void;
  onClose: () => void;
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

const FOOD_ICONS = [
  { icon: '🍎', title: 'Apple' }, { icon: '🥑', title: 'Avocado' }, { icon: '🥓', title: 'Bacon' },
  { icon: '🥯', title: 'Bagel' }, { icon: '🍌', title: 'Banana' }, { icon: '🫐', title: 'Blueberries' },
  { icon: '🍞', title: 'Bread' }, { icon: '🥦', title: 'Broccoli' }, { icon: '🍔', title: 'Burger' },
  { icon: '🌯', title: 'Burrito' }, { icon: '🍰', title: 'Cake' }, { icon: '🍬', title: 'Candy' },
  { icon: '🥕', title: 'Carrot' }, { icon: '🧀', title: 'Cheese' }, { icon: '🍒', title: 'Cherries' },
  { icon: '🍗', title: 'Chicken' }, { icon: '🍫', title: 'Chocolate' }, { icon: '☕', title: 'Coffee' },
  { icon: '🍪', title: 'Cookie' }, { icon: '🌽', title: 'Corn' }, { icon: '🥐', title: 'Croissant' },
  { icon: '🥒', title: 'Cucumber' }, { icon: '🍩', title: 'Donut' }, { icon: '🥚', title: 'Egg' },
  { icon: '🍆', title: 'Eggplant' }, { icon: '🍟', title: 'Fries' }, { icon: '🍇', title: 'Grapes' },
  { icon: '🌭', title: 'Hot Dog' }, { icon: '🍦', title: 'Ice Cream' }, { icon: '🥝', title: 'Kiwi' },
  { icon: '🍋', title: 'Lemon' }, { icon: '🥛', title: 'Milk' }, { icon: '🍄', title: 'Mushroom' },
  { icon: '🧅', title: 'Onion' }, { icon: '🍊', title: 'Orange' }, { icon: '🥞', title: 'Pancakes' },
  { icon: '🍝', title: 'Pasta' }, { icon: '🍑', title: 'Peach' }, { icon: '🥜', title: 'Peanuts' },
  { icon: '🍐', title: 'Pear' }, { icon: '🥧', title: 'Pie' }, { icon: '🍍', title: 'Pineapple' },
  { icon: '🍕', title: 'Pizza' }, { icon: '🍿', title: 'Popcorn' }, { icon: '🥔', title: 'Potato' },
  { icon: '🥨', title: 'Pretzel' }, { icon: '🍚', title: 'Rice' }, { icon: '🥗', title: 'Salad' },
  { icon: '🥪', title: 'Sandwich' }, { icon: '🥤', title: 'Soda / Drink' }, { icon: '🥣', title: 'Soup' },
  { icon: '🥩', title: 'Steak / Meat' }, { icon: '🍓', title: 'Strawberry' }, { icon: '🍣', title: 'Sushi' },
  { icon: '🌮', title: 'Taco' }, { icon: '🍅', title: 'Tomato' }, { icon: '💊', title: 'Vitamin / Supplement' },
  { icon: '🧇', title: 'Waffle' }, { icon: '🍉', title: 'Watermelon' }, { icon: '🍷', title: 'Wine / Alcohol' }
].sort((a, b) => a.title.localeCompare(b.title));

export default function EditFoodLogModal({ log, onSave, onClose }: Props) {
  const { user } = useAuth();
  const toStr = (val: any) => (val !== undefined && val !== null ? String(val) : '');

  const f = log.food || {} as any;

  const [formData, setFormData] = useState({
    name: f.name || (log as any).name || '',
    brand: f.brand || (log as any).brand || '',
    icon: f.icon || '',
    upc: f.upc || '',
    labelServings: toStr(f.servingSize ?? 1),
    labelVolumes: (f.volumes && f.volumes.length > 0) 
      ? f.volumes.map((v: any) => ({ amount: toStr(v.amount), unit: v.unit })) 
      : [{ amount: '', unit: 'g' }],
    calories: toStr(f.calories ?? 0),
    fat: toStr(f.fat),
    saturatedFat: toStr(f.saturatedFat),
    transFat: toStr(f.transFat),
    cholesterol: toStr(f.cholesterol),
    sodium: toStr(f.sodium),
    carbs: toStr(f.carbs),
    fiber: toStr(f.fiber),
    sugar: toStr(f.sugar),
    protein: toStr(f.protein),
  });

  let initialMethod = 'serving';
  let initialVolConsumed = '';
  let initialServingsConsumed = '1';

  if (log.unit === 'serving') {
    initialServingsConsumed = toStr(log.amount);
  } else {
    const volIndex = f.volumes?.findIndex((v: any) => v.unit === log.unit);
    if (volIndex !== undefined && volIndex >= 0) {
      initialMethod = `volume-${volIndex}`;
      initialVolConsumed = toStr(log.amount);
    }
  }

  const [logDetails, setLogDetails] = useState({
    date: log.date || new Date().toISOString().split('T')[0],
    mealType: log.mealType && log.mealType !== 'Uncategorized' ? log.mealType : '',
    consumptionMethod: initialMethod,
    servingsConsumed: initialServingsConsumed,
    volumeConsumed: initialVolConsumed,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Custom states
  const [pendingFoodUpdate, setPendingFoodUpdate] = useState<any>(null); 
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'upc' && value !== '' && !/^\d*$/.test(value)) return;
    if (name === 'upc' && value.length > 12) return; 
    if (name !== 'name' && name !== 'brand' && name !== 'upc' && name !== 'icon' && value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!formData.name.trim()) throw new Error('Food name is required');
      if (!formData.calories) throw new Error('Calories is required');
      if (!formData.labelServings) throw new Error('Number of servings on the label is required');
      if (!logDetails.mealType && !f.isVitamin) throw new Error('A meal category is required');

      let multiplier = 1;
      let finalAmount = 1;
      let finalUnit = 'serving';
      const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

      if (logDetails.consumptionMethod === 'serving') {
        if (!logDetails.servingsConsumed) throw new Error(`Please enter how many servings you had`);
        const labelServings = parseFloat(formData.labelServings) || 1;
        const consumedServings = parseFloat(logDetails.servingsConsumed) || 1;
        multiplier = consumedServings / labelServings;
        finalAmount = consumedServings;
        finalUnit = 'serving';
      } else if (isVolumeSelected) {
        if (!logDetails.volumeConsumed) throw new Error(`Please enter the amount you had`);
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

      // Base Nutrition
      const baseNutrition: any = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        icon: formData.icon.trim() || undefined, 
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
      };

      if (validVolumes.length > 0) {
        baseNutrition.volumes = validVolumes;
        baseNutrition.volume = validVolumes[0].amount;
        baseNutrition.volumeUnit = validVolumes[0].unit;
      }

      const cleanBaseNutrition = Object.fromEntries(Object.entries(baseNutrition).filter(([_, v]) => v !== undefined));

      const updatedFood = {
        ...log.food,
        ...cleanBaseNutrition
      };

      // Consumed Nutrition
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

      const cleanConsumedNutrition = Object.fromEntries(Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined));

      // Final Payload
      const rawPayload: any = {
        date: logDetails.date,
        mealType: logDetails.mealType,
        amount: finalAmount,
        unit: finalUnit,
        food: updatedFood,
        ...cleanConsumedNutrition,
        editedNutrition: null, 
      };

      if (isVolumeSelected) {
        rawPayload.volume = finalAmount;
        rawPayload.volumeUnit = finalUnit;
      }

      const cleanFirebasePayload = JSON.parse(JSON.stringify(rawPayload));
      
      // Trigger the popup instead of saving immediately
      setPendingFoodUpdate(cleanFirebasePayload);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const finalizeSaveNutrition = async (updatePast: boolean) => {
    if (!pendingFoodUpdate) return;

    try {
      setLoading(true);
      
      // If user selected Yes, update past logs using the nested base food object
      if (updatePast && user && pendingFoodUpdate.food) {
        await updateAllPastLogsForFood(user.uid, pendingFoodUpdate.food.id, pendingFoodUpdate.food);
      }

      // Hand off the current log update to the parent component
      onSave(pendingFoodUpdate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred saving data.');
      setLoading(false);
      setPendingFoodUpdate(null);
    }
  };

  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = selectedVolIndex >= 0 ? formData.labelVolumes[selectedVolIndex] : null;
  const filteredIcons = FOOD_ICONS.filter(item => item.title.toLowerCase().includes(iconSearch.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="create-food-modal" style={{ maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', overflowX: 'hidden' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>Edit Logged Food</h3>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: '#64748b' }}>✕</button>
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Base Nutrition Label</h4>
              
              <div className="form-group">
                <label htmlFor="name">Food Name *</label>
                <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label htmlFor="brand">Brand (Optional)</label>
                <input id="brand" type="text" name="brand" value={formData.brand} onChange={handleChange} />
              </div>

              {/* CUSTOM ICON DROPDOWN */}
              <div className="form-group" style={{ position: 'relative' }} ref={iconPickerRef}>
                <label htmlFor="icon">Icon / Emoji (Optional)</label>
                <div 
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  style={{ 
                    padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', color: formData.icon ? '#000' : '#94a3b8'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {formData.icon ? (
                      <><span style={{ fontSize: '1.2rem' }}>{formData.icon}</span><span style={{ color: '#000' }}>{FOOD_ICONS.find(i => i.icon === formData.icon)?.title || 'Custom Icon'}</span></>
                    ) : "Select an Icon..."}
                  </div>
                  <span>▼</span>
                </div>

                {showIconPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff',
                    border: '1px solid #cbd5e1', borderRadius: '0.5rem', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    maxHeight: '250px', display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
                      <input type="text" placeholder="Search icons..." value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '0.5rem', margin: 0, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      <div onClick={() => { setFormData(prev => ({...prev, icon: ''})); setShowIconPicker(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>❌ None</div>
                      {filteredIcons.map(item => (
                        <div key={item.title} onClick={() => { setFormData(prev => ({...prev, icon: item.icon})); setShowIconPicker(false); setIconSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: formData.icon === item.icon ? '#f1f5f9' : 'transparent' }}>
                          <span style={{ fontSize: '1.4rem' }}>{item.icon}</span><span>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="upc">UPC / Barcode (Optional)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <input id="upc" type="text" name="upc" value={formData.upc} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
                  <button type="button" className="btn btn-secondary" onClick={() => setIsScannerOpen(true)} style={{ padding: '0', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, margin: 0 }}>📷</button>
                </div>
              </div>

              <hr style={{ border: '0', borderTop: '1px solid #cbd5e1', margin: '1.25rem 0' }} />

              <div className="form-group">
                <label htmlFor="labelServings">Number of Servings on Label *</label>
                <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={formData.labelServings} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Volume/Weight/Amount on Label (Optional)</label>
                {formData.labelVolumes.map((vol, index) => {
                  const usedUnits = formData.labelVolumes.map(v => v.unit);
                  return (
                    <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <input type="text" inputMode="decimal" style={{ flex: 1 }} value={vol.amount} onChange={(e) => handleVolumeChange(index, 'amount', e.target.value)} />
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
                  <button type="button" onClick={addVolume} style={{ background: 'none', border: '1px dashed #94a3b8', padding: '0.5rem', borderRadius: '0.5rem', color: '#64748b', cursor: 'pointer', width: '100%', marginTop: '5px' }}>+ Add Another Option</button>
                )}
              </div>

              <hr style={{ border: '0', borderTop: '1px solid #cbd5e1', margin: '1.25rem 0' }} />

              <div className="form-group"><label htmlFor="calories">Calories (from label) *</label><input id="calories" type="text" inputMode="decimal" name="calories" value={formData.calories} onChange={handleChange} required /></div>
              <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={formData.fat} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="saturatedFat">Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={formData.saturatedFat} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="transFat">Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={formData.transFat} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="cholesterol">Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={formData.cholesterol} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="sodium">Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={formData.sodium} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={formData.carbs} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="fiber">Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={formData.fiber} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="sugar">Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={formData.sugar} onChange={handleChange} /></div>
              <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={formData.protein} onChange={handleChange} /></div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#166534' }}>Log Details</h4>
              
              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input type="date" id="date" name="date" value={logDetails.date} onChange={handleLogDetailsChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }} required />
              </div>

              {!f.isVitamin && (
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

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.75rem' }}>How was this logged? *</label>
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
                  <label htmlFor="servingsConsumed">Number of Servings {f.isVitamin ? 'Taken' : 'Eaten'} *</label>
                  <input id="servingsConsumed" type="text" inputMode="decimal" name="servingsConsumed" value={logDetails.servingsConsumed} onChange={handleLogDetailsChange} required />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="volumeConsumed">Amount {f.isVitamin ? 'Taken' : 'Eaten'} *</label>
                  <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input id="volumeConsumed" type="text" inputMode="decimal" name="volumeConsumed" style={{ flex: 1 }} value={logDetails.volumeConsumed} onChange={handleLogDetailsChange} required />
                    <span style={{ padding: '0.75rem 1rem', backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '3rem' }}>{selectedVol.unit}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ position: 'sticky', bottom: '-1.5rem', backgroundColor: '#fff', padding: '1rem 0', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
      
      {/* CUSTOM UPDATE PAST LOGS POPUP */}
      {pendingFoodUpdate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          padding: '1rem'
        }}>
          <div style={{ 
            backgroundColor: '#fff', padding: '1.5rem', borderRadius: '0.75rem', 
            maxWidth: '400px', width: '100%', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>Update Past Logs?</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Do you want to update all past logs of this food with the new nutrition information? <br/><br/>
              If you click <strong>No</strong>, only future logs will use this new information.
            </p>
            
{/* BUTTONS CONTAINER */}
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => finalizeSaveNutrition(false)} 
                  disabled={loading} 
                  style={{ flex: '1 1 0', boxSizing: 'border-box', padding: '0.75rem', margin: 0 }}
                >
                  No
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => finalizeSaveNutrition(true)} 
                  disabled={loading} 
                  style={{ flex: '1 1 0', boxSizing: 'border-box', padding: '0.75rem', margin: 0 }}
                >
                  {loading ? 'Saving...' : 'Yes'}
                </button>
              </div>

            <button 
              type="button" 
              onClick={() => setPendingFoodUpdate(null)} 
              disabled={loading} 
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel Edit
            </button>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScanner onClose={() => setIsScannerOpen(false)} onScanSuccess={(code) => { setFormData(prev => ({ ...prev, upc: code })); setIsScannerOpen(false); }} />
      )}
    </div>
  );
}