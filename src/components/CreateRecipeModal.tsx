// src/components/CreateRecipeModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Food, FoodLog } from '../types';
import { createFood, updateFood, createFoodLog, updateFoodLog } from '../services/database';
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
  editLog?: FoodLog | null; 
  editFood?: Food | null;
  initialMealType?: string;
  isDoneDay?: boolean;
}

const FOOD_ICONS = [
  { icon: '🍎', title: 'Apple (Red)' }, { icon: '🍏', title: 'Apple (Green)' }, { icon: '🥑', title: 'Avocado' },
  { icon: '🍼', title: 'Baby Bottle / Formula' }, { icon: '🥓', title: 'Bacon' }, { icon: '🥯', title: 'Bagel' },
  { icon: '🥖', title: 'Baguette' }, { icon: '🍌', title: 'Banana' }, { icon: '🫘', title: 'Beans' },
  { icon: '🍺', title: 'Beer' }, { icon: '🍻', title: 'Beers (Cheers)' }, { icon: '🫑', title: 'Bell Pepper' },
  { icon: '🍱', title: 'Bento / Lunchbox' }, { icon: '🎂', title: 'Birthday Cake' }, { icon: '🫐', title: 'Blueberries' },
  { icon: '🍖', title: 'Bone-In Meat / Ribs' }, { icon: '🥣', title: 'Bowl with Spoon / Cereal' }, { icon: '🍞', title: 'Bread' },
  { icon: '🥦', title: 'Broccoli' }, { icon: '🧋', title: 'Bubble Tea / Boba' }, { icon: '🍔', title: 'Burger' },
  { icon: '🌯', title: 'Burrito' }, { icon: '🧈', title: 'Butter' }, { icon: '🍰', title: 'Cake / Shortcake' },
  { icon: '🍬', title: 'Candy' }, { icon: '🥫', title: 'Canned Food / Soup' }, { icon: '🥕', title: 'Carrot' },
  { icon: '🍾', title: 'Champagne / Sparkling Wine' }, { icon: '🧀', title: 'Cheese' }, { icon: '🍒', title: 'Cherries' },
  { icon: '🌰', title: 'Chestnut / Nut' }, { icon: '🍗', title: 'Chicken / Poultry' }, { icon: '🍫', title: 'Chocolate' },
  { icon: '🥂', title: 'Clinking Glasses' }, { icon: '🍸', title: 'Cocktail / Martini' }, { icon: '🥥', title: 'Coconut' },
  { icon: '☕', title: 'Coffee / Hot Drink' }, { icon: '🍪', title: 'Cookie' }, { icon: '🌽', title: 'Corn' },
  { icon: '🦀', title: 'Crab' }, { icon: '🥐', title: 'Croissant' }, { icon: '🥒', title: 'Cucumber' },
  { icon: '🧁', title: 'Cupcake / Muffin' }, { icon: '🍛', title: 'Curry' }, { icon: '🍡', title: 'Dango / Sweet Skewer' },
  { icon: '🍩', title: 'Donut' }, { icon: '🥟', title: 'Dumplings' }, { icon: '🥚', title: 'Egg (Boiled/Raw)' },
  { icon: '🍳', title: 'Egg (Fried)' }, { icon: '🍆', title: 'Eggplant' }, { icon: '🧆', title: 'Falafel / Meatball' },
  { icon: '🍥', title: 'Fish Cake' }, { icon: '🫓', title: 'Flatbread / Arepa' }, { icon: '🫕', title: 'Fondue / Cheese Dip' },
  { icon: '🥠', title: 'Fortune Cookie' }, { icon: '🍟', title: 'Fries' }, { icon: '🧄', title: 'Garlic' },
  { icon: '🫚', title: 'Ginger' }, { icon: '🍇', title: 'Grapes' }, { icon: '🍯', title: 'Honey / Syrup' },
  { icon: '🌭', title: 'Hot Dog' }, { icon: '🌶️', title: 'Hot Pepper / Spicy' }, { icon: '🧊', title: 'Ice / Water' },
  { icon: '🍨', title: 'Ice Cream (Scoop)' }, { icon: '🍦', title: 'Ice Cream (Soft Serve)' }, { icon: '🧃', title: 'Juice Box' },
  { icon: '🥝', title: 'Kiwi' }, { icon: '🍋', title: 'Lemon' }, { icon: '🥬', title: 'Lettuce / Greens' },
  { icon: '🦞', title: 'Lobster' }, { icon: '🍭', title: 'Lollipop' }, { icon: '🥭', title: 'Mango' },
  { icon: '🧉', title: 'Mate / Herbal Tea' }, { icon: '🍈', title: 'Melon' }, { icon: '🥛', title: 'Milk' },
  { icon: '🥮', title: 'Mooncake' }, { icon: '🍄', title: 'Mushroom' }, { icon: '🍜', title: 'Noodles / Ramen' },
  { icon: '🐙', title: 'Octopus' }, { icon: '🍢', title: 'Oden / Skewer' }, { icon: '🫒', title: 'Olive' },
  { icon: '🧅', title: 'Onion' }, { icon: '🍊', title: 'Orange' }, { icon: '🦪', title: 'Oyster / Clam' },
  { icon: '🥞', title: 'Pancakes' }, { icon: '🍝', title: 'Pasta' }, { icon: '🍑', title: 'Peach' },
  { icon: '🥜', title: 'Peanuts' }, { icon: '🍐', title: 'Pear' }, { icon: '🫛', title: 'Peas / Pea Pod' },
  { icon: '🥧', title: 'Pie' }, { icon: '🍍', title: 'Pineapple' }, { icon: '🥙', title: 'Pita / Gyro / Falafel Wrap' },
  { icon: '🍕', title: 'Pizza' }, { icon: '🍿', title: 'Popcorn' }, { icon: '🍲', title: 'Pot of Food / Soup' },
  { icon: '🥔', title: 'Potato' }, { icon: '🥨', title: 'Pretzel' }, { icon: '🍮', title: 'Pudding / Flan' },
  { icon: '🍚', title: 'Rice' }, { icon: '🍙', title: 'Rice Ball' }, { icon: '🍘', title: 'Rice Cracker' },
  { icon: '🍶', title: 'Sake' }, { icon: '🥗', title: 'Salad' }, { icon: '🧂', title: 'Salt / Spices' },
  { icon: '🥪', title: 'Sandwich' }, { icon: '🍧', title: 'Shaved Ice' }, { icon: '🦐', title: 'Shrimp' },
  { icon: '🍤', title: 'Shrimp (Fried)' }, { icon: '🥤', title: 'Soda / Fast Food Drink' }, { icon: '🦑', title: 'Squid' },
  { icon: '🥩', title: 'Steak / Meat' }, { icon: '🥘', title: 'Stew / Casserole / Paella' }, { icon: '🍓', title: 'Strawberry' },
  { icon: '🍣', title: 'Sushi' }, { icon: '🍠', title: 'Sweet Potato / Yam' }, { icon: '🌮', title: 'Taco' },
  { icon: '🥡', title: 'Takeout Box' }, { icon: '🫔', title: 'Tamale / Wrap' }, { icon: '🍵', title: 'Tea / Matcha' },
  { icon: '🫖', title: 'Teapot' }, { icon: '🍅', title: 'Tomato' }, { icon: '🍹', title: 'Tropical Drink' },
  { icon: '💊', title: 'Vitamin / Supplement' }, { icon: '🧇', title: 'Waffle' }, { icon: '🍉', title: 'Watermelon' },
  { icon: '🥃', title: 'Whiskey / Liquor' }, { icon: '🍷', title: 'Wine' }
].sort((a, b) => a.title.localeCompare(b.title));

