async function test() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@auraforex.com',
                password: 'password123'
            })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Logged in, token obtained.');

        // 2. Get plans
        const plansRes = await fetch('http://localhost:3001/api/plans', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const plansData = await plansRes.json();
        const plan = plansData.plans[0];
        if (!plan) {
            console.error('No plans found');
            return;
        }

        // 3. Submit purchase request
        console.log(`Submitting purchase for plan: ${plan.name} (${plan.id})`);
        const purchaseRes = await fetch('http://localhost:3001/api/purchase/request', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({
                planId: plan.id,
                amount: plan.price,
                transactionHash: 'TEST_HASH_PROBE'
            })
        });

        const purchaseData = await purchaseRes.json();
        console.log('Response Status:', purchaseRes.status);
        console.log('Response:', purchaseData);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
