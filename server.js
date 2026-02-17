// server.js - COMPLETE FILE

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// 1. CONFIG ROUTE (Sends the Public Key to the frontend)
app.get('/config', (req, res) => {
    res.json({ stripeKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// 2. CREATE CHECKOUT SESSION (Updated with 2.00€ Pricing & Auto-Payments)
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { deviceId } = req.body; 

        const session = await stripe.checkout.sessions.create({
            // ENABLE ALL WALLETS (PayPal, Google Pay, Apple Pay)
            automatic_payment_methods: {
                enabled: true,
            },
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

    // LOGIC: Here we normally talk to the Hardware API.
    // Since we are validating the flow, we return "Success" to eject the battery.
    try {
        // If you have specific hardware API code, paste it here. 
        // For now, we simulate a successful unlock:
        res.json({ success: true, message: "Device unlocked successfully" });
    } catch (error) {
        console.error("Unlock Error:", error);
        res.status(500).json({ error: "Failed to unlock device" });
    }
});

// 4. START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Volt Server running on http://localhost:${PORT}`);
});