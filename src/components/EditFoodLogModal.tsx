// src/components/EditFoodLogModal.tsx
import { useState, useRef, useEffect } from 'react';
import { FoodLog, Food } from '../types';
import BarcodeScanner from './BarcodeScanner';
import { useAuth } from '../contexts/AuthContext';
import { updateAllPastLogsForFood, updateFood, updateFoodLog } from '../services/database';
import { FOOD_ICONS } from '../constants/icons';
import Icon from './Icon';
import './CreateFoodModal.css';

interface Props {
  log: FoodLog;
  onSave: (updates: Partial<FoodLog>) => void;
  onClose: () => void;
  isDoneDay?: boolean;
  onLabelSaved?: () => void; // NEW: Triggers a background refresh in the parent
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EditFoodLogModal({ log, onSave, onClose, isDoneDay, onLabelSaved }: Props) {
  const { user } = useAuth();
  const toStr = (val: any) => (val !== undefined && val !== null ? String(val) : '');

  // We maintain a local copy of the food object so it updates immediately when editing the label
  const [localFood, setLocalFood] = useState<Food>(log.food as any);

  // --- States for the "Edit Label" view ---
  const [isEditingNutrition, setIsEditingNutrition] = useState(false);

  const [editFormData, setEditFormData] = useState({
    name: localFood.name || '',
    brand: localFood.brand || '',
    icon: localFood.icon || '',
    upc: (localFood as any).upc || '',
    labelServings: toStr(localFood.servingSize ?? 1),
    labelVolumes: (localFood.volumes && localFood.volumes.length > 0) 
      ? localFood.volumes.map((v: any) => ({ amount: toStr(v.amount), unit: v.unit })) 
      : [{ amount: '', unit: 'g' }],
    calories: toStr(localFood.calories ?? 0),
    fat: toStr(localFood.fat),
    saturatedFat: toStr(localFood.saturatedFat),
    transFat: toStr((localFood as any).transFat),
    cholesterol: toStr((localFood as any).cholesterol),
    sodium: toStr((localFood as any).sodium),
    carbs: toStr(localFood.carbs),
    fiber: toStr(localFood.fiber),
    sugar: toStr(localFood.sugar),
    protein: toStr(localFood.protein),
  });

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const [isEditScannerOpen, setIsEditScannerOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- States for the "Log Details" view ---
  let initialMethod = 'serving';
  let initialVolConsumed = '';
  let initialServingsConsumed = '1';

  if (log.unit === 'serving') {
    initialServingsConsumed = toStr(log.amount);
  } else {
    const volIndex = localFood.volumes?.findIndex((v: any) => v.unit === log.unit);
    if (volIndex !== undefined && volIndex >= 0) {
      initialMethod = `volume-${volIndex}`;
      initialVolConsumed = toStr(log.amount);
    }
  }

  const [logDetails, setLogDetails] = useState({
    date: log.date || getLocalTodayString(),
    mealType: log.mealType && log.mealType !== 'Uncategorized' ? log.mealType : '',
    consumptionMethod: initialMethod,
    servingsConsumed: initialServingsConsumed,
    volumeConsumed: initialVolConsumed,
    isPlanned: log.isPlanned || false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine if we should show the Planned Toggle
  const originalDate = log.date || getLocalTodayString();
  const isCurrentDateDone = isDoneDay && logDetails.date === originalDate;

  // --- Reusable Logic for Saving the Log Details to DB ---
  const processLogSave = async (foodObj: Food, details: typeof logDetails, shouldClose: boolean = true) => {
    if (!foodObj.isVitamin && !details.mealType) throw new Error('A meal category is required');

    let multiplier = 1;
    let finalAmount = 1;
    let finalUnit = 'serving';
    const isVolumeSelected = details.consumptionMethod.startsWith('volume-');

    if (details.consumptionMethod === 'serving') {
      if (!details.servingsConsumed) throw new Error(`Please enter how many servings you had`);
      const labelServings = foodObj.servingSize || 1;
      const consumedServings = parseFloat(details.servingsConsumed) || 1;
      multiplier = consumedServings / labelServings;
      finalAmount = consumedServings;
      finalUnit = 'serving';
    } else if (isVolumeSelected && foodObj.volumes) {
      if (!details.volumeConsumed) throw new Error(`Please enter the amount you had`);
      const volIndex = parseInt(details.consumptionMethod.split('-')[1]);
      const selectedVol = foodObj.volumes[volIndex];
      if (!selectedVol || !selectedVol.amount) throw new Error('Cannot calculate based on an invalid volume');
      const labelVol = selectedVol.amount;
      const consumedVol = parseFloat(details.volumeConsumed) || 0;
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
      calories: calcConsumed(foodObj.calories) || 0,
      fat: calcConsumed(foodObj.fat),
      saturatedFat: calcConsumed(foodObj.saturatedFat),
      transFat: calcConsumed((foodObj as any).transFat),
      cholesterol: calcConsumed((foodObj as any).cholesterol),
      sodium: calcConsumed((foodObj as any).sodium),
      carbs: calcConsumed(foodObj.carbs),
      fiber: calcConsumed(foodObj.fiber),
      sugar: calcConsumed(foodObj.sugar),
      protein: calcConsumed(foodObj.protein),
    };

    const cleanConsumedNutrition = Object.fromEntries(Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined));

    const rawPayload: any = {
      date: details.date,
      mealType: details.mealType,
      amount: finalAmount,
      unit: finalUnit,
      food: foodObj,
      isPlanned: details.isPlanned, 
      ...cleanConsumedNutrition,
      editedNutrition: null, 
    };

    if (isVolumeSelected) {
      rawPayload.volume = finalAmount;
      rawPayload.volumeUnit = finalUnit;
    } else {
      rawPayload.volume = null;
      rawPayload.volumeUnit = null;
    }

    const cleanFirebasePayload = JSON.parse(JSON.stringify(rawPayload));
    
    if (shouldClose) {
      // Calls parent save handler which commits changes and closes modal
      onSave(cleanFirebasePayload);
    } else {
      // Directly updates the DB and refreshes background WITHOUT closing the modal
      if (!user) return;
      await updateFoodLog(user.uid, log.id, cleanFirebasePayload);
      if (onLabelSaved) onLabelSaved();
    }
  };

  // --- Handlers for "Edit Label" ---
  const handleEditClick = () => {
    setEditFormData({
      name: localFood.name || '',
      brand: localFood.brand || '',
      icon: localFood.icon || '',
      upc: (localFood as any).upc || '',
      calories: localFood.calories?.toString() || '',
      fat: localFood.fat?.toString() || '',
      saturatedFat: localFood.saturatedFat?.toString() || '',
      transFat: (localFood as any).transFat?.toString() || '',
      cholesterol: (localFood as any).cholesterol?.toString() || '',
      sodium: (localFood as any).sodium?.toString() || '',
      carbs: localFood.carbs?.toString() || '',
      fiber: localFood.fiber?.toString() || '',
      sugar: localFood.sugar?.toString() || '',
      protein: localFood.protein?.toString() || '',
      labelServings: localFood.servingSize?.toString() || '1',
      labelVolumes: (localFood.volumes && localFood.volumes.length > 0)
        ? localFood.volumes.map(v => ({ amount: v.amount?.toString() || '', unit: v.unit })) 
        : [{ amount: '', unit: 'g' }]
    });
    setIsEditingNutrition(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'upc' && value !== '' && !/^\d*$/.test(value)) return;
    if (name === 'upc' && value.length > 12) return; 
    if (name !== 'name' && name !== 'brand' && name !== 'upc' && name !== 'icon') {
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

  // Directly save updates to the DB without prompting the user
  const handleSaveNutritionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editFormData.name.trim()) { setError('Name is required'); return; }
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
      ...localFood,
      name: editFormData.name.trim() || localFood.name,
      brand: editFormData.brand.trim() || localFood.brand,
      icon: editFormData.icon.trim() || undefined,
      upc: editFormData.upc.trim() || undefined,
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

    if (!user) return;

    try {
      setLoading(true);
      const cleanFirebasePayload = Object.fromEntries(
        Object.entries(updatedFood).filter(([_, v]) => v !== undefined)
      );
      
      // Save to main foods collection
      await updateFood(localFood.id, cleanFirebasePayload);
      
      // Automatically cascade update to ALL past logs and recipes containing this food
      await updateAllPastLogsForFood(user.uid, localFood.id, updatedFood);

      setLocalFood(updatedFood);
      
      // Safely reset method if a volume they were previously logging with was deleted
      let safeDetails = { ...logDetails };
      const isVolMethod = safeDetails.consumptionMethod.startsWith('volume-');
      if (isVolMethod) {
          const vIdx = parseInt(safeDetails.consumptionMethod.split('-')[1]);
          if (!updatedFood.volumes || !updatedFood.volumes[vIdx]) {
              safeDetails = {
                  ...safeDetails,
                  consumptionMethod: 'serving',
                  servingsConsumed: '1',
                  volumeConsumed: ''
              };
              setLogDetails(safeDetails);
          }
      }

      // Switch back to the edit log view without closing!
      setIsEditingNutrition(false);
      setError('');

      // Save the log specifically with current text inputs, but pass FALSE to prevent closing
      await processLogSave(updatedFood, safeDetails, false);

    } catch (err) {
      console.error("Failed to update food label:", err);
      setError(err instanceof Error ? err.message : "Failed to save changes to database.");
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers for "Log Details" ---
  const handleLogDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const name = target.name;

    if (target.type === 'checkbox') {
      setLogDetails(prev => ({ ...prev, [name]: target.checked }));
      return;
    }

    const value = target.value;
    if ((name === 'servingsConsumed' || name === 'volumeConsumed') && value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    
    setLogDetails(prev => {
      const updates: any = { [name]: value };
      if (name === 'date') {
        updates.isPlanned = value > getLocalTodayString();
      }
      return { ...prev, ...updates };
    });
  };

  const calculatePreview = () => {
    let multiplier = 1;
    const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');

    if (logDetails.consumptionMethod === 'serving') {
      const labelServings = localFood.servingSize || 1;
      const consumedServings = parseFloat(logDetails.servingsConsumed) || 0;
      multiplier = consumedServings / labelServings;
    } else if (isVolumeSelected && localFood.volumes) {
      const volIndex = parseInt(logDetails.consumptionMethod.split('-')[1]);
      const selectedVol = localFood.volumes[volIndex];
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
      calories: calc(localFood.calories), protein: calc(localFood.protein), carbs: calc(localFood.carbs),
      fat: calc(localFood.fat), saturatedFat: calc(localFood.saturatedFat), transFat: calc((localFood as any).transFat),
      cholesterol: calc((localFood as any).cholesterol), sodium: calc((localFood as any).sodium),
      fiber: calc(localFood.fiber), sugar: calc(localFood.sugar),
    };
  };

  const handleSaveLogDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Passes true to close the modal after manual Log Details save
      await processLogSave(localFood, logDetails, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = (selectedVolIndex >= 0 && localFood.volumes) ? localFood.volumes[selectedVolIndex] : null;
  const hasVolumes = localFood.volumes && localFood.volumes.length > 0;
  const filteredIcons = FOOD_ICONS.filter(item => item.title.toLowerCase().includes(iconSearch.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', boxSizing: 'border-box' }}>
      
      <style>{`
        .edit-log-modal-container * {
          box-sizing: border-box !important;
        }
        .edit-log-modal-container input:not([type="checkbox"]):not([type="radio"]), 
        .edit-log-modal-container select {
          width: 100%;
          max-width: 100%;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="modal-content edit-log-modal-container" onClick={(e) => e.stopPropagation()} style={{ padding: 0, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'hidden', borderRadius: '1rem', boxSizing: 'border-box', backgroundColor: '#fff' }}>
        
        {/* === EDIT NUTRITION VIEW === */}
        {isEditingNutrition ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem', flexShrink: 0 }}>
              <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>Edit Nutrition Label</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                Update the base nutrition for this entry.
              </p>
              {error && <div className="error" style={{ marginTop: '1rem', marginBottom: 0 }}>{error}</div>}
            </div>

            {/* Scrollable Form Body with Sticky Footer wrapper */}
            <form onSubmit={handleSaveNutritionForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', overflowX: 'hidden' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="name" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>{localFood.isVitamin ? 'Vitamin Name *' : 'Food Name *'}</label>
                  <input id="name" type="text" name="name" value={editFormData.name} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} required />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="brand" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Brand (Optional)</label>
                  <input id="brand" type="text" name="brand" value={editFormData.brand} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                </div>

                <div className="form-group" style={{ position: 'relative', marginBottom: '1rem' }} ref={iconPickerRef}>
                  <label htmlFor="icon" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Icon / Emoji (Optional)</label>
                  <div 
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    style={{ 
                      padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', color: editFormData.icon ? '#000' : '#94a3b8'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {editFormData.icon ? (
                      <>
                        <Icon icon={editFormData.icon} size="1.2rem" />
                        <span style={{ color: '#000' }}>
                          {FOOD_ICONS.find(i => i.icon === editFormData.icon)?.title || 'Custom Icon'}
                        </span>
                      </>
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
                        <input type="text" placeholder="Search icons..." value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '0.5rem', margin: 0 }} />
                      </div>
                      <div className="hide-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
                        <div onClick={() => { setEditFormData(prev => ({...prev, icon: ''})); setShowIconPicker(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>❌ None</div>
                        {filteredIcons.map(item => (
                          <div key={item.title} onClick={() => { setEditFormData(prev => ({...prev, icon: item.icon})); setShowIconPicker(false); setIconSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: editFormData.icon === item.icon ? '#f1f5f9' : 'transparent' }}>
                            <Icon icon={item.icon} size="1.4rem" />
                            <span>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="upc" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>UPC / Barcode (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                    <input id="upc" type="text" name="upc" value={editFormData.upc} onChange={handleEditChange} style={{ flex: 1, minWidth: 0, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                    <button type="button" className="btn btn-secondary" onClick={() => setIsEditScannerOpen(true)} style={{ padding: '0', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, margin: 0 }}>📷</button>
                  </div>
                </div>

                <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="labelServings" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Number of Servings on Label *</label>
                  <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={editFormData.labelServings} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} required />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Volume/Weight/Amount on Label (Optional)</label>
                  {editFormData.labelVolumes.map((vol, index) => {
                    const usedUnits = editFormData.labelVolumes.map(v => v.unit);
                    return (
                      <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{ flex: 1, minWidth: 0, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                          value={vol.amount}
                          onChange={(e) => handleEditVolumeChange(index, 'amount', e.target.value)}
                        />
                        <select
                          style={{ width: 'auto', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
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
                          <button type="button" onClick={() => removeEditVolume(index)} style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', flexShrink: 0 }}>X</button>
                        )}
                      </div>
                    );
                  })}
                  {editFormData.labelVolumes.length < ALL_UNITS.length && (
                    <button type="button" onClick={addEditVolume} style={{ background: 'none', border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '0.5rem', color: '#64748b', cursor: 'pointer', width: '100%', marginTop: '5px' }}>+ Add Another Option</button>
                  )}
                </div>

                <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="calories" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Calories (from label) *</label><input id="calories" type="text" inputMode="decimal" name="calories" value={editFormData.calories} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} required /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="fat" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={editFormData.fat} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="saturatedFat" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={editFormData.saturatedFat} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="transFat" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={editFormData.transFat} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="cholesterol" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={editFormData.cholesterol} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="sodium" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={editFormData.sodium} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="carbs" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={editFormData.carbs} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="fiber" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={editFormData.fiber} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="sugar" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={editFormData.sugar} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
                <div className="form-group" style={{ marginBottom: '1rem' }}><label htmlFor="protein" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={editFormData.protein} onChange={handleEditChange} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} /></div>
              </div>
              
              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ margin: 0, flex: '1 1 0' }}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingNutrition(false)} disabled={loading} style={{ margin: 0, flex: '1 1 0' }}>
                  Cancel
                </button>
              </div>
            </form>

            {isEditScannerOpen && (
              <BarcodeScanner onClose={() => setIsEditScannerOpen(false)} onScanSuccess={(code) => { setEditFormData(prev => ({ ...prev, upc: code })); setIsEditScannerOpen(false); }} />
            )}
          </div>
        ) : (
          /* === LOG DETAILS VIEW === */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <h3 style={{ margin: 0 }}>Edit Log Details</h3>
                <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: '#64748b' }}>✕</button>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem', marginTop: 0 }}>
                When did you {localFood.isVitamin ? 'take' : 'eat'} <strong style={{ textTransform: 'capitalize' }}>{localFood.name}</strong>, and how much?
              </p>
              <button
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={handleEditClick}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', margin: 0 }}
              >
                ✏️ Edit Label
              </button>
              {error && <div className="error" style={{ marginTop: '1rem', marginBottom: 0 }}>{error}</div>}
            </div>

            <form onSubmit={handleSaveLogDetails} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', overflowX: 'hidden' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="date" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                  <input 
                    type="date" 
                    id="date"
                    name="date"
                    value={logDetails.date} 
                    onChange={handleLogDetailsChange}
                    style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                    required
                  />
                </div>

                {!localFood.isVitamin && (
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="mealType" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Meal Category *</label>
                    <select
                      id="mealType"
                      name="mealType"
                      value={logDetails.mealType}
                      onChange={handleLogDetailsChange}
                      style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                      required
                    >
                      <option value="" disabled>Select a Category...</option>
                      <option value="Breakfast">🌅 Breakfast</option>
                      <option value="Lunch">☀️ Lunch</option>
                      <option value="Dinner">🌙 Dinner</option>
                      <option value="Snack">🍎 Snack</option>
                    </select>
                  </div>
                )}

                <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.75rem' }}>How do you want to log this? *</label>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                      <input 
                        type="radio" 
                        name="consumptionMethod" 
                        value="serving" 
                        checked={logDetails.consumptionMethod === 'serving'} 
                        onChange={handleLogDetailsChange} 
                        style={{ width: 'auto', margin: 0 }} 
                      /> 
                      By Servings
                    </label>
                    
                    {hasVolumes && localFood.volumes!.map((vol, index) => {
                      if (!vol.amount) return null;
                      return (
                        <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input 
                            type="radio" 
                            name="consumptionMethod" 
                            value={`volume-${index}`} 
                            checked={logDetails.consumptionMethod === `volume-${index}`} 
                            onChange={handleLogDetailsChange} 
                            style={{ width: 'auto', margin: 0 }} 
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
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="servingsConsumed" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Number of Servings {localFood.isVitamin ? 'Taken' : 'Eaten'} *</label>
                    <input
                      id="servingsConsumed"
                      type="text"
                      inputMode="decimal"
                      name="servingsConsumed"
                      value={logDetails.servingsConsumed}
                      onChange={handleLogDetailsChange}
                      style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                      placeholder="1"
                      required
                    />
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="volumeConsumed" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Amount {localFood.isVitamin ? 'Taken' : 'Eaten'} *</label>
                    <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        id="volumeConsumed"
                        type="text"
                        inputMode="decimal"
                        name="volumeConsumed"
                        style={{ flex: 1, minWidth: 0, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                        value={logDetails.volumeConsumed}
                        onChange={handleLogDetailsChange}
                        placeholder={`e.g., ${selectedVol.amount}`}
                        required
                      />
                      <span style={{ 
                        padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', 
                        border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', minWidth: '3rem'
                      }}>
                        {selectedVol.unit}
                      </span>
                    </div>
                  </div>
                )}

                {/* Preview Section */}
                <div style={{ 
                  marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f8fafc', 
                  borderRadius: '0.75rem', border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                    Nutrition Preview
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {[
                      { label: 'Calories', value: `${calculatePreview().calories} cal`, isHighlight: true, indent: false },
                      { label: 'Total Fat', value: `${calculatePreview().fat}g`, isHighlight: false, indent: false },
                      { label: 'Saturated Fat', value: `${calculatePreview().saturatedFat}g`, isHighlight: false, indent: true },
                      { label: 'Trans Fat', value: `${calculatePreview().transFat}g`, isHighlight: false, indent: true },
                      { label: 'Cholesterol', value: `${calculatePreview().cholesterol}mg`, isHighlight: false, indent: false },
                      { label: 'Sodium', value: `${calculatePreview().sodium}mg`, isHighlight: false, indent: false },
                      { label: 'Total Carbohydrate', value: `${calculatePreview().carbs}g`, isHighlight: false, indent: false },
                      { label: 'Dietary Fiber', value: `${calculatePreview().fiber}g`, isHighlight: false, indent: true },
                      { label: 'Total Sugars', value: `${calculatePreview().sugar}g`, isHighlight: false, indent: true },
                      { label: 'Protein', value: `${calculatePreview().protein}g`, isHighlight: false, indent: false },
                    ].map((nutrient, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        borderBottom: idx !== 9 ? '1px solid #e2e8f0' : 'none', paddingBottom: idx !== 9 ? '0.2rem' : '0'
                      }}>
                        <span style={{ 
                          fontSize: nutrient.isHighlight ? '0.75rem' : '0.65rem', textTransform: 'uppercase', 
                          color: nutrient.isHighlight ? '#475569' : '#94a3b8', fontWeight: nutrient.isHighlight ? 700 : 400,
                          paddingLeft: nutrient.indent ? '0.75rem' : '0'
                        }}>
                          {nutrient.label}
                        </span>
                        <span style={{ 
                          fontWeight: 700, color: nutrient.isHighlight ? '#2563eb' : '#1e293b', 
                          fontSize: nutrient.isHighlight ? '1rem' : '0.8rem' 
                        }}>
                          {nutrient.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!isCurrentDateDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #cbd5e1' }}>
                    <input 
                      type="checkbox" 
                      id="isPlanned"
                      name="isPlanned"
                      checked={logDetails.isPlanned}
                      onChange={handleLogDetailsChange}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', margin: 0 }}
                    />
                    <label htmlFor="isPlanned" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, color: '#475569' }}>
                      Plan for later
                    </label>
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ margin: 0, flex: '1 1 0' }}>
                  {loading ? 'Saving...' : 'Save Log Update'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose} style={{ margin: 0, flex: '1 1 0' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}