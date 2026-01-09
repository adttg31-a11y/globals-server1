const WebSocket = require('ws');

const PORT = process.env.PORT || 8081;
const wss = new WebSocket.Server({ port: PORT });

// Хранилище: pcName -> {ws, minecraftNick}
const users = new Map();

console.log(`Globals WebSocket Server started on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');
    let currentPcName = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'register') {
                const pcName = message.pcName;
                const minecraftNick = message.minecraftNick;
                
                currentPcName = pcName;
                users.set(pcName, { ws, minecraftNick });
                
                console.log(`User registered: ${pcName} (${minecraftNick})`);
                
                // Отправляем список всех пользователей новому клиенту
                const userList = {};
                users.forEach((data, pcName) => {
                    userList[pcName] = data.minecraftNick;
                });
                
                ws.send(JSON.stringify({
                    type: 'userlist',
                    users: userList
                }));
                
                // Уведомляем всех остальных о новом пользователе
                broadcast({
                    type: 'user_join',
                    pcName: pcName,
                    minecraftNick: minecraftNick
                }, ws);
            }
            else if (message.type === 'snowball_throw') {
                // Ретранслируем снежок всем остальным
                console.log(`Snowball thrown by ${message.pcName}`);
                broadcast(message, ws);
            }
            else if (message.type === 'snowball_hit') {
                // Ретранслируем попадание всем
                console.log(`Snowball hit: ${message.targetNick}`);
                broadcast(message, ws);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        if (currentPcName && users.has(currentPcName)) {
            const userData = users.get(currentPcName);
            console.log(`User disconnected: ${currentPcName} (${userData.minecraftNick})`);
            users.delete(currentPcName);
            
            // Уведомляем всех о выходе пользователя
            broadcast({
                type: 'user_leave',
                pcName: currentPcName
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(message, exclude = null) {
    const messageStr = JSON.stringify(message);
    users.forEach((userData) => {
        if (userData.ws !== exclude && userData.ws.readyState === WebSocket.OPEN) {
            userData.ws.send(messageStr);
        }
    });
}

console.log('Globals Server ready. Waiting for connections...');
