import React, { useState, useEffect } from 'react';
import { useShiftStore, BUSINESS_TYPES, ROLES } from '../store/useShiftStore';
import { Settings as SettingsIcon, Store, UserCog, ListChecks, Plus, Trash2, Users, Mail, KeyRound, Building, AlertCircle, GripVertical } from 'lucide-react';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function Settings() {
  const { currentUser, shops, staffs, updateShopRate, updateStaffSalary, updateStaffOrder, reportItems, addReportItem, removeReportItem } = useShiftStore();
  const [activeTab, setActiveTab] = useState('shop');
  const [newItemName, setNewItemName] = useState('');

  // アカウント発行用ステート
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState(ROLES.STAFF);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetShopId, setTargetShopId] = useState('');
  
  const [companies, setCompanies] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    // 会社マスタ取得
    const fetchCompanies = async () => {
      const { data } = await supabase.from('companies').select('*');
      if (data && data.length > 0) {
        setCompanies(data);
        setTargetCompanyId(data[0].id);
      }
    };
    if (activeTab === 'users' && currentUser?.role === ROLES.SYS_ADMIN) {
      fetchCompanies();
    }
  }, [activeTab, currentUser]);

  const handleAddItem = () => {
    if (newItemName.trim()) {
      addReportItem(newItemName.trim());
      setNewItemName('');
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;

    const newStaffs = Array.from(staffs);
    const [reorderedItem] = newStaffs.splice(sourceIndex, 1);
    newStaffs.splice(destinationIndex, 0, reorderedItem);

    updateStaffOrder(newStaffs);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!supabaseAdmin) {
       setCreateError('システムエラー: Service Role Key が設定されていないため、代理作成を実行できません。');
       return;
    }
    
    setIsCreating(true);
    setCreateMsg('');
    setCreateError('');
    
    try {
      // 1. 本来ログアウトしてしまう signUp の代わりに supabaseAdmin を使って強制的に作成する
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true // 自動で確認済みにする
      });
      
      if (authError) throw authError;

      // 2. 作成された Auth ユーザーID を元に profiles にマスタデータを登録
      let finalCompanyId = null;
      let finalShopId = null;

      if (currentUser.role === ROLES.COMPANY_ADMIN) {
        // 企業管理者は自分の会社IDで強制固定 (スタッフのみ)
        finalCompanyId = currentUser.companyId; 
      } else {
        if (newRole === ROLES.COMPANY_ADMIN) {
          // 企業管理者のアカウント発行時は、入力された企業名で同時にマスタも新規作成する
          const { data: newComp, error: compErr } = await supabaseAdmin
            .from('companies')
            .insert([{ name: newCompanyName }])
            .select()
            .single();
          if (compErr) throw compErr;
          finalCompanyId = newComp.id;
        } else if (newRole === ROLES.STAFF) {
          finalCompanyId = targetCompanyId;
        }
        
        if (newRole === ROLES.SHOP_ADMIN) {
          // 店舗管理者のアカウント発行時は、入力された店舗名がすでに存在するかチェックする
          const { data: existingShop } = await supabaseAdmin
            .from('shops')
            .select('*')
            .eq('name', newShopName)
            .single();

          if (existingShop) {
            finalShopId = existingShop.id;
          } else {
            const { data: newShop, error: shopErr } = await supabaseAdmin
              .from('shops')
              .insert([{ name: newShopName }])
              .select()
              .single();
            if (shopErr) throw shopErr;
            finalShopId = newShop.id;
          }
        }
      }

      // 3. Profilesへ登録
      const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
         id: authData.user.id,
         name: newName,
         role: currentUser.role === ROLES.COMPANY_ADMIN ? ROLES.STAFF : newRole,
         company_id: finalCompanyId,
         shop_id: finalShopId
      }]);
      
      if (profileError) throw profileError;

      setCreateMsg(`成功: ${newName} 様のアカウントを発行しました！`);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      
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
            <button
              onClick={() => setActiveTab('shop')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'shop' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <Store className="mr-2" size={18} /> 店舗マスタ設定
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'staff' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <UserCog className="mr-2" size={18} /> スタッフ設定
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'reports' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <ListChecks className="mr-2" size={18} /> 報告項目
            </button>

            {/* システム管理者 or 企業管理者 のみ表示されるアカウント発行タブ */}
            {(currentUser?.role === ROLES.SYS_ADMIN || currentUser?.role === ROLES.COMPANY_ADMIN) && (
              <button
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm flex items-center transition-colors ${activeTab === 'users' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                <Users className="mr-2" size={18} /> アカウント発行・招待
              </button>
            )}
          </nav>
        </div>

        <div>
          {/* ----- 既存のタブコンテンツ群 ----- */}
          {activeTab === 'shop' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center">
                <h3 className="font-bold text-blue-800">店舗別の売上単価設定 (日額/円)</h3>
              </div>
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
                    {shops.map(shop => (
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
                                 value={shop.rates?.[type] || ''}
                                 onChange={(e) => updateShopRate(shop.id, type, e.target.value)}
                                 className="border border-gray-300 rounded-md w-24 px-2 py-1 text-sm text-right focus:ring-blue-500 focus:border-blue-500 outline-none"
                               />
                             </div>
                           </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex items-center justify-between">
                <h3 className="font-bold text-green-800">スタッフ別の給与単価設定 (日額/円)</h3>
                <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">ドラッグで並び替え可能</span>
              </div>
              <div className="p-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                        <th className="px-4 py-2 border-r border-gray-200">スタッフ名</th>
                        <th className="px-4 py-2 border-r border-gray-200">給与単価</th>
                      </tr>
                    </thead>
                    <Droppable droppableId="staff-list">
                      {(provided) => (
                        <tbody 
                          className="divide-y divide-gray-100 bg-white"
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {staffs.map((staff, index) => (
                            <Draggable key={staff.id} draggableId={staff.id} index={index}>
                              {(provided, snapshot) => (
                                <tr 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`hover:bg-gray-50 transition-colors ${snapshot.isDragging ? 'bg-green-50 shadow-lg relative z-50' : ''}`}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 w-64">
                                    <div className="flex items-center">
                                      <div {...provided.dragHandleProps} className="mr-3 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                                        <GripVertical size={18} />
                                      </div>
                                      {staff.name}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-200">
                                    <div className="flex items-center">
                                      <input 
                                        type="number" 
                                        step="1000"
                                        value={staff.dailySalary || ''}
                                        onChange={(e) => updateStaffSalary(staff.id, e.target.value)}
                                        className="border border-gray-300 rounded-md w-32 px-3 py-1 text-sm text-right focus:ring-green-500 focus:border-green-500 outline-none"
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      )}
                    </Droppable>
                  </table>
                </DragDropContext>
              </div>
            </div>
          )}

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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                  <button onClick={handleAddItem} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md shadow text-sm font-medium transition flex items-center cursor-pointer">
                    <Plus size={16} className="mr-1" />
                    追加
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportItems.map(item => (
                    <div key={item} className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                       <span className="font-medium text-gray-700">{item}</span>
                       <button onClick={() => removeReportItem(item)} className="text-gray-400 hover:text-red-500 transition cursor-pointer p-1">
                          <Trash2 size={18} />
                       </button>
                    </div>
                  ))}
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
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
