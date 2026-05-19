import React, { useState, useEffect } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { Clock, Calendar, CheckCircle, Minus } from 'lucide-react';

export default function DailyAttendance() {
  const { staffs, shops, assignments, reports, currentUser, setTargetYearMonth, targetYearMonth } = useShiftStore();
  
  // Default to today
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const [selectedDate, setSelectedDate] = useState(todayStr);

  useEffect(() => {
    // When selectedDate changes, ensure targetYearMonth matches
    const yyyyMM = selectedDate.substring(0, 7);
    if (yyyyMM !== targetYearMonth) {
      setTargetYearMonth(yyyyMM);
    }
  }, [selectedDate, targetYearMonth, setTargetYearMonth]);

  const handleDateChange = (e) => {
    if (e.target.value) {
      setSelectedDate(e.target.value);
    }
  };

  // Only company admins should use this view
  if (currentUser?.role !== 'company_admin') {
    return <div className="p-6">この機能は企業管理者のみ利用可能です。</div>;
  }

  const dayNumber = parseInt(selectedDate.split('-')[2], 10);
  
  // 1. Filter staff to own company
  const companyStaffs = staffs.filter(s => s.companyId === currentUser.companyId);
  
  // 2. Filter staff who have an assignment on this day
  const assignedStaffs = companyStaffs.filter(staff => {
    const asgn = assignments[dayNumber]?.[staff.id];
    return asgn && asgn.status !== 'draft';
  });

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Clock className="mr-3 text-blue-600" />
              日別 出退勤・日報状況
            </h2>
            <div className="flex items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <Calendar size={18} className="text-gray-500 mr-2" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={handleDateChange}
                className="bg-transparent border-none focus:outline-none text-gray-700 font-bold"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">店舗</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">業務種別</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">出勤</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">退勤</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">日報</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignedStaffs.length > 0 ? (
                  assignedStaffs.map(staff => {
                    const asgn = assignments[dayNumber][staff.id];
                    const shop = shops.find(s => s.id === asgn.shopId);
                    const report = reports[dayNumber]?.[staff.id];
                    
                    const clockInTime = report?.items?.clock_in_time;
                    const clockOutTime = report?.items?.clock_out_time;
                    const isReportSubmitted = report?.status === 'submitted';

                    return (
                      <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200">{staff.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{shop?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{asgn.businessType}</td>
                        <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                          {clockInTime ? (
                            <div className="flex items-center justify-center text-emerald-600 font-bold">
                              <CheckCircle size={16} className="mr-1" /> {clockInTime}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-gray-300">
                              <Minus size={16} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                          {clockOutTime ? (
                            <div className="flex items-center justify-center text-emerald-600 font-bold">
                              <CheckCircle size={16} className="mr-1" /> {clockOutTime}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-gray-300">
                              <Minus size={16} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {isReportSubmitted ? (
                            <div className="flex items-center justify-center text-emerald-600 font-bold">
                              <CheckCircle size={18} />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-gray-300">
                              <Minus size={16} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500 text-sm">
                      この日のアサインはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
