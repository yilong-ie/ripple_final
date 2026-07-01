const http = require("http")
const fs = require("fs")
const path = require("path")
const xrpl = require("xrpl")

const PORT = Number(process.env.PORT || 3020)
const XRPL_SERVER = process.env.XRPL_SERVER || "wss://s.altnet.rippletest.net:51233"
const TX_EXPLORER_BASE = "https://testnet.xrpl.org/transactions/"
const ACCOUNT_EXPLORER_BASE = "https://testnet.xrpl.org/accounts/"
const PUBLIC_DIR = path.join(__dirname, "public")

const SCENARIO_PRESETS = [
  {
    id: "rioja",
    label: "Rioja Reserve",
    description: "Revenue-share pilot for a reserve vintage release.",
    config: {
      projectName: "VineLedger Series A1",
      issuerName: "Rioja Family Estate",
      spvName: "Rioja Reserve 2027 SPV",
      region: "La Rioja, Spain",
      vintage: "2027 Reserve",
      investorName: "Atlas Family Office",
      investorType: "Professional Investor",
      investorJurisdiction: "France",
      revenueSharePercent: "12",
      transferLockupDays: "180",
      targetRaiseXrp: "20",
      currency: "VIN",
      trustLimit: "1000000",
      subscriptionXrp: "15",
      issueQuantity: "1000",
      payoutXrp: "1.5",
    },
  },
  {
    id: "bordeaux",
    label: "Bordeaux Barrel",
    description: "Barrel-aging finance for a premium export allocation.",
    config: {
      projectName: "VineLedger Barrel Window",
      issuerName: "Chateau Marais",
      spvName: "Bordeaux Barrel 2028 SPV",
      region: "Bordeaux, France",
      vintage: "2028 Barrel Lot",
      investorName: "Cygnet Capital",
      investorType: "Professional Investor",
      investorJurisdiction: "Luxembourg",
      revenueSharePercent: "10",
      transferLockupDays: "270",
      targetRaiseXrp: "28",
      currency: "BDX",
      trustLimit: "1500000",
      subscriptionXrp: "18",
      issueQuantity: "1200",
      payoutXrp: "1.8",
    },
  },
  {
    id: "douro",
    label: "Douro Export",
    description: "Cross-border working capital for a premium export batch.",
    config: {
      projectName: "VineLedger Export Line",
      issuerName: "Quinta do Vale Azul",
      spvName: "Douro Export 2027 SPV",
      region: "Douro, Portugal",
      vintage: "2027 Export Allocation",
      investorName: "Northbridge Treasury",
      investorType: "Professional Investor",
      investorJurisdiction: "Germany",
      revenueSharePercent: "9",
      transferLockupDays: "120",
      targetRaiseXrp: "24",
      currency: "DRO",
      trustLimit: "1300000",
      subscriptionXrp: "16",
      issueQuantity: "900",
      payoutXrp: "1.35",
    },
  },
]

const INVESTOR_TYPES = [
  "Professional Investor",
  "Family Office",
  "Asset Manager",
  "Corporate Treasury",
]

const ALERT_PLAYBOOK = [
  {
    id: "lockup_breach",
    title: "Transfer requested during lockup",
    detail: "An approved wallet tries to move revenue tokens before the contractual lockup period expires.",
  },
  {
    id: "wallet_mismatch",
    title: "Settlement wallet mismatch",
    detail: "A payout or transfer request points to a wallet that is not on the approved servicing record.",
  },
  {
    id: "sanctions_refresh",
    title: "Sanctions or adverse-media refresh hit",
    detail: "Periodic rescreening returns a new match, so the issuer pauses transfers until manual review is complete.",
  },
  {
    id: "off_platform_transfer",
    title: "Off-platform transfer request",
    detail: "A holder asks to route tokens to an unapproved or unvetted wallet outside the platform workflow.",
  },
]

const DEFAULT_CONFIG = {
  ...SCENARIO_PRESETS[0].config,
  preset: SCENARIO_PRESETS[0].id,
}

