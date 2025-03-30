// 格式化消息文本（保持不变）
function formatMessage(text) {
    if (!text) return '';
    
    let lines = text.split('\n');
    let formattedLines = lines.map(line => {
        line = line.replace(/\*\*(.*?)\*\*/g, '<span class="bold-text">$1</span>');
        return line;
    });
    
    let processedText = formattedLines.join('\n');
    let sections = processedText
        .split('###')
        .filter(section => section.trim())
        .map(section => {
            let lines = section.split('\n').filter(line => line.trim());
            if (lines.length === 0) return '';
            
            let result = '';
            let currentIndex = 0;
            
            while (currentIndex < lines.length) {
                let line = lines[currentIndex].trim();
                
                if (/^\d+\./.test(line)) {
                    result += `<p class="section-title">${line}</p>`;
                }
                else if (line.startsWith('-')) {
                    result += `<p class="subsection"><span class="bold-text">${line.replace(/^-/, '').trim()}</span></p>`;
                }
                else if (line.includes(':')) {
                    let [subtitle, content] = line.split(':').map(part => part.trim());
                    result += `<p><span class="subtitle">${subtitle}</span>: ${content}</p>`;
                }
                else {
                    result += `<p>${line}</p>`;
                }
                currentIndex++;
            }
            return result;
        });
    
    return sections.join('');
}

// 显示消息（保持不变）
function displayMessage(role, message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}`;
    
    const avatar = document.createElement('img');
    avatar.src = role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
    avatar.alt = role === 'user' ? 'User' : 'Bot';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = role === 'user' ? message : formatMessage(message);

    messageElement.appendChild(avatar);
    messageElement.appendChild(messageContent);
    messagesContainer.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth' });
}

// 生成 WebSocket 请求 URL（讯飞 Spark 需要动态鉴权）
function getWebSocketUrl() {
    // 替换为你的 API_KEY 和 APP_ID
    // 前端代码（script.js）
const API_KEY = process.env.NEXT_PUBLIC_XF_API_KEY; // 从 Vercel 环境变量读取
const APP_ID = process.env.NEXT_PUBLIC_XF_APP_ID;
    
    // 1. 生成鉴权参数
    const host = "spark-api.xf-yun.com";
    const date = new Date().toUTCString();
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v1.1/chat HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, API_KEY);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${API_KEY}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = btoa(authorizationOrigin);

    // 2. 构造 WebSocket URL
    return `wss://${host}/v1.1/chat?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
}

// 发送消息（改为使用 WebSocket 连接讯飞 Spark）
function sendMessage() {
    const inputElement = document.getElementById('chat-input');
    const message = inputElement.value;
    if (!message.trim()) return;

    displayMessage('user', message);
    inputElement.value = '';

    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'block';

    // 1. 建立 WebSocket 连接
    const socketUrl = getWebSocketUrl();
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        // 2. 发送请求数据
        const requestData = {
            header: {
                app_id: "d16d8679", // 替换为你的 APP_ID
                uid: "user123" // 用户ID（可选）
            },
            parameter: {
                chat: {
                    domain: "general", // 通用领域
                    temperature: 0.5,  // 控制随机性 (0~1)
                    max_tokens: 2048   // 最大生成长度
                }
            },
            payload: {
                message: {
                    text: [
                        { role: "user", content: message }
                    ]
                }
            }
        };
        socket.send(JSON.stringify(requestData));
    };

    socket.onmessage = (event) => {
        const responseData = JSON.parse(event.data);
        if (responseData.header.code !== 0) {
            console.error("讯飞 Spark 错误:", responseData.header.message);
            displayMessage('bot', '出错了: ' + responseData.header.message);
            return;
        }

        // 3. 处理流式响应（讯飞 Spark 是分段返回的）
        let fullResponse = "";
        const textArray = responseData.payload.choices.text;
        for (const textItem of textArray) {
            fullResponse += textItem.content;
        }

        // 更新消息（替换之前的加载状态）
        const messages = document.querySelectorAll('.message.bot');
        const lastBotMessage = messages[messages.length - 1];
        if (lastBotMessage && lastBotMessage.querySelector('.message-content').innerHTML.includes("思考中")) {
            lastBotMessage.querySelector('.message-content').innerHTML = formatMessage(fullResponse);
        } else {
            displayMessage('bot', fullResponse);
        }

        // 如果状态为 2，表示回答结束
        if (responseData.header.status === 2) {
            socket.close();
            if (loadingElement) loadingElement.style.display = 'none';
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket 错误:", error);
        displayMessage('bot', '网络连接出错，请重试');
        if (loadingElement) loadingElement.style.display = 'none';
    };
}

// 其他功能（主题切换、下拉菜单等保持不变）
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const chatContainer = document.querySelector('.chat-container');
    const messages = document.querySelector('.messages');
    chatContainer.classList.toggle('dark-mode');
    messages.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.querySelector('.chat-container').classList.add('dark-mode');
        document.querySelector('.messages').classList.add('dark-mode');
    }
});
