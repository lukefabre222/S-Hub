import React, { useState, useMemo } from 'react';
import { useShiftStore, BUSINESS_TYPES, getDayOfWeek, isHoliday, ROLES } from '../store/useShiftStore';
import { Plus, Minus, Save, CalendarDays, Eye, CheckCircle2, Building } from 'lucide-react';

export default function OrderManagement() {
  const { dates, shops, companies, orders, updateOrder, submitOrderNotification, currentUser, partnerships, targetYearMonth } = useShiftStore();

  const isReadOnly = currentUser?.role === ROLES.COMPANY_ADMIN;

  // --- 店舗選択 ---
  const initialShopId = currentUser?.role === ROLES.SHOP_ADMIN && currentUser.shopId ? currentUser.shopId : shops[0]?.id;
  const [selectedShopId, setSelectedShopId] = useState(initialShopId);
  const effectiveShopId = selectedShopId || initialShopId;
  const selectedShop = shops.find(s => s.id === effectiveShopId);

  // --- 送信先企業選択 (店舗目線) ---
  const activePartnerCompanies = useMemo(() => {
    if (isReadOnly) return [];
    return companies.filter(company => {
      const p = partnerships.find(p => p.shop_id === effectiveShopId && p.company_id === company.id);
      return p && p.shop_approved && p.company_approved;
    });
  }, [companies, partnerships, effectiveShopId, isReadOnly]);

  const [selectedCompanyId, setSelectedCompanyId] = useState(activePartnerCompanies[0]?.id || '');
  const effectiveCompanyId = isReadOnly ? currentUser?.companyId : (selectedCompanyId || activePartnerCompanies[0]?.id);

  const [showToast, setShowToast] = useState(false);
  const [draftCounts, setDraftCounts] = useState({});

  const handlePlus = (date, shopId, companyId, type, currentCount) => {
    if (!companyId) return;
    const key = `${date}_${shopId}_${companyId}_${type}`;
    const val = draftCounts[key] !== undefined ? draftCounts[key] : currentCount;
    setDraftCounts({ ...draftCounts, [key]: val + 1 });
  };

  const handleMinus = (date, shopId, companyId, type, currentCount) => {
    if (!companyId) return;
    const key = `${date}_${shopId}_${companyId}_${type}`;
    const val = draftCounts[key] !== undefined ? draftCounts[key] : currentCount;
    setDraftCounts({ ...draftCounts, [key]: Math.max(0, val - 1) });
  };

  const handleSave = async () => {
    if (!effectiveCompanyId) {
      alert("送信先の企業が選択されていません。");
      return;
    }
    const hasChanges = Object.keys(draftCounts).length > 0;
    for (const [key, count] of Object.entries(draftCounts)) {
      const [date, shopId, companyId, type] = key.split('_');
      await updateOrder(date, shopId, companyId, type, count);
    }
    if (hasChanges && currentUser?.role === ROLES.SHOP_ADMIN) {
      await submitOrderNotification(effectiveShopId, effectiveCompanyId);
    }
    setDraftCounts({});
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-4 mx-auto w-full max-w-[1600px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
             <CalendarDays className="mr-3 text-blue-600" />
             {targetYearMonth} オーダー入力
          </h2>
          <div className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            {currentUser?.role !== ROLES.SHOP_ADMIN && (
              <>
                <span className="text-sm text-gray-500 font-medium ml-2">対象店舗:</span>
                <select 
                  className="border border-gray-300 rounded-md text-sm pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={effectiveShopId || ''}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                >
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
              </>
            )}
            
            {!isReadOnly && (
              <>
                <Building size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500 font-medium">送信先企業:</span>
                <select 
                  className="border border-gray-300 rounded-md text-sm pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={effectiveCompanyId || ''}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  disabled={activePartnerCompanies.length === 0}
                >
                  {activePartnerCompanies.length === 0 ? (
                    <option value="">(連携済みの企業なし)</option>
                  ) : (
                    activePartnerCompanies.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.name}</option>
                    ))
                  )}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`px-6 py-4 border-b flex justify-between items-center ${isReadOnly ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
             <h3 className={`font-bold ${isReadOnly ? 'text-gray-700 flex items-center' : 'text-blue-800'}`}>
               {isReadOnly && <Eye size={18} className="mr-2 text-gray-500" />}
               {selectedShop?.name} - {isReadOnly ? 'オーダー状況 (閲覧モード)' : '希望人数入力'}
             </h3>
             {!isReadOnly && (
               <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium transition flex items-center">
                 <Save size={16} className="mr-2" />
                 オーダーを保存
               </button>
             )}
          </div>
          <div className="overflow-x-auto pb-4">
            <table className="min-w-max divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24 border-r border-b border-gray-200 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">業務種別</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16 border-r border-b border-gray-200 sticky left-[96px] bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">合計</th>
                  {dates.map(date => {
                    const dayOfWeek = getDayOfWeek(targetYearMonth, date);
                    const isWeekend = dayOfWeek === '土';
                    const isSunday = dayOfWeek === '日';
                    const isHol = isHoliday(targetYearMonth, date);
                    const isRestDay = isSunday || isHol;
                    const dateTextClass = isRestDay ? 'text-red-700' : isWeekend ? 'text-blue-700' : 'text-gray-900';
                    const dayTextClass = isRestDay ? 'text-red-500' : isWeekend ? 'text-blue-500' : 'text-gray-500';

                    return (
                      <th key={date} className="px-2 py-2 text-center text-xs font-bold tracking-wider min-w-[70px] border-r border-b border-gray-200">
                        <div className={dateTextClass}>{date}日</div>
                        <div className={`text-[10px] ${dayTextClass}`}>({isHol ? '祝' : dayOfWeek})</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {BUSINESS_TYPES.map(type => {
                  // 合計を計算
                  const typeTotal = dates.reduce((sum, date) => {
                    const dbCount = orders[date]?.[effectiveShopId]?.[effectiveCompanyId]?.[type] || 0;
                    const draftKey = `${date}_${effectiveShopId}_${effectiveCompanyId}_${type}`;
                    const count = draftCounts[draftKey] !== undefined ? draftCounts[draftKey] : dbCount;
                    return sum + count;
                  }, 0);

                  return (
                    <tr key={type} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold border-r border-b border-gray-200 text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {type}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-sm font-bold text-blue-800 border-r border-b border-gray-200 text-center sticky left-[96px] z-10 bg-blue-50/50">
                        {typeTotal} <span className="text-xs text-blue-600 font-normal">名</span>
                      </td>
                      {dates.map(date => {
                        const dbCount = orders[date]?.[effectiveShopId]?.[effectiveCompanyId]?.[type] || 0;
                        const draftKey = `${date}_${effectiveShopId}_${effectiveCompanyId}_${type}`;
                        const count = draftCounts[draftKey] !== undefined ? draftCounts[draftKey] : dbCount;
                        const cellBgClass = count > 0 ? 'bg-amber-50/80' : 'bg-gray-100/50 transition-colors';
                        
                        return (
                          <td key={`${type}-${date}`} className={`px-1 py-1 border-r border-b border-gray-200 transition-colors align-middle ${cellBgClass}`}>
                            {isReadOnly ? (
                              <div className="flex items-center justify-center h-full">
                                <span className={`text-lg font-bold text-center ${count > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                                  {count > 0 ? count : '-'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center space-y-2 my-2">
                                <button 
                                  onClick={() => handlePlus(date, effectiveShopId, effectiveCompanyId, type, count)}
                                  className={`w-8 h-6 rounded shadow-sm border ${!effectiveCompanyId ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'} transition-colors flex items-center justify-center`}
                                  disabled={!effectiveCompanyId}
                                >
                                  <Plus size={14} strokeWidth={2.5} />
                                </button>
                                <span className={`text-base font-black w-full text-center select-none leading-none my-1 ${count > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                                  {count}
                                </span>
                                <button 
                                  onClick={() => handleMinus(date, effectiveShopId, effectiveCompanyId, type, count)}
                                  className={`w-8 h-6 rounded shadow-sm transition-colors flex items-center justify-center border ${count > 0 ? 'bg-white text-red-500 hover:bg-red-50 border-red-200' : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed shadow-none'}`}
                                  disabled={count <= 0 || !effectiveCompanyId}
                                >
                                  <Minus size={14} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 完了トースト */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center z-50 transition-opacity duration-300">
          <CheckCircle2 size={20} className="text-green-400 mr-2" />
          <span className="font-bold text-sm">最新のオーダー内容を保存しました！</span>
        </div>
      )}
    </div>
  );
}
