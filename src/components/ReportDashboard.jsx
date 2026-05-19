import React, { useState, useMemo } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { FileBarChart, Users as UsersIcon, Store, Calculator, LineChart, Calendar, Trophy, Eye, EyeOff, ListFilter, ChevronDown, ChevronUp } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const CustomRadarTick = ({ payload, x, y, cx, cy, ...rest }) => {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // 中心からの垂直軸（12時・6時の方向）に対する角度（0〜90度）を計算
  let extraVertical = 0;
  if (dist > 0) {
    const angleFromVertical = Math.acos(Math.abs(dy) / dist) * (180 / Math.PI);
    
    // 指定された角度（時計の針）に応じた距離を計算（線形補間）
    if (angleFromVertical <= 15) { // 12:00(0度) ~ 12:30(15度)
      extraVertical = 15 - ((15 - 10) * (angleFromVertical / 15));
    } else if (angleFromVertical <= 30) { // 12:30(15度) ~ 1:00(30度)
      extraVertical = 10 - ((10 - 7) * ((angleFromVertical - 15) / 15));
    } else if (angleFromVertical <= 45) { // 1:00(30度) ~ 1:30(45度)
      extraVertical = 7 - ((7 - 5) * ((angleFromVertical - 30) / 15));
    } else { // 1:30(45度) ~ 3:00(90度)
      // 45度以降は5pxから0pxへ緩やかに減少
      extraVertical = 5 - ((5 - 0) * ((angleFromVertical - 45) / 45));
    }
  }
  
  // Rechartsが計算したデフォルト位置(x, y)に対して、Y軸方向のみ追加でずらす
  const newY = y + (dy > 0 ? extraVertical : -extraVertical);

  return (
    <text 
      {...rest} 
      x={x} 
      y={newY} 
      fill="#4b5563" 
      fontSize={10} 
      fontWeight="bold" 
    >
      {payload.value}
    </text>
  );
};

