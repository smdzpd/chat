var API = 'https://xmjmgfusfuyoifxbscur.supabase.co';
var KEY = 'sb_publishable_FpfJWcT59igaSPSue6nk0w_70Sac-wc';
var TBL = 'chat_messages';

var nameInput = document.getElementById('nameInput');
var msgInput = document.getElementById('msgInput');
var sendBtn = document.getElementById('sendBtn');
var chatBox = document.getElementById('chatBox');

var myName = localStorage.getItem('chat_name') || '';
if (myName) nameInput.value = myName;
nameInput.addEventListener('change', function() {
    localStorage.setItem('chat_name', nameInput.value.trim() || '');
});

// 发送
function sendMsg() {
    var name = nameInput.value.trim() || '匿名';
    var text = msgInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    sendBtn.textContent = '...';
    msgInput.value = '';

    fetch(API + '/rest/v1/' + TBL, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Accept-Profile': 'public', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name: name, content: text })
    }).then(function() {
        loadMsg();
        // 调 AI
        return fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer sk-01d0c91cadab456abb9e714a27adfd6c', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你叫7，说话极短、爱吐槽、爱用表情。一句话不超过15字。' },
                    { role: 'user', content: name + '说：' + text }
                ],
                max_tokens: 100
            })
        });
    }).then(function(r) { return r.json(); }).then(function(data) {
        var reply = '🤔';
        if (data && data.choices && data.choices[0]) reply = data.choices[0].message.content.trim();
        return fetch(API + '/rest/v1/' + TBL, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Accept-Profile': 'public', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: 'AI', content: reply, is_ai: true })
        });
    }).then(function() {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        loadMsg();
    }).catch(function() {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
    });
}

sendBtn.addEventListener('click', sendMsg);
msgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// 加载
function loadMsg() {
    fetch(API + '/rest/v1/' + TBL + '?order=created_at.asc&limit=200', {
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Accept-Profile': 'public' }
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.length) {
            chatBox.innerHTML = '<div class="loading">还没有消息，发一条吧！</div>';
            return;
        }
        chatBox.innerHTML = data.map(function(m) {
            var t = '';
            if (m.created_at) {
                var bj = new Date(new Date(m.created_at).getTime() + 8 * 3600000);
                t = bj.toISOString().slice(11, 19);
            }
            var isSelf = m.name === (nameInput.value.trim() || '匿名');
            var isAI = m.is_ai;
            var side = isAI ? 'ai' : (isSelf ? 'self user' : 'user');
            var avatar = isAI ? '🤖' : '👤';
            var tag = isAI ? '<span class="ai-tag">AI</span>' : '';
            return '<div class="msg ' + side + '">' +
                '<div class="msg-avatar">' + avatar + '</div>' +
                '<div class="msg-body">' +
                    '<span class="msg-name">' + esc(m.name) + tag + '</span>' +
                    '<div class="msg-bubble">' + esc(m.content) + '</div>' +
                    '<div class="msg-time">' + t + '</div>' +
                '</div></div>';
        }).join('');
        setTimeout(function() { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
    }).catch(function(){});
}

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

loadMsg();
setInterval(loadMsg, 3000);
