import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFoods, getDayFoodLogs, createFoodLog, deleteFoodLog, updateFoodLog } from '../services/database';
import { Food, FoodLog } from '../types';
import AddFoodModal from './AddFoodModal';
import EditFoodLogModal from './EditFoodLogModal';
import './FoodLogTab.css';

export default function FoodLogTab() {
  const { user } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [userFoods, logs] = await Promise.all([
        getUserFoods(user.uid),
        getDayFoodLogs(user.uid, today),
      ]);
      setFoods(userFoods);
      setFoodLogs(logs);
    } catch (error) {
      console.error('Failed to load food data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleAddFood = async (foodData: any) => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await createFoodLog(user.uid, {
        date: today,
        ...foodData,
      });
      setShowAddModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to add food:', error);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteFoodLog(logId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete food log:', error);
    }
  };

  const handleEditLog = async (updates: any) => {
    if (!editingLog) return;
    try {
      await updateFoodLog(editingLog.id, updates);
      setShowEditModal(false);
      setEditingLog(null);
      await loadData();
    } catch (error) {
      console.error('Failed to update food log:', error);
    }
  };

  if (loading) return <div className="loading">Loading foods...</div>;

  const totalCalories = foodLogs.reduce((sum, log) => sum + (log.editedNutrition?.calories ?? log.calories), 0);

  return (
    <div className="food-log-tab">
      <div className="tab-header">
        <h2>Food Log</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          + Add Food
        </button>
      </div>

      <div className="food-summary">
        <span>Total: {totalCalories} cal</span>
      </div>

      {foodLogs.length === 0 ? (
        <div className="empty-state">
          <p>No foods logged today</p>
          <button className="btn btn-outline" onClick={() => setShowAddModal(true)}>
            Log your first food
          </button>
        </div>
      ) : (
        <div className="food-logs-list">
          {foodLogs.map((log) => (
            <div key={log.id} className="food-log-item">
              <div className="food-info">
                <h4>{log.food.name}</h4>
                {log.food.brand && <span className="brand">{log.food.brand}</span>}
                <span className="amount">
                  {log.amount} {log.unit}
                </span>
              </div>
              <div className="food-calories">
                <span className="calories">{log.editedNutrition?.calories ?? log.calories} cal</span>
              </div>
              <div className="food-actions">
                <button
                  className="action-btn edit"
                  onClick={() => {
                    setEditingLog(log);
                    setShowEditModal(true);
                  }}
                  title="Edit this food entry"
                >
                  ✏️
                </button>
                <button
                  className="action-btn delete"
                  onClick={() => handleDeleteLog(log.id)}
                  title="Delete this food entry"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddFoodModal foods={foods} onAdd={handleAddFood} onClose={() => setShowAddModal(false)} />
      )}

      {showEditModal && editingLog && (
        <EditFoodLogModal log={editingLog} onSave={handleEditLog} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
