import React, { useState } from 'react';
import { useShiftStore, BUSINESS_TYPES, getDayOfWeek, isHoliday, ROLES } from '../store/useShiftStore';
import { Plus, Minus, Save, CalendarDays, Eye, CheckCircle2 } from 'lucide-react';

export default function OrderManagement() {
  const { dates, shops, orders, updateOrder, currentUser } = useShiftStore();

  const initialShopId = currentUser?.role === ROLES.SHOP_ADMIN && currentUser.shopId ? currentUser.shopId : shops[0]?.id;
  const [selectedShopId, setSelectedShopId] = useState(initialShopId);
  
  // 非同期でデータが遅れて入ってきた場合、undefinedにならないように常に有効なIDを計算する
  const effectiveShopId = selectedShopId || (currentUser?.role === ROLES.SHOP_ADMIN && currentUser.shopId ? currentUser.shopId : shops[0]?.id);
  const selectedShop = shops.find(s => s.id === effectiveShopId);

  const isReadOnly = currentUser?.role === ROLES.COMPANY_ADMIN;
  const [showToast, setShowToast] = useState(false);
  const [draftCounts, setDraftCounts] = useState({});

  const handlePlus = (date, shopId, type, currentCount) => {
    const key = `${date}_${shopId}_${type}`;
    const val = draftCounts[key] !== undefined ? draftCounts[key] : currentCount;
    setDraftCounts({ ...draftCounts, [key]: val + 1 });
  };

  const handleMinus = (date, shopId, type, currentCount) => {
    const key = `${date}_${shopId}_${type}`;
    const val = draftCounts[key] !== undefined ? draftCounts[key] : currentCount;
    setDraftCounts({ ...draftCounts, [key]: Math.max(0, val - 1) });
  };

  const handleSave = async () => {
    // ローカルの変更分をDBへ一括保存
    for (const [key, count] of Object.entries(draftCounts)) {
      const [date, shopId, type] = key.split('_');
      await updateOrder(date, shopId, type, count);
    }
    setDraftCounts({}); // 一旦クリア（あとはリアルタイム購読が最新にしてくれる）
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-4 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
             <CalendarDays className="mr-3 text-blue-600" />
             翌月オーダー入力
          </h2>
          {currentUser?.role !== ROLES.SHOP_ADMIN && (
            <div className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
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
            </div>
          )}
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
          
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20 border-r border-gray-200 sticky top-0 bg-gray-50 z-10">日付</th>
                {BUSINESS_TYPES.map(type => (
                  <th key={type} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-r border-gray-200 sticky top-0 bg-gray-50 z-10">{type}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-800 border-r border-gray-200 text-center w-20">
                  合計
                </td>
                {BUSINESS_TYPES.map(type => {
                  const typeTotal = dates.reduce((sum, date) => sum + (orders[date]?.[selectedShopId]?.[type] || 0), 0);
                  return (
                    <td key={`total-${type}`} className="px-2 py-3 border-r border-gray-200 w-1/4 text-center">
                      <span className="font-bold text-blue-800 text-xl">{typeTotal}</span> <span className="text-sm text-blue-600">名</span>
                    </td>
                  );
                })}
              </tr>
              {dates.map(date => {
                const dayOfWeek = getDayOfWeek(date);
                const isWeekend = dayOfWeek === '土';
                const isSunday = dayOfWeek === '日';
                const isHol = isHoliday(date);
                const isRestDay = isSunday || isHol;
                const dateBgClass = isRestDay ? 'bg-red-50' : isWeekend ? 'bg-blue-50' : 'bg-gray-50';
                const dateTextClass = isRestDay ? 'text-red-700' : isWeekend ? 'text-blue-700' : 'text-gray-900';
                const dayTextClass = isRestDay ? 'text-red-500' : isWeekend ? 'text-blue-500' : 'text-gray-500';

                // 日付全体で1つでもオーダーがあるか判定
                const hasAnyOrderThisDay = BUSINESS_TYPES.some(type => (orders[date]?.[selectedShopId]?.[type] || 0) > 0);
                const rowBgClass = hasAnyOrderThisDay ? 'bg-amber-50/20 hover:bg-amber-50/60' : 'hover:bg-gray-50 transition-colors';

                return (
                  <tr key={date} className={rowBgClass}>
                    <td className={`px-2 py-2 whitespace-nowrap text-sm font-bold border-r border-gray-200 text-center w-20 leading-tight ${dateBgClass} ${dateTextClass}`}>
                      {date}日<br/>
                      <span className={`text-[10px] ${dayTextClass}`}>
                        ({isHol ? '祝' : dayOfWeek})
                      </span>
                    </td>
                    {BUSINESS_TYPES.map(type => {
                      const dbCount = orders[date]?.[effectiveShopId]?.[type] || 0;
                      const draftKey = `${date}_${effectiveShopId}_${type}`;
                      const count = draftCounts[draftKey] !== undefined ? draftCounts[draftKey] : dbCount;
                      const cellBgClass = count > 0 ? 'bg-amber-50/80' : 'bg-transparent';
                      
                      return (
                        <td key={type} className={`px-2 py-2 border-r border-gray-200 w-1/4 transition-colors ${cellBgClass}`}>
                          {isReadOnly ? (
                            <div className="flex items-center justify-center h-7">
                              <span className={`text-xl font-bold text-center ${count > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                                {count > 0 ? count : '-'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <button 
                                onClick={() => handleMinus(date, effectiveShopId, type, count)}
                                className={`w-7 h-7 rounded shadow-sm transition-colors flex items-center justify-center border ${count > 0 ? 'bg-white text-red-500 hover:bg-red-50 border-red-200' : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed shadow-none'}`}
                                disabled={count <= 0}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-xl font-bold w-6 text-center text-gray-800 select-none">
                                {count}
                              </span>
                              <button 
                                onClick={() => handlePlus(date, effectiveShopId, type, count)}
                                className="w-7 h-7 rounded shadow-sm border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
                              >
                                <Plus size={14} />
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
