import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Dashboard from './components/Dashboard';
import OrderManagement from './components/OrderManagement';
import SettingsView from './components/Settings';
import StaffPortal from './components/StaffPortal';
import ReportDashboard from './components/ReportDashboard';
import Login from './components/Login';
import DailyAttendance from './components/DailyAttendance';
import Messages from './components/Messages';
import { useShiftStore, BUSINESS_TYPES, getDayOfWeek, isHoliday, ROLES } from './store/useShiftStore';
import { isPushSupported, subscribeToPush } from './lib/pushSubscription';
import { Share2, FileText, Settings, Users, LogOut, ChevronLeft, ChevronRight, TrendingUp, ClipboardList, Smartphone, FileBarChart, PanelLeftClose, PanelRightClose, Columns, Building, Clock, MessageCircle, Bell, CheckCircle } from 'lucide-react';
import Logo from "./assets/S-Hub_logo.png"
import Icon from "./assets/S-Hub_icon.png"




// 通知アイテム
const NOTIF_ICONS = {
  new_message: <MessageCircle size={16} className="text-indigo-500 shrink-0" />,
  assignment_published: <CheckCircle size={16} className="text-green-500 shrink-0" />,
  order_submitted: <ClipboardList size={16} className="text-amber-500 shrink-0" />,
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

const NotificationItem = ({ notif, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${!notif.is_read ? 'bg-indigo-50/60' : ''}`}
  >
    <div className="mt-0.5">{NOTIF_ICONS[notif.type] || <Bell size={16} className="text-gray-400 shrink-0" />}</div>
    <div className="flex-1 min-w-0">
      <p className={`text-xs leading-snug ${!notif.is_read ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
        {notif.title}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
    </div>
    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />}
  </button>
);

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
  if (prevProps.handleNativeDrop !== nextProps.handleNativeDrop) return false;
  return true;
});

