app.post('/create-checkout-session', async (req, res) => {
    try {
        const { deviceId } = req.body; 

        const session = await stripe.checkout.sessions.create({
            // 1. ENABLE GOOGLE PAY / PAYPAL / APPLE PAY AUTOMATICALLY
            // This tells Stripe: "Look at the settings in the Dashboard and show whatever is turned on."
            automatic_payment_methods: {
                enabled: true,
            },

            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Volt Power Bank Station',
                        // 2. UPDATED PRICE TEXT
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