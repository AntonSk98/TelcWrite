const express = require('express');
const os = require('os');
const { VIEWS_DIR, PUBLIC_DIR, PORT } = require('./config');
const repository = require('./repository');
const apiRoutes = require('./routes/api');
const partialRoutes = require('./routes/partials');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// View engine
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);

// Routes
app.use('/api', apiRoutes);
app.use(partialRoutes);

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

async function start() {
    await repository.initializeDatabase();
    app.listen(PORT, () => {
        const localIP = getLocalIP();
        console.log(`🚀 Klar server running on port ${PORT}`);
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Network: http://${localIP}:${PORT} (für Handy-Zugriff)`);
    });
}

start().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});