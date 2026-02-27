// server.js - FINAL VERSION
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const axios = require('axios');
const app = express();

// Short-term memory for active rentals
const activeRentals = {};

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cors());

// 1. CONFIG ROUTE
app.get('/config', (req, res) => {
    res.json({ stripeKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// 2. CREATE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { deviceId } = req.body; 

       // --- OFFLINE PRE-CHECK BLOCKER ---
        const statusResponse = await axios.get(
            `https://developer.chargenow.top/cdb-open-api/v1/rent/cabinet/query?deviceId=${deviceId}`,
            {
                headers: { 'Content-Type': 'application/json' },
                auth: { username: 'HaloMadhosh', password: 'HaloMadhosh.2025' }
            }
        );

        const cabinet = statusResponse.data?.data?.cabinet;
        console.log(`🔍 ChargeNow Pre-Check Data for ${deviceId}:`, cabinet); // Lets us see exactly what they send
        
        // Aggressively check if it's strictly online. Treat anything else (0, false, null, undefined) as offline.
        const isOnline = cabinet && (cabinet.online === true || cabinet.online === 1 || cabinet.online === "1" || cabinet.online === "true");

        if (!isOnline) {
            console.log(`⚠️ Blocked checkout: Station ${deviceId} is offline.`);
            return res.status(400).json({ error: "STATION_OFFLINE" });
        }
        // ---------------------------------

        // 3. Create Stripe Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'paypal'],
            payment_intent_data: {
                statement_descriptor: 'Volt Pfand'
            },
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Volt Power Bank Station',
                        description: '2,00€ pro 30 Min. • Max. 10€ pro Tag • 20€ Kaution',
                    },
                    unit_amount: 2000, 
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}&deviceId=${deviceId}`,
            cancel_url: `${req.protocol}://${req.get('host')}/index.html`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Stripe/API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. UNLOCK DEVICE ROUTE
app.post('/unlock-device', async (req, res) => {
    const { sessionId, deviceId } = req.body;
    console.log(`🔓 Unlocking Device: ${deviceId} for Session: ${sessionId}`);
    
    try {
        const response = await axios.post(
            'https://developer.chargenow.top/cdb-open-api/v1/rent/order/create',
            new URLSearchParams({
                deviceId: deviceId,
                callbackURL: 'https://volt-app-s42y.onrender.com/api/hardware-webhook' 
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: 'HaloMadhosh',
                    password: 'HaloMadhosh.2025' 
                }
            }
        );

        if (response.data) {
            console.log("Hardware API Response:", response.data);
            if (response.data.code !== 0) {
                throw new Error(response.data.msg || "Station rejected unlock command");
            }
            
            // Extract the tradeNo ChargeNow gave us
            const tradeNo = response.data.data.tradeNo;

            // Save BOTH the sessionId and tradeNo to our memory
            activeRentals[sessionId] = { 
                status: 'renting',
                tradeNo: tradeNo 
            };
        }

        // Send the success response exactly ONCE
        res.json({ success: true, message: "Device unlocked successfully" });

    } catch (error) {
        console.error("Hardware unlock failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Hardware unlock failed" });
    }
});
// 5. CHECK RENTAL STATUS (Polling Route)
app.get('/api/check-status', (req, res) => {
    const { sessionId } = req.query;
    if (activeRentals[sessionId]) {
        res.json({ status: activeRentals[sessionId].status });
    } else {
        res.json({ status: 'unknown' });
    }
});

// 6. HARDWARE WEBHOOK RECEIVER
app.post('/api/hardware-webhook', (req, res) => {
    console.log("📥 Webhook received:", req.body);
    
    const statusString = String(req.body.status);
    const incomingTradeNo = String(req.body.tradeNo);
    
    if (statusString === '2') {
        console.log(`🔋 Return Signal for: ${incomingTradeNo}. Checking memory...`);
        console.log("Current active sessions in memory:", Object.keys(activeRentals));

        let matchFound = false;
        for (const [sessionId, data] of Object.entries(activeRentals)) {
            if (String(data.tradeNo) === incomingTradeNo) {
                console.log(`✅ MATCH! Stopping timer for session: ${sessionId}`);
                activeRentals[sessionId].status = 'returned';
                activeRentals[sessionId].returnTime = Date.now(); // Store when it was returned
                matchFound = true;
                break;
            }
        }
        
        if (!matchFound) {
            console.log(`❌ NO MATCH found for ${incomingTradeNo}. This happens if the server restarted.`);
        }
    }
    res.status(200).send("success");
});
// 7. START SERVER 
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Volt Server running on port ${PORT}`);
});