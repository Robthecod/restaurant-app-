const express = require('express');
const http = require('http'); // <--- Ensure this line is present
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app); // <--- Ensure this line is present
const io = new Server(server, {       // <--- Attach Socket.io to the HTTP server
    cors: { origin: "*" }
});

// Temporary memory to hold active orders
let orders = [];

// Endpoint: Waiter submits a new order
app.post('/api/orders', (req, res) => {
    const { tableNumber, waiterId, items } = req.body;
    
    const newOrder = {
        id: orders.length + 1,
        tableNumber,
        waiterId,
        items,
        status: 'pending',
        timestamp: new Date()
    };
    
    orders.push(newOrder);
    io.emit('kitchen_new_order', newOrder);
    res.status(201).json({ success: true, order: newOrder });
});

// Handle real-time network traffic
io.on('connection', (socket) => {
    console.log(`Device connected: ${socket.id}`);

    socket.on('update_order_status', (data) => {
        const { orderId, status } = data;
        const order = orders.find(o => o.id === parseInt(orderId));
        
        if (order) {
            order.status = status;
            if (status === 'ready') {
                io.emit('waiter_order_ready', {
                    orderId: order.id,
                    tableNumber: order.tableNumber,
                    message: `Table ${order.tableNumber}'s food is ready!`
                });
            }
            io.emit('order_status_synced', order);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Device disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
// CRITICAL: Change app.listen to server.listen so both Express and Socket.io run together!
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
