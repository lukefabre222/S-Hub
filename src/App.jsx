import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Dashboard from './components/Dashboard';
import OrderManagement from './components/OrderManagement';
import SettingsView from './components/Settings';
import StaffPortal from './components/StaffPortal';
import ReportDashboard from './components/ReportDashboard';
import Login from './components/Login';
import { useShiftStore, BUSINESS_TYPES, getDayOfWeek, isHoliday, ROLES } from './store/useShiftStore';
import { Share2, FileText, Settings, Users, LogOut, ChevronLeft, ChevronRight, TrendingUp, ClipboardList, Smartphone, FileBarChart, PanelLeftClose, PanelRightClose, Columns } from 'lucide-react';
import Logo from "./assets/S-Hub_logo.png"
import Icon from "./assets/S-Hub_icon.png"




// 業務種別に応じた文字色クラスを返す
const getBusinessTypeColor = (type) => {
  switch (type) {
    case '店内HP': return 'text-blue-700';
    case '初期設定': return 'text-red-700';
    case '外販': return 'text-emerald-700';
    case '軒先': return 'text-purple-700';
    default: return 'text-gray-700';
  }
};

// 店舗×業務種別ラベル (ドラッグ可能 - HTML5 Native DnD)
const DraggableComboLabel = ({ combo }) => (
  <div
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('text/plain', `palette|${combo.comboId}`);
      e.dataTransfer.effectAllowed = 'copy';
    }}
    className={`px-3 py-1.5 rounded-md shadow flex flex-col items-center justify-center cursor-grab active:cursor-grabbing border-gray-200 border min-w-[70px] hover:opacity-90 transition-opacity`}
    style={{ backgroundColor: combo.shop.dynamicColor || 'hsl(0, 0%, 95%)' }}
  >
    <span className="font-bold text-xs leading-tight text-gray-800">{combo.shop.name}</span>
    <span className={`bg-white bg-opacity-80 px-1.5 py-0.5 mt-1 rounded font-bold text-[10px] leading-none ${getBusinessTypeColor(combo.businessType)}`}>
      {combo.businessType}
    </span>
  </div>
);

// セル単位での無駄な再描画を防ぐためのメモ化コンポーネント
const MemoizedShiftCell = React.memo(({ date, staffId, assignment, shop, businessType, assignShift, handleNativeDrop }) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  return (
    <td
      onDragOver={(e) => {
        e.preventDefault(); // ドロップを許可するために必須
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const data = e.dataTransfer.getData('text/plain');
        if (data && handleNativeDrop) {
          handleNativeDrop(data, date, staffId);
        }
      }}
      className={`px-2 py-2 whitespace-nowrap border-r border-gray-200 min-h-[50px] relative transition-colors ${isDragOver ? 'bg-blue-50' : ''}`}
    >
      {shop ? (
        <div 
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', `move|${date}|${staffId}|${shop.id}|${businessType}`);
            e.dataTransfer.effectAllowed = 'move';
          }}
          className={`px-2 py-1 rounded shadow-sm text-center flex flex-col items-center justify-center relative group cursor-grab active:cursor-grabbing ${assignment.status === 'draft' ? 'border border-dashed border-gray-400 opacity-80' : 'border border-transparent'}`}
          style={{ backgroundColor: shop.dynamicColor || 'hsl(0, 0%, 95%)' }}
        >
          {assignment.status === 'draft' && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white shadow-sm" title="下書き状態（スタッフには非公開）"></span>}
          <span className="text-xs font-bold leading-tight text-gray-800">{shop.name}</span>
          <span className={`bg-white bg-opacity-80 px-1 py-0.5 mt-1 rounded font-bold text-[10px] leading-none ${getBusinessTypeColor(businessType)}`}>
            {businessType}
          </span>
          <button
            onClick={() => assignShift(date, staffId, null, null)}
            className="absolute -top-2 -left-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
          >×</button>
        </div>
      ) : (
        <div className="h-8 w-full border-2 border-dashed border-transparent rounded-md text-gray-400 flex items-center justify-center text-[10px] pointer-events-none">
          {isDragOver ? 'ドロップ' : ''}
        </div>
      )}
    </td>
  );
}, (prevProps, nextProps) => {
  if (prevProps.assignment?.shopId !== nextProps.assignment?.shopId) return false;
  if (prevProps.assignment?.businessType !== nextProps.assignment?.businessType) return false;
  if (prevProps.assignment?.status !== nextProps.assignment?.status) return false;
  return true;
});

