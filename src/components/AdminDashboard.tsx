// src/components/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'wouter'; 
import { getBrandLogo, getBrandConfig, FOOD_BRANDS, normalizeBrandName } from '../constants/brands';
import { getUserFoods, getAllFoodLogs } from '../services/database';
import Icon from './Icon'; 
import { FOOD_ICONS } from '../constants/icons'; 

export default function AdminDashboard() {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('brands');
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  
  const [brandLastUsed, setBrandLastUsed] = useState<Record<string, number>>({});
  
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [filter, setFilter] = useState('all'); 
  const [brandSearch, setBrandSearch] = useState('');
  const [iconSearch, setIconSearch] = useState('');

  const formatDate = (ts?: number) => {
    if (!ts) return 'Never logged';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    if (user?.uid) {
      Promise.all([
        getUserFoods(user.uid),
        getAllFoodLogs(user.uid)
      ]).then(([foods, logs]) => {
        const foundBrands = new Set<string>();
        const brandTimeMap = new Map<string, number>();

        const updateLastUsed = (map: Map<string, number>, key?: string, timestamp?: number) => {
          if (!key || !timestamp) return;
          const cleanKey = key.trim();
          const current = map.get(cleanKey) || 0;
          if (timestamp > current) {
            map.set(cleanKey, timestamp);
          }
        };

        // Check Food Library
        foods.forEach(f => {
          if (f.brand && f.brand.trim() !== '') {
            foundBrands.add(f.brand.trim());
            updateLastUsed(brandTimeMap, normalizeBrandName(f.brand), f.createdAt);
          }
        });

        // Check Logged Items
        logs.forEach(l => {
          if (l.food?.brand && l.food.brand.trim() !== '') {
            foundBrands.add(l.food.brand.trim());
            updateLastUsed(brandTimeMap, normalizeBrandName(l.food.brand), l.timestamp);
          }
        });

        const brandTsRecord: Record<string, number> = {};
        brandTimeMap.forEach((ts, name) => { brandTsRecord[name] = ts; });

        setDbBrands(Array.from(foundBrands));
        setBrandLastUsed(brandTsRecord);
        setLoadingBrands(false);
      }).catch(err => {
        console.error("Failed to load DB data:", err);
        setLoadingBrands(false);
      });
    }
  }, [user?.uid]);

  if (!userProfile?.isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <Link href="/" style={{ textDecoration: 'none', color: '#2563eb' }}>Return to Dashboard</Link>
      </div>
    );
  }

  const baseBrandList = Array.isArray(FOOD_BRANDS) 
    ? FOOD_BRANDS.map((b: any) => typeof b === 'string' ? b : b.name || b.id)
    : Object.keys(FOOD_BRANDS);

  const uniqueBrandMap = new Map<string, string>();

  [...baseBrandList, ...dbBrands, "Example Brand (No Logo)"].forEach(brand => {
    if (!brand) return;
    const normalized = brand === "Example Brand (No Logo)" ? brand : normalizeBrandName(brand);
    if (!uniqueBrandMap.has(normalized)) uniqueBrandMap.set(normalized, brand);
  });

  const combinedBrands = Array.from(uniqueBrandMap.values()).sort();

  const filteredBrands = combinedBrands.filter(brandName => {
    const hasLogo = !!getBrandLogo(brandName);
    let passesDropdown = true;
    if (filter === 'with') passesDropdown = hasLogo;
    if (filter === 'without') passesDropdown = !hasLogo;
    const passesSearch = brandName.toLowerCase().includes(brandSearch.toLowerCase());
    return passesDropdown && passesSearch; 
  });

  const filteredIcons = FOOD_ICONS.filter(item => {
    const title = item.title.toLowerCase();
    const raw = item.icon.toLowerCase();
    const search = iconSearch.toLowerCase();
    return title.includes(search) || raw.includes(search);
  });

  return (
    <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ 
        display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', 
        backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <button style={{ 
            background: 'none', border: 'none', fontSize: '1.5rem', 
            cursor: 'pointer', padding: '0 15px 0 0', color: '#1e293b',
            display: 'flex', alignItems: 'center'
          }}>
            ←
          </button>
        </Link>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Admin Dashboard</h1>
      </header>

      <div style={{ padding: '1.5rem', flex: 1 }}>
        
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setActiveTab('brands')}
            style={{
              padding: '0.75rem 1.5rem', background: 'none', border: 'none',
              borderBottom: activeTab === 'brands' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'brands' ? '#2563eb' : '#64748b',
              fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
            }}
          >
            Brands
          </button>
          <button 
            onClick={() => setActiveTab('icons')}
            style={{
              padding: '0.75rem 1.5rem', background: 'none', border: 'none',
              borderBottom: activeTab === 'icons' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'icons' ? '#2563eb' : '#64748b',
              fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
            }}
          >
            Icons
          </button>
        </div>

        {activeTab === 'brands' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ 
              padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', gap: '1rem' 
            }}>
               <div>
                 <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Brand & Logo Preview</h3>
                 <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                   Combines hardcoded brands with unique brands saved in your database.
                 </p>
               </div>
               
               <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                 <input 
                   type="text" 
                   placeholder="Search brands..." 
                   value={brandSearch}
                   onChange={(e) => setBrandSearch(e.target.value)}
                   style={{
                     padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
                     outline: 'none', fontSize: '0.9rem', flex: '1 1 200px', color: '#1e293b'
                   }}
                 />
                 <select 
                   value={filter}
                   onChange={(e) => setFilter(e.target.value)}
                   style={{ 
                     padding: '0.6rem 2rem 0.6rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
                     backgroundColor: '#fff', color: '#1e293b', fontWeight: 500, fontSize: '0.9rem',
                     cursor: 'pointer', outline: 'none', appearance: 'none', flex: '0 1 auto',
                     backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                     backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto'
                   }}
                 >
                   <option value="all">All Brands</option>
                   <option value="with">With Logos</option>
                   <option value="without">Without Logos</option>
                 </select>
               </div>
            </div>
            
            {loadingBrands ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading brands...</div>
            ) : filteredBrands.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No brands match your search.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredBrands.map((brandName, index) => {
                  const isLast = index === filteredBrands.length - 1;
                  const normalized = normalizeBrandName(brandName);
                  const lastUsedDate = brandLastUsed[normalized];

                  return (
                    <li key={brandName} style={{ 
                      padding: '1rem 1.5rem', borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>
                          {brandName} 
                          {brandName === "Example Brand (No Logo)" && <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>(Static Placeholder)</span>}
                        </span>
                        {brandName !== "Example Brand (No Logo)" && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Last used: {formatDate(lastUsedDate)}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px dashed #cbd5e1'
                      }}>
                        {getBrandLogo(brandName) && (
                          <img 
                            src={getBrandLogo(brandName)!} 
                            alt={brandName} 
                            style={{ height: '1rem', width: 'auto', borderRadius: '0.2rem', objectFit: 'contain' }} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                          />
                        )}
                        {(!getBrandLogo(brandName) || getBrandConfig(brandName)?.showName) && (
                          <span className="brand" style={{ textTransform: 'capitalize', fontSize: '0.85rem', color: '#64748b' }}>
                            {brandName}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'icons' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ 
              padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
               <div>
                 <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Food Icon UI Preview</h3>
                 <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                   This displays all official icons from your icons file.
                 </p>
               </div>

               <input 
                 type="text" 
                 placeholder="Search icons..." 
                 value={iconSearch}
                 onChange={(e) => setIconSearch(e.target.value)}
                 style={{
                   padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
                   outline: 'none', fontSize: '0.9rem', width: '100%', maxWidth: '400px', color: '#1e293b'
                 }}
               />
            </div>
            
            {filteredIcons.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No icons match your search.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredIcons.map((item, index) => {
                  const iconPath = item.icon;
                  const isLast = index === filteredIcons.length - 1;
                  
                  return (
                    <li key={iconPath} style={{ 
                      padding: '1rem 1.5rem', borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: '#475569', fontSize: '1rem' }}>
                          {item.title}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem',
                        border: '1px dashed #cbd5e1', width: '3rem', height: '3rem', flexShrink: 0
                      }}>
                        <Icon icon={iconPath} size="1.5rem" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

      </div>
    </div>
  );
}