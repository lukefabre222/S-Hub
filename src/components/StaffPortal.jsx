import React, { useState } from 'react';
import { useShiftStore, getDayOfWeek } from '../store/useShiftStore';
import { Smartphone, ChevronRight, ChevronLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StaffPortal() {
  const { staffs, dates, assignments, shops, reportItems, reports, saveReport, currentUser, logout } = useShiftStore();
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({});

  const selectedStaffId = currentUser?.id;
  const currentStaff = staffs.find(s => s.id === selectedStaffId) || currentUser;

  // Get shifts for selected staff
  const staffShifts = selectedStaffId ? dates.map(date => {
    const asgn = assignments[date]?.[selectedStaffId];
    if (!asgn || asgn.status === 'draft') return null; // 下書きは見せない
    const shop = shops.find(s => s.id === asgn.shopId);
    return {
      date,
      shop,
      businessType: asgn.businessType,
      isReported: !!reports[date]?.[selectedStaffId],
      reportData: reports[date]?.[selectedStaffId]
    };
  }).filter(Boolean) : [];

  const openReportForm = (shift) => {
    setSelectedDate(shift.date);
    // Load existing items or initialize with 0
    const existingItems = shift.reportData?.items || {};
    const initialForm = reportItems.reduce((acc, item) => {
      acc[item] = existingItems[item] || 0;
      return acc;
    }, {});
    setFormData(initialForm);
  };

  const handleSaveReport = async () => {
    const shift = staffShifts.find(s => s.date === selectedDate);
    try {
      await saveReport(selectedDate, selectedStaffId, shift.shop.id, { items: formData, status: 'submitted' });
      setSelectedDate(null);
      alert('今月の報告が完了しました！');
    } catch (e) {
      console.error(e);
      // alertはsaveReport内で表示されるのでここでは出さない
    }
  };

  const updateItemValue = (item, val) => {
    setFormData(prev => ({ ...prev, [item]: Math.max(0, parseInt(val) || 0) }));
  };


  return (
    <div className="flex-1 bg-[#f0f2f5] flex items-center justify-center p-4 overflow-hidden relative">
      <div className="w-full max-w-[375px] bg-gray-50 rounded-[2.5rem] shadow-2xl h-[700px] flex flex-col border-8 border-gray-800 relative overflow-hidden">
        
        {/* iPhone Notch Mock */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-50"></div>

        {/* Header */}
        <div className="bg-indigo-600 text-white pt-8 pb-4 px-5 shrink-0 flex items-center justify-between shadow-md relative z-10">
          <div className="font-bold text-lg tracking-wide">{currentStaff.name} 様</div>
          <button onClick={logout} className="text-[10px] font-bold bg-white/20 px-2.5 py-1.5 rounded-full hover:bg-white/30 transition">
            ログアウト
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 bg-gray-100">
          
          {!selectedDate ? (
            /* Shift List View */
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-gray-500 font-bold text-xs mb-3 flex items-center">
                 <CalendarIcon className="mr-1" /> 今月のアサイン状況・報告
              </h3>
              
              {staffShifts.length === 0 ? (
                <div className="text-center text-gray-400 mt-12 bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-sm">
                   今月のアサインはありません
                </div>
              ) : (
                <div className="space-y-3">
                  {staffShifts.map(shift => (
                    <div 
                      key={shift.date}
                      onClick={() => openReportForm(shift)}
                      className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:scale-[0.98] transition-transform group flex items-center relative overflow-hidden"
                    >
                      {/* Left Date Block */}
                      <div className="mr-4 flex flex-col items-center justify-center min-w-[2.5rem]">
                        <div className="text-[10px] text-gray-400 font-bold">{getDayOfWeek(shift.date)}</div>
                        <div className="text-2xl font-black font-mono leading-none text-gray-800">{shift.date}</div>
                      </div>
                      
                      {/* Main Info */}
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 text-base leading-tight mb-1">{shift.shop?.name}</div>
                        <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 inline-flex px-2 py-0.5 rounded-full border border-indigo-100">
                          {shift.businessType}
                        </div>
                      </div>

                      {/* Status Icon */}
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
                      
                      {/* Arrow */}
                      <ChevronRight size={16} className="text-gray-300 ml-1" />

                      {/* Side color accent based on report status */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${shift.isReported ? 'bg-green-500' : 'bg-transparent'}`}></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Report Form View */
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-indigo-600 text-sm font-bold flex items-center mb-4 active:opacity-50 transition p-1"
              >
                <ChevronLeft size={16} className="mr-0.5" /> もどる
              </button>

              {(() => {
                const shift = staffShifts.find(s => s.date === selectedDate);
                return (
                  <div className="bg-white rounded-2xl shadow-sm p-5 mb-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <div className="text-xs font-bold text-gray-400 mb-1">{selectedDate}日 ({getDayOfWeek(selectedDate)}) の実績を報告</div>
                    <h2 className="text-xl font-extrabold text-gray-800 mb-2">{shift.shop?.name}</h2>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">{shift.businessType}</span>
                  </div>
                )
              })()}

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center w-full">実績項目</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {reportItems.map(item => (
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
            </div>
          )}

        </div>

        {/* Fixed bottom action (Only when reporting) */}
        {selectedDate && (
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-20">
            <button 
              onClick={handleSaveReport}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center text-base"
            >
              <Save size={20} className="mr-2" /> この実績で報告する
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

const CalendarIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${className}`}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);