const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CreateRecipeModal({ foods, onClose, onCreated, selectedDate, editLog, editFood, initialMealType, isDoneDay }: Props) {
  const { user } = useAuth();
  const isEditLogMode = !!editLog;
  const isEditFoodMode = !!editFood;
  const sourceFood = editLog?.food || editFood;

  const [step, setStep] = useState<'builder' | 'select-previous' | 'size-ingredient' | 'create-ingredient' | 'scan' | 'final-log'>('builder');
  
  const [recipeName, setRecipeName] = useState(sourceFood?.name || '');
  const [recipeIcon, setRecipeIcon] = useState(sourceFood?.icon || ''); 
  const [recipeServings, setRecipeServings] = useState((sourceFood as any)?.recipeServings?.toString() || '1');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>((sourceFood as any)?.recipeIngredients || []);
  
  const [activeFood, setActiveFood] = useState<Food | null>(null);
  const [scannedUpc, setScannedUpc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [consumptionMethod, setConsumptionMethod] = useState('serving');
  const [servingsConsumed, setServingsConsumed] = useState('1');
  const [volumeConsumed, setVolumeConsumed] = useState('');

  const [logDate, setLogDate] = useState(editLog?.date || selectedDate);
  const [logMealType, setLogMealType] = useState(editLog?.mealType || initialMealType || ''); 
  const [logServingsConsumed, setLogServingsConsumed] = useState(editLog?.amount?.toString() || '1');
  
  const [isPlanned, setIsPlanned] = useState((editLog as any)?.isPlanned || (logDate > getLocalTodayString())); 
  
  const [isLogging, setIsLogging] = useState(false);

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getBaseNutrition = () => {
    const totalRecipeServings = parseFloat(recipeServings) || 1;
    return JSON.parse(JSON.stringify({
      userId: user!.uid,
      name: recipeName.trim(),
      icon: recipeIcon.trim() || undefined,
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
      isRecipe: true,
      recipeServings: totalRecipeServings,
      recipeIngredients: ingredients
    }));
  };

  const saveRecipeToDb = async (baseNutrition: any): Promise<string> => {
    let targetFoodId = sourceFood?.id || '';
    if (targetFoodId) {
      try {
        await updateFood(targetFoodId, baseNutrition);
      } catch (updateErr: any) {
        if (updateErr.code === 'not-found') {
          targetFoodId = await createFood(user!.uid, baseNutrition);
        } else {
          throw updateErr;
        }
      }
    } else {
      targetFoodId = await createFood(user!.uid, baseNutrition);
    }
    return targetFoodId;
  };

  const getLogPayload = (targetFoodId: string, baseNutrition: any) => {
    const consumedMultiplier = parseFloat(logServingsConsumed) || 1;
    const consumedNutrition = {
      calories: Number((baseNutrition.calories * consumedMultiplier).toFixed(2)),
      protein: Number((baseNutrition.protein * consumedMultiplier).toFixed(2)),
      carbs: Number((baseNutrition.carbs * consumedMultiplier).toFixed(2)),
      fat: Number((baseNutrition.fat * consumedMultiplier).toFixed(2)),
      saturatedFat: Number((baseNutrition.saturatedFat * consumedMultiplier).toFixed(2)),
      transFat: Number((baseNutrition.transFat * consumedMultiplier).toFixed(2)),
      cholesterol: Number((baseNutrition.cholesterol * consumedMultiplier).toFixed(2)),
      sodium: Number((baseNutrition.sodium * consumedMultiplier).toFixed(2)),
      fiber: Number((baseNutrition.fiber * consumedMultiplier).toFixed(2)),
      sugar: Number((baseNutrition.sugar * consumedMultiplier).toFixed(2)),
    };

    const foodObject: Food = {
      id: targetFoodId,
      ...baseNutrition,
      createdAt: (sourceFood as any)?.createdAt || Date.now()
    };

    return JSON.parse(JSON.stringify({
      date: logDate,
      foodId: targetFoodId,
      food: foodObject,
      amount: consumedMultiplier,
      unit: 'serving',
      mealType: logMealType,
      isPlanned: isPlanned, // PLANNED STATUS
      ...consumedNutrition
    }));
  };

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

  const handleSaveUpdatesOnly = async () => {
    if (!user) return;
    setIsLogging(true);
    try {
      await saveRecipeToDb(getBaseNutrition());
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save recipe updates.");
    } finally {
      setIsLogging(false);
    }
  };

  const handleSaveAndAdvanceToLog = async () => {
    if (!user) return;
    setIsLogging(true);
    try {
      await saveRecipeToDb(getBaseNutrition());
      setStep('final-log');
    } catch (err) {
      console.error(err);
      alert("Failed to save recipe.");
    } finally {
      setIsLogging(false);
    }
  };

  const handleFinalLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLogging(true);
    
    try {
      const baseNutrition = getBaseNutrition();
      const targetFoodId = await saveRecipeToDb(baseNutrition);
      const payload = getLogPayload(targetFoodId, baseNutrition);

      if (isEditLogMode && editLog) {
        payload.foodId = targetFoodId;
        payload.food.id = targetFoodId;
        await updateFoodLog(user.uid, editLog.id, payload);
      } else {
        await createFoodLog(user.uid, payload);
      }
      
      onCreated();
      onClose();
    } catch(err) {
      console.error(err);
      alert("Failed to save and log recipe.");
    } finally {
      setIsLogging(false);
    }
  };

  const filteredIcons = FOOD_ICONS.filter(item => item.title.toLowerCase().includes(iconSearch.toLowerCase()));

  if (step === 'scan') {
    return <BarcodeScanner onClose={() => setStep('builder')} onScanSuccess={handleScanSuccess} />;
  }

  if (step === 'create-ingredient') {
    return (
      <div className="add-food-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.6)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
        <div className="add-food-modal create-recipe-modal" style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
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
      
      <style>{`
        .recipe-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .recipe-scroll-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .create-recipe-modal * {
          box-sizing: border-box !important;
          max-width: 100%;
        }
      `}</style>
      
      <div className="add-food-modal create-recipe-modal" style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1rem', padding: '1.5rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowX: 'hidden', boxSizing: 'border-box' }}>
        
        {step === 'builder' && (
          <>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>{isEditLogMode ? 'Edit Recipe Log' : (isEditFoodMode ? 'Edit Recipe' : 'Create Recipe')}</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Recipe Name</label>
                  <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="e.g. Mom's Chili" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                </div>

                <div style={{ position: 'relative' }} ref={iconPickerRef}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Recipe Icon (Optional)</label>
                  <div 
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    style={{ 
                      padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', color: recipeIcon ? '#000' : '#94a3b8'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {recipeIcon ? (
                        <><span style={{ fontSize: '1.2rem' }}>{recipeIcon}</span><span style={{ color: '#000' }}>{FOOD_ICONS.find(i => i.icon === recipeIcon)?.title || 'Custom Icon'}</span></>
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
                        <div onClick={() => { setRecipeIcon(''); setShowIconPicker(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>❌ None</div>
                        {filteredIcons.map(item => (
                          <div key={item.title} onClick={() => { setRecipeIcon(item.icon); setShowIconPicker(false); setIconSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: recipeIcon === item.icon ? '#f1f5f9' : 'transparent' }}>
                            <span style={{ fontSize: '1.4rem' }}>{item.icon}</span><span>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>How many servings does this make total?</label>
                  <input type="text" inputMode="decimal" value={recipeServings} onChange={e => setRecipeServings(e.target.value)} placeholder="e.g. 4" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                </div>
              </div>
            </div>

            <div className="recipe-scroll-container" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '0.25rem', overflowX: 'hidden' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>Ingredients</h4>
              {ingredients.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', marginBottom: '1.5rem', color: '#64748b' }}>
                  No ingredients added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {ingredients.map((ing, i) => {
                    const hasHighProtein = (ing.macros.protein > 0 && ing.macros.calories > 0) ? ing.macros.protein >= (ing.macros.calories / 10) : false;
                    const hasHighFiber = (ing.macros.fiber >= 4);

                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ textTransform: 'capitalize' }}>{ing.food.name}</span>
                            
                            {/* BADGES */}
                            {(hasHighProtein || hasHighFiber) && (
                              <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
                                {hasHighProtein && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="1g of protein per 10 calories">P</span>}
                                {hasHighFiber && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="4g+ of fiber consumed">F</span>}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{ing.amount} {ing.unit}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#2563eb' }}>{Math.round(ing.macros.calories)} cal</div>
                          <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: '#f8fafc', 
                borderRadius: '0.75rem', 
                border: '1px solid #e2e8f0',
                marginBottom: '1rem'
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
            </div>

            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <button onClick={() => setStep('select-previous')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>+ Previous Food</button>
                <button onClick={() => setStep('create-ingredient')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>+ Create New</button>
                <button onClick={() => setStep('scan')} style={{ gridColumn: 'span 2', padding: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>📷 Scan Barcode</button>
              </div>

              {sourceFood && sourceFood.id && !isEditLogMode ? (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button"
                    disabled={ingredients.length === 0 || !recipeName.trim() || isLogging} 
                    onClick={handleSaveUpdatesOnly}
                    style={{ flex: '1 1 0', padding: '1rem', backgroundColor: '#f8fafc', color: '#2563eb', border: '2px solid #2563eb', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '1rem', cursor: (ingredients.length === 0 || !recipeName.trim()) ? 'not-allowed' : 'pointer', opacity: (ingredients.length === 0 || !recipeName.trim()) ? 0.5 : 1 }}
                  >
                    {isLogging ? 'Saving...' : 'Save Updates'}
                  </button>
                  <button 
                    type="button"
                    disabled={ingredients.length === 0 || !recipeName.trim() || isLogging} 
                    onClick={handleSaveAndAdvanceToLog}
                    style={{ flex: '1 1 0', padding: '1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '1rem', cursor: (ingredients.length === 0 || !recipeName.trim()) ? 'not-allowed' : 'pointer', opacity: (ingredients.length === 0 || !recipeName.trim()) ? 0.5 : 1 }}
                  >
                    {isLogging ? 'Saving...' : 'Save & Log'}
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  disabled={ingredients.length === 0 || !recipeName.trim() || isLogging} 
                  onClick={() => setStep('final-log')}
                  style={{ width: '100%', padding: '1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: (ingredients.length === 0 || !recipeName.trim()) ? 'not-allowed' : 'pointer', opacity: (ingredients.length === 0 || !recipeName.trim()) ? 0.5 : 1 }}
                >
                  Continue to Log Details
                </button>
              )}
            </div>
          </>
        )}

        {step === 'select-previous' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>Select Ingredient</h3>
              <button onClick={() => setStep('builder')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div className="search-bar-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search previous foods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ flex: 1, margin: 0, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1rem' }}
              />
              <button 
                type="button"
                onClick={() => setStep('scan')}
                style={{
                  background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem',
                  padding: '0.65rem 0.75rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', margin: 0
                }}
                title="Scan Barcode"
              >
                📷
              </button>
            </div>

            <div className="recipe-scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              {foods
                .filter(f => !f.isVitamin)
                .filter(food => {
                  const searchLower = searchTerm.toLowerCase();
                  const matchesName = food.name?.toLowerCase().includes(searchLower) ?? false;
                  const matchesBrand = food.brand?.toLowerCase().includes(searchLower) ?? false;
                  const matchesUPC = (food as any).upc?.toLowerCase().includes(searchLower) ?? false;
                  return matchesName || matchesBrand || matchesUPC;
                })
                .map(food => {
                  const hasHighProtein = (food.protein && food.calories) ? food.protein >= (food.calories / 10) : false;
                  const hasHighFiber = food.fiber ? food.fiber >= 4 : false;

                  return (
                    <button
                      key={food.id}
                      className="food-option"
                      onClick={() => { setActiveFood(food); setConsumptionMethod('serving'); setServingsConsumed('1'); setVolumeConsumed(''); setStep('size-ingredient'); }}
                      style={{ 
                        display: 'flex', alignItems: 'center', textAlign: 'left',
                        padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', 
                        cursor: 'pointer', backgroundColor: '#fff', width: '100%', margin: 0,
                        position: 'relative' 
                      }}
                    >
                      {/* BADGES */}
                      {(hasHighProtein || hasHighFiber) && (
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                          {hasHighProtein && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="1g of protein per 10 calories">P</span>}
                          {hasHighFiber && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="4g+ of fiber per serving">F</span>}
                        </div>
                      )}

                      <div style={{ flex: 1, paddingRight: '2rem' }}>
                        <div className="food-name" style={{ marginBottom: '0.15rem', fontWeight: 600, color: '#1e293b', textTransform: 'capitalize', fontSize: '1rem' }}>
                          {food.icon && <span style={{ marginRight: '0.3rem' }}>{food.icon}</span>}
                          {food.name}
                        </div>
                        {food.brand && <div className="food-brand" style={{ marginBottom: '0.25rem', fontSize: '0.85rem', color: '#64748b', textTransform: 'capitalize' }}>{food.brand}</div>}
                        <div className="food-serving" style={{ fontSize: '0.85rem', color: '#475569' }}>
                          {food.servingSize} {food.servingUnit} - {food.calories} cal
                        </div>
                      </div>
                    </button>
                  );
                })}
              
              {foods.filter(f => !f.isVitamin && (f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || f.brand?.toLowerCase().includes(searchTerm.toLowerCase()) || (f as any).upc?.toLowerCase().includes(searchTerm.toLowerCase()))).length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
                  No foods found.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'size-ingredient' && activeFood && (
          <>
             <div style={{ flexShrink: 0 }}>
               <h3 style={{ marginBottom: '1.5rem' }}>How much {activeFood.name}?</h3>
             </div>
             
             <div className="recipe-scroll-container" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
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
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, marginTop: '1rem' }}>
                <button onClick={handleSizeExistingFood} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Add to Recipe</button>
                <button onClick={() => setStep('select-previous')} style={{ padding: '0.75rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
              </div>
          </>
        )}

        {step === 'final-log' && (
          <form onSubmit={handleFinalLog} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <h3 style={{ marginBottom: '1.5rem', flexShrink: 0 }}>{isEditLogMode ? 'Update Recipe Details' : 'Log Your Recipe'}</h3>
            
            <div className="recipe-scroll-container" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingRight: '0.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>Date *</label>
                <input 
                  type="date" 
                  value={logDate} 
                  onChange={e => {
                    const newDate = e.target.value;
                    setLogDate(newDate);
                    setIsPlanned(newDate > getLocalTodayString());
                  }} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} 
                />
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

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>How many servings did you eat? *</label>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>This recipe makes {recipeServings} total servings.</p>
                <input type="text" inputMode="decimal" value={logServingsConsumed} onChange={e => setLogServingsConsumed(e.target.value)} placeholder="1" required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
              </div>
              
              {/* PLANNED TOGGLE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                <input 
                  type="checkbox" 
                  id="recipeIsPlanned"
                  checked={isPlanned}
                  onChange={(e) => setIsPlanned(e.target.checked)}
                  disabled={isDoneDay}
                  style={{ width: '1.25rem', height: '1.25rem', cursor: isDoneDay ? 'not-allowed' : 'pointer', margin: 0 }}
                />
                <label htmlFor="recipeIsPlanned" style={{ cursor: isDoneDay ? 'not-allowed' : 'pointer', margin: 0, fontWeight: 600, color: isDoneDay ? '#94a3b8' : '#475569' }}>
                  Plan for later {isDoneDay && '(Disabled on completed days)'}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, marginTop: '1rem' }}>
                <button type="submit" disabled={isLogging} style={{ flex: 1, padding: '1rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                  {isLogging ? 'Saving...' : (isEditLogMode ? 'Update Recipe Log' : 'Add to Log')}
                </button>
                <button 
                  type="button" 
                  onClick={() => (sourceFood && sourceFood.id && !isEditLogMode) ? onClose() : setStep('builder')} 
                  style={{ padding: '1rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  {(sourceFood && sourceFood.id && !isEditLogMode) ? 'Close' : 'Back'}
                </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}