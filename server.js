require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

let db;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rblxbot';

async function connectToDatabase() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db();
        console.log('Connected to MongoDB');
        
        await db.createCollection('users');
        await db.createCollection('userPetBalances');
        await db.collection('tradeHistory');
        await db.createCollection('pendingTradeRequests');
        await db.createCollection('botAccounts');
        
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        await db.collection('userPetBalances').createIndex({ username: 1, petName: 1 }, { unique: true });
        await db.collection('tradeHistory').createIndex({ timestamp: -1 });
        
        console.log('Database collections and indexes created');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

const cors = require('cors');

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.header('ngrok-skip-browser-warning', 'true');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/verify-user', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }

        const user = await db.collection('users').findOne({ username });
        res.json({ verified: !!user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/user-balance/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const balances = await db.collection('userPetBalances')
            .find({ username })
            .toArray();

        const petBalances = {};
        balances.forEach(balance => {
            petBalances[balance.petName] = balance.count;
        });

        res.json({ username, petBalances });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/user-available-pets/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const availablePets = await getUserAvailablePets(username);
        res.json({ username, availablePets });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/deposit', async (req, res) => {
    try {
        const { username, petCounts = { total: 0 }, petDetails = [], bot = 'Muhammad6194' } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        await db.collection('users').updateOne(
            { username },
            { $setOnInsert: { username, createdAt: new Date() } },
            { upsert: true }
        );

        const result = await db.collection('pendingTradeRequests').insertOne({
            username,
            type: 'deposit',
            bot,
            petCounts,
            petDetails,
            status: 'pending',
            createdAt: new Date()
        });

        res.json({ 
            success: true, 
            message: 'Deposit request created - waiting for bot to process',
            requestId: result.insertedId
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { username, petCounts, petDetails, bot = 'Muhammad6194' } = req.body;

        for (const pet of petDetails) {
            const balance = await db.collection('userPetBalances').findOne({
                username,
                petName: pet.name
            });

            if (!balance || balance.count <= 0) {
                return res.status(400).json({
                    error: `Insufficient pets for withdrawal: ${pet.name}`,
                    availablePets: await getUserAvailablePets(username)
                });
            }
        }

        await db.collection('pendingTradeRequests').insertOne({
            username,
            type: 'withdraw',
            bot,
            petCounts,
            petDetails,
            status: 'pending',
            createdAt: new Date()
        });

        res.json({ 
            success: true, 
            message: 'Withdrawal request created - waiting for bot to process',
            requestId: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/get-pending-requests', async (req, res) => {
    try {
        const { bot } = req.query;
        const requests = await db.collection('pendingTradeRequests')
            .find({ bot, status: 'pending' })
            .sort({ createdAt: 1 })
            .toArray();
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/complete-deposit', async (req, res) => {
    try {
        const { username, success, petCounts, petDetails, bot } = req.body;
        
        await db.collection('pendingTradeRequests').updateOne(
            { username, type: 'deposit', bot, status: 'pending' },
            { $set: { status: success ? 'completed' : 'failed', completedAt: new Date() } }
        );

        if (success && petDetails) {
            for (const pet of petDetails) {
                await db.collection('userPetBalances').updateOne(
                    { username, petName: pet.name },
                    { $inc: { count: 1 } },
                    { upsert: true }
                );
            }

            await db.collection('tradeHistory').insertOne({
                username,
                type: 'deposit',
                petCounts,
                petDetails,
                bot,
                status: 'completed',
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'Deposit completed' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/complete-withdraw', async (req, res) => {
    try {
        const { username, success, petCounts, petDetails, bot } = req.body;
        
        await db.collection('pendingTradeRequests').updateOne(
            { username, type: 'withdraw', bot, status: 'pending' },
            { $set: { status: success ? 'completed' : 'failed', completedAt: new Date() } }
        );

        if (success && petDetails) {
            for (const pet of petDetails) {
                await db.collection('userPetBalances').updateOne(
                    { username, petName: pet.name },
                    { $inc: { count: -1 } }
                );
            }

            await db.collection('tradeHistory').insertOne({
                username,
                type: 'withdraw',
                petCounts,
                petDetails,
                bot,
                status: 'completed',
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'Withdrawal completed' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/trade-history', async (req, res) => {
    try {
        const { username, limit = 50 } = req.query;
        const query = username ? { username } : {};
        
        const history = await db.collection('tradeHistory')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();

        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

async function getUserAvailablePets(username) {
    const balances = await db.collection('userPetBalances')
        .find({ username, count: { $gt: 0 } })
        .toArray();
    
    return balances.map(balance => ({
        name: balance.petName,
        count: balance.count
    }));
}

async function startServer() {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`Backend API running on http://localhost:${PORT}`);
        console.log(`Frontend should be running on ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
    });
}

startServer(); 