// 左側：個人シフト表
const PersonalShiftTable = ({ effectiveTargetCompanyId }) => {
  const { dates, staffs, assignments, assignShift, shops, orders, targetYearMonth } = useShiftStore();

  const filteredStaffs = React.useMemo(() => {
    if (!effectiveTargetCompanyId) return staffs;
    return staffs.filter(s => s.companyId === effectiveTargetCompanyId);
  }, [staffs, effectiveTargetCompanyId]);

  const handleNativeDrop = React.useCallback((dragData, targetDate, targetStaffId) => {
    if (!dragData) return;
    
    const parts = dragData.split('|');
    let type = parts[0];
    let sourceShopId, sourceBusinessType, sourceCompanyId, sourceDate, sourceStaffId;
    
    if (type === 'palette') {
      sourceShopId = parts[1];
      sourceCompanyId = parts[2];
      sourceBusinessType = parts[3];
    } else if (type === 'move') {
      sourceDate = parseInt(parts[1], 10);
      sourceStaffId = parts[2];
      sourceShopId = parts[3];
      sourceBusinessType = parts[4];
    } else {
      return;
    }

    // ドラッグ元（paletteの場合）のオーダー数を、現在のターゲット企業宛てのオーダーから取得
    const orderCount = orders[targetDate]?.[sourceShopId]?.[effectiveTargetCompanyId]?.[sourceBusinessType] || 0;
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

    const currentAssignedCount = Object.keys(dayAssignments).filter(staffId => {
      const asgn = dayAssignments[staffId];
      const staffObj = useShiftStore.getState().staffs.find(s => s.id === staffId);
      const isTargetCompany = staffObj?.companyId === effectiveTargetCompanyId;
      return asgn.shopId === sourceShopId && asgn.businessType === sourceBusinessType && isTargetCompany;
    }).length;

    const isSameDayMove = type === 'move' && sourceDate === targetDate;
    if (!isSameDayMove && currentAssignedCount >= orderCount) {
      alert(`${targetDate}日の「${shopName} - ${sourceBusinessType}」のオーダー枠（${orderCount}名）はすでに他のスタッフで埋まっています！`);
      return;
    }

    if (type === 'move') {
       assignShift(sourceDate, sourceStaffId, null, null);
    }
    
    assignShift(targetDate, targetStaffId, sourceShopId, sourceBusinessType);
  }, [orders, shops, assignShift, effectiveTargetCompanyId]);

  return (
    <div className="flex-1 bg-white rounded-lg shadow overflow-auto border border-gray-200">
      <div className="sticky top-0 bg-gray-50 z-10 p-4 border-b border-gray-200 font-bold text-gray-700">
        ① 個人シフト表
      </div>
      <table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-[57px] z-20 shadow-sm">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border-r border-b border-gray-200 sticky left-0 z-30 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">スタッフ</th>
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
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredStaffs.map(staff => (
            <tr key={staff.id} className="hover:bg-gray-50 group">
              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold border-r border-gray-200 text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                {staff.name}
              </td>
              {dates.map(date => {
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 右側：店舗シフト表
const ShopShiftTable = ({ activeCombos, effectiveTargetCompanyId }) => {
  const { dates, staffs, assignments, orders, currentUser, companies, targetYearMonth } = useShiftStore();
  const isShopAdmin = currentUser?.role === ROLES.SHOP_ADMIN;

  return (
    <div className="flex-1 bg-white rounded-lg shadow overflow-auto border border-gray-200">
      <div className="sticky top-0 bg-gray-50 z-20 p-4 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
        <span>② {isShopAdmin ? '企業別' : '店舗別'}・オーダー状況表示</span>
        <span className="text-xs font-normal text-gray-500">※オーダーが入力された種別のみ表示</span>
      </div>
      <table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-[57px] z-20 shadow-sm">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] border-r border-b border-gray-200 sticky left-0 z-30 bg-gray-50">{isShopAdmin ? '企業名' : '店舗名'}</th>
            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 border-r border-b border-gray-200 sticky left-[120px] z-30 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">種別</th>
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
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activeCombos.length === 0 ? (
            <tr>
              <td colSpan={dates.length + 2} className="px-4 py-4 text-sm text-gray-400 text-center italic">オーダー管理画面から入力してください</td>
            </tr>
          ) : (
            activeCombos.map((combo, index) => {
              const isFirstOfGroup = index === 0 || 
                (isShopAdmin 
                  ? activeCombos[index - 1].company.id !== combo.company.id 
                  : activeCombos[index - 1].shop.id !== combo.shop.id);
              
              const groupCombosCount = activeCombos.filter(c => 
                isShopAdmin ? c.company.id === combo.company.id : c.shop.id === combo.shop.id
              ).length;

              return (
                <tr key={combo.comboId} className="hover:bg-gray-50 group">
                  {isFirstOfGroup && (
                    <td rowSpan={groupCombosCount} className="px-2 py-2 text-sm font-bold border-r border-b border-gray-200 text-center bg-gray-50 align-middle sticky left-0 z-10">
                      {isShopAdmin ? combo.company.name : combo.shop.name}
                    </td>
                  )}
                  <td className={`px-2 py-2 text-[10px] font-bold border-r border-b border-gray-200 text-center align-middle sticky left-[120px] z-10 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${getBusinessTypeColor(combo.businessType)}`}>
                    {combo.businessType}
                  </td>
                  {dates.map(date => {
                    const dayAssignments = assignments[date] || {};
                    const targetCompId = isShopAdmin ? combo.company.id : effectiveTargetCompanyId;

                    const assignedStaffIds = Object.keys(dayAssignments).filter(staffId => {
                      const asgn = dayAssignments[staffId];
                      const staffObj = staffs.find(s => s.id === staffId);
                      const isVisible = currentUser?.role !== ROLES.SHOP_ADMIN || asgn.status !== 'draft';
                      const isTargetCompany = staffObj?.companyId === targetCompId;
                      return asgn.shopId === combo.shop.id && asgn.businessType === combo.businessType && isVisible && isTargetCompany;
                    });
                    const assignedCount = assignedStaffIds.length;
                    
                    const orderedCount = orders[date]?.[combo.shop.id]?.[targetCompId]?.[combo.businessType] || 0;

                    const isDeficient = orderedCount > 0 && assignedCount < orderedCount;
                    const isFulfilled = orderedCount > 0 && assignedCount >= orderedCount;

                    return (
                      <td key={`${date}-${combo.comboId}`} className={`px-2 py-2 border-r border-b border-gray-200 text-center align-top transition-colors ${isDeficient ? 'bg-red-50' : isFulfilled ? 'bg-green-50/50' : ''}`}>
                        {orderedCount > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-bold font-mono ${isDeficient ? 'text-red-600' : 'text-green-600'}`}>
                              {assignedCount}/{orderedCount}
                            </span>
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
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};


// メインアプリケーション
export default function App() {
  const { currentUser, logout, isDataLoaded, fetchInitialData, shops, dates, orders, assignShift, companies, targetYearMonth, setTargetYearMonth, conversations, notifications, fetchNotifications, fetchConversations, markNotificationAsRead, markAllNotificationsAsRead } = useShiftStore();
  const [activeTab, setActiveTab] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifPanelRef = useRef(null);

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // iOSインストール促すバナー
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
    if (isIOS && !isStandalone && !dismissed) setShowInstallBanner(true);
  }, []);
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

  // 通知・会話リストを初期取得（未読バッジをタブ未開封でも表示するため）
  useEffect(() => {
    if (currentUser && isDataLoaded) {
      fetchNotifications();
      fetchConversations();
    }
  }, [currentUser, isDataLoaded]);

  // プッシュ通知バナー
  const [showPushBanner, setShowPushBanner] = useState(false);
  useEffect(() => {
    if (!currentUser || !isPushSupported()) return;
    const permission = Notification.permission;
    if (permission === 'granted') {
      subscribeToPush(currentUser.id);
    } else if (permission === 'default' && !sessionStorage.getItem('push-banner-dismissed')) {
      setShowPushBanner(true);
    }
  }, [currentUser]);

  const handleEnablePush = async () => {
    const permission = await Notification.requestPermission();
    setShowPushBanner(false);
    sessionStorage.setItem('push-banner-dismissed', '1');
    if (permission === 'granted') {
      await subscribeToPush(currentUser.id);
    }
  };

  // データ初期化（ログイン後・未ロード時のみ実行）
  useEffect(() => {
    if (!currentUser || isDataLoaded) return;
    const init = async () => {
      if (!useShiftStore.getState().targetYearMonth) {
        const now = new Date();
        if (currentUser.role === ROLES.STAFF) {
          await useShiftStore.getState().setTargetYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        } else {
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          await useShiftStore.getState().setTargetYearMonth(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`);
        }
      } else {
        await fetchInitialData();
      }
    };
    init();
  }, [currentUser, isDataLoaded, fetchInitialData]);

  // Realtimeサブスクリプション（データロード完了後のみ・同期的に設定して確実にクリーンアップ）
  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;
    const unsubscribe = useShiftStore.getState().subscribeToRealtime();
    return () => unsubscribe();
  }, [currentUser, isDataLoaded]);

  // ログイン時、ロールに応じて最初の画面を切り替える
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === ROLES.STAFF) setActiveTab('staffPortal');
      else if (currentUser.role === ROLES.SHOP_ADMIN) setActiveTab('orders');
      else setActiveTab('shift');
    }
  }, [currentUser]);

  // アプリアイコンバッジ更新（iOS 16.4以上 / PWAインストール済みのみ有効）
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const total = unreadNotifCount + (conversations.reduce((s, c) => s + (c.unreadCount || 0), 0));
    if (total > 0) navigator.setAppBadge(total);
    else navigator.clearAppBadge();
  }, [unreadNotifCount, conversations]);

  // 未読メッセージ数（会話ごとの unreadCount の合計）
  const totalUnreadMessages = React.useMemo(() => {
    if (!currentUser) return 0;
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations, currentUser]);

  // システム管理者向けのターゲット企業切り替え
  const [targetCompanyId, setTargetCompanyId] = useState('');
  useEffect(() => {
    if (companies.length > 0 && !targetCompanyId) {
      setTargetCompanyId(companies[0].id);
    }
  }, [companies, targetCompanyId]);

  const effectiveTargetCompanyId = currentUser?.role === ROLES.COMPANY_ADMIN ? currentUser.companyId : targetCompanyId;

  if (!currentUser) {
    return <Login />;
  }

  // プッシュ通知バナー
  const PushBanner = () => showPushBanner ? (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-indigo-700 text-white px-4 py-3 flex items-center gap-3 shadow-2xl">
      <Bell size={20} className="shrink-0" />
      <p className="flex-1 text-sm font-medium">新着メッセージ・アサイン通知をプッシュで受け取りますか？</p>
      <button
        onClick={handleEnablePush}
        className="bg-white text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-md shrink-0 hover:bg-indigo-50 transition-colors"
      >有効にする</button>
      <button
        onClick={() => { setShowPushBanner(false); sessionStorage.setItem('push-banner-dismissed', '1'); }}
        className="text-indigo-300 hover:text-white text-xl leading-none shrink-0"
      >×</button>
    </div>
  ) : null;

  // iOSインストールバナー（スタッフ含む全ロールで表示）
  const InstallBanner = () => showInstallBanner ? (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-900 text-white px-4 py-3 flex items-start gap-3 shadow-2xl">
      <img src="/apple-touch-icon.png" className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">S-Hub をホーム画面に追加</p>
        <p className="text-xs text-slate-300 mt-0.5">
          Safariの <span className="inline-block">⎋</span> 共有ボタン →「ホーム画面に追加」でアプリとして使えます
        </p>
      </div>
      <button
        onClick={() => { setShowInstallBanner(false); sessionStorage.setItem('pwa-banner-dismissed', '1'); }}
        className="text-slate-400 hover:text-white text-xl leading-none shrink-0 mt-0.5"
      >×</button>
    </div>
  ) : null;

  if (currentUser.role === ROLES.STAFF) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-gray-50 font-sans">
        <StaffPortal isPreview={false} />
        <PushBanner />
        <InstallBanner />
      </div>
    );
  }

  // オーダーが存在する 店舗×企業×業務種別 の組み合わせを抽出してソート
  const getOrderedCombos = () => {
    const combos = new Map(); // key: shopId|companyId|type
    dates.forEach(date => {
      if (!orders[date]) return;
      Object.entries(orders[date]).forEach(([shopId, companyObj]) => {
        Object.entries(companyObj).forEach(([companyId, typeCounts]) => {
          // 企業管理者の場合は自社宛のオーダーのみ
          if (currentUser?.role === ROLES.COMPANY_ADMIN && companyId !== currentUser.companyId) return;
          // システム管理者の場合は選択した企業宛のオーダーのみ
          if (currentUser?.role === ROLES.SYS_ADMIN && companyId !== targetCompanyId) return;
          
          Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > 0) combos.set(`${shopId}|${companyId}|${type}`, { shopId, companyId, businessType: type });
          });
        });
      });
    });

    const activeComboList = Array.from(combos.values()).map(({ shopId, companyId, businessType }) => {
      const shop = shops.find(s => s.id === shopId);
      const company = companies.find(c => c.id === companyId);
      return { shop, company, businessType, comboId: `${shopId}|${companyId}|${businessType}` };
    }).filter(c => c.shop && c.company);

    // 店舗管理者以外は店舗順、店舗管理者は企業順でソート
    if (currentUser?.role === ROLES.SHOP_ADMIN) {
       activeComboList.sort((a, b) => {
         if (a.company.id === b.company.id) return a.businessType.localeCompare(b.businessType);
         return a.company.id.localeCompare(b.company.id);
       });
    } else {
       activeComboList.sort((a, b) => a.shop.id.localeCompare(b.shop.id));
    }
    return activeComboList;
  };

  const activeCombos = getOrderedCombos();

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden font-sans">
      <PushBanner />
      <InstallBanner />

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
              {currentUser.role === ROLES.COMPANY_ADMIN && (
                <button
                  title="日別 出退勤・日報状況"
                  onClick={() => setActiveTab('attendance')}
                  className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition ${activeTab === 'attendance' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  <Clock className={isSidebarOpen ? "mr-3 shrink-0" : "shrink-0"} size={20} />
                  {isSidebarOpen && <span className="whitespace-nowrap">日別出退勤・日報</span>}
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

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN || currentUser.role === ROLES.SHOP_ADMIN) && (
            <button
              title="メッセージ"
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center ${isSidebarOpen ? 'p-3' : 'p-3 justify-center'} rounded-lg shadow transition relative ${activeTab === 'messages' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <div className="relative shrink-0">
                <MessageCircle className={isSidebarOpen ? "mr-3" : ""} size={20} />
                {!isSidebarOpen && totalUnreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none border border-slate-900">
                    {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                  </span>
                )}
              </div>
              {isSidebarOpen && <span className="whitespace-nowrap">メッセージ</span>}
              {isSidebarOpen && totalUnreadMessages > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-md px-2 py-1 leading-none min-w-[24px] text-center">
                  {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                </span>
              )}
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

          {(currentUser.role === ROLES.SYS_ADMIN || currentUser.role === ROLES.COMPANY_ADMIN || currentUser.role === ROLES.SHOP_ADMIN) && (
            <>
              <div className="pt-4 mt-2 border-t border-slate-700"></div>
              <button
                title={currentUser.role === ROLES.SHOP_ADMIN ? "パートナー連携・設定" : "マスタ管理"}
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
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-20 sticky top-0">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-slate-800">
              {activeTab === 'shift' && 'シフト管理'}
              {activeTab === 'orders' && (currentUser.role === ROLES.SHOP_ADMIN ? 'オーダー＆連携状況' : 'オーダー管理')}
              {activeTab === 'dashboard' && '売上・利益ダッシュボード'}
              {activeTab === 'reportDashboard' && '実績集計ダッシュボード'}
            </h1>
            
            {/* システム管理者用: 表示対象企業切り替え */}
            {currentUser?.role === ROLES.SYS_ADMIN && activeTab === 'shift' && (
              <div className="ml-6 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <Building className="text-gray-400 mr-2" size={16} />
                <span className="text-sm font-bold text-gray-600 mr-2">表示企業:</span>
                <select
                  className="text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 py-1 pl-2 pr-6"
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                >
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* 月選択 */}
            {['shift', 'orders', 'dashboard', 'reportDashboard'].includes(activeTab) && (
              <div className="ml-6 flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                <span className="text-sm font-bold text-gray-500 mr-2">対象月:</span>
                <input 
                  type="month" 
                  value={targetYearMonth || ''}
                  onChange={(e) => {
                    if (e.target.value) setTargetYearMonth(e.target.value);
                  }}
                  className="text-sm font-bold text-gray-800 focus:outline-none bg-transparent"
                />
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">

            {/* 通知ベルアイコン */}
            <div ref={notifPanelRef} className="relative">
              <button
                onClick={() => setShowNotifications(v => !v)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Bell size={20} className="text-gray-600" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col max-h-[480px]">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h3 className="font-bold text-gray-800 text-sm">通知</h3>
                    {unreadNotifCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsAsRead()}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        すべて既読
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        通知はありません
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <NotificationItem
                          key={notif.id}
                          notif={notif}
                          onClick={() => {
                            markNotificationAsRead(notif.id);
                            if (notif.type === 'new_message') setActiveTab('messages');
                            else if (notif.type === 'assignment_published' || notif.type === 'order_submitted') setActiveTab('orders');
                            setShowNotifications(false);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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

        {activeTab === 'messages' && <Messages />}
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
                        <ShopShiftTable activeCombos={activeCombos.filter(c => c.shop.id === currentUser.shopId)} effectiveTargetCompanyId={effectiveTargetCompanyId} />
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
        {activeTab === 'staffPortal' && <StaffPortal isPreview={true} />}
        {activeTab === 'reportDashboard' && <ReportDashboard effectiveTargetCompanyId={effectiveTargetCompanyId} />}
        {activeTab === 'attendance' && <DailyAttendance />}

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
                  <PersonalShiftTable effectiveTargetCompanyId={effectiveTargetCompanyId} />
                </div>
                <div className={`flex flex-col min-w-0 ${shiftLayoutMode === 'personal-only' ? 'hidden' : 'flex-1'}`}>
                  <ShopShiftTable activeCombos={activeCombos} effectiveTargetCompanyId={effectiveTargetCompanyId} />
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
