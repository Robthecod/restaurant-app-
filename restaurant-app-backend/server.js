const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
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
        items, // Expected format: [{ name, quantity, modifiers }]
        status: 'pending',
        timestamp: new Date()
    };
    
    orders.push(newOrder);
    
    // Instantly alert the kitchen screens
    io.emit('kitchen_new_order', newOrder);
    
    res.status(201).json({ success: true, order: newOrder });
});

// Handle real-time network traffic
io.on('connection', (socket) => {
    console.log(`Device connected: ${socket.id}`);

    // Cook updates order status (e.g., from 'pending' to 'ready')
    socket.on('update_order_status', (data) => {
        const { orderId, status } = data;
        const order = orders.find(o => o.id === parseInt(orderId));
        
        if (order) {
            order.status = status;
            
            // If the kitchen says food is ready, alert the waiters
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
