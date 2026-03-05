// src/components/CreateRecipeModal.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Food, FoodLog } from '../types';
import { createFood, createFoodLog, updateFoodLog } from '../services/database';
import CreateFoodModal from './CreateFoodModal';
import BarcodeScanner from './BarcodeScanner';

interface RecipeIngredient {
  food: Food;
  amount: number;
  unit: string;
  macros: any;
}

interface Props {
  foods: Food[];
  onClose: () => void;
  onCreated: () => void;
  selectedDate: string;
  editLog?: FoodLog | null; // <-- NEW: Accepts an existing log to edit!
  editFood?: Food | null;
}

export default function CreateRecipeModal({ foods, onClose, onCreated, selectedDate, editLog, editFood }: Props) {
  const { user } = useAuth();
  const isEditLogMode = !!editLog;
  const isEditFoodMode = !!editFood;
  const sourceFood = editLog?.food || editFood;

  const [step, setStep] = useState<'builder' | 'select-previous' | 'size-ingredient' | 'create-ingredient' | 'scan' | 'final-log'>('builder');
  
  // --- Initialize state with the existing recipe data if we are editing! ---
  const [recipeName, setRecipeName] = useState(sourceFood?.name || '');
  const [recipeServings, setRecipeServings] = useState((sourceFood as any)?.recipeServings?.toString() || '1');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>((sourceFood as any)?.recipeIngredients || []);
  
  const [activeFood, setActiveFood] = useState<Food | null>(null);
  const [scannedUpc, setScannedUpc] = useState<string | null>(null);
  
  // Sizing State for Existing Foods
  const [consumptionMethod, setConsumptionMethod] = useState('serving');
  const [servingsConsumed, setServingsConsumed] = useState('1');
  const [volumeConsumed, setVolumeConsumed] = useState('');

  // Final Log State
  const [logDate, setLogDate] = useState(editLog?.date || selectedDate);
  const [logMealType, setLogMealType] = useState(editLog?.mealType || '');
  const [logServingsConsumed, setLogServingsConsumed] = useState(editLog?.amount?.toString() || '1');
  const [isLogging, setIsLogging] = useState(false);

  // --- Total Macros Calculation ---
  const totalMacros = ingredients.reduce((acc, curr) => {
    acc.calories += curr.macros.calories || 0;
    acc.protein += curr.macros.protein || 0;
    acc.carbs += curr.macros.carbs || 0;
    acc.fat += curr.macros.fat || 0;
    acc.saturatedFat += curr.macros.saturatedFat || 0;
    acc.transFat += curr.macros.transFat || 0;
    acc.cholesterol += curr.macros.cholesterol || 0;
    acc.sodium += curr.macros.sodium || 0;
    acc.fiber += curr.macros.fiber || 0;
    acc.sugar += curr.macros.sugar || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, transFat: 0, cholesterol: 0, sodium: 0, fiber: 0, sugar: 0 });

  // --- Handlers ---
  const handleScanSuccess = (code: string) => {
    const matched = foods.find(f => f.upc === code);
    if (matched) {
      if (matched.isVitamin) {
        alert("Vitamins cannot be added to recipes.");
        setStep('scan'); 
      } else {
        setActiveFood(matched);
        setConsumptionMethod('serving'); setServingsConsumed('1'); setVolumeConsumed('');
        setStep('size-ingredient');
      }
    } else {
      setScannedUpc(code);
      setStep('create-ingredient');
    }
  };

  const handleSizeExistingFood = () => {
    if (!activeFood) return;
    let multiplier = 1;
    let finalAmount = 1;
    let finalUnit = 'serving';

    if (consumptionMethod === 'serving') {
      const labelServings = activeFood.servingSize || 1;
      const consumed = parseFloat(servingsConsumed) || 1;
      multiplier = consumed / labelServings;
      finalAmount = consumed;
    } else {
      const volIndex = parseInt(consumptionMethod.split('-')[1]);
      const selectedVol = activeFood.volumes ? activeFood.volumes[volIndex] : null;
      if (selectedVol && selectedVol.amount) {
        multiplier = (parseFloat(volumeConsumed) || 0) / selectedVol.amount;
        finalAmount = parseFloat(volumeConsumed) || 0;
        finalUnit = selectedVol.unit;
      }
    }

    const calc = (val: number | undefined) => val ? Number((val * multiplier).toFixed(2)) : 0;
    
    const calculatedMacros = {
      calories: calc(activeFood.calories), protein: calc(activeFood.protein), carbs: calc(activeFood.carbs), fat: calc(activeFood.fat),
      saturatedFat: calc(activeFood.saturatedFat), transFat: calc(activeFood.transFat), cholesterol: calc(activeFood.cholesterol),
      sodium: calc(activeFood.sodium), fiber: calc(activeFood.fiber), sugar: calc(activeFood.sugar),
    };

    setIngredients(prev => [...prev, { food: activeFood, amount: finalAmount, unit: finalUnit, macros: calculatedMacros }]);
    setActiveFood(null);
    setStep('builder');
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLogging(true);

    try {
      const totalRecipeServings = parseFloat(recipeServings) || 1;
      
      // 1. Create the Base Food Object 
      const baseNutrition: any = {
        name: recipeName.trim(),
        calories: Number((totalMacros.calories / totalRecipeServings).toFixed(2)),
        protein: Number((totalMacros.protein / totalRecipeServings).toFixed(2)),
        carbs: Number((totalMacros.carbs / totalRecipeServings).toFixed(2)),
        fat: Number((totalMacros.fat / totalRecipeServings).toFixed(2)),
        saturatedFat: Number((totalMacros.saturatedFat / totalRecipeServings).toFixed(2)),
        transFat: Number((totalMacros.transFat / totalRecipeServings).toFixed(2)),
        cholesterol: Number((totalMacros.cholesterol / totalRecipeServings).toFixed(2)),
        sodium: Number((totalMacros.sodium / totalRecipeServings).toFixed(2)),
        fiber: Number((totalMacros.fiber / totalRecipeServings).toFixed(2)),
        sugar: Number((totalMacros.sugar / totalRecipeServings).toFixed(2)),
        servingSize: 1,
        servingUnit: 'serving',
        isVitamin: false,
        // --- NEW: Save the recipe blueprint directly into the food! ---
        isRecipe: true, 
        recipeServings: totalRecipeServings,
        recipeIngredients: ingredients
      };

      const cleanBaseNutrition = JSON.parse(JSON.stringify(baseNutrition));
      // By creating a new food ID, we ensure we don't accidentally overwrite past logs if the user tweaks the recipe for just today
      const newFoodId = await createFood(user.uid, cleanBaseNutrition);

      // 2. Create the Food Log payload
      const consumedMultiplier = parseFloat(logServingsConsumed) || 1;
      const consumedNutrition: any = {
        calories: Number((cleanBaseNutrition.calories * consumedMultiplier).toFixed(2)),
        protein: Number((cleanBaseNutrition.protein * consumedMultiplier).toFixed(2)),
        carbs: Number((cleanBaseNutrition.carbs * consumedMultiplier).toFixed(2)),
        fat: Number((cleanBaseNutrition.fat * consumedMultiplier).toFixed(2)),
        saturatedFat: Number((cleanBaseNutrition.saturatedFat * consumedMultiplier).toFixed(2)),
        transFat: Number((cleanBaseNutrition.transFat * consumedMultiplier).toFixed(2)),
        cholesterol: Number((cleanBaseNutrition.cholesterol * consumedMultiplier).toFixed(2)),
        sodium: Number((cleanBaseNutrition.sodium * consumedMultiplier).toFixed(2)),
        fiber: Number((cleanBaseNutrition.fiber * consumedMultiplier).toFixed(2)),
        sugar: Number((cleanBaseNutrition.sugar * consumedMultiplier).toFixed(2)),
      };

      const foodObject: Food = { id: newFoodId, userId: user.uid, ...cleanBaseNutrition, createdAt: Date.now() };

      const payload = {
        date: logDate, foodId: newFoodId, food: foodObject, amount: consumedMultiplier, unit: 'serving',
        mealType: logMealType, ...consumedNutrition
      };

      // 3. Either Update the existing log, or Create a new one
      if (isEditLogMode && editLog) {
        await updateFoodLog(user.uid, editLog.id, JSON.parse(JSON.stringify(payload)));
      } else {
        await createFoodLog(user.uid, JSON.parse(JSON.stringify(payload)));
      }
      
      onCreated();
    } catch (err) {
      console.error(err);
      alert("Failed to log recipe.");
    } finally {
      setIsLogging(false);
    }
  };

  // --- Sub-Views ---

  if (step === 'scan') {
    return <BarcodeScanner onClose={() => setStep('builder')} onScanSuccess={handleScanSuccess} />;
  }

  if (step === 'create-ingredient') {
    return (
      <div className="add-food-overlay">
        <div className="add-food-modal">
           <CreateFoodModal 
             isRecipeIngredientMode={true} 
             initialUpc={scannedUpc || ''} 
             onClose={() => setStep('builder')} 
             onIngredientCalculated={(foodObj, macros, amt, unit) => {
               setIngredients(prev => [...prev, { food: foodObj, amount: amt, unit: unit, macros: macros }]);
               setStep('builder');
             }} 
           />
        </div>
      </div>
    );
  }

  return (
    <div className="add-food-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.6)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
      <div className="add-food-modal" style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {step === 'builder' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{isEditLogMode ? 'Edit Recipe Log' : (isEditFoodMode ? 'Edit Recipe' : 'Create Recipe')}</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Recipe Name</label>
                <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="e.g. Mom's Chili" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>How many servings does this make total?</label>
                <input type="text" inputMode="decimal" value={recipeServings} onChange={e => setRecipeServings(e.target.value)} placeholder="e.g. 4" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
              </div>
            </div>

            <h4 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>Ingredients</h4>
            {ingredients.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', marginBottom: '1rem', color: '#64748b' }}>
                No ingredients added yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ing.food.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{ing.amount} {ing.unit}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>{Math.round(ing.macros.calories)} cal</div>
                      <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '2rem' }}>
              <button onClick={() => setStep('select-previous')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>+ Previous Food</button>
              <button onClick={() => setStep('create-ingredient')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>+ Create New</button>
              <button onClick={() => setStep('scan')} style={{ gridColumn: 'span 2', padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>📷 Scan Barcode</button>
            </div>

            {/* --- NEW TOTAL MACROS PREVIEW --- */}
<div style={{ 
              padding: '1.25rem', 
              backgroundColor: '#f8fafc', 
              borderRadius: '0.75rem', 
              border: '1px solid #e2e8f0',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                Total Recipe Nutrition
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {[
                  { label: 'Calories', value: `${Math.round(totalMacros.calories)} cal`, isHighlight: true, indent: false },
                  { label: 'Total Fat', value: `${Math.round(totalMacros.fat)}g`, isHighlight: false, indent: false },
                  { label: 'Saturated Fat', value: `${Math.round(totalMacros.saturatedFat)}g`, isHighlight: false, indent: true },
                  { label: 'Trans Fat', value: `${Math.round(totalMacros.transFat)}g`, isHighlight: false, indent: true },
                  { label: 'Cholesterol', value: `${Math.round(totalMacros.cholesterol)}mg`, isHighlight: false, indent: false },
                  { label: 'Sodium', value: `${Math.round(totalMacros.sodium)}mg`, isHighlight: false, indent: false },
                  { label: 'Total Carbohydrate', value: `${Math.round(totalMacros.carbs)}g`, isHighlight: false, indent: false },
                  { label: 'Dietary Fiber', value: `${Math.round(totalMacros.fiber)}g`, isHighlight: false, indent: true },
                  { label: 'Total Sugars', value: `${Math.round(totalMacros.sugar)}g`, isHighlight: false, indent: true },
                  { label: 'Protein', value: `${Math.round(totalMacros.protein)}g`, isHighlight: false, indent: false },
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
                      paddingLeft: nutrient.indent ? '0.75rem' : '0' // Added indentation for sub-nutrients
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

            <button 
              disabled={ingredients.length === 0 || !recipeName.trim()} 
              onClick={() => setStep('final-log')}
              style={{ width: '100%', padding: '1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: (ingredients.length === 0 || !recipeName.trim()) ? 'not-allowed' : 'pointer', opacity: (ingredients.length === 0 || !recipeName.trim()) ? 0.5 : 1 }}
            >
              Continue to Log Details
            </button>
          </>
        )}

        {step === 'select-previous' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Select Ingredient</h3>
              <button onClick={() => setStep('builder')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {foods.filter(f => !f.isVitamin).map(f => (
                <div key={f.id} onClick={() => { setActiveFood(f); setConsumptionMethod('serving'); setServingsConsumed('1'); setVolumeConsumed(''); setStep('size-ingredient'); }} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontWeight: 600 }}>{f.name}</div>
                  {f.brand && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{f.brand}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'size-ingredient' && activeFood && (
          <>
             <h3 style={{ marginBottom: '1.5rem' }}>How much {activeFood.name}?</h3>
             
             <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" checked={consumptionMethod === 'serving'} onChange={() => setConsumptionMethod('serving')} style={{ margin: 0 }} /> By Servings
                </label>
                {(activeFood.volumes || []).map((vol: any, index: number) => (
                  <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" checked={consumptionMethod === `volume-${index}`} onChange={() => setConsumptionMethod(`volume-${index}`)} style={{ margin: 0 }} /> By {vol.unit}
                  </label>
                ))}
              </div>

              {consumptionMethod === 'serving' ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Number of Servings Added</label>
                  <input type="text" inputMode="decimal" value={servingsConsumed} onChange={e => setServingsConsumed(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Amount Added</label>
                  <input type="text" inputMode="decimal" value={volumeConsumed} onChange={e => setVolumeConsumed(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={handleSizeExistingFood} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Add to Recipe</button>
                <button onClick={() => setStep('builder')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
              </div>
          </>
        )}

        {step === 'final-log' && (
          <form onSubmit={handleFinalLog}>
            <h3 style={{ marginBottom: '1.5rem' }}>{isEditLogMode ? 'Update Recipe Details' : 'Log Your Recipe'}</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Meal Category *</label>
              <select value={logMealType} onChange={e => setLogMealType(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                <option value="" disabled>Select a Category...</option>
                <option value="Breakfast">🌅 Breakfast</option>
                <option value="Lunch">☀️ Lunch</option>
                <option value="Dinner">🌙 Dinner</option>
                <option value="Snack">🍎 Snack</option>
              </select>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>How many servings did you eat? *</label>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>This recipe makes {recipeServings} total servings.</p>
              <input type="text" inputMode="decimal" value={logServingsConsumed} onChange={e => setLogServingsConsumed(e.target.value)} placeholder="1" required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" disabled={isLogging} style={{ flex: 1, padding: '1rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                  {isLogging ? 'Saving...' : (isEditLogMode ? 'Update Recipe Log' : 'Save & Log Recipe')}
                </button>
                <button type="button" onClick={() => setStep('builder')} style={{ padding: '1rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Back</button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}