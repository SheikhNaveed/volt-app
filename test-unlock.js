const axios = require('axios');
const qs = require('qs');

// 1. HARDCODED CREDENTIALS (To rule out .env errors)
// Check these carefully against what the client sent you
const USER = 'HaloMadhosh';
const PASS = 'HaloMadhosh.2025';
const DEVICE_ID = 'DTA20476'; // The specific ID you are testing

async function testUnlock() {
    console.log("🔐 Testing Hardware Connection...");
    console.log(`User: ${USER}`);
    console.log(`Pass: ${PASS}`);

    const data = qs.stringify({
        'deviceId': DEVICE_ID,
        'callbackURL': 'https://google.com' // Dummy URL for testing
    });

    const config = {
        method: 'post',
        url: 'https://developer.chargenow.top/cdb-open-api/v1/rent/order/create',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64')
        },
        data: data
    };

    try {
        const response = await axios(config);
        console.log("✅ SUCCESS! The password is correct.");
        console.log("Response:", response.data);
    } catch (error) {
        console.log("❌ FAILED. The password/user is definitely wrong.");
        if (error.response) {
            console.log("Server Said:", error.response.data);
            console.log("Status:", error.response.status);
        } else {
            console.log("Error:", error.message);
        }
    }
}

testUnlock();