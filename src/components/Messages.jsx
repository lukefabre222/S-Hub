import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShiftStore, ROLES } from '../store/useShiftStore';
import { Send, MessageCircle } from 'lucide-react';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatPreviewDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(dateStr);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨日';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Messages() {
  const {
    currentUser, conversations, messages, partnerships, shops, companies, staffs,
    fetchConversations, fetchMessages, sendMessage, markConversationAsRead, getOrCreateConversation,
  } = useShiftStore();

  const [selectedConvId, setSelectedConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const composingRef = useRef(false);
  const justFinishedRef = useRef(false);
  const blockedRef = useRef(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[selectedConvId]?.length]);

  // 会話を開いている間に新しいメッセージが届いたら自動で既読にする
  const currentMsgsLength = selectedConvId ? (messages[selectedConvId]?.length ?? 0) : 0;
  useEffect(() => {
    if (selectedConvId && currentMsgsLength > 0) {
      markConversationAsRead(selectedConvId);
    }
  }, [selectedConvId, currentMsgsLength]);

  const handleSelectConv = async (convId) => {
    setSelectedConvId(convId);
    await fetchMessages(convId);
  };

  const handleStartConversation = async (shopId, companyId) => {
    try {
      const conv = await getOrCreateConversation(shopId, companyId);
      if (conv) await handleSelectConv(conv.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedConvId) return;
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(selectedConvId, text);
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (composingRef.current) {
      blockedRef.current = true;
      return;
    }
    if (justFinishedRef.current) {
      justFinishedRef.current = false;
      return;
    }
    handleSend();
  };

  const isShopAdmin = currentUser?.role === ROLES.SHOP_ADMIN;
  const isCompanyAdmin = currentUser?.role === ROLES.COMPANY_ADMIN;

  const myPartnerships = useMemo(() => {
    return partnerships.filter(p => {
      if (!p.shop_approved || !p.company_approved) return false;
      if (isShopAdmin) return p.shop_id === currentUser.shopId;
      if (isCompanyAdmin) return p.company_id === currentUser.companyId;
      return true;
    });
  }, [partnerships, currentUser, isShopAdmin, isCompanyAdmin]);

  const displayList = useMemo(() => {
    return myPartnerships.map(p => {
      const conv = conversations.find(c => c.shop_id === p.shop_id && c.company_id === p.company_id);
      const shop = shops.find(s => s.id === p.shop_id);
      const company = companies.find(c => c.id === p.company_id);
      const partnerName = isShopAdmin ? (company?.name || '不明') : (shop?.name || '不明');

      const lastMsg = conv?.lastMessage || null;
      const isUnread = !!(lastMsg &&
        lastMsg.sender_id !== currentUser.id &&
        !lastMsg.message_reads?.some(r => r.user_id === currentUser.id));

      return {
        key: `${p.shop_id}-${p.company_id}`,
        convId: conv?.id || null,
        shopId: p.shop_id,
        companyId: p.company_id,
        partnerName,
        lastMsg,
        isUnread,
      };
    }).sort((a, b) => {
      const aT = a.lastMsg?.created_at || 0;
      const bT = b.lastMsg?.created_at || 0;
      return new Date(bT) - new Date(aT);
    });
  }, [myPartnerships, conversations, shops, companies, currentUser, isShopAdmin]);

  const selectedItem = displayList.find(d => d.convId === selectedConvId);
  const currentMessages = selectedConvId ? (messages[selectedConvId] || []) : [];

  const getSenderName = (senderId) => {
    if (senderId === currentUser.id) return currentUser.name;
    return staffs.find(s => s.id === senderId)?.name || '相手';
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">

      {/* 左パネル: 会話リスト */}
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <h2 className="font-bold text-gray-700 flex items-center text-sm">
            <MessageCircle size={16} className="mr-2 text-indigo-500" />
            メッセージ
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayList.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs leading-relaxed mt-4">
              連携済みのパートナーが<br />ありません
            </div>
          ) : (
            displayList.map(item => (
              <button
                key={item.key}
                onClick={() => item.convId ? handleSelectConv(item.convId) : handleStartConversation(item.shopId, item.companyId)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-3 border-l-[3px] ${selectedConvId === item.convId && item.convId ? 'bg-indigo-50 border-l-indigo-500' : 'border-l-transparent'}`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 font-bold text-indigo-700 text-sm">
                  {item.partnerName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm truncate ${item.isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {item.partnerName}
                    </span>
                    {item.lastMsg && (
                      <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                        {formatPreviewDate(item.lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className={`text-xs truncate flex-1 ${item.isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {item.lastMsg ? item.lastMsg.content : 'メッセージを送る →'}
                    </p>
                    {item.isUnread && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 ml-2" />
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右パネル: チャット */}
      {selectedConvId && selectedItem ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f2f5]">

          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-5 py-3 shrink-0 flex items-center shadow-sm">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center mr-3 font-bold text-indigo-700 text-sm shrink-0">
              {selectedItem.partnerName[0]}
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">{selectedItem.partnerName}</p>
              <p className="text-[10px] text-indigo-500 font-medium">連携済み</p>
            </div>
          </div>

          {/* メッセージ一覧 */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {currentMessages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-12 bg-white rounded-xl p-6 mx-auto max-w-xs border border-dashed border-gray-200">
                最初のメッセージを送ってみましょう
              </div>
            ) : (
              <div className="space-y-0.5">
                {currentMessages.map((msg, idx) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  const otherPartyRead = isOwn && msg.message_reads?.some(r => r.user_id !== currentUser.id);

                  const prevMsg = currentMessages[idx - 1];
                  const nextMsg = currentMessages[idx + 1];
                  const showDateDivider = !prevMsg ||
                    new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                  const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                  const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="flex items-center my-4">
                          <div className="flex-1 border-t border-gray-300" />
                          <span className="mx-3 text-[11px] text-gray-500 bg-[#f0f2f5] px-2 font-medium">
                            {new Date(msg.created_at).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                          </span>
                          <div className="flex-1 border-t border-gray-300" />
                        </div>
                      )}

                      <div className={`flex items-end gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>

                        {/* 相手アバター（グループ末尾のみ表示） */}
                        {!isOwn && (
                          <div className={`w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600 ${isLastInGroup ? 'opacity-100' : 'opacity-0'}`}>
                            {selectedItem.partnerName[0]}
                          </div>
                        )}

                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[60%]`}>
                          {/* 送信者名（グループ先頭・相手メッセージのみ） */}
                          {!isOwn && isFirstInGroup && (
                            <span className="text-[10px] text-gray-500 font-medium ml-1 mb-0.5">
                              {getSenderName(msg.sender_id)}
                            </span>
                          )}

                          {/* バブル */}
                          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                            isOwn
                              ? 'bg-indigo-500 text-white rounded-br-md'
                              : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'
                          } ${msg._temp ? 'opacity-60' : ''}`}>
                            {msg.content}
                          </div>
                        </div>

                        {/* 時刻 + 既読（グループ末尾のみ） */}
                        {isLastInGroup && (
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} shrink-0 pb-0.5`}>
                            {isOwn && otherPartyRead && (
                              <span className="text-[10px] text-indigo-400 font-medium leading-tight">既読</span>
                            )}
                            <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 入力エリア */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => {
                  composingRef.current = true;
                  justFinishedRef.current = false;
                  blockedRef.current = false;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                  if (!blockedRef.current) {
                    justFinishedRef.current = true;
                  }
                  blockedRef.current = false;
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                placeholder="メッセージを入力 (Enterで送信 / Shift+Enterで改行)"
                rows={1}
                className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed overflow-y-auto"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 flex items-center justify-center transition-colors shrink-0 shadow-sm"
              >
                <Send size={16} className={inputText.trim() ? 'text-white' : 'text-gray-400'} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
          <div className="text-center text-gray-400">
            <MessageCircle size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">左のリストから会話を選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}
