/* ============ 配置 ============ */
var API = 'https://xmjmgfusfuyoifxbscur.supabase.co';
var KEY = 'sb_publishable_FpfJWcT59igaSPSue6nk0w_70Sac-wc';
var TABLE = 'chat_messages';

/* ============ DOM ============ */
var $ = function(id) { return document.getElementById(id); };
var chatBox = $('chatBox');
var msgInput = $('msgInput');
var sendBtn = $('sendBtn');
var nameInput = $('nameInput');

/* ============ 状态 ============ */
var myName = localStorage.getItem('chat_name') || '';
var knownIds = {};
var loading = false;

if (myName) nameInput.value = myName;
nameInput.addEventListener('change', function() {
    localStorage.setItem('chat_name', nameInput.value.trim() || '');
});

/* ============ AI 自动回复（占位）====================
 * 用户提供 API 后替换此函数即可
 * 参数: messages - 最近 N 条聊天记录 [{name, content}]
 * 返回: AI 回复文本
 * ================================================ */
function callAI(messages) {
    // ★ 在这里接入你的 AI API ★
    // 示例：fetch('你的API地址', { method:'POST', body: JSON.stringify({messages}) })

    return new Promise(function(resolve) {
        setTimeout(function() {
            var replies = [
                '🤔 有意思，展开说说？',
                '😄 哈哈说得对！',
                '👀 我在听，继续～',
                '💡 这个问题我也想过！',
                '✨ 有道理！',
                '🎯 说得好！',
                '🤗 原来如此～',
                '🌟 给你点赞！'
            ];
            resolve(replies[Math.floor(Math.random() * replies.length)]);
        }, 1000);
    });
}

/* ============ 发送消息 ============ */
function sendMessage() {
    var name = nameInput.value.trim() || '匿名';
    var text = msgInput.value.trim();
    if (!text || loading) return;

    loading = true;
    sendBtn.disabled = true;
    msgInput.value = '';

    // 保存用户消息
    fetch(API + '/rest/v1/' + TABLE, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name: name, content: text })
    }).then(function() {
        loadMessages(true);

        // 调用 AI 回复
        return callAI([{ name: name, content: text }]);
    }).then(function(aiReply) {
        // 保存 AI 回复
        return fetch(API + '/rest/v1/' + TABLE, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: 'AI', content: aiReply, is_ai: true })
        });
    }).then(function() {
        loadMessages(true);
        loading = false;
        sendBtn.disabled = false;
    }).catch(function() {
        loading = false;
        sendBtn.disabled = false;
    });
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

/* ============ 加载消息 ============ */
function msgHtml(m) {
    var t = '';
    if (m.created_at) {
        var bj = new Date(new Date(m.created_at).getTime() + 8 * 3600000);
        t = bj.toISOString().slice(11, 19);
    }
    var isSelf = m.name === (nameInput.value.trim() || '匿名');
    var isAI = m.is_ai;
    var side = isAI ? 'ai' : (isSelf ? 'self user' : 'user');
    var avatar = isAI ? '🤖' : (isSelf ? '😎' : '👤');
    var nameTag = isAI ? '<span class="msg-name">' + esc(m.name) + '<span class="ai-tag">AI</span></span>' :
                         '<span class="msg-name">' + esc(m.name) + '</span>';
    return '<div class="msg ' + side + '" data-id="' + m.id + '">' +
        '<div class="msg-avatar">' + avatar + '</div>' +
        '<div class="msg-body">' +
            nameTag +
            '<div class="msg-bubble">' + esc(m.content) + '</div>' +
            '<div class="msg-time">' + t + '</div>' +
        '</div></div>';
}

function loadMessages(scroll) {
    fetch(API + '/rest/v1/' + TABLE + '?order=created_at.asc&limit=200', {
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.length) {
            if (Object.keys(knownIds).length === 0) {
                chatBox.innerHTML = '<div class="loading">还没有消息，发一条吧！</div>';
            }
            return;
        }

        // 首次加载
        if (Object.keys(knownIds).length === 0) {
            chatBox.innerHTML = data.map(msgHtml).join('');
            data.forEach(function(m) { knownIds[m.id] = true; });
            if (scroll !== false) scrollToBottom();
            return;
        }

        // 增量追加新消息
        var newItems = '';
        for (var i = 0; i < data.length; i++) {
            if (!knownIds[data[i].id]) {
                newItems += msgHtml(data[i]);
                knownIds[data[i].id] = true;
            }
        }
        if (newItems) {
            chatBox.insertAdjacentHTML('beforeend', newItems);
            if (scroll !== false) scrollToBottom();
        }
    }).catch(function(){});
}

function scrollToBottom() {
    setTimeout(function() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);
}

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* ============ 启动 ============ */
loadMessages();
setInterval(function() { loadMessages(false); }, 2000);
