require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const axios = require('axios');
const qs = require('qs'); // Library to format data like a form

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// 1. CONFIG
app.get('/config', (req, res) => {
    res.json({
        stripeKey: process.env.STRIPE_PUBLISHABLE_KEY,
        brandColor: "#FFA500"
    });
});

// 2. CREATE PAYMENT
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur', // CHANGED TO EURO
                    product_data: {
                        name: 'Power Bank Miete (Station ' + deviceId + ')', // German Name
                        description: '1,00€ pro Stunde • Tageshöchstsatz 10€ • 20€ Kaution', // German Description
                    },
                    unit_amount: 2000, // 20.00 EUR (The Deposit Amount)
                },
                quantity: 1,
            }],
            mode: 'payment', // Or 'setup' if you are doing pure holds, but 'payment' with manual capture is standard for simple MVPs
            success_url: `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}&deviceId=${deviceId}`,
            cancel_url: `${req.protocol}://${req.get('host')}/index.html`,
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. UNLOCK DEVICE (Updated for Bajie API)
app.post('/unlock-device', async (req, res) => {
    const { sessionId, deviceId } = req.body;

    try {
        // A. Verify Payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment incomplete' });
        }

        console.log(`Payment confirmed. Unlocking device ${deviceId}...`);

        // B. Send Signal to Hardware
        // The API requires data in "application/x-www-form-urlencoded" format
        const data = qs.stringify({
            'deviceId': deviceId,
            'callbackURL': `${req.protocol}://${req.get('host')}/api/callback` // Placeholder for now
        });

        const config = {
            method: 'post',
            url: process.env.HARDWARE_API_URL,
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                // This handles the "Basic Auth" requirement automatically
                'Authorization': 'Basic ' + Buffer.from(process.env.HARDWARE_USER + ':' + process.env.HARDWARE_PASS).toString('base64')
            },
            data: data
        };

        const hardwareResponse = await axios(config);
        
        console.log("Hardware Response:", hardwareResponse.data);
        res.json({ success: true, message: "Device Unlocked!", data: hardwareResponse.data });

    } catch (error) {
        console.error("Unlock Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Unlock failed" });
    }
});

// 4. HANDLE RETURN & PRICING (Webhook)
// This triggers when the machine says "Powerbank Returned"
app.post('/api/callback', (req, res) => {
    console.log("🔔 HARDWARE EVENT RECEIVED:");
    console.log("Data:", req.body); 

    // TODO: In the future, you will save this to a database
    // For now, we just print it to the Render Logs so you can see it works
    
    // We MUST reply "success" or the machine will keep sending the message
    res.json({ result: "success" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Volt Server running on http://localhost:${PORT}`);
});