// 左側：個人シフト表
const PersonalShiftTable = () => {
  const { dates, staffs, assignments, assignShift, shops, orders } = useShiftStore();

  const handleNativeDrop = React.useCallback((dragData, targetDate, targetStaffId) => {
    if (!dragData) return;
    
    const parts = dragData.split('|');
    const type = parts[0];
    
    let sourceShopId, sourceBusinessType, sourceDate, sourceStaffId;

    if (type === 'palette') {
      sourceShopId = parts[1];
      sourceBusinessType = parts[2];
    } else if (type === 'move') {
      sourceDate = parseInt(parts[1], 10);
      sourceStaffId = parts[2];
      sourceShopId = parts[3];
      sourceBusinessType = parts[4];
    } else {
      return;
    }

    const orderCount = orders[targetDate]?.[sourceShopId]?.[sourceBusinessType] || 0;
    const shopName = shops.find(s => s.id === sourceShopId)?.name || '';

    if (orderCount === 0) {
      alert(`${targetDate}日の「${shopName} - ${sourceBusinessType}」にはオーダーが入っていません！\n先にオーダー管理画面でオーダー数を入力してください。`);
      return;
    }

    const dayAssignments = useShiftStore.getState().assignments[targetDate] || {};
    const existingAssignment = dayAssignments[targetStaffId];

    if (existingAssignment?.shopId === sourceShopId && existingAssignment?.businessType === sourceBusinessType) {
      return;
    }

    const currentAssignedCount = Object.values(dayAssignments).filter(
      asgn => asgn.shopId === sourceShopId && asgn.businessType === sourceBusinessType
    ).length;

    const isSameDayMove = type === 'move' && sourceDate === targetDate;
    if (!isSameDayMove && currentAssignedCount >= orderCount) {
      alert(`${targetDate}日の「${shopName} - ${sourceBusinessType}」のオーダー枠（${orderCount}名）はすでに他のスタッフで埋まっています！`);
      return;
    }

    if (type === 'move') {
       assignShift(sourceDate, sourceStaffId, null, null);
    }
    
    assignShift(targetDate, targetStaffId, sourceShopId, sourceBusinessType);
  }, [orders, shops, assignShift]);

  return (
    <div className="flex-1 bg-white rounded-lg shadow overflow-auto border border-gray-200">
      <div className="sticky top-0 bg-gray-50 z-10 p-4 border-b border-gray-200 font-bold text-gray-700">
        ① 個人シフト表
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-[57px] z-10">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16 border-r border-gray-200">日付</th>
            {staffs.map(staff => (
              <th key={staff.id} className="px-4 py-3 text-center text-xs font-bold text-gray-700 tracking-wider min-w-[100px] border-r border-gray-200">
                {staff.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dates.map(date => {
            const dayOfWeek = getDayOfWeek(date);
            const isWeekend = dayOfWeek === '土';
            const isSunday = dayOfWeek === '日';
            const isHol = isHoliday(date);
            const isRestDay = isSunday || isHol;
            const dateBgClass = isRestDay ? 'bg-red-50' : isWeekend ? 'bg-blue-50' : 'bg-gray-50';
            const dateTextClass = isRestDay ? 'text-red-700' : isWeekend ? 'text-blue-700' : 'text-gray-900';
            const dayTextClass = isRestDay ? 'text-red-500' : isWeekend ? 'text-blue-500' : 'text-gray-500';

            return (
              <tr key={date} className="hover:bg-gray-50">
                <td className={`px-2 py-2 whitespace-nowrap text-sm font-bold border-r border-gray-200 text-center w-16 leading-tight ${dateBgClass} ${dateTextClass}`}>
                  {date}日<br />
                  <span className={`text-[10px] ${dayTextClass}`}>
                    ({isHol ? '祝' : dayOfWeek})
                  </span>
                </td>
                {staffs.map(staff => {
                  const assignment = assignments[date]?.[staff.id];
                  const shop = assignment ? shops.find(s => s.id === assignment.shopId) : null;
                  const businessType = assignment ? assignment.businessType : null;

                  return (
                    <MemoizedShiftCell
                      key={`${date}-${staff.id}`}
                      date={date}
                      staffId={staff.id}
                      assignment={assignment}
                      shop={shop}
                      businessType={businessType}
                      assignShift={assignShift}
                      handleNativeDrop={handleNativeDrop}
                    />
                  );
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
};

// 右側：店舗シフト表
const ShopShiftTable = ({ activeCombos }) => {
  const { dates, staffs, assignments, orders, currentUser } = useShiftStore();

  // 店舗ごとにグルーピング (ヘッダー表示用)
  const shopGroups = [];
  activeCombos.forEach(combo => {
    let group = shopGroups.find(g => g.shopId === combo.shop.id);
    if (!group) {
      group = { shopId: combo.shop.id, shop: combo.shop, combos: [] };
      shopGroups.push(group);
    }
    group.combos.push(combo);
  });

  return (
    <div className="flex-1 bg-white rounded-lg shadow overflow-auto border border-gray-200">
      <div className="sticky top-0 bg-gray-50 z-10 p-4 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
        <span>② 店舗別・オーダー状況表示</span>
        <span className="text-xs font-normal text-gray-500">※オーダーが入力された種別のみ表示</span>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-[57px] z-10 shadow-sm">
          <tr>
            <th rowSpan={2} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16 border-r border-b border-gray-200">日付</th>
            {shopGroups.map(group => (
              <th key={group.shopId} colSpan={group.combos.length} className="px-2 py-1.5 text-center text-xs font-bold text-gray-700 tracking-wider border-r border-b border-gray-200 bg-gray-100">
                {group.shop.name}
              </th>
            ))}
            {activeCombos.length === 0 && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 border-b border-gray-200">オーダー情報なし</th>
            )}
          </tr>
          {activeCombos.length > 0 && (
            <tr>
              {activeCombos.map(combo => (
                <th key={combo.comboId} className="px-2 py-1.5 text-center text-[10px] font-bold text-blue-800 tracking-wider min-w-[70px] border-r border-b border-gray-200 bg-blue-50/50">
                  {combo.businessType}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dates.map(date => {
            const dayAssignments = assignments[date] || {};
            const dayOfWeek = getDayOfWeek(date);
            const isWeekend = dayOfWeek === '土';
            const isSunday = dayOfWeek === '日';
            const isHol = isHoliday(date);
            const isRestDay = isSunday || isHol;
            const dateBgClass = isRestDay ? 'bg-red-50' : isWeekend ? 'bg-blue-50' : 'bg-gray-50';
            const dateTextClass = isRestDay ? 'text-red-700' : isWeekend ? 'text-blue-700' : 'text-gray-900';
            const dayTextClass = isRestDay ? 'text-red-500' : isWeekend ? 'text-blue-500' : 'text-gray-500';

            return (
              <tr key={date} className="hover:bg-gray-50">
                <td className={`px-2 py-2 whitespace-nowrap text-sm font-bold border-r border-gray-200 text-center w-16 leading-tight ${dateBgClass} ${dateTextClass}`}>
                  {date}日<br />
                  <span className={`text-[10px] ${dayTextClass}`}>
                    ({isHol ? '祝' : dayOfWeek})
                  </span>
                </td>
                {activeCombos.length === 0 ? (
                  <td className="px-4 py-4 text-sm text-gray-400 text-center italic">オーダー管理画面から入力してください</td>
                ) : (
                  activeCombos.map(combo => {
                    // この日、この店舗、この業務種別にアサインされているスタッフ数
                    const assignedStaffIds = Object.keys(dayAssignments).filter(staffId => {
                      const asgn = dayAssignments[staffId];
                      const isVisible = currentUser?.role !== ROLES.SHOP_ADMIN || asgn.status !== 'draft';
                      return asgn.shopId === combo.shop.id && asgn.businessType === combo.businessType && isVisible;
                    });
                    const assignedCount = assignedStaffIds.length;

                    // オーダー数
                    const orderedCount = orders[date]?.[combo.shop.id]?.[combo.businessType] || 0;

                    // 不足しているか？
                    const isDeficient = orderedCount > 0 && assignedCount < orderedCount;
                    const isFulfilled = orderedCount > 0 && assignedCount >= orderedCount;

                    return (
                      <td key={`${date}-${combo.comboId}`} className={`px-2 py-2 border-r border-gray-200 text-center align-top transition-colors ${isDeficient ? 'bg-red-50' : isFulfilled ? 'bg-green-50/50' : ''}`}>
                        {orderedCount > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-bold font-mono ${isDeficient ? 'text-red-600' : 'text-green-600'}`}>
                              {assignedCount}/{orderedCount}
                            </span>

                            {/* アサインされたスタッフ名の表示 */}
                            {assignedCount > 0 && (
                              <div className="flex flex-col gap-1 mt-1 items-center w-full">
                                {assignedStaffIds.map(stId => {
                                  const staffObj = staffs.find(s => s.id === stId);
                                  return staffObj ? (
                                    <span key={stId} className="text-[10px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-700 shadow-sm leading-tight whitespace-nowrap">
                                      {staffObj.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-200 text-xs">-</span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


// メインアプリケーション
export default function App() {
  const { currentUser, logout, isDataLoaded, fetchInitialData, shops, dates, orders, assignShift } = useShiftStore();
  const [activeTab, setActiveTab] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [orderViewMode, setOrderViewMode] = useState('input'); // 'input' | 'assignment'
  const [showPublishToast, setShowPublishToast] = useState(false);
  const [shiftLayoutMode, setShiftLayoutMode] = useState('split'); // 'split' | 'personal-only' | 'shop-only'

  const handlePublish = async () => {
    if (window.confirm('現在「下書き」状態のシフトをすべて「確定」し、スタッフのスマホへ公開しますか？')) {
      await useShiftStore.getState().publishShifts();
      setShowPublishToast(true);
      setTimeout(() => setShowPublishToast(false), 3000);
    }
  };

  // ログイン時のみデータをフェッチ＆リアルタイム監視を開始する
  useEffect(() => {
    let unsubscribe = null;
    
    if (currentUser && !isDataLoaded) {
      const init = async () => {
        await fetchInitialData();
        unsubscribe = useShiftStore.getState().subscribeToRealtime();
      };
      init();
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, isDataLoaded, fetchInitialData]);

  // ログイン時、ロールに応じて最初の画面を切り替える
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === ROLES.STAFF) setActiveTab('staffPortal');
      else if (currentUser.role === ROLES.SHOP_ADMIN) setActiveTab('orders');
      else setActiveTab('shift');
    }
  }, [currentUser]);

  if (!currentUser) {
    return <Login />;
  }

  // オーダーが存在する 店舗×業務種別 の組み合わせを抽出してソート
  const getOrderedCombos = () => {
    const combos = new Map(); // key: shopId|type
    dates.forEach(date => {
      if (!orders[date]) return;
      Object.entries(orders[date]).forEach(([shopId, typeCounts]) => {
        Object.entries(typeCounts).forEach(([type, count]) => {
          if (count > 0) combos.set(`${shopId}|${type}`, { shopId, businessType: type });
        });
      });
    });

    const activeComboList = Array.from(combos.values()).map(({ shopId, businessType }) => {
      const shop = shops.find(s => s.id === shopId);
      return { shop, businessType, comboId: `${shopId}|${businessType}` };
    }).filter(c => c.shop);

    // idで並び変えることで、店舗ごとに列を正しくグループ化させる
    activeComboList.sort((a, b) => a.shop.id.localeCompare(b.shop.id));
    return activeComboList;
  };

  const activeCombos = getOrderedCombos();

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden font-sans">

      {/* サイドバー */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 z-50`}>
        <div className="p-4 text-xl font-bold border-b border-slate-800 flex items-center justify-center tracking-wider h-[73px]">
          {isSidebarOpen ? (
            <div className="flex items-center w-full justify-center whitespace-nowrap">
              <img src={Logo} className="w-36" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <img src={Icon} className="w-8" />
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-x-hidden">
          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN) && (
            <button
              title="シフト管理"
              onClick={() => setActiveTab('shift')}
              className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'shift' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Share2 className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
              {isSidebarOpen && <span className="whitespace-nowrap">シフト管理</span>}
            </button>
          )}

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN || currentUser.role === ROLES.SHOP_ADMIN) && (
            <>
              <button
                title={currentUser.role === ROLES.SHOP_ADMIN ? "オーダー＆アサイン状況" : "オーダー管理"}
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'orders' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <ClipboardList className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
                {isSidebarOpen && <span className="whitespace-nowrap">{currentUser.role === ROLES.SHOP_ADMIN ? 'オーダー＆連携状況' : 'オーダー管理'}</span>}
              </button>
              {currentUser.role !== ROLES.SHOP_ADMIN && (
                <button
                  title="売上・利益ダッシュボード"
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  <TrendingUp className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
                  {isSidebarOpen && <span className="whitespace-nowrap">売上・利益</span>}
                </button>
              )}
            </>
          )}

          {/* New Report System Tabs */}
          <div className="pt-4 mt-2 border-t border-slate-700"></div>

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN || currentUser.role === ROLES.SHOP_ADMIN) && (
            <button
              title="実績集計一覧"
              onClick={() => setActiveTab('reportDashboard')}
              className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'reportDashboard' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <FileBarChart className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
              {isSidebarOpen && <span className="whitespace-nowrap">実績・集計一覧</span>}
            </button>
          )}

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN || currentUser.role === ROLES.STAFF) && (
            <button
              title="スタッフ版画面 (スマホ)"
              onClick={() => setActiveTab('staffPortal')}
              className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'staffPortal' ? 'bg-pink-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Smartphone className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
              {isSidebarOpen && <span className="whitespace-nowrap">スタッフ画面(スマホ)</span>}
            </button>
          )}

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN) && (
            <>
              <div className="pt-4 mt-2 border-t border-slate-700"></div>
              <button
                title="マスタ管理"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <Settings className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
                {isSidebarOpen && <span className="whitespace-nowrap">設定</span>}
              </button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800 text-sm flex flex-col items-center">
          {isSidebarOpen && (
            <div onClick={logout} className="flex items-center text-slate-400 hover:text-white cursor-pointer transition w-full mb-4 px-2">
              <LogOut className="mr-3 shrink-0" size={18} /> <span className="whitespace-nowrap">ログアウト ({currentUser.name})</span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition">
            {isSidebarOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm z-20 px-6 py-4 flex justify-between items-center border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-bold text-gray-800">
            {activeTab === 'shift' ? '4月 シフト編成' : activeTab === 'orders' ? 'オーダー入力・管理' : activeTab === 'settings' ? 'マスタ管理・設定' : activeTab === 'reportDashboard' ? '実績・集計ダッシュボード' : activeTab === 'staffPortal' ? 'スタッフ向けポータル (スマホプレビュー)' : '売上・利益ダッシュボード'}
          </h1>
          <div className="flex items-center space-x-4">
            {activeTab === 'shift' && (
              <div className="flex bg-gray-100 rounded-md p-1">
                <button 
                  onClick={() => setShiftLayoutMode('personal-only')} 
                  className={`p-1.5 rounded flex items-center justify-center transition-colors ${shiftLayoutMode === 'personal-only' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} 
                  title="個人シフト表を最大化"
                >
                  <PanelRightClose size={18} />
                </button>
                <button 
                  onClick={() => setShiftLayoutMode('split')} 
                  className={`p-1.5 rounded flex items-center justify-center transition-colors ${shiftLayoutMode === 'split' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} 
                  title="分割表示"
                >
                  <Columns size={18} />
                </button>
                <button 
                  onClick={() => setShiftLayoutMode('shop-only')} 
                  className={`p-1.5 rounded flex items-center justify-center transition-colors ${shiftLayoutMode === 'shop-only' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} 
                  title="店舗別表示を最大化"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
            )}
            {activeTab === 'shift' && <div className="text-sm text-gray-500">
              {showPublishToast && <span className="text-green-600 font-bold mr-3 animate-pulse">シフトを公開しました！</span>}
            </div>}
            {activeTab === 'dashboard' && <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium transition">レポートを出力</button>}
            {activeTab === 'shift' && <button onClick={handlePublish} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium transition">シフトを確定・共有</button>}
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'orders' && (
          <div className="flex flex-col flex-1 overflow-hidden h-full bg-gray-50">
            {currentUser.role === ROLES.SHOP_ADMIN ? (
              <div className="flex flex-col h-full">
                {/* 内部切り替えタブ */}
                <div className="bg-white border-b border-gray-200 px-6 pt-4 flex space-x-4 shrink-0">
                  <button
                    onClick={() => setOrderViewMode('input')}
                    className={`pb-3 px-2 text-sm font-bold border-b-4 transition-colors ${orderViewMode === 'input' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    ① 希望入力 (オーダー)
                  </button>
                  <button
                    onClick={() => setOrderViewMode('assignment')}
                    className={`pb-3 px-2 text-sm font-bold border-b-4 transition-colors ${orderViewMode === 'assignment' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    ② アサイン・入店予定状況
                  </button>
                </div>

                {/* タブコンテンツ */}
                <div className="flex-1 overflow-auto p-4">
                  {orderViewMode === 'input' ? (
                    <OrderManagement />
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col min-h-full">
                      <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                          <FileText className="mr-3 text-emerald-600" />
                          アサイン・スタッフ入店予定表
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">※企業側で確定されたスタッフの入店予定が表示されます</p>
                      </div>
                      <div className="flex-1">
                        <ShopShiftTable activeCombos={activeCombos.filter(c => c.shop.id === currentUser.shopId)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4">
                <OrderManagement />
              </div>
            )}
          </div>
        )}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'staffPortal' && <StaffPortal />}
        {activeTab === 'reportDashboard' && <ReportDashboard />}

        {activeTab === 'shift' && (
            <div className="flex flex-col flex-1 p-6 overflow-hidden">

              {/* ドラッグ元の店舗×業務種別パレット */}
              <div className="bg-white p-4 rounded-lg shadow mb-4 border border-gray-200 shrink-0">
                <h2 className="text-sm font-bold text-gray-600 mb-2">アサインパレット（店舗 × 業務種別）</h2>
                <div className="overflow-x-auto pb-2">
                  <div className="flex space-x-2 w-max">
                    {activeCombos.length > 0 ? (
                      activeCombos.map((combo) => (
                        <DraggableComboLabel key={combo.comboId} combo={combo} />
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 py-2">※オーダーが入力されていません。</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 分割テーブルエリア */}
              <div className={`flex flex-1 min-h-0 ${shiftLayoutMode === 'split' ? 'space-x-6' : ''}`}>
                <div className={`flex flex-col min-w-0 ${shiftLayoutMode === 'shop-only' ? 'hidden' : 'flex-1'}`}>
                  <PersonalShiftTable />
                </div>
                <div className={`flex flex-col min-w-0 ${shiftLayoutMode === 'personal-only' ? 'hidden' : 'flex-1'}`}>
                  <ShopShiftTable activeCombos={activeCombos} />
                </div>
              </div>

            </div>
        )}
      </div>
    </div>
  );
}
