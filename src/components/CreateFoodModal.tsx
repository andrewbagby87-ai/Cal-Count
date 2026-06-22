// src/components/CreateFoodModal.tsx
import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '../contexts/AuthContext';
import { createFood, getUserFoods, createFoodLog } from '../services/database';
import { Food } from '../types';
import BarcodeScanner from './BarcodeScanner';
import { FOOD_ICONS } from '../constants/icons';
import Icon from './Icon';
import './CreateFoodModal.css';

interface Props {
  onCreated?: (food: Food) => void;
  onClose: () => void;
  initialDate?: string; 
  isVitaminMode?: boolean; 
  initialUpc?: string;
  isRecipeIngredientMode?: boolean;
  onIngredientCalculated?: (foodObject: Food, consumedNutrition: any, amount: number, unit: string) => void;
  initialMealType?: string; 
  foods?: Food[];
}

const ALL_UNITS = ['g', 'oz', 'cup', 'ml', 'each'];

const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();
  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${month} ${getOrdinal(day)}, ${date.getFullYear()}`;
};

export default function CreateFoodModal({ onCreated, onClose, initialDate, isVitaminMode, initialUpc, isRecipeIngredientMode, onIngredientCalculated, initialMealType, foods = [] }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'meal'>('form');
  const [showFlavorSuggestions, setShowFlavorSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', flavor: '', brand: '', icon: '', 
    upcs: initialUpc ? [initialUpc] : [''], 
    calories: '', fat: '', saturatedFat: '',
    transFat: '', cholesterol: '', sodium: '', carbs: '', fiber: '', sugar: '', protein: '', labelServings: '1',
    labelVolumes: [{ amount: '', unit: 'g' }] as { amount: string, unit: string }[],
  });

  const [logDetails, setLogDetails] = useState({
    date: initialDate || getLocalTodayString(),
    mealType: isVitaminMode ? 'Vitamins' : (initialMealType || ''), 
    consumptionMethod: 'serving', 
    servingsConsumed: '1',
    volumeConsumed: '',
    isPlanned: (initialDate && initialDate > getLocalTodayString()) ? true : false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isAnalyzingLabel, setIsAnalyzingLabel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const topRef = useRef<HTMLDivElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const iconPickerRef = useRef<HTMLDivElement>(null);

  // Auto-complete States
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [existingFoodId, setExistingFoodId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<Food | null>(null);

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
    if (error && topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleUpcChange = (index: number, value: string) => {
    if (value !== '' && !/^\d*$/.test(value)) return;
    if (value.length > 13) return; 
    setFormData(prev => {
      const newUpcs = [...prev.upcs];
      newUpcs[index] = value;
      return { ...prev, upcs: newUpcs };
    });
  };

  const addUpcInput = () => {
    setFormData(prev => ({ ...prev, upcs: [...prev.upcs, ''] }));
  };

  const removeUpcInput = (index: number) => {
    setFormData(prev => {
      const newUpcs = [...prev.upcs];
      newUpcs.splice(index, 1);
      if (newUpcs.length === 0) newUpcs.push('');
      return { ...prev, upcs: newUpcs };
    });
  };

  const handleScanSuccess = async (code: string) => {
    if (!user) return;
    try {
      const existingFoods = await getUserFoods(user.uid);
      const isDuplicate = existingFoods.some(f => f.upc === code || f.upcs?.includes(code));

      if (isDuplicate) {
        setError('A food with this barcode already exists in your database!');
        setIsScannerOpen(false); 
        return;
      }

      setFormData(prev => {
        const newUpcs = [...prev.upcs];
        const emptyIdx = newUpcs.findIndex(u => u.trim() === '');
        if (emptyIdx >= 0) {
          newUpcs[emptyIdx] = code;
        } else {
          newUpcs.push(code);
        }
        return { ...prev, upcs: newUpcs };
      });
      setError(''); 
      setIsScannerOpen(false); 
    } catch (err) {
      console.error("Failed to verify UPC:", err);
      setIsScannerOpen(false); 
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name !== 'name' && name !== 'brand' && name !== 'icon' && name !== 'flavor' && value !== '' && !/^\d*\.?\d*$/.test(value)) return; 
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

  const safeParse = (val: string) => {
    if (!val) return undefined;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : Number(parsed.toFixed(2));
  };

  // <-- ADD THIS ENTIRE FUNCTION -->
  const handleLabelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingLabel(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          
          // Initialize Gemini (using the standard 2.0 flash model)
          const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          const prompt = `
            Analyze this image of a nutrition label. Extract the nutritional values and return ONLY a raw JSON object. 
            
            CRITICAL INSTRUCTION: If the nutrition label has multiple columns (for example, "Per Serving" and "Per Container"), you MUST ONLY extract the values for ONE SERVING. Ignore the "Per Container" values entirely.
            
            Do not include markdown formatting like \`\`\`json.
            Only output numbers or decimals as strings. If a value is missing or you can't read it, return an empty string "".
            
            NEW RULE: If a nutritional value on the label is explicitly listed as "<1", "< 1", "<1g", or "less than 1", you MUST output it as "0".
            
            SUGAR RULE: For the "sugar" key, you MUST extract the "Total Sugars" value. Do not use the "Added Sugars" value for this key.
            
            ALSO EXTRACT the serving size volume or weight (e.g., from "Serving Size 1 cup (240ml)" or "Serving Size 100g"). 
            Return the number in a key called "servingAmount" and the unit in a key called "servingUnit". 
            The "servingUnit" MUST perfectly match one of these exact strings: "g", "oz", "cup", "ml", "each". If the unit on the label does not match one of these, or is missing, leave both servingAmount and servingUnit as empty strings "".
            
            Use exactly these keys: calories, fat, saturatedFat, transFat, cholesterol, sodium, carbs, fiber, sugar, protein, labelServings, servingAmount, servingUnit.
          `;

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64String, mimeType: file.type } }
          ]);

          const responseText = result.response.text().trim();
          const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const extractedData = JSON.parse(cleanJsonStr);

          setFormData(prev => {
            const hasValidVolume = extractedData.servingAmount && extractedData.servingUnit;

            return {
              ...prev,
              calories: extractedData.calories || prev.calories,
              fat: extractedData.fat || prev.fat,
              saturatedFat: extractedData.saturatedFat || prev.saturatedFat,
              transFat: extractedData.transFat || prev.transFat,
              cholesterol: extractedData.cholesterol || prev.cholesterol,
              sodium: extractedData.sodium || prev.sodium,
              carbs: extractedData.carbs || prev.carbs,
              fiber: extractedData.fiber || prev.fiber,
              sugar: extractedData.sugar || prev.sugar,
              protein: extractedData.protein || prev.protein,
              
              labelServings: '1', 

              labelVolumes: hasValidVolume 
                ? [{ amount: String(extractedData.servingAmount), unit: extractedData.servingUnit }] 
                : prev.labelVolumes
            };
          });
        } catch (innerErr) {
          console.error("AI Parsing Error:", innerErr);
          setError('Failed to extract data from the image. Please enter it manually.');
        } finally {
          setIsAnalyzingLabel(false);
          if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
      };
    } catch (err) {
      console.error(err);
      setError('Error reading the image file.');
      setIsAnalyzingLabel(false);
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Name is required'); return; }
    
    const validUpcs = formData.upcs.map(u => u.trim()).filter(u => u !== '');
    for (const upc of validUpcs) {
      if (upc.length !== 8 && upc.length !== 12 && upc.length !== 13) {
        setError('UPCs must be exactly 8, 12, or 13 digits');
        return;
      }
      if (foods.some(f => f.upc === upc || f.upcs?.includes(upc))) {
        setError('One of the UPCs is already used by another item in your database.');
        return;
      }
    }
    
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
    
    if (isRecipeIngredientMode) setLoading(true);

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
        
      const validUpcs = formData.upcs.map(u => u.trim()).filter(u => u !== '');

      const baseNutrition: any = {
        name: formData.name.trim(),
        flavor: formData.flavor.trim() || undefined,
        brand: formData.brand.trim() || undefined,
        icon: formData.icon.trim() || undefined, 
        upcs: validUpcs.length > 0 ? validUpcs : undefined,
        upc: validUpcs.length > 0 ? validUpcs[0] : undefined, // Compatibility
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

      if (!isRecipeIngredientMode) onClose();

      const cleanBaseNutrition = JSON.parse(JSON.stringify(baseNutrition));
      let newFoodId = existingFoodId;

      if (!newFoodId) {
        newFoodId = await createFood(user.uid, cleanBaseNutrition);
        window.dispatchEvent(new Event('foodLibraryChanged'));
      }
      
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

      const foodObject: Food = existingFoodId 
        ? foods.find(f => f.id === existingFoodId)! 
        : { id: newFoodId, userId: user.uid, ...cleanBaseNutrition, createdAt: Date.now() };

      if (isRecipeIngredientMode && onIngredientCalculated) {
        onIngredientCalculated(foodObject, consumedNutrition, finalAmount, finalUnit);
        setLoading(false);
        return; 
      }

      const payload = {
        date: logDetails.date, 
        foodId: newFoodId,
        food: foodObject, 
        amount: finalAmount, 
        unit: finalUnit,
        mealType: logDetails.mealType, 
        isPlanned: logDetails.isPlanned, 
        ...consumedNutrition 
      };

      const cleanPayload = JSON.parse(JSON.stringify(payload));

      if (onCreated) {
         (onCreated as any)(cleanPayload); 
      }

    } catch (err) {
      console.error(err);
      if (!isRecipeIngredientMode) {
        alert(err instanceof Error ? err.message : 'An error occurred while saving.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      setLoading(false);
    } 
  };

  // Auto-complete Logic
  const nameSuggestions = formData.name.length > 1
    ? foods.filter(f => f.name.toLowerCase().includes(formData.name.toLowerCase()) && (!isVitaminMode ? !f.isVitamin : f.isVitamin)).slice(0, 5)
    : [];

  const uniqueBrands = Array.from(new Set(foods.map(f => f.brand).filter(b => b && b.trim() !== '')));
  const brandSuggestions = formData.brand.length > 0
    ? uniqueBrands.filter(b => b && b.toLowerCase().includes(formData.brand.toLowerCase())).slice(0, 5)
    : [];

  const uniqueFlavors = Array.from(new Set(foods.map(f => f.flavor).filter(f => f && f.trim() !== '')));
  const flavorSuggestions = formData.flavor.length > 0
    ? uniqueFlavors.filter(f => f && f.toLowerCase().includes(formData.flavor.toLowerCase())).slice(0, 5)
    : [];

  const processSelection = (action: 'log' | 'copy' | 'name-only') => {
    if (!pendingSelection) return;
    const food = pendingSelection;

    if (action === 'log') {
      setExistingFoodId(food.id);
      setLogDetails(prev => ({ ...prev, consumptionMethod: 'serving', servingsConsumed: '1' }));
      setStep('meal');
    } else if (action === 'copy') {
      const toStr = (val: any) => (val !== undefined && val !== null ? String(val) : '');
      setFormData(prev => ({
        ...prev,
        name: food.name, brand: food.brand || '', icon: food.icon || '',
        calories: toStr(food.calories), fat: toStr(food.fat), saturatedFat: toStr(food.saturatedFat),
        transFat: toStr(food.transFat), cholesterol: toStr(food.cholesterol), sodium: toStr(food.sodium),
        carbs: toStr(food.carbs), fiber: toStr(food.fiber), sugar: toStr(food.sugar), protein: toStr(food.protein),
        labelServings: toStr(food.servingSize || 1),
        labelVolumes: (food.volumes && food.volumes.length > 0) ? food.volumes.map(v => ({ amount: toStr(v.amount), unit: v.unit })) : [{ amount: '', unit: 'g' }]
      }));
    } else if (action === 'name-only') {
      setFormData(prev => ({ ...prev, name: food.name }));
    }
    setPendingSelection(null);
  };

  const isVolumeSelected = logDetails.consumptionMethod.startsWith('volume-');
  const selectedVolIndex = isVolumeSelected ? parseInt(logDetails.consumptionMethod.split('-')[1]) : -1;
  const selectedVol = selectedVolIndex >= 0 ? formData.labelVolumes[selectedVolIndex] : null;
  
  const filteredIcons = FOOD_ICONS.filter(item => 
    item.title.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div className="create-food-modal" style={{ overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      
      <div ref={topRef} />
      
      <style>{`
        .create-food-modal * {
          box-sizing: border-box !important;
          max-width: 100%;
        }
      `}</style>
      
      {step === 'form' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{isRecipeIngredientMode ? 'Create Recipe Ingredient' : 'Step 1: Nutrition Label'}</h3>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: '#64748b' }}>✕</button>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Enter the exact values shown on the nutrition label.
          </p>

          {error && <div className="error">{error}</div>}
          
          <form onSubmit={handleContinue}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="name">{isVitaminMode ? 'Vitamin Name *' : 'Food Name *'}</label>
              <input 
                id="name" type="text" name="name" value={formData.name} 
                onChange={(e) => { handleChange(e); setShowNameSuggestions(true); setExistingFoodId(null); }} 
                onFocus={() => setShowNameSuggestions(true)}
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                placeholder={isVitaminMode ? "e.g., Vitamin C" : "e.g., Grilled Chicken Breast"} required 
                autoComplete="off"
              />
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {nameSuggestions.map(f => (
                    <div 
                      key={f.id} 
                      onClick={() => { setPendingSelection(f); setShowNameSuggestions(false); }} 
                      style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        {f.icon && <Icon icon={f.icon} size="1.2rem" />}
                        <span style={{ fontWeight: 600, color: '#1e293b', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}{f.flavor ? ` - ${f.flavor}` : ''}
                        </span>
                      </div>
                      {f.brand ? (
                        <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize', marginLeft: '0.5rem', flexShrink: 0 }}>{f.brand}</span>
                      ) : (f as any).isRecipe ? (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '0.25rem', backgroundColor: '#0f766e', color: '#ffffff', letterSpacing: '0.02em', marginLeft: '0.5rem', flexShrink: 0 }}>
                          RECIPE
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="form-group" style={{ position: 'relative', marginTop: '1rem' }}>
              <label htmlFor="flavor">Flavor / Type (Optional)</label>
              <input 
                id="flavor" type="text" name="flavor" value={formData.flavor} 
                onChange={(e) => { handleChange(e); setShowFlavorSuggestions(true); }} 
                onFocus={() => setShowFlavorSuggestions(true)}
                onBlur={() => setTimeout(() => setShowFlavorSuggestions(false), 200)}
                placeholder="e.g., Chocolate, Spicy, Roasted" 
                autoComplete="off"
              />
              {showFlavorSuggestions && flavorSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {flavorSuggestions.map((f, i) => (
                    <div key={i} onClick={() => { setFormData(prev => ({...prev, flavor: f as string})); setShowFlavorSuggestions(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#1e293b', textTransform: 'capitalize' }}>
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="brand">Brand (Optional)</label>
              <input 
                id="brand" type="text" name="brand" value={formData.brand} 
                onChange={(e) => { handleChange(e); setShowBrandSuggestions(true); }} 
                onFocus={() => setShowBrandSuggestions(true)}
                onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                placeholder="e.g., Nature Made" 
                autoComplete="off"
              />
              {showBrandSuggestions && brandSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {brandSuggestions.map((b, i) => (
                    <div key={i} onClick={() => { setFormData(prev => ({...prev, brand: b as string})); setShowBrandSuggestions(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>
                      {b}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ position: 'relative' }} ref={iconPickerRef}>
              <label htmlFor="icon">Icon / Emoji (Optional)</label>
              <div 
                onClick={() => setShowIconPicker(!showIconPicker)}
                style={{ 
                  padding: '0.75rem', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '0.5rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#fff',
                  color: formData.icon ? '#000' : '#94a3b8'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {formData.icon ? (
                    <>
                      <Icon icon={formData.icon} size="1.2rem" />
                      <span style={{ color: '#000' }}>{FOOD_ICONS.find(i => i.icon === formData.icon)?.title || 'Custom Icon'}</span>
                    </>
                  ) : (
                    "Select an Icon..."
                  )}
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
                    <input 
                      type="text" 
                      placeholder="Search icons..." 
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', padding: '0.5rem', margin: 0, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <div 
                      onClick={() => { setFormData(prev => ({...prev, icon: ''})); setShowIconPicker(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    >
                      ❌ None
                    </div>
                    {filteredIcons.map(item => (
                      <div 
                        key={item.title}
                        onClick={() => { setFormData(prev => ({...prev, icon: item.icon})); setShowIconPicker(false); setIconSearch(''); }}
                        style={{ 
                          padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                          backgroundColor: formData.icon === item.icon ? '#f1f5f9' : 'transparent'
                        }}
                      >
                        <Icon icon={item.icon} size="1.4rem" />
                        <span>{item.title}</span>
                      </div>
                    ))}
                    {filteredIcons.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No icons found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>UPC / Barcodes (Optional)</label>
              {formData.upcs.map((upc, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', marginBottom: '0.5rem' }}>
                  <input 
                    type="text" value={upc} onChange={(e) => handleUpcChange(index, e.target.value)} 
                    placeholder="e.g., 012345678901" style={{ flex: 1, margin: 0 }} 
                  />
                  {formData.upcs.length > 1 && (
                     <button type="button" onClick={() => removeUpcInput(index)} style={{ padding: '0 1rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>X</button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={addUpcInput} style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}>
                  + Add UPC
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsScannerOpen(true)} style={{ padding: '0 1rem', fontSize: '1.2rem', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Scan Barcode">
                  📷
                </button>
              </div>
            </div>

            {/* <-- ADD THIS NEW BLOCK --> */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              onChange={handleLabelUpload} 
              style={{ display: 'none' }} 
            />

            <div style={{ marginBottom: '1.5rem', marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.75rem 0', color: '#166534', fontWeight: 600, fontSize: '0.9rem' }}>
                ✨ Have a nutrition label?
              </p>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzingLabel}
                style={{ 
                  width: '100%', padding: '0.75rem', backgroundColor: '#22c55e', color: 'white', 
                  border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isAnalyzingLabel ? 'wait' : 'pointer' 
                }}
              >
                {isAnalyzingLabel ? 'Analyzing Label...' : '📸 Scan Label with AI'}
              </button>
            </div>
            {/* <-- END OF NEW BLOCK --> */}

            <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

            <div className="form-group">
              <label htmlFor="labelServings">Number of Servings *</label>
              <input id="labelServings" type="text" inputMode="decimal" name="labelServings" value={formData.labelServings} onChange={handleChange} placeholder="1" required />
            </div>

            <div className="form-group">
              <label>Volume/Weight/Amount on Label (Optional)</label>
              {formData.labelVolumes.map((vol, index) => {
                const usedUnits = formData.labelVolumes.map(v => v.unit);
                return (
                  <div key={index} className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
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

            <div className="form-group"><label htmlFor="calories">Calories *</label><input id="calories" type="text" inputMode="decimal" name="calories" value={formData.calories} onChange={handleChange} placeholder="0" required /></div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{isRecipeIngredientMode ? 'Ingredient Amount' : 'Step 2: Log Details'}</h3>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0, color: '#64748b' }}>✕</button>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {isRecipeIngredientMode ? 'How much of this went into the recipe?' : `When did you ${isVitaminMode ? 'take' : 'eat'} this, and how much did you have?`}
          </p>

          {error && <div className="error">{error}</div>}

          <form onSubmit={handleFinalSubmit}>
            
            {!isRecipeIngredientMode && (
              <>
                <div className="form-group">
                  <label>Date</label>
                  <div style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: '1.05rem', fontWeight: 600, boxSizing: 'border-box', textAlign: 'center' }}>
                    {formatDateDisplay(logDetails.date)}
                  </div>
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
                <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        fontWeight: 700, color: nutrient.isHighlight ? '#2563eb' : '#1e293b', fontSize: nutrient.isHighlight ? '1rem' : '0.8rem' 
                      }}>
                        {nutrient.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isRecipeIngredientMode && (
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

            <div className="form-actions" style={{ marginTop: '2.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (isRecipeIngredientMode ? 'Add Ingredient' : 'Save Food Log')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>Back</button>
            </div>
          </form>
        </>
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}

      {/* NEW: Custom Auto-Suggest Modal Overlay */}
      {pendingSelection && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 10000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '400px', backgroundColor: '#fff',
            borderRadius: '1rem', padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '1.25rem' }}>Food Already Exists</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
              <strong>"{pendingSelection.name}"</strong> is already in your database. What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button type="button" onClick={() => processSelection('log')} style={{ padding: '0.85rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Skip Creating & Just Log It
              </button>
              <button type="button" onClick={() => processSelection('copy')} style={{ padding: '0.85rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Copy Nutrition to New Item
              </button>
              <button type="button" onClick={() => processSelection('name-only')} style={{ padding: '0.85rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Use Name Only
              </button>
              <button type="button" onClick={() => setPendingSelection(null)} style={{ padding: '0.85rem', background: 'none', color: '#94a3b8', border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}