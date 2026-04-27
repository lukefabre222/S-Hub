import React, { useState, useMemo } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { FileBarChart, Users as UsersIcon, Store, Calculator, LineChart, Calendar } from 'lucide-react';

export default function ReportDashboard() {
  const { dates, staffs, shops, assignments, reports, reportItems, currentUser } = useShiftStore();
  const isShopAdmin = currentUser?.role === 'shop_admin';
  const [viewMode, setViewMode] = useState('staff'); // 'staff' | 'shop'
  const [selectedMonth, setSelectedMonth] = useState('2026-04');

  const calcStats = (type, entityId) => {
    let totals = reportItems.reduce((acc, item) => ({ ...acc, [item]: 0 }), {});
    let reportedDaysCount = 0; 
    let assignedDaysCount = 0;

    dates.forEach(date => {
      Object.keys(assignments[date] || {}).forEach(staffId => {
        const asgn = assignments[date][staffId];
        
        if (type === 'staff' && staffId !== entityId) return;
        if (type === 'shop' && asgn.shopId !== entityId) return;
        if (isShopAdmin && asgn.shopId !== currentUser.shopId) return; // 店舗管理者は自店舗のみ集計

        assignedDaysCount++;

        const report = reports[date]?.[staffId];
        if (report && report.items) {
          reportedDaysCount++;
          reportItems.forEach(item => {
            totals[item] += (report.items[item] || 0);
          });
        }
      });
    });

    const averages = {};
    reportItems.forEach(item => {
      averages[item] = reportedDaysCount > 0 ? (totals[item] / reportedDaysCount).toFixed(1) : '0.0';
    });

    return { totals, averages, reportedDaysCount, assignedDaysCount };
  };

  const displayShops = isShopAdmin ? shops.filter(s => s.id === currentUser.shopId) : shops;
  const displayStaffs = isShopAdmin 
    ? staffs.filter(staff => dates.some(date => assignments[date]?.[staff.id]?.shopId === currentUser.shopId))
    : staffs;

  const entities = viewMode === 'staff' ? displayStaffs : displayShops;

  // 全体合計・平均を計算する
  const grandStats = useMemo(() => {
    const acc = {
      reportedDaysCount: 0,
      assignedDaysCount: 0,
      totals: reportItems.reduce((a, i) => ({ ...a, [i]: 0 }), {})
    };
    entities.forEach(entity => {
      const stats = calcStats(viewMode, entity.id);
      acc.reportedDaysCount += stats.reportedDaysCount;
      acc.assignedDaysCount += stats.assignedDaysCount;
      reportItems.forEach(item => {
        acc.totals[item] += stats.totals[item];
      });
    });
    
    acc.averages = {};
    reportItems.forEach(item => {
      acc.averages[item] = acc.reportedDaysCount > 0 ? (acc.totals[item] / acc.reportedDaysCount).toFixed(1) : '0.0';
    });
    return acc;
  }, [entities, viewMode, assignments, reports, reportItems]);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-4 w-full">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center mr-6">
              <FileBarChart className="mr-3 text-purple-600" />
              獲得実績 集計
            </h2>
            
            {/* 年月選択 (モック) */}
            <div className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-1.5 shadow-sm">
              <Calendar size={18} className="text-gray-500 mr-2" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-gray-700 font-bold outline-none text-sm cursor-pointer"
              >
                <option value="2026-03">2026年3月度</option>
                <option value="2026-04">2026年4月度</option>
                <option value="2026-05">2026年5月度</option>
              </select>
            </div>
          </div>

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
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
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
                   {reportItems.map(item => (
                     <th key={item} colSpan={2} className="px-1 py-1 border-r border-gray-200 text-center text-[11px] font-bold text-purple-800 bg-purple-50 shrink-0 min-w-[70px]">
                       {item}
                     </th>
                   ))}
                 </tr>
                 <tr>
                   {reportItems.map(item => (
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
                       {reportItems.map(item => (
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
                    {reportItems.map(item => {
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
               </tbody>
             </table>
           </div>
        </div>

      </div>
    </div>
  );
}
