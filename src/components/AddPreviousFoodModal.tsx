// src/components/AddPreviousFoodModal.tsx
import { useState, useEffect, useRef } from 'react';
import { Food, FoodLog } from '../types';
import { deleteFood, getAllFoodLogs, updateFood, createFoodLog, updateAllPastLogsForFood } from '../services/database';
import { useAuth } from '../contexts/AuthContext';
import BarcodeScanner from './BarcodeScanner';
import './AddPreviousFoodModal.css';

interface Props {
  foods: Food[];
  onAdd: (foodData: any) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
  onFoodDeleted?: () => void; 
  initialDate?: string;
  isVitaminMode?: boolean; 
  initialFood?: Food; 
  initialMealType?: string;
  onEditRecipe?: (food: Food) => void;
  onCreateNew?: () => void;
  onCreateRecipe?: () => void;
  onOpenScanner?: () => void; 
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

const FOOD_ICONS = [
  { icon: '🍎', title: 'Apple (Red)' },
  { icon: '🍏', title: 'Apple (Green)' },
  { icon: '🥑', title: 'Avocado' },
  { icon: '🍼', title: 'Baby Bottle / Formula' },
  { icon: '🥓', title: 'Bacon' },
  { icon: '🥯', title: 'Bagel' },
  { icon: '🥖', title: 'Baguette' },
  { icon: '🍌', title: 'Banana' },
  { icon: '🫘', title: 'Beans' },
  { icon: '🍺', title: 'Beer' },
  { icon: '🍻', title: 'Beers (Cheers)' },
  { icon: '🫑', title: 'Bell Pepper' },
  { icon: '🍱', title: 'Bento / Lunchbox' },
  { icon: '🎂', title: 'Birthday Cake' },
  { icon: '🫐', title: 'Blueberries' },
  { icon: '🍖', title: 'Bone-In Meat / Ribs' },
  { icon: '🥣', title: 'Bowl with Spoon / Cereal' },
  { icon: '🍞', title: 'Bread' },
  { icon: '🥦', title: 'Broccoli' },
  { icon: '🧋', title: 'Bubble Tea / Boba' },
  { icon: '🍔', title: 'Burger' },
  { icon: '🌯', title: 'Burrito' },
  { icon: '🧈', title: 'Butter' },
  { icon: '🍰', title: 'Cake / Shortcake' },
  { icon: '🍬', title: 'Candy' },
  { icon: '🥫', title: 'Canned Food / Soup' },
  { icon: '🥕', title: 'Carrot' },
  { icon: '🍾', title: 'Champagne / Sparkling Wine' },
  { icon: '🧀', title: 'Cheese' },
  { icon: '🍒', title: 'Cherries' },
  { icon: '🌰', title: 'Chestnut / Nut' },
  { icon: '🍗', title: 'Chicken / Poultry' },
  { icon: '🍫', title: 'Chocolate' },
  { icon: '🥂', title: 'Clinking Glasses' },
  { icon: '🍸', title: 'Cocktail / Martini' },
  { icon: '🥥', title: 'Coconut' },
  { icon: '☕', title: 'Coffee / Hot Drink' },
  { icon: '🍪', title: 'Cookie' },
  { icon: '🌽', title: 'Corn' },
  { icon: '🦀', title: 'Crab' },
  { icon: '🥐', title: 'Croissant' },
  { icon: '🥒', title: 'Cucumber' },
  { icon: '🧁', title: 'Cupcake / Muffin' },
  { icon: '🍛', title: 'Curry' },
  { icon: '🍡', title: 'Dango / Sweet Skewer' },
  { icon: '🍩', title: 'Donut' },
  { icon: '🥟', title: 'Dumplings' },
  { icon: '🥚', title: 'Egg (Boiled/Raw)' },
  { icon: '🍳', title: 'Egg (Fried)' },
  { icon: '🍆', title: 'Eggplant' },
  { icon: '🧆', title: 'Falafel / Meatball' },
  { icon: '🍥', title: 'Fish Cake' },
  { icon: '🫓', title: 'Flatbread / Arepa' },
  { icon: '🫕', title: 'Fondue / Cheese Dip' },
  { icon: '🥠', title: 'Fortune Cookie' },
  { icon: '🍟', title: 'Fries' },
  { icon: '🧄', title: 'Garlic' },
  { icon: '🫚', title: 'Ginger' },
  { icon: '🍇', title: 'Grapes' },
  { icon: '🍯', title: 'Honey / Syrup' },
  { icon: '🌭', title: 'Hot Dog' },
  { icon: '🌶️', title: 'Hot Pepper / Spicy' },
  { icon: '🧊', title: 'Ice / Water' },
  { icon: '🍨', title: 'Ice Cream (Scoop)' },
  { icon: '🍦', title: 'Ice Cream (Soft Serve)' },
  { icon: '🧃', title: 'Juice Box' },
  { icon: '🥝', title: 'Kiwi' },
  { icon: '🍋', title: 'Lemon' },
  { icon: '🥬', title: 'Lettuce / Greens' },
  { icon: '🦞', title: 'Lobster' },
  { icon: '🍭', title: 'Lollipop' },
  { icon: '🥭', title: 'Mango' },
  { icon: '🧉', title: 'Mate / Herbal Tea' },
  { icon: '🍈', title: 'Melon' },
  { icon: '🥛', title: 'Milk' },
  { icon: '🥮', title: 'Mooncake' },
  { icon: '🍄', title: 'Mushroom' },
  { icon: '🍜', title: 'Noodles / Ramen' },
  { icon: '🐙', title: 'Octopus' },
  { icon: '🍢', title: 'Oden / Skewer' },
  { icon: '🫒', title: 'Olive' },
  { icon: '🧅', title: 'Onion' },
  { icon: '🍊', title: 'Orange' },
  { icon: '🦪', title: 'Oyster / Clam' },
  { icon: '🥞', title: 'Pancakes' },
  { icon: '🍝', title: 'Pasta' },
  { icon: '🍑', title: 'Peach' },
  { icon: '🥜', title: 'Peanuts' },
  { icon: '🍐', title: 'Pear' },
  { icon: '🫛', title: 'Peas / Pea Pod' },
  { icon: '🥧', title: 'Pie' },
  { icon: '🍍', title: 'Pineapple' },
  { icon: '🥙', title: 'Pita / Gyro / Falafel Wrap' },
  { icon: '🍕', title: 'Pizza' },
  { icon: '🍿', title: 'Popcorn' },
  { icon: '🍲', title: 'Pot of Food / Soup' },
  { icon: '🥔', title: 'Potato' },
  { icon: '🥨', title: 'Pretzel' },
  { icon: '🍮', title: 'Pudding / Flan' },
  { icon: '🍚', title: 'Rice' },
  { icon: '🍙', title: 'Rice Ball' },
  { icon: '🍘', title: 'Rice Cracker' },
  { icon: '🍶', title: 'Sake' },
  { icon: '🥗', title: 'Salad' },
  { icon: '🧂', title: 'Salt / Spices' },
  { icon: '🥪', title: 'Sandwich' },
  { icon: '🍧', title: 'Shaved Ice' },
  { icon: '🦐', title: 'Shrimp' },
  { icon: '🍤', title: 'Shrimp (Fried)' },
  { icon: '🥤', title: 'Soda / Fast Food Drink' },
  { icon: '🦑', title: 'Squid' },
  { icon: '🥩', title: 'Steak / Meat' },
  { icon: '🥘', title: 'Stew / Casserole / Paella' },
  { icon: '🍓', title: 'Strawberry' },
  { icon: '🍣', title: 'Sushi' },
  { icon: '🍠', title: 'Sweet Potato / Yam' },
  { icon: '🌮', title: 'Taco' },
  { icon: '🥡', title: 'Takeout Box' },
  { icon: '🫔', title: 'Tamale / Wrap' },
  { icon: '🍵', title: 'Tea / Matcha' },
  { icon: '🫖', title: 'Teapot' },
  { icon: '🍅', title: 'Tomato' },
  { icon: '🍹', title: 'Tropical Drink' },
  { icon: '💊', title: 'Vitamin / Supplement' },
  { icon: '🧇', title: 'Waffle' },
  { icon: '🍉', title: 'Watermelon' },
  { icon: '🥃', title: 'Whiskey / Liquor' },
  { icon: '🍷', title: 'Wine' }
].sort((a, b) => a.title.localeCompare(b.title));

const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddPreviousFoodModal({ foods, onAdd, onBack, onClose, onFoodDeleted, initialDate, isVitaminMode, initialFood, initialMealType, onEditRecipe, onCreateNew, onCreateRecipe, onOpenScanner }: Props) {
  const { user } = useAuth();
  const [localFoods, setLocalFoods] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(initialFood || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allLogs, setAllLogs] = useState<FoodLog[]>([]);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setLocalFoods(foods); }, [foods]);

  useEffect(() => {
    if (user) {
      getAllFoodLogs(user.uid).then(logs => setAllLogs(logs)).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (initialFood) {
      setSelectedFood(initialFood);
    }
  }, [initialFood]);

  useEffect(() => {
    if (initialFood && selectedFood?.id === initialFood.id && allLogs.length > 0) {
      const lastLog = allLogs.find(l => l.foodId === initialFood.id || l.food?.id === initialFood.id);
      if (lastLog) {
        let method = 'serving';
        let volume = '';
        let servings = '1';

        if (lastLog.unit === 'serving') {
          servings = lastLog.amount.toString();
        } else {
          const volIndex = initialFood.volumes?.findIndex(v => v.unit === lastLog.unit);
          if (volIndex !== undefined && volIndex >= 0) {
            method = `volume-${volIndex}`;
            volume = lastLog.amount.toString();
          }
        }
        
        setLogDetails(prev => ({
            ...prev,
            consumptionMethod: method,
            servingsConsumed: servings,
            volumeConsumed: volume
        }));
      }
    }
  }, [initialFood, allLogs, selectedFood]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);
  
  const [logDetails, setLogDetails] = useState({
    date: initialDate || getLocalTodayString(),
    mealType: isVitaminMode ? 'Vitamins' : (initialMealType || ''),
    consumptionMethod: 'serving', 
    servingsConsumed: '1',
    volumeConsumed: '',
  });

  const [isEditingNutrition, setIsEditingNutrition] = useState(false);
  const [pendingFoodUpdate, setPendingFoodUpdate] = useState<Food | null>(null); 
  const [editFormData, setEditFormData] = useState({
    name: '', brand: '', icon: '', upc: '', calories: '', fat: '', saturatedFat: '', transFat: '', cholesterol: '', sodium: '',
    carbs: '', fiber: '', sugar: '', protein: '', labelServings: '1',
    labelVolumes: [{ amount: '', unit: 'g' }] as { amount: string, unit: string }[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (initialDate) setLogDetails(prev => ({ ...prev, date: initialDate }));
  }, [initialDate]);

  const handleLogDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'servingsConsumed' || name === 'volumeConsumed') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
    }
    setLogDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleItemInteraction = (e: React.MouseEvent | React.TouchEvent, food: Food) => {
    if (isMultiSelectMode) {
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(food.id)) next.delete(food.id);
        else next.add(food.id);
        return next;
      });
      return;
    }

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      
      const targetType = isVitaminMode ? 'vitamin' : 'food';
      if (window.confirm(`Are you sure you want to permanently delete ${food.name} from your saved ${targetType}s list? (It will remain in your past daily logs)`)) {
        deleteFood(food.id)
          .then(() => {
            setLocalFoods(prev => prev.filter(f => f.id !== food.id));
            if (onFoodDeleted) onFoodDeleted(); 
          })
          .catch(err => {
            console.error("Failed to delete food:", err);
            setError("Failed to delete food.");
          });
      }
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setSelectedFood(food);
        
        let method = 'serving';
        let servings = '1';
        let volume = '';

        const lastLog = allLogs.find(l => l.foodId === food.id || l.food?.id === food.id);

        if (lastLog) {
          if (lastLog.unit === 'serving') {
            method = 'serving';
            servings = lastLog.amount.toString();
          } else {
            const volIndex = food.volumes?.findIndex(v => v.unit === lastLog.unit);
            if (volIndex !== undefined && volIndex >= 0) {
              method = `volume-${volIndex}`;
              volume = lastLog.amount.toString();
            }
          }
        }
        
        setLogDetails(prev => ({
            ...prev,
            consumptionMethod: method,
            servingsConsumed: servings,
            volumeConsumed: volume
        }));
      }, 250); 
    }
  };

  const handleEditClick = () => {
    if (!selectedFood) return;
    if ((selectedFood as any).isRecipe && onEditRecipe) {
      onEditRecipe(selectedFood);
      return;
    }
    setEditFormData({
      name: selectedFood.name || '',
      brand: selectedFood.brand || '',
      icon: selectedFood.icon || '',
      upc: (selectedFood as any).upc || '',
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
      labelVolumes: (selectedFood.volumes && selectedFood.volumes.length > 0)
        ? selectedFood.volumes.map(v => ({ amount: v.amount?.toString() || '', unit: v.unit })) 
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

  const handleSaveNutrition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;

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
      ...selectedFood,
      name: editFormData.name.trim() || selectedFood.name,
      brand: editFormData.brand.trim() || selectedFood.brand,
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

    setPendingFoodUpdate(updatedFood);
  };

  const finalizeSaveNutrition = async (updatePast: boolean) => {
    if (!selectedFood || !pendingFoodUpdate) return;

    try {
      setLoading(true);
      const cleanFirebasePayload = Object.fromEntries(
        Object.entries(pendingFoodUpdate).filter(([_, v]) => v !== undefined)
      );
      
      await updateFood(selectedFood.id, cleanFirebasePayload);
      
      if (updatePast && user) {
        await updateAllPastLogsForFood(user.uid, selectedFood.id, pendingFoodUpdate);
        const newLogs = await getAllFoodLogs(user.uid);
        setAllLogs(newLogs);
      }

      setLocalFoods(prevFoods => prevFoods.map(f => f.id === selectedFood.id ? pendingFoodUpdate : f));
      setSelectedFood(pendingFoodUpdate);
      setIsEditingNutrition(false);
      setError('');
      
      setLogDetails(prev => ({
        ...prev,
        consumptionMethod: 'serving',
        servingsConsumed: '1',
        volumeConsumed: ''
      }));
    } catch (err) {
      console.error("Failed to update food label:", err);
      setError("Failed to save changes to database.");
    } finally {
      setLoading(false);
      setPendingFoodUpdate(null);
    }
  };

  const handleBatchAdd = async () => {
    if (!user) return;
    if (multiSelectedIds.size === 0) {
      setIsMultiSelectMode(false);
      return;
    }
    if (!isVitaminMode && !logDetails.mealType) {
      setError('Please ensure a meal category is selected to add items.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      for (const foodId of multiSelectedIds) {
        const food = localFoods.find(f => f.id === foodId);
        if (!food) continue;
        
        const lastLog = allLogs.find(l => l.foodId === food.id || l.food?.id === food.id);
        
        let finalAmount = 1;
        let finalUnit = 'serving';
        let multiplier = 1;

        if (lastLog) {
          finalAmount = lastLog.amount;
          finalUnit = lastLog.unit;
          
          if (finalUnit === 'serving') {
             multiplier = finalAmount / (food.servingSize || 1);
          } else {
             const vol = food.volumes?.find(v => v.unit === finalUnit);
             if (vol && vol.amount) {
                multiplier = finalAmount / vol.amount;
             } else {
                multiplier = 0;
             }
          }
        } else {
          multiplier = 1 / (food.servingSize || 1); 
        }

        const calcConsumed = (val: number | undefined) => {
          if (val === undefined || isNaN(val)) return undefined;
          return Number((val * multiplier).toFixed(2));
        };

        const consumedNutrition: any = {
          calories: calcConsumed(food.calories) || 0,
          fat: calcConsumed(food.fat),
          saturatedFat: calcConsumed(food.saturatedFat),
          transFat: calcConsumed((food as any).transFat),
          cholesterol: calcConsumed((food as any).cholesterol),
          sodium: calcConsumed((food as any).sodium),
          carbs: calcConsumed(food.carbs),
          fiber: calcConsumed(food.fiber),
          sugar: calcConsumed(food.sugar),
          protein: calcConsumed(food.protein),
        };

        const cleanConsumedNutrition = Object.fromEntries(
          Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)
        ) as any;

        if (finalUnit !== 'serving') {
          cleanConsumedNutrition.volume = finalAmount;
          cleanConsumedNutrition.volumeUnit = finalUnit;
        }

        const payload = {
          date: logDetails.date,
          foodId: food.id,
          food: food,
          amount: finalAmount,
          unit: finalUnit,
          mealType: logDetails.mealType,
          ...cleanConsumedNutrition,
        };

        const cleanPayload = JSON.parse(JSON.stringify(payload));
        await createFoodLog(user.uid, cleanPayload);
      }
      
      onClose(); 
    } catch (err) {
      console.error("Batch add failed:", err);
      setError(err instanceof Error ? err.message : 'Failed to add selected foods.');
    } finally {
      setLoading(false);
    }
  };

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
      calories: calc(selectedFood.calories), protein: calc(selectedFood.protein), carbs: calc(selectedFood.carbs),
      fat: calc(selectedFood.fat), saturatedFat: calc(selectedFood.saturatedFat), transFat: calc((selectedFood as any).transFat),
      cholesterol: calc((selectedFood as any).cholesterol), sodium: calc((selectedFood as any).sodium),
      fiber: calc(selectedFood.fiber), sugar: calc(selectedFood.sugar),
    };
  };

  const preview = selectedFood ? calculatePreview() : null;

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;

    setError('');
    
    try {
      if (!isVitaminMode && !logDetails.mealType) throw new Error('Please select a meal category');

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
        calories: calcConsumed(selectedFood.calories) || 0, fat: calcConsumed(selectedFood.fat),
        saturatedFat: calcConsumed(selectedFood.saturatedFat), transFat: calcConsumed((selectedFood as any).transFat),
        cholesterol: calcConsumed((selectedFood as any).cholesterol), sodium: calcConsumed((selectedFood as any).sodium),
        carbs: calcConsumed(selectedFood.carbs), fiber: calcConsumed(selectedFood.fiber),
        sugar: calcConsumed(selectedFood.sugar), protein: calcConsumed(selectedFood.protein),
      };

      const cleanConsumedNutrition = Object.fromEntries(Object.entries(consumedNutrition).filter(([_, v]) => v !== undefined)) as any;

      if (isVolumeSelected) {
        cleanConsumedNutrition.volume = finalAmount;
        cleanConsumedNutrition.volumeUnit = finalUnit;
      }

      setLoading(true);

      const payload = {
        date: logDetails.date, foodId: selectedFood.id, food: selectedFood,
        amount: finalAmount, unit: finalUnit, mealType: logDetails.mealType, ...cleanConsumedNutrition,
      };

      await onAdd(JSON.parse(JSON.stringify(payload)));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add food');
    } finally {
      setLoading(false);
    }
  };

  const filteredIcons = FOOD_ICONS.filter(item => item.title.toLowerCase().includes(iconSearch.toLowerCase()));

  if (!selectedFood) {
    const filteredFoods = localFoods.filter(food => {
      const searchLower = searchTerm.toLowerCase();
      const matchesName = food.name?.toLowerCase().includes(searchLower) ?? false;
      const matchesBrand = food.brand?.toLowerCase().includes(searchLower) ?? false;
      const matchesUPC = (food as any).upc?.toLowerCase().includes(searchLower) ?? false;
      return matchesName || matchesBrand || matchesUPC;
    });

    return (
      <div className="previous-food-modal list-view" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <h3 style={{ marginBottom: '1rem', flexShrink: 0 }}>{isVitaminMode ? 'Add Vitamin' : 'Add Food'}</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexShrink: 0 }}>
          {onCreateNew && (
            <button className="btn btn-primary btn-sm" style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }} onClick={onCreateNew}>
              ➕ Create {isVitaminMode ? 'Vitamin' : 'Food'}
            </button>
          )}
          {!isVitaminMode && onCreateRecipe && (
            <button className="btn btn-primary btn-sm" style={{ flex: 1, backgroundColor: '#0f766e', borderColor: '#0f766e', padding: '0.6rem', fontSize: '0.9rem' }} onClick={onCreateRecipe}>
              🥘 Create Recipe
            </button>
          )}
        </div>

        <div className="search-bar-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
          <input
            type="text"
            className="search-input"
            placeholder={`Search previous ${isVitaminMode ? 'vitamins' : 'foods'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, margin: 0 }}
          />
          {onOpenScanner && (
            <button 
              type="button"
              onClick={onOpenScanner}
              style={{
                background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.5rem',
                padding: '0.65rem 0.75rem', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
              }}
              title="Scan Barcode"
            >
              📷
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0, padding: '0 0.25rem', minHeight: '38px' }}>
          {isMultiSelectMode ? (
            <>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6' }}>{multiSelectedIds.size} selected</span>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ 
                    margin: 0, padding: '0 1rem', fontSize: '0.85rem', height: '38px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
                  }} 
                  onClick={() => { setIsMultiSelectMode(false); setMultiSelectedIds(new Set()); }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ 
                    margin: 0, padding: '0 1rem', fontSize: '0.85rem', height: '38px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
                  }} 
                  onClick={handleBatchAdd} 
                  disabled={loading || multiSelectedIds.size === 0}
                >
                  {loading ? 'Adding...' : 'Done'}
                </button>
              </div>
            </>
          ) : (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setIsMultiSelectMode(true)}
              style={{ 
                width: '100%', height: '38px', fontSize: '0.9rem', margin: 0,
                backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxSizing: 'border-box'
              }}
            >
              📋 Select Multiple
            </button>
          )}
        </div>

        {error && <div className="error" style={{ flexShrink: 0 }}>{error}</div>}

        <div className="food-list" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '0.25rem' }}>
          {filteredFoods.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
              {isVitaminMode ? 'No vitamins found.' : 'No foods found.'}
            </p>
          ) : (
            filteredFoods.map((food) => {
              const lastLog = allLogs.find(l => l.foodId === food.id || l.food?.id === food.id);
              const isSelected = multiSelectedIds.has(food.id);

              return (
                <button
                  key={food.id}
                  className="food-option"
                  onClick={(e) => handleItemInteraction(e, food)}
                  style={{ 
                    display: 'flex', alignItems: 'center', textAlign: 'left',
                    ...(isMultiSelectMode && isSelected ? { borderColor: '#2563eb', backgroundColor: '#eff6ff', borderWidth: '2px' } : {})
                  }}
                >
                  {isMultiSelectMode && (
                    <div style={{ marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '6px', 
                        border: `2px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`, 
                        backgroundColor: isSelected ? '#2563eb' : 'transparent',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s'
                      }}>
                        {isSelected && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ flex: 1 }}>
                    <div className="food-name" style={{ marginBottom: '0.15rem', textTransform: 'capitalize' }}>
                      {food.icon && <span style={{ marginRight: '0.3rem' }}>{food.icon}</span>}
                      {food.name}
                    </div>
                    {food.brand && <div className="food-brand" style={{ marginBottom: '0.25rem', textTransform: 'capitalize' }}>{food.brand}</div>}
                    <div className="food-serving">
                      {food.servingSize} {food.servingUnit} - {food.calories} cal
                    </div>
                    
                    {lastLog && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', fontWeight: 500 }}>
                        Last logged: {lastLog.amount} {lastLog.unit}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        {!isMultiSelectMode && (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', margin: '1rem 0', fontStyle: 'italic', flexShrink: 0 }}>
            * Double-tap an item to permanently delete it from this list.
          </p>
        )}

        <div className="modal-actions" style={{ flexShrink: 0, marginTop: isMultiSelectMode ? '1rem' : 0 }}>
          <button className="btn btn-secondary" onClick={onBack}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (isEditingNutrition) {
    return (
      <div className="previous-food-modal" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Edit Nutrition Label</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Update the base nutrition for this entry.
        </p>

        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleSaveNutrition}>
          <div className="form-group">
            <label htmlFor="name">{isVitaminMode ? 'Vitamin Name *' : 'Food Name *'}</label>
            <input id="name" type="text" name="name" value={editFormData.name} onChange={handleEditChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="brand">Brand (Optional)</label>
            <input id="brand" type="text" name="brand" value={editFormData.brand} onChange={handleEditChange} />
          </div>

          <div className="form-group" style={{ position: 'relative' }} ref={iconPickerRef}>
            <label htmlFor="icon">Icon / Emoji (Optional)</label>
            <div 
              onClick={() => setShowIconPicker(!showIconPicker)}
              style={{ 
                padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', color: editFormData.icon ? '#000' : '#94a3b8'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editFormData.icon ? (
                  <><span style={{ fontSize: '1.2rem' }}>{editFormData.icon}</span><span style={{ color: '#000' }}>{FOOD_ICONS.find(i => i.icon === editFormData.icon)?.title || 'Custom Icon'}</span></>
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
                  <div onClick={() => { setEditFormData(prev => ({...prev, icon: ''})); setShowIconPicker(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>❌ None</div>
                  {filteredIcons.map(item => (
                    <div key={item.title} onClick={() => { setEditFormData(prev => ({...prev, icon: item.icon})); setShowIconPicker(false); setIconSearch(''); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: editFormData.icon === item.icon ? '#f1f5f9' : 'transparent' }}>
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
              <input id="upc" type="text" name="upc" value={editFormData.upc} onChange={handleEditChange} style={{ flex: 1, margin: 0 }} />
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditScannerOpen(true)} style={{ padding: '0', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, margin: 0 }}>📷</button>
            </div>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

          <div className="form-group">
            <label htmlFor="labelServings">Number of Servings on Label *</label>
            <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={editFormData.labelServings} onChange={handleEditChange} required />
          </div>

          <div className="form-group">
            <label>Volume/Weight/Amount on Label (Optional)</label>
            {editFormData.labelVolumes.map((vol, index) => {
              const usedUnits = editFormData.labelVolumes.map(v => v.unit);
              return (
                <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    style={{ flex: 1 }}
                    value={vol.amount}
                    onChange={(e) => handleEditVolumeChange(index, 'amount', e.target.value)}
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

          <div className="form-group"><label htmlFor="calories">Calories (from label) *</label><input id="calories" type="text" inputMode="decimal" name="calories" value={editFormData.calories} onChange={handleEditChange} required /></div>
          <div className="form-group"><label htmlFor="fat">Fat (g)</label><input id="fat" type="text" inputMode="decimal" name="fat" value={editFormData.fat} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="saturatedFat">Saturated Fat (g)</label><input id="saturatedFat" type="text" inputMode="decimal" name="saturatedFat" value={editFormData.saturatedFat} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="transFat">Trans Fat (g)</label><input id="transFat" type="text" inputMode="decimal" name="transFat" value={editFormData.transFat} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="cholesterol">Cholesterol (mg)</label><input id="cholesterol" type="text" inputMode="decimal" name="cholesterol" value={editFormData.cholesterol} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="sodium">Sodium (mg)</label><input id="sodium" type="text" inputMode="decimal" name="sodium" value={editFormData.sodium} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="carbs">Carbs (g)</label><input id="carbs" type="text" inputMode="decimal" name="carbs" value={editFormData.carbs} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="fiber">Fiber (g)</label><input id="fiber" type="text" inputMode="decimal" name="fiber" value={editFormData.fiber} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="sugar">Sugar (g)</label><input id="sugar" type="text" inputMode="decimal" name="sugar" value={editFormData.sugar} onChange={handleEditChange} /></div>
          <div className="form-group"><label htmlFor="protein">Protein (g)</label><input id="protein" type="text" inputMode="decimal" name="protein" value={editFormData.protein} onChange={handleEditChange} /></div>

          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditingNutrition(false)}>Cancel</button>
          </div>
        </form>

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
        {isEditScannerOpen && (
          <BarcodeScanner onClose={() => setIsEditScannerOpen(false)} onScanSuccess={(code) => { setEditFormData(prev => ({ ...prev, upc: code })); setIsEditScannerOpen(false); }} />
        )}
      </div>
    );
  }

  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = (selectedVolIndex >= 0 && selectedFood.volumes) ? selectedFood.volumes[selectedVolIndex] : null;
  const hasVolumes = selectedFood.volumes && selectedFood.volumes.length > 0;

  return (
    <div className="previous-food-modal" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Log Details</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.75rem', marginTop: 0 }}>
          When did you {isVitaminMode ? 'take' : 'eat'} <strong style={{ textTransform: 'capitalize' }}>{selectedFood.name}</strong>, and how much?
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

        {!isVitaminMode && (
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
        )}

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
                style={{ width: 'auto', margin: 0 }} 
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
          <div className="form-group">
            <label htmlFor="servingsConsumed">Number of Servings {isVitaminMode ? 'Taken' : 'Eaten'} *</label>
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
            <label htmlFor="volumeConsumed">Amount {isVitaminMode ? 'Taken' : 'Eaten'} *</label>
            <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', 
                border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600', display: 'flex',
                alignItems: 'center', justifyContent: 'center', minWidth: '3rem'
              }}>
                {selectedVol.unit}
              </span>
            </div>
          </div>
        )}

        {preview && (
          <div style={{ 
            marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#f8fafc', 
            borderRadius: '0.75rem', border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
              Nutrition Preview
            </h4>
            
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
        )}

        <div className="form-actions" style={{ marginTop: '2.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding...' : 'Add to Log'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setSelectedFood(null)}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}