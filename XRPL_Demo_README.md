# XRPL Demo Runbook

## What this is

This is a local demo app for the VineLedger project. It connects to XRPL Testnet and walks through a more complete classroom flow:

1. Create fresh issuer, treasury, and investor wallets
2. Enable `RequireAuth` on the issuer
3. Create the investor trust line
4. Authorize the investor wallet
5. Receive an investor subscription payment
6. Issue the winery revenue token
7. Send a simulated payout
8. Freeze the trust line as a compliance control
9. Release the hold after a simulated manual review

The upgraded UI also includes:

- preset deal scenarios
- one-click `Auto-run Happy Path`
- issuance memo panel
- policy gateway board
- cashflow story panel
- investor registry
- cap table
- richer KPI and timeline cards

## Files

- [demo/server.js](/D:/Desktop/ripple_final/demo/server.js:1)
- [demo/public/index.html](/D:/Desktop/ripple_final/demo/public/index.html:1)
- [demo/public/app.js](/D:/Desktop/ripple_final/demo/public/app.js:1)
- [demo/public/styles.css](/D:/Desktop/ripple_final/demo/public/styles.css:1)

## How to run

From `D:\Desktop\ripple_final`:

```powershell
npm run demo
```

Then open:

[http://localhost:3020](http://localhost:3020)

## Suggested classroom click path

Option A: fast presentation

1. Pick a preset
2. Click `Auto-run Happy Path`
3. Click `Freeze Hold`
4. Click `Release Hold`

Option B: step-by-step presentation

1. Click `Launch Fresh Deal`
2. Click `Trust Line`
3. Click `Allow-list`
4. Click `Subscription`
5. Click `Issue Token`
6. Click `Payout`
7. Click `Freeze Hold`
8. Click `Release Hold`

## What to say during the demo

- `Launch Fresh Deal`: "We create issuer, treasury, and investor wallets on XRPL Testnet, then arm issuer controls like RequireAuth."
- `Auto-run Happy Path`: "This runs the full investor journey from onboarding to payout so we can focus the presentation on business logic."
- `Trust Line`: "The investor expresses willingness to hold the token by opening a trust line."
- `Allow-list`: "Our policy gateway has approved the investor, so the issuer authorizes that wallet."
- `Subscription`: "The investor sends funds into the SPV treasury."
- `Issue Token`: "The issuer delivers tokenized revenue rights to the approved wallet."
- `Payout`: "After off-chain sales are reported, the treasury distributes a revenue share."
- `Freeze Hold`: "This shows compliance enforcement if suspicious activity is detected."
- `Release Hold`: "This shows that controls are reversible after manual review."

## Notes

- The app uses XRPL Testnet, so faucet funding or validation may occasionally be slow.
- If Testnet is congested, wait a few seconds and retry the failed step.
- The demo stores wallets in memory only while the local server is running.