export default function ReportDashboard({ effectiveTargetCompanyId }) {
  const { dates, staffs, shops, assignments, reports, reportItems, currentUser, partnerships } = useShiftStore();
  const isShopAdmin = currentUser?.role === 'shop_admin';
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const [viewMode, setViewMode] = useState('staff'); // 'staff' | 'shop' | 'ranking'
  const [showRadarChart, setShowRadarChart] = useState(true);
  const [selectedRadarItems, setSelectedRadarItems] = useState(null); // null = 全選択
  const [showItemFilter, setShowItemFilter] = useState(false);

  const toggleRadarItem = (item) => {
    const current = selectedRadarItems ?? new Set(activeReportItems);
    const next = new Set(current);
    if (next.has(item)) {
      if (next.size <= 1) return; // 最低1つは選択必須
      next.delete(item);
    } else {
      next.add(item);
    }
    setSelectedRadarItems(next.size === activeReportItems.length ? null : next);
  };

  const activeReportItems = useMemo(() => {
    const items = reportItems.filter(item => !item.companyId || item.companyId === effectiveTargetCompanyId).map(i => i.name);
    return Array.from(new Set(items));
  }, [reportItems, effectiveTargetCompanyId]);

  const calcStats = (type, entityId, isSystemScope = false) => {
    let totals = activeReportItems.reduce((acc, item) => ({ ...acc, [item]: 0 }), {});
    let reportedDaysCount = 0; 
    let assignedDaysCount = 0;

    dates.forEach(date => {
      Object.keys(assignments[date] || {}).forEach(staffId => {
        const asgn = assignments[date][staffId];
        
        if (type === 'staff' && staffId !== entityId) return;
        if (type === 'shop' && asgn.shopId !== entityId) return;
        
        if (!isSystemScope) {
          if (isShopAdmin && asgn.shopId !== currentUser.shopId) return; // 店舗管理者は自店舗のみ集計
          if (isCompanyAdmin) {
             const staffObj = staffs.find(s => s.id === staffId);
             if (!staffObj || staffObj.companyId !== currentUser.companyId) return; // 企業管理者は自社スタッフのみ集計
          }
        }

        assignedDaysCount++;

        const report = reports[date]?.[staffId];
        if (report && report.items) {
          reportedDaysCount++;
          activeReportItems.forEach(item => {
            totals[item] += (report.items[item] || 0);
          });
        }
      });
    });

    const averages = {};
    activeReportItems.forEach(item => {
      averages[item] = reportedDaysCount > 0 ? (totals[item] / reportedDaysCount).toFixed(1) : '0.0';
    });

    return { totals, averages, reportedDaysCount, assignedDaysCount };
  };

  const displayShops = isShopAdmin 
    ? shops.filter(s => s.id === currentUser.shopId) 
    : isCompanyAdmin 
      ? shops.filter(s => partnerships.some(p => p.shop_id === s.id && p.company_id === currentUser.companyId && p.shop_approved && p.company_approved))
      : shops;
      
  const displayStaffs = isShopAdmin 
    ? staffs.filter(staff => dates.some(date => assignments[date]?.[staff.id]?.shopId === currentUser.shopId))
    : isCompanyAdmin
      ? staffs.filter(staff => staff.companyId === currentUser.companyId)
      : staffs;

  const entities = viewMode === 'staff' ? displayStaffs : displayShops;

  // 全体合計・平均を計算する
  const grandStats = useMemo(() => {
    const acc = {
      reportedDaysCount: 0,
      assignedDaysCount: 0,
      totals: activeReportItems.reduce((a, i) => ({ ...a, [i]: 0 }), {})
    };
    entities.forEach(entity => {
      const stats = calcStats(viewMode, entity.id);
      acc.reportedDaysCount += stats.reportedDaysCount;
      acc.assignedDaysCount += stats.assignedDaysCount;
      activeReportItems.forEach(item => {
        acc.totals[item] += stats.totals[item];
      });
    });
    
    acc.averages = {};
    activeReportItems.forEach(item => {
      acc.averages[item] = acc.reportedDaysCount > 0 ? (acc.totals[item] / acc.reportedDaysCount).toFixed(1) : '0.0';
    });
    return acc;
  }, [entities, viewMode, assignments, reports, activeReportItems]);

  // システム全体合計・平均を計算する
  const systemStats = useMemo(() => {
    const acc = {
      reportedDaysCount: 0,
      assignedDaysCount: 0,
      totals: activeReportItems.reduce((a, i) => ({ ...a, [i]: 0 }), {})
    };
    staffs.forEach(staff => {
      const stats = calcStats('staff', staff.id, true);
      acc.reportedDaysCount += stats.reportedDaysCount;
      acc.assignedDaysCount += stats.assignedDaysCount;
      activeReportItems.forEach(item => {
        acc.totals[item] += stats.totals[item];
      });
    });
    
    acc.averages = {};
    activeReportItems.forEach(item => {
      acc.averages[item] = acc.reportedDaysCount > 0 ? (acc.totals[item] / acc.reportedDaysCount).toFixed(1) : '0.0';
    });
    return acc;
  }, [staffs, assignments, reports, activeReportItems]);

  const radarData = useMemo(() => {
    if (!isCompanyAdmin || viewMode !== 'staff') return [];
    return activeReportItems.map(item => ({
      subject: item,
      自社平均: parseFloat(grandStats.averages[item]) || 0,
      全体平均: parseFloat(systemStats.averages[item]) || 0,
    }));
  }, [activeReportItems, grandStats, systemStats, isCompanyAdmin, viewMode]);

  const filteredRadarData = useMemo(() => {
    if (!selectedRadarItems) return radarData;
    return radarData.filter(d => selectedRadarItems.has(d.subject));
  }, [radarData, selectedRadarItems]);

  const radarMax = useMemo(() => {
    if (filteredRadarData.length === 0) return 10;
    const vals = filteredRadarData.flatMap(d => [d['自社平均'], d['全体平均']]).filter(v => v > 0);
    if (vals.length === 0) return 10;
    return Math.ceil(Math.max(...vals) * 1.3);
  }, [filteredRadarData]);

  const rankingData = useMemo(() => {
    if (viewMode !== 'ranking') return {};
    
    const staffStatsList = staffs.map(staff => {
      const stats = calcStats('staff', staff.id, true);
      return { staff, stats };
    });

    const result = {};
    activeReportItems.forEach(item => {
      const validStaffs = staffStatsList.filter(s => s.stats.totals[item] > 0);
      const sorted = validStaffs.sort((a, b) => b.stats.totals[item] - a.stats.totals[item]).slice(0, 5);
      
      result[item] = sorted.map(s => {
        const isOwnCompany = s.staff.companyId === currentUser.companyId;
        return {
          id: s.staff.id,
          name: isOwnCompany ? s.staff.name : '*****',
          isOwnCompany,
          total: s.stats.totals[item]
        };
      });
    });
    
    return result;
  }, [staffs, viewMode, currentUser, activeReportItems, assignments, reports]);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-4 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center mr-6">
              <FileBarChart className="mr-3 text-purple-600" />
              獲得実績 集計
            </h2>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            {isCompanyAdmin && viewMode === 'staff' && radarData.length > 0 && (
              <button 
                onClick={() => setShowRadarChart(!showRadarChart)}
                className="px-3 py-1.5 text-sm font-bold rounded-lg flex items-center transition bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 shadow-sm"
              >
                {showRadarChart ? (
                  <><EyeOff size={16} className="mr-1.5" /> チャートを隠す</>
                ) : (
                  <><Eye size={16} className="mr-1.5" /> チャートを表示</>
                )}
              </button>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex">
              <button 
                onClick={() => setViewMode('staff')}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition ${viewMode === 'staff' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <UsersIcon size={16} className="mr-2" />
                スタッフ別
              </button>
              <button 
                onClick={() => setViewMode('shop')}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition ${viewMode === 'shop' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Store size={16} className="mr-2" />
                店舗別
              </button>
              <button 
                onClick={() => setViewMode('ranking')}
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition ${viewMode === 'ranking' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Trophy size={16} className="mr-2" />
                ランキング
              </button>
            </div>
          </div>
        </div>
        {viewMode === 'ranking' && (
          <div className="flex flex-wrap gap-6 pb-8">
            {activeReportItems.map(item => (
              <div key={item} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex-1 min-w-[300px]">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">{item}</h3>
                <div className="space-y-3">
                  {rankingData[item]?.map((entry, idx) => (
                    <div key={`${item}-${entry.id}`} className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                        idx === 1 ? 'bg-gray-200 text-gray-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className={`flex-1 font-bold text-base truncate ${entry.isOwnCompany ? 'text-gray-800' : 'text-gray-400'}`}>
                        {entry.name}
                      </div>
                      <div className="font-mono font-bold text-xl text-purple-600">
                        {entry.total}
                      </div>
                    </div>
                  ))}
                  {(!rankingData[item] || rankingData[item].length === 0) && (
                    <div className="text-sm text-gray-400 text-center py-4">実績データがありません</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode !== 'ranking' && (
          <div className="flex flex-col xl:flex-row gap-6 mb-8 items-start">
            
            {/* レーダーチャート (左側) */}
            {isCompanyAdmin && viewMode === 'staff' && radarData.length > 0 && showRadarChart && (
              <div className="w-full xl:w-1/3 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
                {/* カードヘッダー */}
                <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-700 flex items-center text-sm">
                      <LineChart size={16} className="mr-1.5 text-purple-600" />
                      平均比較レーダーチャート
                    </h3>
                    <button
                      onClick={() => setShowItemFilter(v => !v)}
                      className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${showItemFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}
                    >
                      <ListFilter size={13} />
                      表示項目選択
                      {showItemFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">外側に広がるほど実績が高いことを示します</p>

                  {/* アコーディオン */}
                  {showItemFilter && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-500">表示する項目を選択</span>
                        <button
                          onClick={() => setSelectedRadarItems(null)}
                          className="text-[10px] text-blue-500 hover:underline font-medium"
                        >
                          すべて選択
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeReportItems.map(item => {
                          const checked = !selectedRadarItems || selectedRadarItems.has(item);
                          return (
                            <label key={item} className={`flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none px-2 py-1 rounded-md border transition-colors ${checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRadarItem(item)}
                                className="accent-blue-600 w-3 h-3"
                              />
                              {item}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* チャート本体 */}
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={460}>
                    <RadarChart cx="50%" cy="50%" outerRadius="60%" data={filteredRadarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={<CustomRadarTick />} />
                      <PolarRadiusAxis angle={30} domain={[0, radarMax]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Radar name="自社平均" dataKey="自社平均" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.35} />
                      <Radar name="全体平均" dataKey="全体平均" stroke="#dc2626" fill="#ef4444" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* テーブル (右側) */}
            <div className={`w-full ${isCompanyAdmin && viewMode === 'staff' && radarData.length > 0 && showRadarChart ? 'xl:w-2/3' : 'flex-1'} bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}>
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200 text-sm">
               <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                 <tr>
                   <th rowSpan={2} className="px-3 py-2 border-r border-gray-200 text-left text-xs font-bold text-gray-700 align-bottom whitespace-nowrap min-w-[100px]">
                     {viewMode === 'staff' ? 'スタッフ名' : '店舗名'}
                   </th>
                   <th rowSpan={2} className="px-2 py-2 border-r border-gray-200 text-center text-xs font-bold text-gray-700 align-bottom whitespace-nowrap">
                     報告済/稼働
                   </th>
                   {activeReportItems.map(item => (
                     <th key={item} colSpan={2} className="px-1 py-1 border-r border-gray-200 text-center text-[11px] font-bold text-purple-800 bg-purple-50 shrink-0 min-w-[70px]">
                       {item}
                     </th>
                   ))}
                 </tr>
                 <tr>
                   {activeReportItems.map(item => (
                     <React.Fragment key={`${item}-sub`}>
                       <th className="px-1 py-1 border-r border-gray-200 border-t border-purple-100 bg-purple-50/50 text-center text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                         <div className="flex items-center justify-center"><Calculator size={10} className="mr-0.5 text-purple-400" />合計</div>
                       </th>
                       <th className="px-1 py-1 border-r border-gray-200 border-t border-purple-100 bg-purple-50/50 text-center text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                         <div className="flex items-center justify-center"><LineChart size={10} className="mr-0.5 text-purple-400" />平均/日</div>
                       </th>
                     </React.Fragment>
                   ))}
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {entities.map(entity => {
                   const stats = calcStats(viewMode, entity.id);
                   const isZero = stats.reportedDaysCount === 0;

                   return (
                     <tr key={entity.id} className="hover:bg-purple-50 transition-colors">
                       <td className="px-3 py-2 border-r border-gray-200 text-xs font-bold text-gray-800 whitespace-nowrap">
                         {entity.name}
                       </td>
                       <td className="px-2 py-2 border-r border-gray-200 text-xs text-center whitespace-nowrap">
                         <span className="font-mono font-bold text-blue-600">{stats.reportedDaysCount}</span>
                         <span className="text-[10px] text-gray-500 mx-0.5">/</span>
                         <span className="font-mono text-gray-600">{stats.assignedDaysCount}</span>
                         <span className="text-[10px] text-gray-400 ml-0.5">日</span>
                       </td>
                       {activeReportItems.map(item => (
                         <React.Fragment key={`${item}-val`}>
                           <td className={`px-1 py-2 border-r border-gray-100 text-center text-xs font-mono font-bold ${isZero ? 'text-gray-300' : 'text-gray-900'}`}>
                             {stats.totals[item]}
                           </td>
                           <td className={`px-1 py-2 border-r border-gray-200 text-center text-xs font-mono ${isZero ? 'text-gray-300' : 'text-purple-600'}`}>
                             {stats.averages[item]}
                           </td>
                         </React.Fragment>
                       ))}
                     </tr>
                   );
                 })}
                 
                 {/* Footer - Grand Total */}
                 <tr className="bg-purple-50/60 border-t-[3px] border-purple-200">
                    <td className="px-3 py-3 border-r border-purple-200 text-xs font-extrabold text-purple-900 whitespace-nowrap">
                      【総合計】
                    </td>
                    <td className="px-2 py-3 border-r border-purple-200 text-xs text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-purple-700">{grandStats.reportedDaysCount}</span>
                      <span className="text-[10px] text-purple-600 mx-0.5">/</span>
                      <span className="font-mono text-gray-700">{grandStats.assignedDaysCount}</span>
                      <span className="text-[10px] text-purple-500 ml-0.5">日</span>
                    </td>
                    {activeReportItems.map(item => {
                       const isZero = grandStats.reportedDaysCount === 0;
                       return (
                         <React.Fragment key={`${item}-grand`}>
                           <td className={`px-1 py-3 border-r border-purple-100 text-center text-xs font-mono font-extrabold ${isZero ? 'text-gray-400' : 'text-purple-900'}`}>
                             {grandStats.totals[item]}
                           </td>
                           <td className={`px-1 py-3 border-r border-purple-200 text-center text-xs font-mono font-bold ${isZero ? 'text-gray-400' : 'text-purple-700'}`}>
                             {grandStats.averages[item]}
                           </td>
                         </React.Fragment>
                       );
                    })}
                 </tr>

                 {/* Footer - System Total */}
                 {isCompanyAdmin && viewMode === 'staff' && (
                   <tr className="bg-gray-100/80 border-t-[3px] border-gray-300">
                      <td className="px-3 py-3 border-r border-gray-300 text-xs font-extrabold text-gray-700 whitespace-nowrap">
                        【システム全体】
                      </td>
                      <td className="px-2 py-3 border-r border-gray-300 text-xs text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-gray-600">{systemStats.reportedDaysCount}</span>
                        <span className="text-[10px] text-gray-500 mx-0.5">/</span>
                        <span className="font-mono text-gray-500">{systemStats.assignedDaysCount}</span>
                        <span className="text-[10px] text-gray-400 ml-0.5">日</span>
                      </td>
                      {activeReportItems.map(item => {
                         const isZero = systemStats.reportedDaysCount === 0;
                         return (
                           <React.Fragment key={`${item}-sys`}>
                             <td className={`px-1 py-3 border-r border-gray-200 text-center text-xs font-mono font-bold ${isZero ? 'text-gray-400' : 'text-gray-700'}`}>
                               {systemStats.totals[item]}
                             </td>
                             <td className={`px-1 py-3 border-r border-gray-300 text-center text-xs font-mono font-bold ${isZero ? 'text-gray-400' : 'text-gray-600'}`}>
                               {systemStats.averages[item]}
                             </td>
                           </React.Fragment>
                         );
                      })}
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
