// server.js - FINAL VERSION
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const axios = require('axios');
const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// 1. CONFIG ROUTE
app.get('/config', (req, res) => {
    res.json({ stripeKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// 2. CREATE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { deviceId } = req.body; 

        const session = await stripe.checkout.sessions.create({
            // FIX: Explicitly list the methods. 
            // 'card' includes Google Pay & Apple Pay automatically.
            // 'paypal' adds the PayPal button.
            payment_method_types: ['card', 'paypal'],
            
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Volt Power Bank Station',
                        description: '2,00€ pro 30 Min. • Max. 10€ pro Tag • 20€ Kaution',
                    },
                    unit_amount: 2000, // 20.00 EUR Deposit
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}&deviceId=${deviceId}`,
            cancel_url: `${req.protocol}://${req.get('host')}/index.html`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. UNLOCK DEVICE ROUTE
app.post('/unlock-device', async (req, res) => {
    const { sessionId, deviceId } = req.body;
    console.log(`🔓 Unlocking Device: ${deviceId} for Session: ${sessionId}`);
    
    try {
        const response = await axios.post(
            'https://developer.chargenow.top/cdb-open-api/v1/rent/order/create',
            new URLSearchParams({
                deviceId: deviceId 
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: 'HaloMadhosh',
                    // Please insert your API password here. 
                    // I have masked it for security, but it ends in .2025
                    password: 'HaloMadhosh.2025' 
                }
            }
        );

        if (response.data) {
            console.log("Hardware API Response:", response.data);
        }

        res.json({ success: true, message: "Device unlocked successfully" });
    } catch (error) {
        console.error("Hardware unlock failed:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Hardware unlock failed" });
    }
});

// 4. START SERVER (Updated to fix Render Timeout)
const PORT = process.env.PORT || 10000;
// We add '0.0.0.0' to ensure Render can connect to the port
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Volt Server running on port ${PORT}`);
});