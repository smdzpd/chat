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

/* ============ AI 自动回复（DeepSeek） ============ */
var AI_KEY = 'sk-01d0c91cadab456abb9e714a27adfd6c';
var AI_MODEL = 'deepseek-chat'; // 可选: deepseek-chat / deepseek-reasoner

function callAI(messages) {
    // 构建对话上下文
    var systemMsg = '你是一个友好的聊天机器人，在多人聊天室里和大家聊天。回复简短自然，一句话即可，不要超过50字。可以用表情。';
    var chatMsgs = [{ role: 'system', content: systemMsg }];
    for (var i = 0; i < messages.length; i++) {
        chatMsgs.push({ role: 'user', content: messages[i].name + '说：' + messages[i].content });
    }

    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort(); }, 15000);

    return fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
            'Authorization': 'Bearer ' + AI_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: chatMsgs,
            stream: false,
            max_tokens: 200
        })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.choices && data.choices[0]) {
            return data.choices[0].message.content.trim();
        }
        return '🤖 我在思考中...';
    }).catch(function() {
        return '🤖 网络开小差了～';
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

        // 取最近几条消息作为 AI 上下文
        var recent = [{ name: name, content: text }];
        var items = chatBox.querySelectorAll('.msg');
        var ctx = [];
        for (var i = Math.max(0, items.length - 5); i < items.length; i++) {
            var n = items[i].querySelector('.msg-name');
            var b = items[i].querySelector('.msg-bubble');
            if (n && b) ctx.push({ name: n.textContent.replace('AI','').trim(), content: b.textContent });
        }
        if (ctx.length > 1) recent = ctx;

        return callAI(recent);
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
