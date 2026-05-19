import React, { useState, useEffect } from 'react';
import { useShiftStore, BUSINESS_TYPES, ROLES } from '../store/useShiftStore';
import { Settings as SettingsIcon, Store, UserCog, ListChecks, Plus, Trash2, Users, Mail, KeyRound, Building, AlertCircle, GripVertical, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const adminUsers = async (action, params = {}) => {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function Settings() {
  const { 
    currentUser, shops, staffs, companies, partnerships,
    updateShopRate, saveShopRates, updateStaffSalary, updateStaffOrder, reportItems, addReportItem, removeReportItem,
    requestPartnership, approvePartnership, cancelPartnership
  } = useShiftStore();
  const [activeTab, setActiveTab] = useState(currentUser?.role === ROLES.SHOP_ADMIN ? 'partners' : 'shop');
  const [newItemName, setNewItemName] = useState('');
  
  // 単価設定タブ用ステート
  const [rateCompanyId, setRateCompanyId] = useState('');
  useEffect(() => {
    if (companies.length > 0 && !rateCompanyId) {
      setRateCompanyId(companies[0].id);
    }
  }, [companies, rateCompanyId]);
  const effectiveRateCompanyId = currentUser?.role === ROLES.COMPANY_ADMIN ? currentUser.companyId : rateCompanyId;
  const [showSaveToast, setShowSaveToast] = useState(false);

  // アカウント発行用ステート
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState(ROLES.STAFF);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  useEffect(() => {
    if (companies.length > 0 && !targetCompanyId) {
      setTargetCompanyId(companies[0].id);
    }
  }, [companies, targetCompanyId]);
  const [targetShopId, setTargetShopId] = useState('');
  const [newDailySalary, setNewDailySalary] = useState(''); // NEW
  
  const [partnerSearch, setPartnerSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');

  // ユーザー管理用ステート
  const [allUsers, setAllUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState(ROLES.STAFF);
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editShopId, setEditShopId] = useState('');
  const [editDailySalary, setEditDailySalary] = useState(''); // NEW
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { users } = await adminUsers('list');
      const { data: profiles } = await supabase.from('profiles').select('*');

      const combined = (profiles || []).map(profile => {
        const authUser = users.find((u) => u.id === profile.id);
        return {
          ...profile,
          email: authUser?.email || '',
          last_sign_in_at: authUser?.last_sign_in_at || null,
        };
      });

      const filteredUsers = currentUser.role === ROLES.COMPANY_ADMIN
        ? combined.filter(u => u.company_id === currentUser.companyId && (u.role === ROLES.STAFF || u.role === ROLES.COMPANY_ADMIN))
        : combined;
      setAllUsers(filteredUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && (currentUser?.role === ROLES.SYS_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN)) {
      fetchAllUsers();
    }
  }, [activeTab, currentUser]);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`本当に「${userName}」を削除しますか？\nこの操作は取り消せません。`)) return;
    try {
      await adminUsers('delete', { userId });
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      alert('ユーザーを削除しました。');
    } catch (err) {
      alert(`削除エラー: ${err.message}`);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setEditError('');

    try {
      await adminUsers('update', {
        userId: editingUser.id,
        email: editEmail,
        password: editPassword || undefined,
        name: editName,
        role: editRole,
        companyId: editCompanyId,
        shopId: editShopId,
        dailySalary: editDailySalary,
      });

      alert('ユーザー情報を更新しました。');
      setEditingUser(null);
      fetchAllUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '未ログイン';
    const date = new Date(isoString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditPassword('');
    setEditRole(user.role || ROLES.STAFF);
    setEditCompanyId(user.company_id || (companies[0]?.id || ''));
    setEditShopId(user.shop_id || (shops[0]?.id || ''));
    setEditDailySalary(user.daily_salary || '');
    setEditError('');
  };

  const handleAddItem = async () => {
    if (newItemName.trim()) {
      await addReportItem(newItemName.trim(), currentUser.role === ROLES.COMPANY_ADMIN ? currentUser.companyId : null);
      setNewItemName('');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateMsg('');
    setCreateError('');

    try {
      await adminUsers('create', {
        email: newEmail,
        password: newPassword,
        name: newName,
        role: newRole,
        companyName: newCompanyName,
        shopName: newShopName,
        targetCompanyId,
        dailySalary: newDailySalary,
      });

      setCreateMsg(`成功: ${newName} 様のアカウントを発行しました！`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewDailySalary('');
      fetchAllUsers();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <SettingsIcon className="mr-3 text-gray-600" />
          マスタ管理・設定
        </h2>

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {/* システム管理者 or 企業管理者 のみ表示されるタブ */}
            {(currentUser?.role === ROLES.SYS_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN) && (
              <>
                <button
                  onClick={() => setActiveTab('shop')}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'shop' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <Store className="mr-2" size={18} /> 店舗マスタ設定
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'reports' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <ListChecks className="mr-2" size={18} /> 報告項目
                </button>
              </>
            )}

            {/* システム管理者 or 企業管理者 のみ表示されるタブ */}
            {(currentUser?.role === ROLES.SYS_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN) && (
              <button
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'users' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                <Users className="mr-2" size={18} /> ユーザー設定
              </button>
            )}

            {/* パートナー連携タブ（店舗管理者・企業管理者向け） */}
            {(currentUser?.role === ROLES.SHOP_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN) && (
              <button
                onClick={() => setActiveTab('partners')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'partners' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                <Building className="mr-2" size={18} /> パートナー連携
              </button>
            )}
          </nav>
        </div>

        <div>
          {/* ----- 既存のタブコンテンツ群 ----- */}
          {activeTab === 'shop' && (() => {
            // SYS_ADMINは全店舗、COMPANY_ADMINは自社と相互承認済みの店舗のみを表示
            const activePartnerShops = currentUser?.role === ROLES.SYS_ADMIN ? shops : shops.filter(shop => {
              const p = partnerships.find(p => p.shop_id === shop.id && p.company_id === currentUser?.companyId);
              return p && p.shop_approved && p.company_approved;
            });

            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                  <h3 className="font-bold text-blue-800 flex items-center">
                    店舗別の売上単価設定 (日額/円)
                    {currentUser?.role === ROLES.SYS_ADMIN && (
                      <select 
                        className="ml-4 border border-blue-300 rounded-md text-sm pl-2 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={rateCompanyId}
                        onChange={(e) => setRateCompanyId(e.target.value)}
                      >
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </h3>
                  <button 
                    onClick={async () => {
                      if (!effectiveRateCompanyId) return;
                      try {
                        await saveShopRates(effectiveRateCompanyId);
                        setShowSaveToast(true);
                        setTimeout(() => setShowSaveToast(false), 3000);
                      } catch (err) {
                        alert("保存時にエラーが発生しました: " + (err.message || JSON.stringify(err)));
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium transition"
                  >
                    保存する
                  </button>
                </div>
                {showSaveToast && (
                  <div className="bg-green-50 text-green-700 px-6 py-2 text-sm font-bold border-b border-green-200">
                    単価設定を保存しました。
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3 border-r border-gray-200">店舗名</th>
                        {BUSINESS_TYPES.map(type => (
                          <th key={type} className="px-6 py-3 border-r border-gray-200 text-center">{type}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {activePartnerShops.length === 0 ? (
                        <tr>
                          <td colSpan={BUSINESS_TYPES.length + 1} className="px-6 py-4 text-center text-sm text-gray-500">
                            連携済みの店舗がありません。パートナー連携タブから申請・承認を行ってください。
                          </td>
                        </tr>
                      ) : (
                        activePartnerShops.map(shop => (
                          <tr key={shop.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                               {shop.name}
                            </td>
                            {BUSINESS_TYPES.map(type => (
                               <td key={type} className="px-4 py-3 border-r border-gray-200">
                                 <div className="flex items-center justify-center">
                                   <input 
                                     type="number" 
                                     step="1000"
                                     value={shop.rates?.[effectiveRateCompanyId]?.[type] || ''}
                                     onChange={(e) => updateShopRate(effectiveRateCompanyId, shop.id, type, e.target.value)}
                                     className="border border-gray-300 rounded-md w-24 px-2 py-1 text-sm text-right focus:ring-blue-500 focus:border-blue-500 outline-none"
                                   />
                                 </div>
                               </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {activeTab === 'reports' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-purple-50 px-6 py-4 border-b border-purple-100 flex items-center justify-between">
                <h3 className="font-bold text-purple-800">スタッフからの報告実績項目 設定</h3>
              </div>
              <div className="p-6">
                <div className="flex mb-6 space-x-2">
                  <input 
                    type="text"
                    placeholder="新しい報告項目を追加..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        handleAddItem();
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                  <button 
                    onClick={handleAddItem}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
                  >
                    <Plus size={16} className="mr-1" /> 追加
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {(currentUser.role === ROLES.COMPANY_ADMIN 
                    ? reportItems.filter(i => !i.companyId || i.companyId === currentUser.companyId)
                    : reportItems.filter(i => !i.companyId)
                  ).map(item => {
                    const isSystemItem = !item.companyId;
                    const canDelete = currentUser.role === ROLES.SYS_ADMIN || (currentUser.role === ROLES.COMPANY_ADMIN && !isSystemItem);
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                         <div className="flex flex-col">
                           <span className="font-medium text-gray-700">{item.name}</span>
                           {isSystemItem && currentUser.role === ROLES.COMPANY_ADMIN && <span className="text-[10px] text-gray-400">システム共通</span>}
                         </div>
                         {canDelete && (
                           <button onClick={() => removeReportItem(item.id)} className="text-gray-400 hover:text-red-500 transition cursor-pointer p-1">
                              <Trash2 size={18} />
                           </button>
                         )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'partners' && (currentUser?.role === ROLES.SHOP_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="font-bold text-indigo-800">
                  {currentUser.role === ROLES.SHOP_ADMIN ? '連携する企業を探す' : '連携する店舗を探す'}
                </h3>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <input 
                    type="text"
                    placeholder="名前で検索..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="w-full max-w-md border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {(() => {
                        const isShop = currentUser.role === ROLES.SHOP_ADMIN;
                        const list = isShop ? companies : shops;
                        const filtered = list.filter(item => item.name.toLowerCase().includes(partnerSearch.toLowerCase()));

                        return filtered.map(partner => {
                          const partnership = partnerships.find(p => 
                            isShop ? (p.shop_id === currentUser.shopId && p.company_id === partner.id)
                                   : (p.shop_id === partner.id && p.company_id === currentUser.companyId)
                          );

                          let statusLabel = '未連携';
                          let statusColor = 'bg-gray-100 text-gray-600';
                          let actionButton = null;

                          if (partnership) {
                            if (partnership.shop_approved && partnership.company_approved) {
                              statusLabel = '連携済み';
                              statusColor = 'bg-indigo-100 text-indigo-700 font-bold border border-indigo-200';
                              actionButton = (
                                <button onClick={() => cancelPartnership(partnership.id)} className="text-xs font-bold px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition-colors shadow-sm">
                                  連携解除
                                </button>
                              );
                            } else if (isShop) {
                              // 店舗目線
                              if (partnership.shop_approved && !partnership.company_approved) {
                                statusLabel = '申請中';
                                statusColor = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                                actionButton = (
                                  <button onClick={() => cancelPartnership(partnership.id)} className="text-xs font-bold px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded transition-colors shadow-sm">
                                    申請取消
                                  </button>
                                );
                              } else if (!partnership.shop_approved && partnership.company_approved) {
                                statusLabel = '企業から申請あり';
                                statusColor = 'bg-blue-100 text-blue-700 border border-blue-200';
                                actionButton = (
                                  <button onClick={() => approvePartnership(partnership.id, ROLES.SHOP_ADMIN)} className="text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-colors shadow-sm">
                                    承認する
                                  </button>
                                );
                              }
                            } else {
                              // 企業目線
                              if (partnership.company_approved && !partnership.shop_approved) {
                                statusLabel = '申請中';
                                statusColor = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                                actionButton = (
                                  <button onClick={() => cancelPartnership(partnership.id)} className="text-xs font-bold px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded transition-colors shadow-sm">
                                    申請取消
                                  </button>
                                );
                              } else if (!partnership.company_approved && partnership.shop_approved) {
                                statusLabel = '店舗から申請あり';
                                statusColor = 'bg-blue-100 text-blue-700 border border-blue-200';
                                actionButton = (
                                  <button onClick={() => approvePartnership(partnership.id, ROLES.COMPANY_ADMIN)} className="text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-colors shadow-sm">
                                    承認する
                                  </button>
                                );
                              }
                            }
                          } else {
                            actionButton = (
                              <button onClick={() => requestPartnership(isShop ? currentUser.shopId : partner.id, isShop ? partner.id : currentUser.companyId, currentUser.role)} className="text-xs font-bold px-3 py-1.5 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 rounded transition-colors shadow-sm">
                                連携申請
                              </button>
                            );
                          }

                          return (
                            <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200">{partner.name}</td>
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <span className={`inline-block px-3 py-1 text-xs rounded-full ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {actionButton}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ----- アカウント発行用 UI ----- */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center">
                <Users className="text-orange-600 mr-2" size={20} />
                <h3 className="font-bold text-orange-800">
                  アカウントの発行・委譲
                </h3>
              </div>
              <div className="p-6">
                
                {createMsg && (
                   <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg flex items-center text-sm mb-6 border border-emerald-200">
                      <SettingsIcon size={16} className="mr-2 shrink-0 animate-spin-slow" />
                      <span className="font-bold">{createMsg}</span>
                   </div>
                )}
                {createError && (
                   <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm mb-6 border border-red-200">
                      <AlertCircle size={16} className="mr-2 shrink-0" />
                      <span>{createError}</span>
                   </div>
                )}

                <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-100">
                   <p className="text-sm text-orange-800">
                     ここで発行したアカウント情報は、対象者に直接口頭やメール等でお渡しください。
                   </p>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-5 max-w-xl">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">氏名 / ユーザー名</label>
                      <input 
                        required 
                        type="text" 
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500" 
                        placeholder="例) 山田 太郎" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">発行する権限</label>
                      {currentUser.role === ROLES.SYS_ADMIN ? (
                        <select 
                          value={newRole}
                          onChange={e => setNewRole(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value={ROLES.COMPANY_ADMIN}>派遣元(企業) 管理者</option>
                          <option value={ROLES.SHOP_ADMIN}>店舗 管理者</option>
                          <option value={ROLES.STAFF}>派遣スタッフ</option>
                        </select>
                      ) : (
                        <div className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md text-gray-500">
                          派遣スタッフ (固定)
                        </div>
                      )}
                    </div>
                  </div>

                  {currentUser.role === ROLES.SYS_ADMIN && newRole === ROLES.COMPANY_ADMIN && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                        <Building size={16} className="mr-1 text-gray-500" /> 企業名 (自動的にマスタにも登録されます)
                      </label>
                      <input 
                        required
                        type="text" 
                        value={newCompanyName}
                        onChange={e => setNewCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-orange-500 focus:border-orange-500"
                        placeholder="例) 株式会社RUSSEL"
                      />
                    </div>
                  )}

                  {currentUser.role === ROLES.SYS_ADMIN && newRole === ROLES.STAFF && companies.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                        <Building size={16} className="mr-1 text-gray-500" /> 所属させる企業
                      </label>
                      <select 
                        value={targetCompanyId}
                        onChange={e => setTargetCompanyId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-orange-500 focus:border-orange-500"
                      >
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {currentUser.role === ROLES.SYS_ADMIN && newRole === ROLES.SHOP_ADMIN && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                        <Store size={16} className="mr-1 text-gray-500" /> 店舗名 (自動的にマスタにも登録されます)
                      </label>
                      <input 
                        required
                        type="text" 
                        value={newShopName}
                        onChange={e => setNewShopName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-orange-500 focus:border-orange-500"
                        placeholder="例) 銀座店"
                      />
                    </div>
                  )}

                  <hr className="border-gray-200" />

                  {(currentUser.role === ROLES.COMPANY_ADMIN || newRole === ROLES.STAFF || newRole === ROLES.COMPANY_ADMIN) && (
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-1">単価(日給)</label>
                      <input 
                        required
                        type="number" 
                        step="1000"
                        value={newDailySalary}
                        onChange={e => setNewDailySalary(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-right"
                        placeholder="例) 12000"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">ログイン用 メールアドレス</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                          required 
                          type="email" 
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500" 
                          placeholder="staff@example.com" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">初期パスワード (6文字以上)</label>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                          required 
                          type="password" 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500" 
                          placeholder="••••••••" 
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isCreating}
                    className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg shadow transition-colors active:scale-95 disabled:bg-gray-400"
                  >
                    {isCreating ? 'アカウント作成中...' : 'アカウントを発行する'}
                  </button>

                </form>

                <hr className="my-8 border-gray-200" />

                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Users className="mr-2 text-gray-600" size={18} /> 登録済みユーザー一覧
                </h4>
                {isLoadingUsers ? (
                  <p className="text-gray-500 text-sm">読み込み中...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg shadow-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー名</th>
                          {currentUser.role !== ROLES.COMPANY_ADMIN && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">権限</th>
                          )}
                          {currentUser.role !== ROLES.COMPANY_ADMIN && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                          )}
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">単価(日給)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終ログイン日</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.map(user => {
                          const roleLabel = user.role === ROLES.SYS_ADMIN ? 'システム管理者' :
                                            user.role === ROLES.COMPANY_ADMIN ? '企業管理者' :
                                            user.role === ROLES.SHOP_ADMIN ? '店舗管理者' : '派遣スタッフ';
                          const company = companies.find(c => c.id === user.company_id)?.name || '-';
                          const shop = shops.find(s => s.id === user.shop_id)?.name || '-';
                          const organization = user.role === ROLES.SHOP_ADMIN ? shop :
                                               (user.role === ROLES.STAFF || user.role === ROLES.COMPANY_ADMIN) ? company : '-';

                          return (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                              {currentUser.role !== ROLES.COMPANY_ADMIN && (
                                <td className="px-4 py-3 text-sm text-gray-600">{roleLabel}</td>
                              )}
                              {currentUser.role !== ROLES.COMPANY_ADMIN && (
                                <td className="px-4 py-3 text-sm text-gray-600">{organization}</td>
                              )}
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono text-right">
                                {user.daily_salary ? `¥${user.daily_salary.toLocaleString()}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">{formatDate(user.last_sign_in_at)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button 
                                    onClick={() => openEditModal(user)} 
                                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-md transition-colors border border-blue-100 font-bold"
                                  >
                                    <Pencil size={14} className="mr-1.5" /> 編集
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id, user.name)} 
                                    className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-md transition-colors border border-red-100 font-bold"
                                  >
                                    <Trash2 size={14} className="mr-1.5" /> 削除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ----- 編集モーダル ----- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">ユーザー情報の編集</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                ×
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                 <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm border border-red-200">
                    <AlertCircle size={16} className="mr-2 shrink-0" />
                    <span>{editError}</span>
                 </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">氏名 / ユーザー名</label>
                <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
                <input required type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">新しいパスワード <span className="text-xs font-normal text-gray-500">※変更しない場合は空欄</span></label>
                <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <hr className="border-gray-200" />

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">権限</label>
                {currentUser.role === ROLES.SYS_ADMIN ? (
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500">
                    <option value={ROLES.SYS_ADMIN}>システム管理者</option>
                    <option value={ROLES.COMPANY_ADMIN}>派遣元(企業) 管理者</option>
                    <option value={ROLES.SHOP_ADMIN}>店舗 管理者</option>
                    <option value={ROLES.STAFF}>派遣スタッフ</option>
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md text-gray-500">
                    {editRole === ROLES.SYS_ADMIN ? 'システム管理者' :
                     editRole === ROLES.COMPANY_ADMIN ? '派遣元(企業) 管理者' :
                     editRole === ROLES.SHOP_ADMIN ? '店舗 管理者' : '派遣スタッフ'}
                  </div>
                )}
              </div>

              {(editRole === ROLES.COMPANY_ADMIN || editRole === ROLES.STAFF) && companies.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">所属企業</label>
                  <select value={editCompanyId} onChange={e => setEditCompanyId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500">
                    <option value="">(未選択)</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {editRole === ROLES.SHOP_ADMIN && shops.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">所属店舗</label>
                  <select value={editShopId} onChange={e => setEditShopId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500">
                    <option value="">(未選択)</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {(editRole === ROLES.STAFF || editRole === ROLES.COMPANY_ADMIN) && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">単価(日給)</label>
                  <input required type="number" step="1000" value={editDailySalary} onChange={e => setEditDailySalary(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right" />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">キャンセル</button>
                <button type="submit" disabled={isSavingEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow transition-colors disabled:bg-blue-400">
                  {isSavingEdit ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
