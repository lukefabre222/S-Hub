import React, { useMemo } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const { staffs, shops, assignments } = useShiftStore();

  const stats = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    
    // Calculate per shop
    const shopStats = shops.reduce((acc, shop) => {
      acc[shop.id] = { name: shop.name, sales: 0, cost: 0, profit: 0, count: 0 };
      return acc;
    }, {});

    Object.entries(assignments).forEach(([dateStr, dayAssignments]) => {
      Object.entries(dayAssignments).forEach(([staffId, assignment]) => {
        const staff = staffs.find(s => s.id === staffId);
        const shop = shops.find(s => s.id === assignment.shopId);
        const businessType = assignment.businessType;
        
        if (staff && shop && businessType) {
          const rate = shop.rates[businessType] || 0;
          totalSales += rate;
          totalCost += staff.dailySalary;
          
          shopStats[shop.id].sales += rate;
          shopStats[shop.id].cost += staff.dailySalary;
          shopStats[shop.id].profit += (rate - staff.dailySalary);
          shopStats[shop.id].count += 1;
        }
      });
    });

    return {
      totalSales,
      totalCost,
      totalProfit: totalSales - totalCost,
      shopData: Object.values(shopStats)
    };
  }, [assignments, staffs, shops]);

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-6">今月の実績・見込</h2>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className="p-4 rounded-full bg-blue-100 text-blue-600 mr-4">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">総売上 (想定)</p>
              <p className="text-2xl font-bold text-gray-800">¥{stats.totalSales.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className="p-4 rounded-full bg-red-100 text-red-600 mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">スタッフ原価 (給与)</p>
              <p className="text-2xl font-bold text-gray-800">¥{stats.totalCost.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className="p-4 rounded-full bg-green-100 text-green-600 mr-4">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">想定利益 (粗利)</p>
              <p className="text-2xl font-bold text-gray-800">¥{stats.totalProfit.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px]">
            <h3 className="text-lg font-bold text-gray-700 mb-4">店舗別 収支</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={stats.shopData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value/1000}k`} />
                <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} cursor={{fill: '#f3f4f6'}} />
                <Legend />
                <Bar dataKey="sales" name="売上" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="原価" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="利益" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-700 mb-4">店舗別 詳細</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店舗名</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">稼働数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">売上</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">利益</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.shopData.map(shop => (
                  <tr key={shop.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{shop.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{shop.count} 人日</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">¥{shop.sales.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 text-right font-bold">¥{shop.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
