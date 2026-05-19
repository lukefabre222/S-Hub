import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabaseClient';

// 業務種別
export const BUSINESS_TYPES = ['店内HP', '初期設定', '外販', '軒先'];

// 権限(ロール)の定義
export const ROLES = {
  SYS_ADMIN: 'sys_admin',
  COMPANY_ADMIN: 'company_admin',
  SHOP_ADMIN: 'shop_admin',
  STAFF: 'staff',
};

// 曜日計算
export const getDayOfWeek = (yearMonth, day) => {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(year, month - 1, day);
  return days[date.getDay()];
};

// 祝日モック
export const isHoliday = (yearMonth, day) => {
  if (yearMonth === '2026-04' && day === 29) return true;
  if (yearMonth === '2026-05' && (day === 3 || day === 4 || day === 5 || day === 6)) return true;
  return false;
};

// 月末までの日数を取得
export const getDaysInMonth = (yearMonth) => {
  if (!yearMonth) return 31;
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

// 報告項目モック（削除済：DBから取得）

export const useShiftStore = create(
  persist(
    (set, get) => ({
      targetYearMonth: '',
      dates: [],
      companies: [],
      shops: [],
      staffs: [],
      assignments: {},
      orders: {},
      partnerships: [],

      // 報告関連のステート
      reportItems: [],
      reports: {},

      // メッセージング
      conversations: [],
      messages: {},

      // 通知
      notifications: [],

      // 認証ステート
      currentUser: null,
      isDataLoaded: false,

      login: (user) => set({ currentUser: user }),
      logout: async () => {
        await supabase.auth.signOut();
        set({
          currentUser: null,
          targetYearMonth: '',
          dates: [],
          orders: {},
          assignments: {},
          staffs: [],
          reports: {},
          partnerships: [],
          conversations: [],
          messages: {},
          notifications: [],
          isDataLoaded: false
        });
      },

      setTargetYearMonth: async (yearMonth) => {
        const daysInMonth = getDaysInMonth(yearMonth);
        set({ 
          targetYearMonth: yearMonth,
          dates: Array.from({ length: daysInMonth }, (_, i) => i + 1)
        });
        await get().fetchInitialData();
      },

      // ⬇ 初期データ取得処理 (Supabaseから最新データを取得)
      fetchInitialData: async () => {
        try {
          const { targetYearMonth } = get();
          const { data: cData } = await supabase.from('companies').select('*');
          const { data: sData } = await supabase.from('shops').select('*');
          // スタッフとして登録されているプロフィール情報を取得 ( sort_order順 )
          const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .in('role', [ROLES.STAFF, ROLES.COMPANY_ADMIN])
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
          
          let oData = [], aData = [], rData = [];
          if (targetYearMonth) {
            const startDate = `${targetYearMonth}-01`;
            const daysInMonth = getDaysInMonth(targetYearMonth);
            const endDate = `${targetYearMonth}-${String(daysInMonth).padStart(2, '0')}`;
            
            const resO = await supabase.from('orders').select('*').gte('target_date', startDate).lte('target_date', endDate);
            oData = resO.data || [];
            
            const resA = await supabase.from('assignments').select('*').gte('target_date', startDate).lte('target_date', endDate);
            aData = resA.data || [];
            
            const resR = await supabase.from('reports').select('*').gte('target_date', startDate).lte('target_date', endDate);
            rData = resR.data || [];
          }
          const { data: ratesData } = await supabase.from('shop_rates').select('*');
          const { data: partnershipsData } = await supabase.from('partnerships').select('*');
          const { data: reportItemsData } = await supabase.from('report_items').select('*').order('created_at', { ascending: true });

          // 店舗をID順（または名前順）でソートして、色相(Hue)を均等に割り当てる
          const sortedShops = [...(sData || [])].sort((a, b) => a.id.localeCompare(b.id));
          const totalShops = sortedShops.length || 1;

          // 店舗データに店舗単価(rates)と均等な動的カラーを結合
          const shopsMap = sortedShops.reduce((acc, shop, index) => {
             const hue = Math.floor((index * 360) / totalShops);
             acc[shop.id] = { ...shop, rates: {}, dynamicColor: `hsl(${hue}, 80%, 93%)` };
             return acc;
          }, {});
          if (ratesData) {
             ratesData.forEach(r => {
                if (shopsMap[r.shop_id]) {
                   if (!shopsMap[r.shop_id].rates[r.company_id]) {
                       shopsMap[r.shop_id].rates[r.company_id] = {};
                   }
                   shopsMap[r.shop_id].rates[r.company_id][r.business_type] = r.daily_rate;
                }
             });
          }

          // スタッフデータのキャメルケースマッピング
          const formattedStaffs = (pData || []).map(p => ({
            id: p.id,
            name: p.name,
            companyId: p.company_id,
            dailySalary: p.daily_salary || 0,
            role: p.role,
            sortOrder: p.sort_order || 0
          }));

          const formattedReportItems = (reportItemsData || []).map(r => ({
            id: r.id,
            name: r.name,
            companyId: r.company_id
          }));

          // オーダーデータの整形: orders[date][shopId][companyId][businessType] = count
          const formattedOrders = {};
          if (oData) {
            oData.forEach(row => {
               const day = parseInt(row.target_date.split('-')[2], 10);
               if (!formattedOrders[day]) formattedOrders[day] = {};
               if (!formattedOrders[day][row.shop_id]) formattedOrders[day][row.shop_id] = {};
               if (!formattedOrders[day][row.shop_id][row.company_id]) formattedOrders[day][row.shop_id][row.company_id] = {};
               formattedOrders[day][row.shop_id][row.company_id][row.business_type] = row.requested_count;
            });
          }

          // アサインデータの整形: assignments[date][staffId] = { shopId, businessType, status }
          const formattedAssignments = {};
          if (aData) {
            aData.forEach(row => {
               const day = parseInt(row.target_date.split('-')[2], 10);
               if (!formattedAssignments[day]) formattedAssignments[day] = {};
               formattedAssignments[day][row.staff_id] = { 
                 shopId: row.shop_id, 
                 businessType: row.business_type,
                 status: row.status
               };
            });
          }

          // 実績データの整形: reports[date][staffId] = { shopId, items, status }
          const formattedReports = {};
          if (rData) {
            rData.forEach(row => {
               const day = parseInt(row.target_date.split('-')[2], 10);
               if (!formattedReports[day]) formattedReports[day] = {};
               formattedReports[day][row.staff_id] = { 
                 shopId: row.shop_id,
                 items: row.items,
                 status: row.status
               };
            });
          }

          set({
            companies: cData || [],
            shops: Object.values(shopsMap),
            staffs: formattedStaffs,
            orders: formattedOrders,
            assignments: formattedAssignments,
            reports: formattedReports,
            partnerships: partnershipsData || [],
            reportItems: formattedReportItems,
            isDataLoaded: true
          });

        } catch (error) {
          console.error("データ取得エラー:", error);
        }
      },

      // ⬇ DB書き込み対応したアクション郡
      updateOrder: async (date, shopId, companyId, businessType, count) => {
        const { targetYearMonth } = get();
        if (!targetYearMonth) return;
        const targetDateStr = `${targetYearMonth}-${String(date).padStart(2, '0')}`;
        
        // 状態をオプティミスティック（即時）更新
        set((state) => {
          const newOrders = { ...state.orders };
          if (!newOrders[date]) newOrders[date] = {};
          if (!newOrders[date][shopId]) newOrders[date][shopId] = {};
          if (!newOrders[date][shopId][companyId]) newOrders[date][shopId][companyId] = {};
          newOrders[date][shopId][companyId][businessType] = Number(count);
          return { orders: newOrders };
        });

        try {
          // count <= 0 の場合でも delete せず requested_count: 0 として UPDATE させる。
          const { error } = await supabase.from('orders')
            .upsert({
              target_date: targetDateStr,
              shop_id: shopId,
              company_id: companyId,
              business_type: businessType,
              requested_count: Number(count)
            }, { onConflict: 'target_date,shop_id,company_id,business_type' });
          if (error) throw error;
        } catch (e) {
          console.error("Order update failed:", e);
          const currentUser = get().currentUser;
          alert(`オーダーの保存に失敗しました:\nRole: ${currentUser?.role}\nShopID: ${shopId}\nDate: ${targetDateStr}\nError: ${e.message}`);
        }
      },

      assignShift: async (date, staffId, shopId, businessType) => {
        const { targetYearMonth } = get();
        if (!targetYearMonth) return;
        const targetDateStr = `${targetYearMonth}-${String(date).padStart(2, '0')}`;
        
        // 状態をオプティミスティック（即時）更新
        set((state) => {
          const newAssignments = { ...state.assignments };
          if (!newAssignments[date]) newAssignments[date] = {};
          if (!shopId) {
            delete newAssignments[date][staffId];
          } else {
            newAssignments[date][staffId] = { shopId, businessType, status: 'draft' };
          }
          return { assignments: newAssignments };
        });

        try {
          if (!shopId) {
            const { error } = await supabase.from('assignments')
              .delete()
              .match({ target_date: targetDateStr, staff_id: staffId });
            if (error) throw error;
          } else {
            const { error } = await supabase.from('assignments')
              .upsert({
                target_date: targetDateStr,
                staff_id: staffId,
                shop_id: shopId,
                business_type: businessType,
                status: 'draft'
              }, { onConflict: 'target_date,staff_id' });
            if (error) throw error;
          }
        } catch (e) {
          console.error("Assignment update failed:", e);
          alert("アサインの保存に失敗しました: " + e.message);
        }
      },

      publishShifts: async () => {
        // 下書きスタッフIDを先に収集（オプティミスティック更新前）
        const draftStaffIds = [...new Set(
          Object.values(get().assignments).flatMap(dayA =>
            Object.keys(dayA).filter(staffId => dayA[staffId].status === 'draft')
          )
        )];

        // オプティミスティック更新
        set((state) => {
          const newAssignments = { ...state.assignments };
          Object.keys(newAssignments).forEach(date => {
            Object.keys(newAssignments[date]).forEach(staffId => {
              if (newAssignments[date][staffId].status === 'draft') {
                newAssignments[date][staffId].status = 'published';
              }
            });
          });
          return { assignments: newAssignments };
        });

        try {
          await supabase.from('assignments')
            .update({ status: 'published' })
            .eq('status', 'draft');

          const user = get().currentUser;
          if (user?.role === ROLES.COMPANY_ADMIN) {
            const currentAssignments = get().assignments;
            const shopIds = [...new Set(
              Object.values(currentAssignments).flatMap(dayA =>
                Object.values(dayA).map(a => a.shopId).filter(Boolean)
              )
            )];

            const notifCalls = [];

            // 店舗管理者へ通知
            if (shopIds.length > 0) {
              const { data: shopAdmins } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', ROLES.SHOP_ADMIN)
                .in('shop_id', shopIds);
              if (shopAdmins?.length) {
                notifCalls.push(...shopAdmins.map(admin =>
                  supabase.rpc('create_notification', {
                    target_user_id: admin.id,
                    notif_type: 'assignment_published',
                    notif_title: 'アサイン確定のお知らせ',
                    notif_body: 'スタッフのアサインが確定されました。入店予定をご確認ください。',
                    notif_related_id: user.companyId,
                  })
                ));
              }
            }

            // スタッフへ通知
            notifCalls.push(...draftStaffIds.map(staffId =>
              supabase.rpc('create_notification', {
                target_user_id: staffId,
                notif_type: 'assignment_published',
                notif_title: 'シフトが確定されました',
                notif_body: 'スタッフポータルからシフトをご確認ください。',
                notif_related_id: null,
              })
            ));

            await Promise.all(notifCalls);
          }
        } catch (e) {
          console.error("Publish failed:", e);
        }
      },

      submitOrderNotification: async (shopId, companyId) => {
        const shop = get().shops.find(s => s.id === shopId);
        try {
          const { data: companyAdmins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', ROLES.COMPANY_ADMIN)
            .eq('company_id', companyId);
          if (companyAdmins?.length) {
            await Promise.all(companyAdmins.map(admin =>
              supabase.rpc('create_notification', {
                target_user_id: admin.id,
                notif_type: 'order_submitted',
                notif_title: `${shop?.name || '店舗'}からオーダーが届きました`,
                notif_body: 'オーダー管理画面から内容をご確認ください。',
                notif_related_id: shopId,
              })
            ));
          }
        } catch (e) {
          console.error('オーダー通知送信失敗:', e);
        }
      },

      updateShopRate: (companyId, shopId, businessType, dailyRate) => {
        set((state) => ({
          shops: state.shops.map(shop => {
            if (shop.id === shopId) {
              const rates = shop.rates || {};
              const companyRates = rates[companyId] || {};
              return { 
                ...shop, 
                rates: { 
                  ...rates, 
                  [companyId]: { ...companyRates, [businessType]: Number(dailyRate) } 
                } 
              };
            }
            return shop;
          })
        }));
      },

      saveShopRates: async (companyId) => {
        const { shops } = get();
        const upserts = [];
        shops.forEach(shop => {
          if (shop.rates && shop.rates[companyId]) {
            Object.entries(shop.rates[companyId]).forEach(([businessType, dailyRate]) => {
              upserts.push({
                company_id: companyId,
                shop_id: shop.id,
                business_type: businessType,
                daily_rate: dailyRate
              });
            });
          }
        });

        if (upserts.length === 0) return;

        try {
          const { error } = await supabase.from('shop_rates').upsert(upserts, { onConflict: 'company_id,shop_id,business_type' });
          if (error) throw error;
        } catch (error) {
          console.error("単価一括保存エラー:", error);
          throw error;
        }
      },

      updateStaffSalary: async (id, dailySalary) => {
        await supabase.from('profiles').update({ daily_salary: Number(dailySalary) }).eq('id', id);

        set((state) => ({
          staffs: state.staffs.map(staff => 
            staff.id === id 
            ? { ...staff, dailySalary: Number(dailySalary) } 
            : staff
          )
        }));
      },

      updateStaffOrder: async (newOrderedStaffs) => {
        // ローカルUIの即時反映
        set({ staffs: newOrderedStaffs });
        
        try {
          // 並び順の一括更新
          const updatePromises = newOrderedStaffs.map((staff, index) => {
            return supabase.from('profiles')
              .update({ sort_order: index + 1 })
              .eq('id', staff.id);
          });
          
          await Promise.all(updatePromises);
        } catch (e) {
          console.error("Staff order update failed:", e);
          alert("並び順の保存に失敗しました。");
        }
      },

      requestPartnership: async (shopId, companyId, initiatorRole) => {
        const payload = {
           shop_id: shopId,
           company_id: companyId,
           shop_approved: initiatorRole === ROLES.SHOP_ADMIN,
           company_approved: initiatorRole === ROLES.COMPANY_ADMIN
        };
        const { data, error } = await supabase.from('partnerships')
          .upsert(payload, { onConflict: 'shop_id,company_id' })
          .select()
          .single();
        if (error) {
          alert('フォロー申請に失敗しました');
          return;
        }
        set((state) => {
           const existing = state.partnerships.find(p => p.shop_id === shopId && p.company_id === companyId);
           if (existing) {
             return { partnerships: state.partnerships.map(p => p.id === existing.id ? data : p) };
           }
           return { partnerships: [...state.partnerships, data] };
        });
      },

      approvePartnership: async (partnershipId, role) => {
        const updatePayload = role === ROLES.SHOP_ADMIN ? { shop_approved: true } : { company_approved: true };
        const { error } = await supabase.from('partnerships').update(updatePayload).eq('id', partnershipId);
        if (error) {
          alert('承認に失敗しました');
          return;
        }
        set((state) => ({
          partnerships: state.partnerships.map(p => p.id === partnershipId ? { ...p, ...updatePayload } : p)
        }));
      },

      cancelPartnership: async (partnershipId) => {
        const { error } = await supabase.from('partnerships').delete().eq('id', partnershipId);
        if (error) {
          alert('連携の解除に失敗しました');
          return;
        }
        set((state) => ({
          partnerships: state.partnerships.filter(p => p.id !== partnershipId)
        }));
      },

      // --- 実績報告関連 ---
      // 報告関連のアクション（DB保存化）
      saveReport: async (date, staffId, shopId, data) => {
        const { targetYearMonth } = get();
        if (!targetYearMonth) return;
        const targetDateStr = `${targetYearMonth}-${String(date).padStart(2, '0')}`;
        console.log("=== saveReport Payload ===");
        console.log({ target_date: targetDateStr, staff_id: staffId, shop_id: shopId, items: data.items, status: data.status });
        try {
          const response = await supabase.from('reports').upsert({
            target_date: targetDateStr,
            staff_id: staffId,
            shop_id: shopId,
            items: data.items,
            status: data.status
          }, { onConflict: 'target_date,staff_id' });
          
          console.log("=== saveReport Response ===");
          console.log(response);

          if (response.error) throw response.error;
        } catch(e) {
          console.error("Report save failed:", e);
          alert(`実績の保存に失敗しました:\n${e.message}`);
          throw e;
        }
      },

      // --- 通知 ---

      fetchNotifications: async () => {
        const { currentUser } = get();
        if (!currentUser) return;
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50);
        set({ notifications: data || [] });
      },

      markNotificationAsRead: async (id) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        set(state => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
        }));
      },

      markAllNotificationsAsRead: async () => {
        const { currentUser } = get();
        if (!currentUser) return;
        await supabase.from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .eq('is_read', false);
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, is_read: true }))
        }));
      },

      subscribeToRealtime: () => {
        const uniqueId = Math.random().toString(36).substring(7);
        
        const orderSubscription = supabase
          .channel(`public:orders-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const currentMonth = get().targetYearMonth;
            if (eventType === 'DELETE') {
              if (oldRecord && oldRecord.target_date && (!currentMonth || oldRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newOrders = { ...state.orders };
                  const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                  if (newOrders[date]?.[oldRecord.shop_id]?.[oldRecord.company_id]) {
                    delete newOrders[date][oldRecord.shop_id][oldRecord.company_id][oldRecord.business_type];
                  }
                  return { orders: newOrders };
                });
              }
            } else {
              if (newRecord && newRecord.target_date && (!currentMonth || newRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newOrders = { ...state.orders };
                  const date = parseInt(newRecord.target_date.split('-')[2], 10);
                  if (!newOrders[date]) newOrders[date] = {};
                  if (!newOrders[date][newRecord.shop_id]) newOrders[date][newRecord.shop_id] = {};
                  if (!newOrders[date][newRecord.shop_id][newRecord.company_id]) newOrders[date][newRecord.shop_id][newRecord.company_id] = {};
                  newOrders[date][newRecord.shop_id][newRecord.company_id][newRecord.business_type] = newRecord.requested_count;
                  return { orders: newOrders };
                });
              }
            }
          })
          .subscribe();

        const assignmentSubscription = supabase
          .channel(`public:assignments-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const currentMonth = get().targetYearMonth;
            
            if (eventType === 'DELETE') {
              if (oldRecord && oldRecord.target_date && (!currentMonth || oldRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newAssignments = { ...state.assignments };
                  const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                  if (newAssignments[date]) {
                    delete newAssignments[date][oldRecord.staff_id];
                  }
                  return { assignments: newAssignments };
                });
              }
            } else {
              if (newRecord && newRecord.target_date && (!currentMonth || newRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newAssignments = { ...state.assignments };
                  const date = parseInt(newRecord.target_date.split('-')[2], 10);
                  if (!newAssignments[date]) newAssignments[date] = {};
                  newAssignments[date][newRecord.staff_id] = {
                    shopId: newRecord.shop_id,
                    businessType: newRecord.business_type,
                    status: newRecord.status
                  };

                  if (newRecord.status === 'published') {
                    const currentUser = get().currentUser;
                    if (currentUser?.role === 'shop_admin') {
                      const currentStaffs = get().staffs;
                      if (!currentStaffs.find(s => s.id === newRecord.staff_id)) {
                        supabase.from('profiles').select('*').eq('id', newRecord.staff_id).single().then(({data}) => {
                          if (data) {
                            set(s => ({
                              staffs: [...s.staffs, {
                                id: data.id,
                                role: data.role,
                                name: data.name,
                                companyId: data.company_id,
                                dailySalary: data.daily_salary
                              }]
                            }));
                          }
                        });
                      }
                    }
                  }
                  return { assignments: newAssignments };
                });
              }
            }
          })
          .subscribe();

        const reportSubscription = supabase
          .channel(`public:reports-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const currentMonth = get().targetYearMonth;
            
            if (eventType === 'DELETE') {
              if (oldRecord && oldRecord.target_date && (!currentMonth || oldRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newReports = { ...state.reports };
                  const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                  if (newReports[date]) {
                    delete newReports[date][oldRecord.staff_id];
                  }
                  return { reports: newReports };
                });
              }
            } else {
              if (newRecord && newRecord.target_date && (!currentMonth || newRecord.target_date.startsWith(currentMonth))) {
                set((state) => {
                  const newReports = { ...state.reports };
                  const date = parseInt(newRecord.target_date.split('-')[2], 10);
                  if (!newReports[date]) newReports[date] = {};
                  newReports[date][newRecord.staff_id] = {
                    shopId: newRecord.shop_id,
                    items: newRecord.items,
                    status: newRecord.status
                  };
                  return { reports: newReports };
                });
              }
            }
          })
          .subscribe();
          
        const messageSubscription = supabase
          .channel(`public:messages-${uniqueId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
            const { new: newMsg } = payload;
            const currentUser = get().currentUser;
            if (!currentUser || newMsg.sender_id === currentUser.id) return;

            // 送信者プロフィールを取得してメッセージを補完
            const { data: fullMsg } = await supabase
              .from('messages')
              .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(id, name), message_reads(user_id, read_at)')
              .eq('id', newMsg.id)
              .single();

            const msg = fullMsg || { ...newMsg, sender: null, message_reads: [] };
            const convId = newMsg.conversation_id;

            set(state => {
              const newState = {};
              // 会話が開いていればメッセージリストに追加（重複チェック）
              if (state.messages[convId]) {
                const alreadyExists = state.messages[convId].some(m => m.id === msg.id);
                if (!alreadyExists) {
                  newState.messages = {
                    ...state.messages,
                    [convId]: [...state.messages[convId], msg],
                  };
                }
              }
              // 会話リストの最新メッセージ・未読数を更新
              newState.conversations = state.conversations.map(c =>
                c.id === convId ? { ...c, lastMessage: msg, unreadCount: (c.unreadCount || 0) + 1 } : c
              );
              return newState;
            });

            // 通知をスレッド単位で1件にまとめる
            const state = get();
            const existingNotif = state.notifications.find(
              n => n.type === 'new_message' && n.related_id === convId && !n.is_read
            );
            const conv = state.conversations.find(c => c.id === convId);
            const partnerName = currentUser.role === ROLES.SHOP_ADMIN
              ? conv?.company?.name || '相手'
              : conv?.shop?.name || '相手';

            if (existingNotif) {
              // 既存の未読通知を更新
              const unreadCount = (state.messages[convId] || [])
                .filter(m => m.sender_id !== currentUser.id && !(m.message_reads || []).some(r => r.user_id === currentUser.id))
                .length || 2;
              const newBody = `${unreadCount}件の未読メッセージ`;
              const newCreatedAt = new Date().toISOString();
              await supabase.from('notifications')
                .update({ body: newBody, created_at: newCreatedAt })
                .eq('id', existingNotif.id);
              set(s => ({
                notifications: s.notifications.map(n =>
                  n.id === existingNotif.id ? { ...n, body: newBody, created_at: newCreatedAt } : n
                )
              }));
            } else {
              // 新規通知を作成（自分自身への INSERT → RLS: user_id = auth.uid()）
              const { data: notif, error } = await supabase
                .from('notifications')
                .insert({
                  user_id: currentUser.id,
                  type: 'new_message',
                  title: `${partnerName}からのメッセージ`,
                  body: msg.content,
                  related_id: convId,
                })
                .select()
                .single();
              if (error) {
                console.error('通知の作成に失敗:', error);
              } else if (notif) {
                set(s => ({
                  notifications: s.notifications.some(n => n.id === notif.id)
                    ? s.notifications
                    : [notif, ...s.notifications],
                }));
              }
            }
          })
          .subscribe();

        const messageReadSubscription = supabase
          .channel(`public:message_reads-${uniqueId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, payload => {
            const { new: newRead } = payload;
            const currentUser = get().currentUser;
            if (!currentUser || newRead.user_id === currentUser.id) return;

            set(state => {
              const newMessages = { ...state.messages };
              for (const [convId, msgs] of Object.entries(newMessages)) {
                const msgIdx = msgs.findIndex(m => m.id === newRead.message_id);
                if (msgIdx !== -1) {
                  const updatedMsgs = [...msgs];
                  updatedMsgs[msgIdx] = {
                    ...updatedMsgs[msgIdx],
                    message_reads: [...(updatedMsgs[msgIdx].message_reads || []), { user_id: newRead.user_id, read_at: newRead.read_at }],
                  };
                  newMessages[convId] = updatedMsgs;
                  break;
                }
              }
              return { messages: newMessages };
            });
          })
          .subscribe();

        const currentUser = get().currentUser;
        const notificationSubscription = supabase
          .channel(`public:notifications-${uniqueId}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser?.id}` },
            payload => {
              const notif = payload.new;
              set(s => ({
                notifications: s.notifications.some(n => n.id === notif.id) ? s.notifications : [notif, ...s.notifications]
              }));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(orderSubscription);
          supabase.removeChannel(assignmentSubscription);
          supabase.removeChannel(reportSubscription);
          supabase.removeChannel(messageSubscription);
          supabase.removeChannel(messageReadSubscription);
          supabase.removeChannel(notificationSubscription);
        };
      },
      addReportItem: async (name, companyId = null) => {
        if (!name) return;
        const { data, error } = await supabase.from('report_items').insert([{ name, company_id: companyId }]).select().single();
        if (!error && data) {
          set(state => ({
            reportItems: [...state.reportItems, { id: data.id, name: data.name, companyId: data.company_id }]
          }));
        }
      },
      removeReportItem: async (id) => {
        const { error } = await supabase.from('report_items').delete().eq('id', id);
        if (!error) {
          set(state => ({
            reportItems: state.reportItems.filter(i => i.id !== id)
          }));
        }
      },

      // --- メッセージング ---

      fetchConversations: async () => {
        try {
          const { data: convData, error } = await supabase
            .from('conversations')
            .select('id, shop_id, company_id, created_at, shop:shops(id, name), company:companies(id, name)');
          if (error) throw error;
          if (!convData?.length) { set({ conversations: [] }); return; }

          const convIds = convData.map(c => c.id);
          const { data: msgData } = await supabase
            .from('messages')
            .select('id, conversation_id, content, created_at, sender_id, message_reads(user_id)')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
            .limit(100);

          const currentUserId = get().currentUser?.id;
          // 会話ごとに最新メッセージ・未読数を集計
          const lastMsgMap = {};
          const unreadCountMap = {};
          (msgData || []).forEach(msg => {
            if (!lastMsgMap[msg.conversation_id]) lastMsgMap[msg.conversation_id] = msg;
            if (msg.sender_id !== currentUserId && !(msg.message_reads || []).some(r => r.user_id === currentUserId)) {
              unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
            }
          });

          set({
            conversations: convData.map(c => ({
              ...c,
              lastMessage: lastMsgMap[c.id] || null,
              unreadCount: unreadCountMap[c.id] || 0,
            }))
          });
        } catch (e) {
          console.error('fetchConversations error:', e);
        }
      },

      fetchMessages: async (conversationId) => {
        try {
          const { data, error } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(id, name), message_reads(user_id, read_at)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
          if (error) throw error;
          set(state => ({
            messages: { ...state.messages, [conversationId]: data || [] }
          }));
        } catch (e) {
          console.error('fetchMessages error:', e);
        }
      },

      sendMessage: async (conversationId, content) => {
        const { currentUser } = get();
        const tempId = `temp-${Date.now()}`;

        const tempMsg = {
          id: tempId,
          conversation_id: conversationId,
          sender_id: currentUser.id,
          sender: { id: currentUser.id, name: currentUser.name },
          content,
          created_at: new Date().toISOString(),
          message_reads: [],
          _temp: true,
        };

        set(state => ({
          messages: {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), tempMsg],
          },
          conversations: state.conversations.map(c =>
            c.id === conversationId ? { ...c, lastMessage: tempMsg } : c
          ),
        }));

        try {
          const { data, error } = await supabase
            .from('messages')
            .insert({ conversation_id: conversationId, sender_id: currentUser.id, content })
            .select('id, conversation_id, sender_id, content, created_at, message_reads(user_id, read_at)')
            .single();
          if (error) throw error;

          const fullMsg = { ...data, sender: { id: currentUser.id, name: currentUser.name } };
          set(state => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId].map(m => m.id === tempId ? fullMsg : m),
            },
            conversations: state.conversations.map(c =>
              c.id === conversationId ? { ...c, lastMessage: fullMsg } : c
            ),
          }));
        } catch (e) {
          console.error('sendMessage error:', e);
          set(state => ({
            messages: {
              ...state.messages,
              [conversationId]: (state.messages[conversationId] || []).filter(m => m.id !== tempId),
            },
          }));
          alert('メッセージの送信に失敗しました');
        }
      },

      markConversationAsRead: async (conversationId) => {
        const { currentUser } = get();
        const convMessages = get().messages[conversationId] || [];

        const unreadIds = convMessages
          .filter(m => m.sender_id !== currentUser.id && !m.message_reads?.some(r => r.user_id === currentUser.id))
          .map(m => m.id);
        if (!unreadIds.length) return;

        await supabase.from('message_reads')
          .upsert(unreadIds.map(id => ({ message_id: id, user_id: currentUser.id })), { onConflict: 'message_id,user_id' });

        const newRead = { user_id: currentUser.id, read_at: new Date().toISOString() };
        set(state => ({
          messages: {
            ...state.messages,
            [conversationId]: state.messages[conversationId].map(m =>
              unreadIds.includes(m.id) ? { ...m, message_reads: [...(m.message_reads || []), newRead] } : m
            ),
          },
          conversations: state.conversations.map(c => {
            if (c.id !== conversationId) return c;
            const updatedLastMsg = c.lastMessage && unreadIds.includes(c.lastMessage.id)
              ? { ...c.lastMessage, message_reads: [...(c.lastMessage.message_reads || []), newRead] }
              : c.lastMessage;
            return { ...c, lastMessage: updatedLastMsg, unreadCount: 0 };
          }),
        }));

        // 対応するメッセージ通知を既読にする
        const notif = get().notifications.find(n => n.type === 'new_message' && n.related_id === conversationId && !n.is_read);
        if (notif) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
          set(s => ({
            notifications: s.notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
          }));
        }
      },

      getOrCreateConversation: async (shopId, companyId) => {
        const existing = get().conversations.find(c => c.shop_id === shopId && c.company_id === companyId);
        if (existing) return existing;

        const { data, error } = await supabase
          .from('conversations')
          .upsert({ shop_id: shopId, company_id: companyId }, { onConflict: 'shop_id,company_id' })
          .select('id, shop_id, company_id, created_at, shop:shops(id, name), company:companies(id, name)')
          .single();
        if (error) throw error;

        const newConv = { ...data, lastMessage: null };
        set(state => ({
          conversations: state.conversations.some(c => c.id === data.id)
            ? state.conversations
            : [newConv, ...state.conversations],
        }));
        return newConv;
      },


    }),
    {
      name: 'shift-storage',
      // ローカルストレージには「ログイン状態（currentUser）」のみを保存し、キャッシュ問題を完全に解決する
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);