const state = {
  config: { ...DEFAULT_CONFIG },
  phase: "idle",
  busy: false,
  network: {
    server: XRPL_SERVER,
    connected: false,
    ledgerIndex: null,
  },
  flags: {
    setupComplete: false,
    trustlineCreated: false,
    trustlineAuthorized: false,
    subscriptionReceived: false,
    tokensIssued: false,
    payoutSent: false,
    trustlineFrozen: false,
    holdReleased: false,
  },
  offering: null,
  policy: null,
  sales: null,
  registry: null,
  accounts: null,
  trustline: null,
  timeline: [],
  lastUpdated: null,
}

let client = null
let wallets = null

function nowIso() {
  return new Date().toISOString()
}

function normalizeCurrency(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
}

function toFixedString(value, digits = 2) {
  return Number(value).toFixed(digits)
}

function positiveNumber(label, rawValue) {
  const num = Number(String(rawValue).trim())
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be a positive number.`)
  }
  return String(num)
}

function findPreset(presetId) {
  return SCENARIO_PRESETS.find((preset) => preset.id === presetId) || null
}

function sanitizeConfig(input = {}) {
  const preset = findPreset(input.preset) || findPreset(DEFAULT_CONFIG.preset)
  const base = preset ? preset.config : DEFAULT_CONFIG
  const investorType = String(input.investorType || base.investorType).trim()

  const config = {
    preset: preset ? preset.id : DEFAULT_CONFIG.preset,
    projectName: String(input.projectName || base.projectName).trim(),
    issuerName: String(input.issuerName || base.issuerName).trim(),
    spvName: String(input.spvName || base.spvName).trim(),
    region: String(input.region || base.region).trim(),
    vintage: String(input.vintage || base.vintage).trim(),
    investorName: String(input.investorName || base.investorName).trim(),
    investorType,
    investorJurisdiction: String(input.investorJurisdiction || base.investorJurisdiction).trim(),
    revenueSharePercent: positiveNumber(
      "Revenue share percent",
      input.revenueSharePercent || base.revenueSharePercent,
    ),
    transferLockupDays: positiveNumber(
      "Transfer lockup days",
      input.transferLockupDays || base.transferLockupDays,
    ),
    targetRaiseXrp: positiveNumber("Target raise", input.targetRaiseXrp || base.targetRaiseXrp),
    currency: normalizeCurrency(input.currency || base.currency),
    trustLimit: positiveNumber("Trust limit", input.trustLimit || base.trustLimit),
    subscriptionXrp: positiveNumber("Subscription XRP", input.subscriptionXrp || base.subscriptionXrp),
    issueQuantity: positiveNumber("Issue quantity", input.issueQuantity || base.issueQuantity),
    payoutXrp: positiveNumber("Payout XRP", input.payoutXrp || base.payoutXrp),
  }

  if (!/^[A-Z0-9]{3}$/.test(config.currency)) {
    throw new Error("Currency code must be exactly 3 letters or numbers, for example VIN.")
  }

  if (!INVESTOR_TYPES.includes(config.investorType)) {
    throw new Error("Investor type must be selected from the supported investor categories.")
  }

  for (const [label, value] of [
    ["Project name", config.projectName],
    ["Issuer name", config.issuerName],
    ["SPV name", config.spvName],
    ["Region", config.region],
    ["Vintage", config.vintage],
    ["Investor name", config.investorName],
    ["Investor type", config.investorType],
    ["Investor jurisdiction", config.investorJurisdiction],
  ]) {
    if (!value) {
      throw new Error(`${label} cannot be empty.`)
    }
  }

  return config
}

function buildOffering(config) {
  return {
    projectName: config.projectName,
    issuerName: config.issuerName,
    spvName: config.spvName,
    region: config.region,
    vintage: config.vintage,
    investorName: config.investorName,
    investorType: config.investorType,
    investorJurisdiction: config.investorJurisdiction,
    revenueSharePercent: config.revenueSharePercent,
    transferLockupDays: config.transferLockupDays,
    targetRaiseXrp: config.targetRaiseXrp,
    committedXrp: "0",
    issueQuantity: config.issueQuantity,
    unitPriceXrp: toFixedString(Number(config.subscriptionXrp) / Number(config.issueQuantity), 4),
    issuanceStatus: "Draft",
    settlementStatus: "Awaiting wallets",
  }
}

function buildPolicy(config) {
  return {
    overallStatus: "Awaiting investor onboarding",
    note: "Issuer controls are not armed yet.",
    transferRule: `Approved wallets only, ${config.transferLockupDays}-day lockup, ${config.investorType}.`,
    alertReason: null,
    alertPlaybook: ALERT_PLAYBOOK.map((item) => ({ ...item })),
    holdActive: false,
    checks: {
      issuerControls: "pending",
      kyc: "pending",
      sanctions: "pending",
      walletScreening: "pending",
      suitability: "pending",
      jurisdiction: "pending",
      transferRestrictions: "pending",
    },
  }
}

function buildSales() {
  return {
    reportStatus: "No report filed",
    distributionStatus: "Awaiting issuance",
    payoutPoolXrp: "0",
    grossRevenueXrp: "0",
    bottlesSold: 0,
    avgBottlePriceXrp: "0",
    lastReportAt: null,
  }
}

function buildRegistry(config) {
  return {
    investors: [
      {
        id: "lead",
        name: config.investorName,
        category: config.investorType,
        jurisdiction: config.investorJurisdiction,
        walletAddress: null,
        onboardingStatus: "Prospect",
        kycStatus: "pending",
        sanctionsStatus: "pending",
        walletStatus: "not_connected",
        tokenStatus: "not_allocated",
        subscriptionXrp: "0",
        allocationTokens: "0",
        ownershipPct: "0.0",
        payoutReceivedXrp: "0",
        holdStatus: "clear",
        note: "Lead investor targeted for the pilot issuance.",
      },
      {
        id: "pipeline",
        name: "Follow-on Allocation Waitlist",
        category: "Pipeline account",
        jurisdiction: "Multi-jurisdiction",
        walletAddress: null,
        onboardingStatus: "Pipeline",
        kycStatus: "not_started",
        sanctionsStatus: "not_started",
        walletStatus: "off_platform",
        tokenStatus: "pipeline",
        subscriptionXrp: "0",
        allocationTokens: "0",
        ownershipPct: "0.0",
        payoutReceivedXrp: "0",
        holdStatus: "not_applicable",
        note: `Reserved capacity for later investors that may be onboarded after the ${config.region} pilot closes.`,
      },
    ],
  }
}

function computeRegistrySummary(investors = []) {
  const approved = investors.filter((investor) => investor.onboardingStatus === "Approved").length
  const restricted = investors.filter((investor) => investor.holdStatus === "frozen").length
  const activeHolders = investors.filter((investor) => investor.tokenStatus === "issued").length
  const totalCommittedXrp = investors.reduce(
    (sum, investor) => sum + Number(investor.subscriptionXrp || 0),
    0,
  )
  const totalAllocatedTokens = investors.reduce(
    (sum, investor) => sum + Number(investor.allocationTokens || 0),
    0,
  )

  return {
    totalInvestors: investors.length,
    approved,
    restricted,
    activeHolders,
    totalCommittedXrp: toFixedString(totalCommittedXrp, 2),
    totalAllocatedTokens: String(totalAllocatedTokens),
  }
}

function computeCapTable(investors = [], config) {
  const totalSupply = Number(config.issueQuantity)
  const allocatedSupply = investors.reduce(
    (sum, investor) => sum + Number(investor.allocationTokens || 0),
    0,
  )
  const issuedSupply = investors
    .filter((investor) => investor.tokenStatus === "issued")
    .reduce((sum, investor) => sum + Number(investor.allocationTokens || 0), 0)
  const unallocatedSupply = Math.max(totalSupply - allocatedSupply, 0)

  const rows = investors
    .filter((investor) => Number(investor.allocationTokens || 0) > 0 || investor.id === "lead")
    .map((investor) => {
      const allocation = Number(investor.allocationTokens || 0)
      const ownershipPct = totalSupply ? (allocation / totalSupply) * 100 : 0

      return {
        holder: investor.name,
        className: "Revenue Participation Tokens",
        status:
          investor.tokenStatus === "issued"
            ? "Issued"
            : investor.tokenStatus === "reserved"
              ? "Reserved"
              : "Pipeline",
        tokens: String(allocation),
        ownershipPct: toFixedString(ownershipPct, 1),
        committedXrp: toFixedString(Number(investor.subscriptionXrp || 0), 2),
        payoutReceivedXrp: toFixedString(Number(investor.payoutReceivedXrp || 0), 2),
      }
    })

  rows.push({
    holder: "Unallocated Capacity",
    className: "Remaining issuance capacity",
    status: unallocatedSupply > 0 ? "Open" : "Fully placed",
    tokens: String(unallocatedSupply),
    ownershipPct: toFixedString(totalSupply ? (unallocatedSupply / totalSupply) * 100 : 0, 1),
    committedXrp: "0.00",
    payoutReceivedXrp: "0.00",
  })

  return {
    totalSupply: String(totalSupply),
    allocatedSupply: String(allocatedSupply),
    issuedSupply: String(issuedSupply),
    unallocatedSupply: String(unallocatedSupply),
    rows,
  }
}

function getLeadInvestor() {
  return state.registry?.investors?.find((investor) => investor.id === "lead") || null
}

function updateLeadInvestor(updates) {
  const investor = getLeadInvestor()
  if (investor) Object.assign(investor, updates)
}

function resetState(nextConfig = state.config) {
  state.config = { ...nextConfig }
  state.phase = "idle"
  state.busy = false
  state.flags = {
    setupComplete: false,
    trustlineCreated: false,
    trustlineAuthorized: false,
    subscriptionReceived: false,
    tokensIssued: false,
    payoutSent: false,
    trustlineFrozen: false,
    holdReleased: false,
  }
  state.offering = buildOffering(nextConfig)
  state.policy = buildPolicy(nextConfig)
  state.sales = buildSales()
  state.registry = buildRegistry(nextConfig)
  state.accounts = null
  state.trustline = null
  state.timeline = []
  state.lastUpdated = nowIso()
  wallets = null
}

function addTimeline(kind, title, detail, extra = {}) {
  state.timeline.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title,
    detail,
    at: nowIso(),
    ...extra,
  })
}

async function ensureClient() {
  if (!client) {
    client = new xrpl.Client(XRPL_SERVER)
  }
  if (!client.isConnected()) {
    await client.connect()
  }
  state.network.connected = client.isConnected()
  state.network.ledgerIndex = await client.getLedgerIndex()
  return client
}

async function submitTransaction(wallet, tx, label) {
  const connectedClient = await ensureClient()
  const prepared = await connectedClient.autofill(tx)
  const signed = wallet.sign(prepared)
  const result = await connectedClient.submitAndWait(signed.tx_blob)
  const metaResult = result.result?.meta?.TransactionResult

  if (metaResult !== "tesSUCCESS") {
    throw new Error(`${label} failed with ${metaResult || "unknown result"}.`)
  }

  addTimeline("tx", label, metaResult, {
    txHash: signed.hash,
    explorerUrl: `${TX_EXPLORER_BASE}${signed.hash}`,
  })

  return result
}

async function getAccountSnapshot(name, wallet) {
  const connectedClient = await ensureClient()
  const balances = await connectedClient.getBalances(wallet.address, {
    ledger_index: "validated",
  })

  const xrp = balances.find((entry) => entry.currency === "XRP")?.value || "0"
  const issued = balances
    .filter((entry) => entry.currency !== "XRP")
    .map((entry) => ({
      currency: entry.currency,
      issuer: entry.issuer || null,
      value: entry.value,
    }))

  return {
    name,
    address: wallet.address,
    explorerUrl: `${ACCOUNT_EXPLORER_BASE}${wallet.address}`,
    xrp,
    issued,
  }
}

function computeMetrics() {
  const targetRaise = Number(state.config.targetRaiseXrp)
  const committedXrp = Number(state.offering?.committedXrp || 0)
  const payoutXrp = Number(state.config.payoutXrp)
  const issueQuantity = Number(state.config.issueQuantity)
  const approvedChecks = Object.values(state.policy?.checks || {}).filter((value) => value === "passed").length
  const totalChecks = Object.values(state.policy?.checks || {}).length || 1
  const txCount = state.timeline.filter((item) => item.kind === "tx").length

  const registrySummary = computeRegistrySummary(state.registry?.investors || [])

  return {
    targetRaiseXrp: toFixedString(targetRaise, 2),
    committedXrp: toFixedString(committedXrp, 2),
    commitmentPct: toFixedString(targetRaise ? (committedXrp / targetRaise) * 100 : 0, 1),
    fundingGapXrp: toFixedString(Math.max(targetRaise - committedXrp, 0), 2),
    tokenSupply: String(issueQuantity),
    unitPriceXrp: state.offering?.unitPriceXrp || "0",
    payoutYieldPct: toFixedString(committedXrp ? (payoutXrp / committedXrp) * 100 : 0, 2),
    approvedWallets: registrySummary.approved,
    activeHolders: registrySummary.activeHolders,
    txCount,
    policyScorePct: toFixedString((approvedChecks / totalChecks) * 100, 0),
  }
}

async function refreshDerivedState() {
  if (!wallets) {
    state.lastUpdated = nowIso()
    return
  }

  const connectedClient = await ensureClient()
  state.network.connected = connectedClient.isConnected()
  state.network.ledgerIndex = await connectedClient.getLedgerIndex()

  state.accounts = {
    issuer: await getAccountSnapshot("Issuer", wallets.issuer),
    treasury: await getAccountSnapshot("Treasury", wallets.treasury),
    investor: await getAccountSnapshot("Investor", wallets.investor),
  }

  const lines = await connectedClient.request({
    command: "account_lines",
    account: wallets.investor.address,
    peer: wallets.issuer.address,
    ledger_index: "validated",
  })

  state.trustline = lines.result.lines.find((line) => line.currency === state.config.currency) || null
  state.lastUpdated = nowIso()
}

function snapshot() {
  const registry = {
    summary: computeRegistrySummary(state.registry?.investors || []),
    investors: state.registry?.investors || [],
  }

  return {
    phase: state.phase,
    busy: state.busy,
    config: state.config,
    investorTypes: INVESTOR_TYPES,
    network: state.network,
    flags: state.flags,
    offering: state.offering,
    policy: state.policy,
    sales: state.sales,
    registry,
    capTable: computeCapTable(registry.investors, state.config),
    metrics: computeMetrics(),
    presets: SCENARIO_PRESETS,
    accounts: state.accounts,
    trustline: state.trustline,
    timeline: state.timeline,
    lastUpdated: state.lastUpdated,
  }
}

async function runAction(actionName, handler) {
  if (state.busy) {
    throw new Error("Another demo action is already running. Please wait a few seconds and try again.")
  }

  state.busy = true
  state.phase = actionName
  state.lastUpdated = nowIso()

  try {
    await handler()
    await refreshDerivedState()
    state.phase = "ready"
    return snapshot()
  } catch (error) {
    state.phase = "error"
    addTimeline("error", `${actionName} failed`, error.message)
    await refreshDerivedState().catch(() => {})
    throw error
  } finally {
    state.busy = false
    state.lastUpdated = nowIso()
  }
}

async function setupDemo(configInput) {
  const nextConfig = sanitizeConfig(configInput)
  resetState(nextConfig)

  await runAction("Setting up accounts", async () => {
    const connectedClient = await ensureClient()

    addTimeline(
      "info",
      "Issuance scenario loaded",
      `${state.config.projectName} for ${state.config.vintage} in ${state.config.region} is ready for XRPL Testnet setup.`,
    )

    const issuerFunding = await connectedClient.fundWallet(undefined, {
      amount: "40",
      usageContext: "vineledger-issuer",
    })
    const treasuryFunding = await connectedClient.fundWallet(undefined, {
      amount: "50",
      usageContext: "vineledger-treasury",
    })
    const investorFunding = await connectedClient.fundWallet(undefined, {
      amount: "35",
      usageContext: "vineledger-investor",
    })

    wallets = {
      issuer: issuerFunding.wallet,
      treasury: treasuryFunding.wallet,
      investor: investorFunding.wallet,
    }

    updateLeadInvestor({
      walletAddress: wallets.investor.address,
      onboardingStatus: "Wallet funded",
      walletStatus: "wallet_funded",
      note: "XRPL Testnet wallet created and funded for the lead investor.",
    })

    addTimeline("info", "Wallets funded", "Issuer, treasury, and investor accounts received Testnet XRP.")

    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "AccountSet",
        Account: wallets.issuer.address,
        SetFlag: xrpl.AccountSetAsfFlags.asfRequireAuth,
      },
      "Issuer enabled RequireAuth",
    )

    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "AccountSet",
        Account: wallets.issuer.address,
        SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
      },
      "Issuer enabled DefaultRipple",
    )

    state.flags.setupComplete = true
    state.offering.issuanceStatus = "Bookbuilding"
    state.offering.settlementStatus = "Issuer controls live"
    state.policy.overallStatus = "Issuer controls armed"
    state.policy.note =
      "Issuer account now requires authorization before any wallet can receive the winery revenue token."
    state.policy.checks.issuerControls = "passed"
    state.policy.checks.transferRestrictions = "passed"
    addTimeline(
      "policy",
      "Policy gateway ready",
      "RequireAuth and transfer restrictions are active. The token can only be distributed to approved wallets.",
    )
  })
}

async function createTrustline() {
  if (!wallets || !state.flags.setupComplete) {
    throw new Error("Run Setup first.")
  }

  await runAction("Creating trust line", async () => {
    await submitTransaction(
      wallets.investor,
      {
        TransactionType: "TrustSet",
        Account: wallets.investor.address,
        LimitAmount: {
          currency: state.config.currency,
          issuer: wallets.issuer.address,
          value: state.config.trustLimit,
        },
      },
      "Investor created trust line",
    )

    state.flags.trustlineCreated = true
    state.policy.checks.walletScreening = "in_review"
    state.policy.note = "Investor wallet requested access and entered policy review."
    updateLeadInvestor({
      onboardingStatus: "Under review",
      walletStatus: "trustline_open",
      note: "Trust line opened and wallet submitted for policy review.",
    })
    addTimeline(
      "policy",
      "Wallet submitted for screening",
      `${state.config.investorName} opened a trust line and entered compliance review.`,
    )
  })
}

async function authorizeTrustline() {
  if (!wallets || !state.flags.trustlineCreated) {
    throw new Error("Create the investor trust line first.")
  }

  await runAction("Authorizing wallet", async () => {
    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "TrustSet",
        Account: wallets.issuer.address,
        LimitAmount: {
          currency: state.config.currency,
          issuer: wallets.investor.address,
          value: "0",
        },
        Flags: xrpl.TrustSetFlags.tfSetfAuth,
      },
      "Issuer authorized investor wallet",
    )

    state.flags.trustlineAuthorized = true
    state.policy.overallStatus = "Investor approved"
    state.policy.note = `${state.config.investorName} passed onboarding and can now receive ${state.config.currency}.`
    state.policy.checks.kyc = "passed"
    state.policy.checks.sanctions = "passed"
    state.policy.checks.walletScreening = "passed"
    state.policy.checks.suitability = "passed"
    state.policy.checks.jurisdiction = "passed"
    updateLeadInvestor({
      onboardingStatus: "Approved",
      kycStatus: "passed",
      sanctionsStatus: "passed",
      walletStatus: "allow_listed",
      tokenStatus: "approved",
      note: "Investor passed onboarding and can receive the XRPL token.",
    })
    addTimeline(
      "policy",
      "KYC and allow-list complete",
      "The investor wallet is now authorized to receive the winery revenue token.",
    )
  })
}

async function receiveSubscription() {
  if (!wallets || !state.flags.trustlineAuthorized) {
    throw new Error("Authorize the investor wallet first.")
  }

  await runAction("Receiving subscription", async () => {
    await submitTransaction(
      wallets.investor,
      {
        TransactionType: "Payment",
        Account: wallets.investor.address,
        Destination: wallets.treasury.address,
        Amount: xrpl.xrpToDrops(state.config.subscriptionXrp),
      },
      "Investor sent subscription payment",
    )

    state.flags.subscriptionReceived = true
    state.offering.committedXrp = state.config.subscriptionXrp
    state.offering.issuanceStatus = "Subscribed"
    state.offering.settlementStatus = "Treasury funded"
    updateLeadInvestor({
      subscriptionXrp: state.config.subscriptionXrp,
      allocationTokens: state.config.issueQuantity,
      ownershipPct: "100.0",
      tokenStatus: "reserved",
      note: "Capital committed and allocation reserved pending issuance.",
    })
    addTimeline(
      "business",
      "SPV treasury funded",
      `Treasury received ${state.config.subscriptionXrp} XRP from ${state.config.investorName}.`,
    )
  })
}

async function issueToken() {
  if (!wallets || !state.flags.subscriptionReceived) {
    throw new Error("Receive the subscription payment first.")
  }

  await runAction("Issuing tokens", async () => {
    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "Payment",
        Account: wallets.issuer.address,
        Destination: wallets.investor.address,
        DeliverMax: {
          currency: state.config.currency,
          value: state.config.issueQuantity,
          issuer: wallets.issuer.address,
        },
      },
      "Issuer distributed revenue tokens",
    )

    state.flags.tokensIssued = true
    state.offering.issuanceStatus = "Issued on XRPL"
    state.offering.settlementStatus = "Investor holds tokenized revenue rights"
    state.sales.distributionStatus = "Awaiting first sales cycle"
    updateLeadInvestor({
      tokenStatus: "issued",
      note: "Revenue participation tokens delivered on XRPL to the approved wallet.",
    })
    addTimeline(
      "business",
      "Investor received tokenized revenue rights",
      `${state.config.issueQuantity} ${state.config.currency} issued to the approved investor wallet.`,
    )
  })
}

async function sendPayout() {
  if (!wallets || !state.flags.tokensIssued) {
    throw new Error("Issue the revenue tokens first.")
  }

  await runAction("Paying revenue share", async () => {
    const payout = Number(state.config.payoutXrp)
    const sharePct = Number(state.config.revenueSharePercent)
    const grossRevenue = sharePct ? payout / (sharePct / 100) : 0
    const bottlesSold = Math.max(120, Math.round(grossRevenue / 0.04))
    const avgBottlePrice = bottlesSold ? grossRevenue / bottlesSold : 0

    addTimeline(
      "business",
      "Sales report approved",
      `The ${state.config.spvName} reporting cycle is closed and the payout window has been approved.`,
    )

    await submitTransaction(
      wallets.treasury,
      {
        TransactionType: "Payment",
        Account: wallets.treasury.address,
        Destination: wallets.investor.address,
        Amount: xrpl.xrpToDrops(state.config.payoutXrp),
      },
      "Treasury sent payout",
    )

    state.flags.payoutSent = true
    state.sales.reportStatus = "Revenue report filed"
    state.sales.distributionStatus = "Paid to investor"
    state.sales.payoutPoolXrp = state.config.payoutXrp
    state.sales.grossRevenueXrp = toFixedString(grossRevenue, 2)
    state.sales.bottlesSold = bottlesSold
    state.sales.avgBottlePriceXrp = toFixedString(avgBottlePrice, 4)
    state.sales.lastReportAt = nowIso()
    updateLeadInvestor({
      payoutReceivedXrp: state.config.payoutXrp,
      note: "Investor received the first simulated revenue distribution.",
    })
    addTimeline(
      "business",
      "Revenue share distributed",
      `${state.config.investorName} received ${state.config.payoutXrp} XRP as a simulated distribution.`,
    )
  })
}

async function freezeTrustline() {
  if (!wallets || !state.flags.tokensIssued) {
    throw new Error("Issue the revenue tokens before demonstrating a freeze.")
  }

  await runAction("Freezing trust line", async () => {
    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "TrustSet",
        Account: wallets.issuer.address,
        LimitAmount: {
          currency: state.config.currency,
          issuer: wallets.investor.address,
          value: "0",
        },
        Flags: xrpl.TrustSetFlags.tfSetFreeze,
      },
      "Issuer froze investor trust line",
    )

    state.flags.trustlineFrozen = true
    state.flags.holdReleased = false
    state.policy.holdActive = true
    state.policy.overallStatus = "Transfer hold active"
    state.policy.alertReason = { ...ALERT_PLAYBOOK[0] }
    state.policy.note = "A transfer-during-lockup alert was raised, so the issuer froze the trust line pending review."
    state.policy.checks.walletScreening = "alert"
    updateLeadInvestor({
      onboardingStatus: "Temporarily restricted",
      walletStatus: "frozen",
      holdStatus: "frozen",
      note: "Wallet frozen pending manual compliance review.",
    })
    addTimeline(
      "policy",
      "Compliance hold enacted",
      "The issuer froze the trust line to contain a simulated suspicious-activity alert.",
    )
  })
}

async function releaseHold() {
  if (!wallets || !state.flags.trustlineFrozen) {
    throw new Error("Freeze the trust line first.")
  }

  await runAction("Releasing compliance hold", async () => {
    await submitTransaction(
      wallets.issuer,
      {
        TransactionType: "TrustSet",
        Account: wallets.issuer.address,
        LimitAmount: {
          currency: state.config.currency,
          issuer: wallets.investor.address,
          value: "0",
        },
        Flags: xrpl.TrustSetFlags.tfClearFreeze,
      },
      "Issuer released trust line freeze",
    )

    state.flags.trustlineFrozen = false
    state.flags.holdReleased = true
    state.policy.holdActive = false
    state.policy.overallStatus = "Investor approved"
    state.policy.alertReason = null
    state.policy.note = "Manual review completed and transfer capability has been restored."
    state.policy.checks.walletScreening = "passed"
    updateLeadInvestor({
      onboardingStatus: "Approved",
      walletStatus: "allow_listed",
      holdStatus: "clear",
      note: "Compliance review cleared and wallet access restored.",
    })
    addTimeline(
      "policy",
      "Hold released",
      "Compliance review is complete and the investor trust line is active again.",
    )
  })
}

async function autoplay(configInput) {
  const bodyProvided = configInput && Object.keys(configInput).length > 0
  if (bodyProvided || !state.flags.setupComplete) {
    await setupDemo(bodyProvided ? configInput : state.config)
  }
  if (!state.flags.trustlineCreated) await createTrustline()
  if (!state.flags.trustlineAuthorized) await authorizeTrustline()
  if (!state.flags.subscriptionReceived) await receiveSubscription()
  if (!state.flags.tokensIssued) await issueToken()
  if (!state.flags.payoutSent) await sendPayout()
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload, null, 2))
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const raw = Buffer.concat(chunks).toString("utf8")
  return raw ? JSON.parse(raw) : {}
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8"
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8"
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8"
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8"
  return "text/plain; charset=utf-8"
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/state") {
      await refreshDerivedState().catch(() => {})
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/setup") {
      const body = await readRequestBody(req)
      await setupDemo(body)
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/autoplay") {
      const body = await readRequestBody(req)
      await autoplay(body)
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/trustline") {
      await createTrustline()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/authorize") {
      await authorizeTrustline()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/subscribe") {
      await receiveSubscription()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/issue") {
      await issueToken()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/payout") {
      await sendPayout()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/freeze") {
      await freezeTrustline()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    if (req.method === "POST" && pathname === "/api/release") {
      await releaseHold()
      return sendJson(res, 200, { ok: true, state: snapshot() })
    }

    return sendJson(res, 404, { ok: false, error: "Unknown API route." })
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message, state: snapshot() })
  }
}

function serveStatic(res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname
  const fullPath = path.join(PUBLIC_DIR, path.normalize(cleanPath))

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { ok: false, error: "Forbidden." })
    return
  }

  fs.readFile(fullPath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Not found.")
      return
    }

    res.writeHead(200, { "Content-Type": contentTypeFor(fullPath) })
    res.end(content)
  })
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`)

  if (requestUrl.pathname.startsWith("/api/")) {
    await handleApi(req, res, requestUrl.pathname)
    return
  }

  serveStatic(res, requestUrl.pathname)
})

resetState(DEFAULT_CONFIG)

server.listen(PORT, () => {
  console.log(`VineLedger demo server running at http://localhost:${PORT}`)
})
