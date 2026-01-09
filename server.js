const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const wss = new WebSocket.Server({ port: PORT });

// Файлы для хранения данных
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Создаем папку data если её нет
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Загружаем данные
let users = {};
let messages = [];

try {
    if (fs.existsSync(USERS_FILE)) {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
} catch (e) {
    console.error('Error loading users:', e);
    users = {};
}

try {
    if (fs.existsSync(MESSAGES_FILE)) {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
} catch (e) {
    console.error('Error loading messages:', e);
    messages = [];
}

// Сохраняем данные
function saveUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

function saveMessages() {
    try {
        // Храним только последние 1000 сообщений
        if (messages.length > 1000) {
            messages = messages.slice(-1000);
        }
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (e) {
        console.error('Error saving messages:', e);
    }
}

// Хранилище активных подключений: minecraftNick -> {ws, globalsNick, friends}
const activeConnections = new Map();

console.log(`Globals WebSocket Server started on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');
    let currentUser = null;
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Регистрация нового пользователя
            if (data.type === 'register') {
                const { minecraftNick, globalsNick, password } = data;
                
                if (users[minecraftNick]) {
                    ws.send(JSON.stringify({
                        type: 'registerError',
                        message: 'Пользователь уже зарегистрирован'
                    }));
                    return;
                }
                
                users[minecraftNick] = {
                    globalsNick,
                    password,
                    friends: [],
                    createdAt: Date.now()
                };
                saveUsers();
                
                currentUser = minecraftNick;
                activeConnections.set(minecraftNick, { ws, globalsNick, friends: [] });
                
                console.log(`User registered: ${minecraftNick} as ${globalsNick}`);
                
                ws.send(JSON.stringify({
                    type: 'registerSuccess',
                    globalsNick,
                    friends: []
                }));
                
                broadcastUserList();
            }
            
            // Вход существующего пользователя
            else if (data.type === 'login') {
                const { minecraftNick, password } = data;
                
                if (!users[minecraftNick]) {
                    ws.send(JSON.stringify({
                        type: 'loginError',
                        message: 'Пользователь не найден'
                    }));
                    return;
                }
                
                if (users[minecraftNick].password !== password) {
                    ws.send(JSON.stringify({
                        type: 'loginError',
                        message: 'Неверный пароль'
                    }));
                    return;
                }
                
                currentUser = minecraftNick;
                const userData = users[minecraftNick];
                activeConnections.set(minecraftNick, { 
                    ws, 
                    globalsNick: userData.globalsNick, 
                    friends: userData.friends || [] 
                });
                
                console.log(`User logged in: ${minecraftNick} as ${userData.globalsNick}`);
                
                ws.send(JSON.stringify({
                    type: 'loginSuccess',
                    globalsNick: userData.globalsNick,
                    friends: userData.friends || [],
                    recentMessages: messages.slice(-50) // Последние 50 сообщений
                }));
                
                broadcastUserList();
            }
            
            // Отправка сообщения в общий чат
            else if (data.type === 'globalMessage') {
                if (!currentUser) return;
                
                const userData = users[currentUser];
                const msg = {
                    type: 'globalMessage',
                    from: userData.globalsNick,
                    minecraftNick: currentUser,
                    text: data.text,
                    timestamp: Date.now()
                };
                
                messages.push(msg);
                saveMessages();
                
                // Отправляем всем подключенным
                broadcast(msg);
            }
            
            // Отправка личного сообщения
            else if (data.type === 'privateMessage') {
                if (!currentUser) return;
                
                const userData = users[currentUser];
                const targetConnection = activeConnections.get(data.to);
                
                const msg = {
                    type: 'privateMessage',
                    from: userData.globalsNick,
                    fromMinecraft: currentUser,
                    to: data.to,
                    text: data.text,
                    timestamp: Date.now()
                };
                
                // Отправляем отправителю
                ws.send(JSON.stringify(msg));
                
                // Отправляем получателю если он онлайн
                if (targetConnection) {
                    targetConnection.ws.send(JSON.stringify(msg));
                }
            }
            
            // Добавление друга
            else if (data.type === 'addFriend') {
                if (!currentUser) return;
                
                const friendMinecraftNick = data.friendMinecraftNick;
                
                if (!users[friendMinecraftNick]) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Пользователь не найден'
                    }));
                    return;
                }
                
                if (!users[currentUser].friends) {
                    users[currentUser].friends = [];
                }
                
                if (!users[currentUser].friends.includes(friendMinecraftNick)) {
                    users[currentUser].friends.push(friendMinecraftNick);
                    saveUsers();
                    
                    ws.send(JSON.stringify({
                        type: 'friendAdded',
                        friend: {
                            minecraftNick: friendMinecraftNick,
                            globalsNick: users[friendMinecraftNick].globalsNick
                        }
                    }));
                }
            }
            
            // Удаление друга
            else if (data.type === 'removeFriend') {
                if (!currentUser) return;
                
                const friendMinecraftNick = data.friendMinecraftNick;
                
                if (users[currentUser].friends) {
                    users[currentUser].friends = users[currentUser].friends.filter(f => f !== friendMinecraftNick);
                    saveUsers();
                    
                    ws.send(JSON.stringify({
                        type: 'friendRemoved',
                        friendMinecraftNick
                    }));
                }
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        if (currentUser) {
            console.log(`User disconnected: ${currentUser}`);
            activeConnections.delete(currentUser);
            broadcastUserList();
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function broadcastUserList() {
    const onlineUsers = Array.from(activeConnections.entries()).map(([minecraftNick, data]) => ({
        minecraftNick,
        globalsNick: data.globalsNick
    }));
    
    broadcast({
        type: 'userList',
        users: onlineUsers
    });
}

console.log('Globals Server ready. Waiting for connections...');
