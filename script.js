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
var AI_MODEL = 'deepseek-chat';

/* ============ AI 人格设定（基于聊天记录学习） ============ */
var AI_PERSONA = '你是一个叫7的聊天伙伴，以下是你的说话风格：\n\
1. 说话极短，大部分消息不超过10个字\n\
2. 爱用表情和表情包，一张图能表达就不打字\n\
3. 喜欢调侃和反问，说话带点贱兮兮的幽默感\n\
4. 经常用"？""。。""啥""吗""吧""呗"这些语气词\n\
5. 接话很快，常吐槽，但语气是友好的\n\
6. 偶尔发"[白眼]""[委屈]"等表情\n\
7. 不会长篇大论，一句话解决\n\
8. 没人说话时会主动问"？""人呢""好无聊"\n\
\n\
以下是你的说话例子：\n\
"呦""。。""？""鱼来的""使劲想想""多大点事"\n\
"你不是和她宝子吗""啥意思""你是狗 那你不领"\n\
"？所以啥意思""你分饰多角呢""给你机会重新说"\n\
"吃不吃瓜""我又不是天天挂这""？。？"\n\
"品味不错[强]""记得吗""又来了""辛苦辛苦"\n\
"加油""多帅""你才看到吗""想不想要这个"\n\
"对的""好""包的""不信""哦。""嗯哼""呗"\n\
\n\
现在你就是7，在多人聊天室里，按你的风格回复。';

var idleTimer = null;
var IDLE_TIME = 60000; // 60秒没人说话，AI主动发一句

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(sendIdleMessage, IDLE_TIME);
}

function sendIdleMessage() {
    // 取最近几条消息作为上下文
    var recent = [];
    var items = chatBox.querySelectorAll('.msg');
    var ctx = [];
    for (var i = Math.max(0, items.length - 3); i < items.length; i++) {
        var n = items[i].querySelector('.msg-name');
        var b = items[i].querySelector('.msg-bubble');
        if (n && b) ctx.push({ name: n.textContent.replace('AI','').trim(), content: b.textContent });
    }
    if (ctx.length > 0) recent = ctx;

    callAI(recent, true).then(function(reply) {
        return fetch(API + '/rest/v1/' + TABLE, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: 'AI', content: reply, is_ai: true })
        });
    }).then(function() { knownIds = {}; loadMessages(true); if(idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(sendIdleMessage, IDLE_TIME); }).catch(function(){});
}

function callAI(messages, isIdle) {
    // 构建对话上下文
    var systemMsg = AI_PERSONA;
    if (isIdle) systemMsg += '\n（注意：聊天室已经冷场好久了，你主动说一句打破沉默，简短一点）';
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

/* ============ 发送消息（立即显示 + 后台保存） ============ */
function sendMessage() {
    var name = nameInput.value.trim() || '匿名';
    var text = msgInput.value.trim();
    if (!text || loading) return;

    loading = true;
    sendBtn.disabled = true;
    msgInput.value = '';

    // ★ 立即显示消息，不等数据库
    var selfHtml = '<div class="msg self user" data-id="opt_' + Date.now() + '">' +
        '<div class="msg-avatar">😎</div>' +
        '<div class="msg-body">' +
            '<span class="msg-name">' + esc(name) + '</span>' +
            '<div class="msg-bubble">' + esc(text) + '</div>' +
        '</div></div>';
    chatBox.insertAdjacentHTML('beforeend', selfHtml);
    scrollToBottom();
    resetIdleTimer();

    // 后台存数据库 + 调 AI
    fetch(API + '/rest/v1/' + TABLE, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name: name, content: text })
    }).then(function() {
        // 获取最近几条消息作为 AI 上下文
        var recent = [{ name: name, content: text }];
        return callAI(recent);
    }).then(function(aiReply) {
        // ★ 立即显示 AI 回复
        if (aiReply) {
            var aiHtml = '<div class="msg ai" data-id="ai_' + Date.now() + '">' +
                '<div class="msg-avatar">🤖</div>' +
                '<div class="msg-body">' +
                    '<span class="msg-name">AI<span class="ai-tag">AI</span></span>' +
                    '<div class="msg-bubble">' + esc(aiReply) + '</div>' +
                '</div></div>';
            chatBox.insertAdjacentHTML('beforeend', aiHtml);
            scrollToBottom();
        }
        // 后台存 AI 回复
        return fetch(API + '/rest/v1/' + TABLE, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: 'AI', content: aiReply, is_ai: true })
        });
    }).then(function() {
        knownIds = {};
        loadMessages(false);
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
resetIdleTimer(); // 启动空闲计时器
