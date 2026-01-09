const WebSocket = require('ws');

const PORT = process.env.PORT || 8081;
const wss = new WebSocket.Server({ port: PORT });

const users = new Map(); // WebSocket -> username

console.log(`Globals WebSocket Server started on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'register') {
                const username = message.username;
                users.set(ws, username);
                console.log(`User registered: ${username}`);
                
                // Отправляем список всех пользователей новому клиенту
                const userList = Array.from(users.values());
                ws.send(JSON.stringify({
                    type: 'userlist',
                    users: userList
                }));
                
                // Уведомляем всех остальных о новом пользователе
                broadcast({
                    type: 'user_join',
                    username: username
                }, ws);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        const username = users.get(ws);
        if (username) {
            console.log(`User disconnected: ${username}`);
            users.delete(ws);
            
            // Уведомляем всех о выходе пользователя
            broadcast({
                type: 'user_leave',
                username: username
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(message, exclude = null) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

console.log('Globals Server ready. Waiting for connections...');
