import React, { useState, useMemo } from 'react';
import { useShiftStore, getDayOfWeek } from '../store/useShiftStore';
import { Smartphone, ChevronRight, ChevronLeft, Save, CheckCircle2, AlertCircle, Calendar as CalendarIconLucide, List, Clock, Trophy, LogIn, LogOut, Bell, MessageCircle, ClipboardList } from 'lucide-react';
import Icon from '../assets/S-Hub_icon.png';

function timeAgoStaff(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export default function StaffPortal({ isPreview = false }) {
  const { staffs, dates, assignments, shops, reportItems, reports, saveReport, currentUser, logout, targetYearMonth, setTargetYearMonth, notifications, markNotificationAsRead } = useShiftStore();
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' | 'report' | 'ranking'
  const [shiftViewMode, setShiftViewMode] = useState('list'); // 'list' | 'calendar'

  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({});

  const selectedStaffId = currentUser?.id;
  const currentStaff = staffs.find(s => s.id === selectedStaffId) || currentUser;

  const activeReportItems = useMemo(() => {
    const items = reportItems.filter(item => !item.companyId || item.companyId === currentStaff?.companyId).map(i => i.name);
    return Array.from(new Set(items));
  }, [reportItems, currentStaff]);

  // Get shifts for selected staff
  const staffShifts = selectedStaffId ? dates.map(day => {
    const asgn = assignments[day]?.[selectedStaffId];
    if (!asgn || asgn.status === 'draft') return null;
    const shop = shops.find(s => s.id === asgn.shopId);
    const reportData = reports[day]?.[selectedStaffId];
    const dateStr = `${targetYearMonth}-${String(day).padStart(2, '0')}`;
    return {
      day,
      dateStr,
      shop,
      businessType: asgn.businessType,
      isReported: reportData?.status === 'submitted',
      reportData: reportData
    };
  }).filter(Boolean) : [];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayShift = staffShifts.find(s => s.dateStr === todayStr);

  const openReportForm = (shift) => {
    setSelectedDate(shift.day);
    const existingItems = shift.reportData?.items || {};
    const initialForm = activeReportItems.reduce((acc, item) => {
      acc[item] = existingItems[item] || 0;
      return acc;
    }, {});
    setFormData(initialForm);
  };

  const handleClockAction = async (shift, action) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const existingItems = shift.reportData?.items || {};

    let newStatus = shift.reportData?.status || 'draft';
    let newItems = { ...existingItems };

    if (action === 'clock_in') {
      newStatus = 'clocked_in';
      newItems.clock_in_time = timeStr;
    } else if (action === 'clock_out') {
      newStatus = 'clocked_out';
      newItems.clock_out_time = timeStr;
    }

    try {
      await saveReport(shift.day, selectedStaffId, shift.shop.id, { items: newItems, status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReport = async () => {
    const shift = staffShifts.find(s => s.day === selectedDate);
    // keep clock_in/out times if they exist
    const finalItems = { ...(shift.reportData?.items || {}), ...formData };

    try {
      await saveReport(selectedDate, selectedStaffId, shift.shop.id, { items: finalItems, status: 'submitted' });
      setSelectedDate(null);
      alert('実績報告が完了しました！');
    } catch (e) {
      console.error(e);
    }
  };

  const updateItemValue = (item, val) => {
    setFormData(prev => ({ ...prev, [item]: Math.max(0, parseInt(val) || 0) }));
  };

  // Ranking data logic
  const rankingData = useMemo(() => {
    if (!currentStaff?.companyId) return {};

    // 自身と同じ企業のスタッフを取得
    const companyStaffs = staffs.filter(s => s.companyId === currentStaff.companyId);

    // 各項目ごとに、スタッフ別の合計を計算
    const totals = {};
    activeReportItems.forEach(item => {
      totals[item] = companyStaffs.map(staff => {
        let sum = 0;
        dates.forEach(d => {
          if (reports[d]?.[staff.id]?.status === 'submitted') {
            sum += (reports[d][staff.id].items?.[item] || 0);
          }
        });
        return { staff, sum };
      }).sort((a, b) => b.sum - a.sum).slice(0, 3); // Top 3
    });
    return totals;
  }, [reports, staffs, currentStaff, reportItems, dates, activeReportItems]);

  const renderShiftsList = () => (
    <div className="space-y-3">
      {staffShifts.map(shift => (
        <div
          key={shift.day}
          onClick={() => {
            // 過去日や任意の日付をクリックした場合は無条件で報告フォーム（既存の挙動）
            setActiveTab('report');
            openReportForm(shift);
          }}
          className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:scale-[0.98] transition-transform group flex items-center relative overflow-hidden"
        >
          <div className="mr-4 flex flex-col items-center justify-center min-w-[2.5rem]">
            <div className="text-[10px] text-gray-400 font-bold">{getDayOfWeek(targetYearMonth, shift.day)}</div>
            <div className="text-2xl font-black font-mono leading-none text-gray-800">{shift.day}</div>
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-800 text-base leading-tight mb-1">{shift.shop?.name}</div>
            <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 inline-flex px-2 py-0.5 rounded-full border border-indigo-100">
              {shift.businessType}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center ml-2">
            {shift.isReported ? (
              <div className="bg-green-50 p-1.5 rounded-full mb-0.5">
                <CheckCircle2 size={20} className="text-green-500" />
              </div>
            ) : (
              <div className="bg-amber-50 p-1.5 rounded-full mb-0.5">
                <AlertCircle size={20} className="text-amber-500" />
              </div>
            )}
            <span className={`text-[9px] font-extrabold ${shift.isReported ? 'text-green-600' : 'text-amber-600'}`}>
              {shift.isReported ? '報告済' : '未報告'}
            </span>
          </div>
          <ChevronRight size={16} className="text-gray-300 ml-1" />
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${shift.isReported ? 'bg-green-500' : 'bg-transparent'}`}></div>
        </div>
      ))}
    </div>
  );

  const renderShiftsCalendar = () => {
    if (!targetYearMonth) return null;
    const [year, month] = targetYearMonth.split('-').map(Number);
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0(Sun) - 6(Sat)
    const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
    const days = dates;

    return (
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="text-[10px] font-bold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map(b => <div key={`blank-${b}`} className="col-span-1"></div>)}
          {days.map(d => {
            const dateStr = `${targetYearMonth}-${String(d).padStart(2, '0')}`;
            const shift = staffShifts.find(s => s.dateStr === dateStr);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={d}
                onClick={() => {
                  if (shift) {
                    setActiveTab('report');
                    openReportForm(shift);
                  }
                }}
                className={`aspect-square rounded-lg flex flex-col items-center justify-start p-1 relative border ${shift ? 'cursor-pointer hover:border-indigo-300 border-indigo-100 bg-indigo-50/30' : 'border-transparent'} ${isToday ? 'ring-2 ring-indigo-400' : ''}`}
              >
                <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>{d}</span>
                {shift && (
                  <>
                    <div className="text-[8px] leading-tight text-center mt-0.5 text-gray-700 font-bold line-clamp-2 truncate w-full px-0.5">
                      {shift.shop?.name}
                    </div>
                    {shift.isReported && (
                      <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderReportTab = () => {
    // 選択された日付（過去の報告など）があればそちらを優先、なければ今日
    const shift = selectedDate ? staffShifts.find(s => s.day === selectedDate) : todayShift;

    if (!shift) {
      return (
        <div className="text-center text-gray-400 mt-12 bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-sm">
          本日の出勤予定はありません
        </div>
      );
    }

    const status = shift.reportData?.status || 'draft';
    const clockIn = shift.reportData?.items?.clock_in_time;
    const clockOut = shift.reportData?.items?.clock_out_time;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="text-xs font-bold text-gray-400 mb-1">{shift.dateStr} ({getDayOfWeek(targetYearMonth, shift.day)})</div>
          <h2 className="text-xl font-extrabold text-gray-800 mb-2">{shift.shop?.name}</h2>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">{shift.businessType}</span>

          {(clockIn || clockOut) && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-around text-sm">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 font-bold">出勤時間</div>
                <div className="font-mono font-bold text-gray-700">{clockIn || '--:--'}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 font-bold">退勤時間</div>
                <div className="font-mono font-bold text-gray-700">{clockOut || '--:--'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Status based UI */}
        {status === 'draft' && (
          <button
            onClick={() => handleClockAction(shift, 'clock_in')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-4 rounded-2xl shadow-lg transition active:scale-95 flex items-center justify-center text-xl mb-4"
          >
            <LogIn size={28} className="mr-3" /> 出勤する
          </button>
        )}

        {status === 'clocked_in' && (
          <button
            onClick={() => handleClockAction(shift, 'clock_out')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-6 px-4 rounded-2xl shadow-lg transition active:scale-95 flex items-center justify-center text-xl mb-4"
          >
            <LogOut size={28} className="mr-3" /> 退勤する
          </button>
        )}

        {(status === 'clocked_out' || selectedDate) && status !== 'submitted' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 mt-4">
            <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center w-full">実績項目入力</span>
            </div>
            <div className="divide-y divide-gray-100">
              {activeReportItems.map(item => (
                <div key={item} className="p-4 flex items-center justify-between">
                  <label className="font-bold text-gray-700 flex-1 text-sm">{item}</label>
                  <div className="flex items-center space-x-1 bg-gray-50 rounded-xl p-1 border border-gray-200">
                    <button
                      onClick={() => updateItemValue(item, (formData[item] || 0) - 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg font-bold text-gray-500 text-xl active:bg-gray-200 transition-colors bg-white shadow-sm"
                    >-</button>
                    <input
                      type="number"
                      value={formData[item] || 0}
                      readOnly
                      className="w-10 h-10 text-center font-bold text-xl bg-transparent outline-none text-indigo-700"
                    />
                    <button
                      onClick={() => updateItemValue(item, (formData[item] || 0) + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg font-bold text-gray-500 text-xl active:bg-gray-200 transition-colors bg-white shadow-sm"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'submitted' && (
          <div className="text-center bg-green-50 text-green-700 p-6 rounded-2xl font-bold flex flex-col items-center border border-green-200">
            <CheckCircle2 size={40} className="mb-2 text-green-500" />
            本日の業務報告は完了しました
          </div>
        )}

      </div>
    );
  };

  const [reportViewMode, setReportViewMode] = useState('staff'); // 'staff' | 'shop'

  const renderRankingTab = () => {
    // 自身と同じ企業のスタッフ
    const companyStaffs = staffs.filter(s => s.companyId === currentStaff?.companyId);

    // 自社スタッフがアサインまたは報告している店舗のリスト
    const companyShopIds = new Set();
    dates.forEach(d => {
      companyStaffs.forEach(staff => {
        const asgn = assignments[d]?.[staff.id];
        if (asgn && asgn.shopId) companyShopIds.add(asgn.shopId);

        const report = reports[d]?.[staff.id];
        if (report && report.shopId) companyShopIds.add(report.shopId);
      });
    });
    const companyShops = shops.filter(s => companyShopIds.has(s.id));

    const calcStats = (type, entityId) => {
      let totals = activeReportItems.reduce((acc, item) => ({ ...acc, [item]: 0 }), {});
      let reportedDaysCount = 0;
      let assignedDaysCount = 0;

      dates.forEach(d => {
        companyStaffs.forEach(staff => {
          const asgn = assignments[d]?.[staff.id];
          const report = reports[d]?.[staff.id];

          if (!asgn && (!report || report.status !== 'submitted')) return;

          const targetShopId = asgn?.shopId || report?.shopId;

          if (type === 'staff' && staff.id !== entityId) return;
          if (type === 'shop' && targetShopId !== entityId) return;

          if (asgn) assignedDaysCount++;

          if (report && report.status === 'submitted' && report.items) {
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

    const entities = reportViewMode === 'staff' ? companyStaffs : companyShops;

    // 全体合計
    const grandStats = {
      reportedDaysCount: 0,
      assignedDaysCount: 0,
      totals: activeReportItems.reduce((a, i) => ({ ...a, [i]: 0 }), {})
    };
    entities.forEach(entity => {
      const stats = calcStats(reportViewMode, entity.id);
      grandStats.reportedDaysCount += stats.reportedDaysCount;
      grandStats.assignedDaysCount += stats.assignedDaysCount;
      activeReportItems.forEach(item => {
        grandStats.totals[item] += stats.totals[item];
      });
    });
    grandStats.averages = {};
    activeReportItems.forEach(item => {
      grandStats.averages[item] = grandStats.reportedDaysCount > 0 ? (grandStats.totals[item] / grandStats.reportedDaysCount).toFixed(1) : '0.0';
    });

    return (
      <div className="animate-in fade-in pb-10 space-y-6">

        {/* 全体集計表 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="text-gray-600 font-bold text-xs flex items-center">
              社内全体実績
            </h3>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button
                onClick={() => setReportViewMode('staff')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${reportViewMode === 'staff' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                個人別
              </button>
              <button
                onClick={() => setReportViewMode('shop')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${reportViewMode === 'shop' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                店舗別
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-[10px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th rowSpan={2} className="px-2 py-1 border-r border-gray-200 text-left font-bold text-gray-700 whitespace-nowrap min-w-[70px]">
                    {reportViewMode === 'staff' ? 'スタッフ名' : '店舗名'}
                  </th>
                  {activeReportItems.map(item => (
                    <th key={item} colSpan={2} className="px-1 py-1 border-r border-gray-200 text-center font-bold text-indigo-800 bg-indigo-50 min-w-[50px]">
                      {item}
                    </th>
                  ))}
                </tr>
                <tr>
                  {activeReportItems.map(item => (
                    <React.Fragment key={`${item}-sub`}>
                      <th className="px-1 border-r border-gray-200 border-t border-indigo-100 bg-indigo-50/50 text-center font-semibold text-gray-600">合</th>
                      <th className="px-1 border-r border-gray-200 border-t border-indigo-100 bg-indigo-50/50 text-center font-semibold text-gray-600">平</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entities.map(entity => {
                  const stats = calcStats(reportViewMode, entity.id);
                  const isZero = stats.reportedDaysCount === 0;
                  return (
                    <tr key={entity.id} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-2 py-1.5 border-r border-gray-200 font-bold text-gray-800 whitespace-nowrap truncate max-w-[80px]">
                        {entity.name}
                      </td>
                      {activeReportItems.map(item => (
                        <React.Fragment key={`${item}-val`}>
                          <td className={`px-1 py-1.5 border-r border-gray-100 text-center font-mono font-bold ${isZero ? 'text-gray-300' : 'text-gray-900'}`}>
                            {stats.totals[item]}
                          </td>
                          <td className={`px-1 py-1.5 border-r border-gray-200 text-center font-mono ${isZero ? 'text-gray-300' : 'text-indigo-600'}`}>
                            {stats.averages[item]}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
                <tr className="bg-indigo-50/60 border-t-2 border-indigo-200">
                  <td className="px-2 py-2 border-r border-indigo-200 font-extrabold text-indigo-900 whitespace-nowrap">
                    合計
                  </td>
                  {activeReportItems.map(item => {
                    const isZero = grandStats.reportedDaysCount === 0;
                    return (
                      <React.Fragment key={`${item}-grand`}>
                        <td className={`px-1 py-2 border-r border-indigo-100 text-center font-mono font-extrabold ${isZero ? 'text-gray-400' : 'text-indigo-900'}`}>
                          {grandStats.totals[item]}
                        </td>
                        <td className={`px-1 py-2 border-r border-indigo-200 text-center font-mono font-bold ${isZero ? 'text-gray-400' : 'text-indigo-700'}`}>
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

        <h3 className="text-gray-500 font-bold text-xs flex items-center pt-2">
          <Trophy size={14} className="mr-1" /> 社内実績ランキング (今月)
        </h3>

        {activeReportItems.map(item => (
          <div key={item} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
            <h4 className="font-bold text-indigo-800 mb-4 border-b border-gray-100 pb-2">{item}</h4>
            <div className="space-y-3">
              {rankingData[item]?.map((entry, idx) => (
                <div key={entry.staff.id} className="flex items-center p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-200 text-gray-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                    }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 font-bold text-sm text-gray-800 truncate">
                    {entry.staff.name}
                  </div>
                  <div className="font-mono font-bold text-lg text-indigo-600">
                    {entry.sum}
                  </div>
                </div>
              ))}
              {(!rankingData[item] || rankingData[item].length === 0) && (
                <div className="text-xs text-gray-400 text-center py-2">実績データがありません</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className={`flex-1 flex justify-center overflow-hidden relative ${isPreview ? 'bg-[#f0f2f5] items-center p-4' : 'bg-gray-50 h-full w-full'}`}>
      <div className={`w-full bg-gray-50 flex flex-col relative overflow-hidden ${isPreview ? 'max-w-[375px] rounded-[2.5rem] shadow-2xl h-[700px] border-8 border-gray-800' : 'h-full'}`}>

        {/* iPhone Notch Mock */}
        {isPreview && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-50"></div>}

        {/* Header */}
        <div className="bg-slate-900 text-white pb-4 px-4 shrink-0 shadow-md relative z-10 flex flex-col space-y-2" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center space-x-2">
              <img src={Icon} alt="S-Hub Icon" className="w-10 h-10 object-contain" />
              <div className="font-bold text-base tracking-wide">{currentStaff.name} 様</div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="month"
                value={targetYearMonth || ''}
                onChange={(e) => {
                  if (e.target.value) setTargetYearMonth(e.target.value);
                }}
                className="text-[10px] font-bold text-gray-800 bg-white border-0 rounded px-2 py-1 shadow-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 relative" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 1rem)' }}>
          {activeTab === 'shifts' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-bold text-xs flex items-center">
                  <CalendarIconLucide size={14} className="mr-1" /> アサイン状況
                </h3>
                <div className="flex bg-gray-200 p-1 rounded-lg">
                  <button
                    onClick={() => setShiftViewMode('list')}
                    className={`p-1.5 rounded ${shiftViewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                  >
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => setShiftViewMode('calendar')}
                    className={`p-1.5 rounded ${shiftViewMode === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                  >
                    <CalendarIconLucide size={14} />
                  </button>
                </div>
              </div>

              {staffShifts.length === 0 ? (
                <div className="text-center text-gray-400 mt-12 bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-sm">
                  今月のアサインはありません
                </div>
              ) : (
                shiftViewMode === 'list' ? renderShiftsList() : renderShiftsCalendar()
              )}
            </div>
          )}

          {activeTab === 'report' && renderReportTab()}
          {activeTab === 'ranking' && renderRankingTab()}

          {activeTab === 'notifications' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-gray-500 font-bold text-xs flex items-center mb-4">
                <Bell size={14} className="mr-1" /> 通知
              </h3>
              {notifications.length === 0 ? (
                <div className="text-center text-gray-400 mt-12 bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-sm">
                  通知はありません
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
                  {notifications.map(notif => (
                    <div key={notif.id} className={`px-4 py-3 flex items-start gap-3 ${!notif.is_read ? 'bg-indigo-50/60' : ''}`}>
                      <div className="mt-0.5 shrink-0">
                        {notif.type === 'new_message' ? <MessageCircle size={16} className="text-indigo-500" />
                          : notif.type === 'assignment_published' ? <CheckCircle2 size={16} className="text-green-500" />
                          : <ClipboardList size={16} className="text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${!notif.is_read ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>{notif.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgoStaff(notif.created_at)}</p>
                      </div>
                      {!notif.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Report Action Button (Only in report tab when form is active) */}
        {activeTab === 'report' && (() => {
          const shift = selectedDate ? staffShifts.find(s => s.day === selectedDate) : todayShift;
          const status = shift?.reportData?.status || 'draft';
          if (shift && (status === 'clocked_out' || selectedDate) && status !== 'submitted') {
            return (
              <div className="absolute left-0 right-0 p-4 bg-gradient-to-t from-gray-100 pt-8 z-20 pointer-events-none" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
                <button
                  onClick={handleSaveReport}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center text-base pointer-events-auto"
                >
                  <Save size={20} className="mr-2" /> この実績で報告する
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="h-[4.5rem] flex items-center justify-around">
          <button
            onClick={() => { setActiveTab('shifts'); setSelectedDate(null); }}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'shifts' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <CalendarIconLucide size={22} className="mb-1" />
            <span className="text-[10px] font-bold">シフト確認</span>
          </button>
          <button
            onClick={() => { setActiveTab('report'); setSelectedDate(null); }}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'report' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Clock size={22} className="mb-1" />
            <span className="text-[10px] font-bold">報告</span>
          </button>
          <button
            onClick={() => { setActiveTab('ranking'); setSelectedDate(null); }}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'ranking' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Trophy size={22} className="mb-1" />
            <span className="text-[10px] font-bold">実績確認</span>
          </button>
          {(() => {
            const unreadCount = notifications.filter(n => !n.is_read).length;
            const notifColor = activeTab === 'notifications' ? 'text-indigo-600' : unreadCount > 0 ? 'text-red-500' : 'text-gray-400 hover:text-gray-600';
            return (
              <button
                onClick={() => {
                  setActiveTab('notifications');
                  notifications.filter(n => !n.is_read).forEach(n => markNotificationAsRead(n.id));
                }}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors ${notifColor}`}
              >
                <div className="relative">
                  <Bell size={22} className="mb-1" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold">通知</span>
              </button>
            );
          })()}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center w-full h-full transition-colors text-gray-400 hover:text-red-500"
          >
            <LogOut size={22} className="mb-1" />
            <span className="text-[10px] font-bold">ログアウト</span>
          </button>
        </div>
        </div>

      </div>
    </div>
  );
}

const CalendarIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${className}`}><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
);
