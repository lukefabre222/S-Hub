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

// 曜日計算 (2026年4月ベース)
export const getDayOfWeek = (day) => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(2026, 3, day);
  return days[date.getDay()];
};

// 2026年4月の祝日モック (4/29 昭和の日)
export const isHoliday = (day) => {
  return day === 29;
};

// 日付リスト
const DATES = Array.from({ length: 31 }, (_, i) => i + 1);

// 報告項目モック
const initialReportItems = ['応対数', '販売誘導', '機種変更', 'HS新規', 'PI', '光', 'dカードGOLD'];

export const useShiftStore = create(
  persist(
    (set, get) => ({
      dates: DATES,
      companies: [],
      shops: [],
      staffs: [],
      assignments: {},
      orders: {},

      // 報告関連のステート
      reportItems: initialReportItems,
      reports: {}, 

      // 認証ステート
      currentUser: null,
      isDataLoaded: false,

      login: (user) => set({ currentUser: user }),
      logout: async () => {
        await supabase.auth.signOut();
        set({ 
          currentUser: null,
          orders: {},
          assignments: {},
          staffs: [],
          reports: {},
          isDataLoaded: false
        });
      },

      // ⬇ 初期データ取得処理 (Supabaseから最新データを取得)
      fetchInitialData: async () => {
        try {
          const { data: cData } = await supabase.from('companies').select('*');
          const { data: sData } = await supabase.from('shops').select('*');
          // スタッフとして登録されているプロフィール情報を取得 ( sort_order順 )
          const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .in('role', [ROLES.STAFF, ROLES.COMPANY_ADMIN])
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
          
          const { data: oData } = await supabase.from('orders').select('*');
          const { data: aData } = await supabase.from('assignments').select('*');
          const { data: rData } = await supabase.from('reports').select('*');
          const { data: ratesData } = await supabase.from('shop_rates').select('*');

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
                   shopsMap[r.shop_id].rates[r.business_type] = r.daily_rate;
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

          // オーダーデータの整形: orders[date][shopId][businessType] = count
          const formattedOrders = {};
          if (oData) {
            oData.forEach(row => {
               const day = parseInt(row.target_date.split('-')[2], 10);
               if (!formattedOrders[day]) formattedOrders[day] = {};
               if (!formattedOrders[day][row.shop_id]) formattedOrders[day][row.shop_id] = {};
               formattedOrders[day][row.shop_id][row.business_type] = row.requested_count;
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
            isDataLoaded: true
          });

        } catch (error) {
          console.error("データ取得エラー:", error);
        }
      },

      // ⬇ DB書き込み対応したアクション郡
      updateOrder: async (date, shopId, businessType, count) => {
        const targetDateStr = `2026-04-${String(date).padStart(2, '0')}`;
        
        // 状態をオプティミスティック（即時）更新
        set((state) => {
          const newOrders = { ...state.orders };
          if (!newOrders[date]) newOrders[date] = {};
          if (!newOrders[date][shopId]) newOrders[date][shopId] = {};
          newOrders[date][shopId][businessType] = Number(count);
          return { orders: newOrders };
        });

        try {
          // count <= 0 の場合でも delete せず requested_count: 0 として UPDATE させる。
          const { error } = await supabase.from('orders')
            .upsert({
              target_date: targetDateStr,
              shop_id: shopId,
              business_type: businessType,
              requested_count: Number(count)
            }, { onConflict: 'target_date,shop_id,business_type' });
          if (error) throw error;
        } catch (e) {
          console.error("Order update failed:", e);
          const currentUser = get().currentUser;
          alert(`オーダーの保存に失敗しました:\nRole: ${currentUser?.role}\nShopID: ${shopId}\nDate: ${targetDateStr}\nError: ${e.message}`);
        }
      },

      assignShift: async (date, staffId, shopId, businessType) => {
        const targetDateStr = `2026-04-${String(date).padStart(2, '0')}`;
        
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
        } catch (e) {
          console.error("Publish failed:", e);
        }
      },

      updateShopRate: async (id, businessType, dailyRate) => {
        await supabase.from('shop_rates').upsert({
           shop_id: id,
           business_type: businessType,
           daily_rate: Number(dailyRate)
        }, { onConflict: 'shop_id,business_type' });

        set((state) => ({
          shops: state.shops.map(shop => 
            shop.id === id 
            ? { ...shop, rates: { ...shop.rates, [businessType]: Number(dailyRate) } } 
            : shop
          )
        }));
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

      // 報告関連のアクション（DB保存化）
      saveReport: async (date, staffId, shopId, data) => {
        const targetDateStr = `2026-04-${String(date).padStart(2, '0')}`;
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

      subscribeToRealtime: () => {
        const uniqueId = Math.random().toString(36).substring(7);
        
        const orderSubscription = supabase
          .channel(`public:orders-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            set((state) => {
              const newOrders = { ...state.orders };
              
              if (eventType === 'DELETE') {
                const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                if (newOrders[date]?.[oldRecord.shop_id]) {
                  delete newOrders[date][oldRecord.shop_id][oldRecord.business_type];
                }
              } else {
                const date = parseInt(newRecord.target_date.split('-')[2], 10);
                if (!newOrders[date]) newOrders[date] = {};
                if (!newOrders[date][newRecord.shop_id]) newOrders[date][newRecord.shop_id] = {};
                newOrders[date][newRecord.shop_id][newRecord.business_type] = newRecord.requested_count;
              }
              return { orders: newOrders };
            });
          })
          .subscribe();

        const assignmentSubscription = supabase
          .channel(`public:assignments-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            set((state) => {
              const newAssignments = { ...state.assignments };
              
              if (eventType === 'DELETE') {
                if (oldRecord && oldRecord.target_date) {
                  const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                  if (newAssignments[date]) {
                    delete newAssignments[date][oldRecord.staff_id];
                  }
                }
              } else {
                const date = parseInt(newRecord.target_date.split('-')[2], 10);
                if (!newAssignments[date]) newAssignments[date] = {};
                newAssignments[date][newRecord.staff_id] = {
                  shopId: newRecord.shop_id,
                  businessType: newRecord.business_type,
                  status: newRecord.status
                };

                // もし店舗管理者で、新しいスタッフのアサイン（published）が来たらプロフィールを追加フェッチする
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
              }
              return { assignments: newAssignments };
            });
          })
          .subscribe();

        const reportSubscription = supabase
          .channel(`public:reports-${uniqueId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, payload => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            set((state) => {
              const newReports = { ...state.reports };
              
              if (eventType === 'DELETE') {
                if (oldRecord && oldRecord.target_date) {
                  const date = parseInt(oldRecord.target_date.split('-')[2], 10);
                  if (newReports[date]) {
                    delete newReports[date][oldRecord.staff_id];
                  }
                }
              } else {
                const date = parseInt(newRecord.target_date.split('-')[2], 10);
                if (!newReports[date]) newReports[date] = {};
                newReports[date][newRecord.staff_id] = {
                  shopId: newRecord.shop_id,
                  items: newRecord.items,
                  status: newRecord.status
                };
              }
              return { reports: newReports };
            });
          })
          .subscribe();
          
        return () => {
          supabase.removeChannel(orderSubscription);
          supabase.removeChannel(assignmentSubscription);
          supabase.removeChannel(reportSubscription);
        };
      },
      addReportItem: (item) => set((state) => {
        if (!item || state.reportItems.includes(item)) return state;
        return { reportItems: [...state.reportItems, item] };
      }),
      removeReportItem: (item) => set((state) => ({
        reportItems: state.reportItems.filter(i => i !== item)
      })),


    }),
    {
      name: 'shift-storage',
      // ローカルストレージには「ログイン状態（currentUser）」のみを保存し、キャッシュ問題を完全に解決する
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);
