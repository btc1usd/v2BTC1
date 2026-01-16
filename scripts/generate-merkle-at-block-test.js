/* ============================================================
   SELF-RECONCILING MERKLE GENERATOR (V11 - FIXED)
   Network: Base Mainnet
   Fixes: RPC rate limits, pool detection, 100% reconciliation
   ============================================================ */

const { ethers } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const fs = require("fs");
require("dotenv").config({ path: ".env.production" });

/* ================= CONFIG ================= */

const TARGET_BLOCK = 40596432;
const BTC1_DECIMALS = 8;
const BTC1USD = "0x9B8fc91C33ecAFE4992A2A8dBA27172328f423a5".toLowerCase();
const WEEKLY = "0x1FEf2533641cA69B9E30fA734944BB219b2152B6";
const ZERO = "0x0000000000000000000000000000000000000000";

const EXCLUDED_ADDRESSES = [
    ZERO,
    BTC1USD,
    WEEKLY.toLowerCase(),
    "0x000000000000000000000000000000000000dead"
];

const ALCHEMY_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC, { name: "base", chainId: 8453 }, { staticNetwork: true });

/* ================= BIGINT JSON SERIALIZER ================= */

function replacer(key, value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}

function jsonStringify(data, space = 2) {
    return JSON.stringify(data, replacer, space);
}

/* ================= RATE LIMIT AWARE EVENT QUERIER ================= */

class RateLimitAwareEventQuerier {
    constructor(provider, blockTag) {
        this.provider = provider;
        this.blockTag = blockTag;
        this.maxBlockRange = 1000; // Conservative for free tier
    }

    async queryEventsInChunks(contract, filter, fromBlock, toBlock) {
        const events = [];
        let currentBlock = fromBlock;

        while (currentBlock <= toBlock) {
            const endBlock = Math.min(currentBlock + this.maxBlockRange - 1, toBlock);
            
            try {
                console.log(`      Querying blocks ${currentBlock} to ${endBlock}...`);
                const chunkEvents = await contract.queryFilter(filter, currentBlock, endBlock);
                events.push(...chunkEvents);
                currentBlock = endBlock + 1;
            } catch (error) {
                if (error.message.includes("10 block range") || error.message.includes("block range")) {
                    // Reduce block range for free tier
                    this.maxBlockRange = Math.max(10, Math.floor(this.maxBlockRange / 2));
                    console.log(`      ⚠️  Reducing block range to ${this.maxBlockRange} (RPC limit)`);
                    continue;
                } else if (error.message.includes("rate limit") || error.message.includes("429")) {
                    console.log(`      ⏳ Rate limited, waiting 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                } else {
                    console.log(`      ⚠️  Error querying blocks ${currentBlock}-${endBlock}: ${error.message}`);
                    currentBlock = endBlock + 1;
                }
            }
        }

        return events;
    }
}

/* ================= MULTI-API HOLDER FETCHER ================= */

class MultiAPIHolderFetcher {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl, { name: "base", chainId: 8453 }, { staticNetwork: true });
    }

    async fetchFromCovalent() {
        console.log("📡 Attempting Covalent API (GoldRush)...");
        try {
            const apiKey = process.env.COVALENT_API_KEY;
            if (!apiKey) {
                console.log("   ⚠️  Covalent API key not found");
                return null;
            }

            const url = `https://api.covalenthq.com/v1/base-mainnet/tokens/${this.config.tokenAddress}/token_holders_v2/?key=${apiKey}&page-size=1000`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error || data.error_code) {
                console.log(`   ⚠️  Covalent Error: ${data.error_message || data.error}`);
                return null;
            }

            if (!data.data || !data.data.items) {
                console.log("   ⚠️  No holders found in Covalent response");
                return null;
            }

            const holders = [];
            let pageNumber = 0;
            let hasMore = true;

            while (hasMore) {
                const pageUrl = `https://api.covalenthq.com/v1/base-mainnet/tokens/${this.config.tokenAddress}/token_holders_v2/?key=${apiKey}&page-size=1000&page-number=${pageNumber}`;
                const pageResponse = await fetch(pageUrl);
                const pageData = await pageResponse.json();

                if (!pageData.data || !pageData.data.items) break;

                for (const item of pageData.data.items) {
                    if (item.address && item.balance) {
                        holders.push({
                            address: item.address.toLowerCase(),
                            balance: item.balance
                        });
                    }
                }

                hasMore = pageData.data.pagination.has_more;
                pageNumber++;
            }

            console.log(`   ✅ Fetched ${holders.length} holders from Covalent`);
            return holders;
        } catch (error) {
            console.log(`   ❌ Covalent fetch failed: ${error.message}`);
            return null;
        }
    }

    async fetchFromMoralis() {
        console.log("📡 Attempting Moralis API...");
        try {
            const apiKey = process.env.MORALIS_API_KEY;
            if (!apiKey) {
                console.log("   ⚠️  Moralis API key not found");
                return null;
            }

            const url = `https://deep-index.moralis.io/api/v2.2/erc20/${this.config.tokenAddress}/owners?chain=base&limit=1000`;
            const response = await fetch(url, {
                headers: {
                    "X-API-Key": apiKey
                }
            });

            if (!response.ok) {
                console.log(`   ⚠️  Moralis Error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();

            if (!data.result || !Array.isArray(data.result)) {
                console.log("   ⚠️  No holders found in Moralis response");
                return null;
            }

            const holders = [];
            for (const item of data.result) {
                if (item.owner_of && item.balance) {
                    holders.push({
                        address: item.owner_of.toLowerCase(),
                        balance: item.balance
                    });
                }
            }

            console.log(`   ✅ Fetched ${holders.length} holders from Moralis`);
            return holders;
        } catch (error) {
            console.log(`   ❌ Moralis fetch failed: ${error.message}`);
            return null;
        }
    }

    async fetchFromBlockScout() {
        console.log("📡 Attempting BlockScout API...");
        try {
            const url = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${this.config.tokenAddress}&page=1&offset=10000&apikey=${process.env.BASESCAN_API_KEY || ""}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== "1") {
                console.log(`   ⚠️  BlockScout Error: ${data.message}`);
                return null;
            }

            const holders = [];
            for (const item of data.result) {
                if (item.TokenHolderAddress && item.TokenHolderQuantity) {
                    holders.push({
                        address: item.TokenHolderAddress.toLowerCase(),
                        balance: item.TokenHolderQuantity
                    });
                }
            }

            console.log(`   ✅ Fetched ${holders.length} holders from BlockScout`);
            return holders;
        } catch (error) {
            console.log(`   ❌ BlockScout fetch failed: ${error.message}`);
            return null;
        }
    }

    async fetchFromRPC() {
        console.log("📡 Attempting RPC-based holder discovery...");
        try {
            const btc1Contract = new ethers.Contract(this.config.tokenAddress, [
                "event Transfer(address indexed from, address indexed to, uint256 value)"
            ], this.provider);

            // Use rate-limit aware querier with narrow 7-day window
            const querier = new RateLimitAwareEventQuerier(this.provider, this.config.blockTag);
            const BLOCKS_PER_DAY = 43200; // Base: ~2 second blocks
            const fromBlock = Math.max(0, this.config.blockTag - (BLOCKS_PER_DAY * 7)); // 7 days
            
            console.log(`   Querying Transfer events from block ${fromBlock} to ${this.config.blockTag} (7 day window)...`);

            const filter = btc1Contract.filters.Transfer();
            const events = await querier.queryEventsInChunks(btc1Contract, filter, fromBlock, this.config.blockTag);

            const holders = new Map();
            for (const event of events) {
                if (event.args.from && event.args.from !== ZERO) {
                    holders.set(event.args.from.toLowerCase(), true);
                }
                if (event.args.to && event.args.to !== ZERO) {
                    holders.set(event.args.to.toLowerCase(), true);
                }
            }

            // Get balances for all holders
            const btc1Contract2 = new ethers.Contract(this.config.tokenAddress, [
                "function balanceOf(address) view returns (uint256)"
            ], this.provider);

            const holdersList = [];
            for (const addr of holders.keys()) {
                try {
                    const balance = await btc1Contract2.balanceOf(addr, { blockTag: this.config.blockTag });
                    if (balance > 0n) {
                        holdersList.push({
                            address: addr,
                            balance: balance.toString()
                        });
                    }
                } catch (error) {
                    // Skip individual balance fetch errors
                }
            }

            console.log(`   ✅ Found ${holdersList.length} holders from RPC events`);
            return holdersList;
        } catch (error) {
            console.log(`   ❌ RPC fetch failed: ${error.message}`);
            return null;
        }
    }

    async fetch() {
        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║   FETCHING TOKEN HOLDERS FROM MULTIPLE SOURCES             ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        let holders = await this.fetchFromCovalent();
        if (holders) return holders;

        holders = await this.fetchFromMoralis();
        if (holders) return holders;

        holders = await this.fetchFromBlockScout();
        if (holders) return holders;

        console.log("\n🔄 All APIs failed, falling back to RPC-based discovery...\n");
        holders = await this.fetchFromRPC();
        if (holders) return holders;

        throw new Error("Failed to fetch holders from all available sources");
    }
}

/* ================= ENHANCED POOL DETECTION ================= */

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const AERODROME_ABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function reserve0() view returns (uint256)",
    "function reserve1() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

const UNIV2_ABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
];

const UNIV3_POOL_ABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"
];

const UNIV3_POSITION_MANAGER_ABI = [
    "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const UNIV4_MANAGER_ABI = [
    "function positions(bytes32 id) view returns (address owner, uint256 liquidity, uint256 amount0, uint256 amount1)",
    "event PositionCreated(bytes32 indexed id, address indexed owner, uint256 liquidity)"
];

class SelfReconcilingEngineV11 {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl, { name: "base", chainId: 8453 }, { staticNetwork: true });
        this.balances = new Map();
        this.metadata = new Map();
        this.processedPools = new Set();
        this.querier = new RateLimitAwareEventQuerier(this.provider, config.blockTag);
    }

    async detectPoolType(address) {
        try {
            const code = await this.provider.getCode(address, this.config.blockTag);
            if (code === "0x") return { type: "EOA" };

            // Try Aerodrome first (Base-specific)
            try {
                const aeroContract = new ethers.Contract(address, AERODROME_ABI, this.provider);
                const token0 = await aeroContract.token0({ blockTag: this.config.blockTag });
                const reserve0 = await aeroContract.reserve0({ blockTag: this.config.blockTag });
                if (token0 && reserve0 !== undefined) return { type: "AERODROME_POOL" };
            } catch (e) {
                // Not Aerodrome, try next
            }

            // Try V2 Pool (with error handling)
            try {
                const v2Contract = new ethers.Contract(address, UNIV2_ABI, this.provider);
                const token0 = await v2Contract.token0({ blockTag: this.config.blockTag });
                const reserves = await v2Contract.getReserves({ blockTag: this.config.blockTag });
                if (token0 && reserves) return { type: "UNIV2_POOL" };
            } catch (e) {
                // Not a V2 pool, try next
            }

            // Try V3 Pool
            try {
                const v3Contract = new ethers.Contract(address, UNIV3_POOL_ABI, this.provider);
                const token0 = await v3Contract.token0({ blockTag: this.config.blockTag });
                const token1 = await v3Contract.token1({ blockTag: this.config.blockTag });
                if (token0 && token1) return { type: "UNIV3_POOL" };
            } catch {}

            // Try V3 Position Manager
            try {
                const pmContract = new ethers.Contract(address, UNIV3_POSITION_MANAGER_ABI, this.provider);
                const balance = await pmContract.balanceOf(this.config.tokenAddress, { blockTag: this.config.blockTag });
                if (balance >= 0n) return { type: "UNIV3_POSITION_MANAGER" };
            } catch {}

            // Try V4 Manager (check for V4-specific functions)
            try {
                const v4Contract = new ethers.Contract(address, [
                    "function modifyLiquidity(bytes32,int256,bytes32) external returns (int256,int256)"
                ], this.provider);
                // V4 uses hook-based architecture, check bytecode patterns
                if (code.includes("modifyLiquidity") || code.length > 10000) {
                    return { type: "UNIV4_POOL" };
                }
            } catch {}

            return { type: "CONTRACT" };
        } catch (error) {
            return { type: "UNKNOWN" };
        }
    }

    async getLPHoldersFromCovalent(poolAddress) {
        try {
            const apiKey = process.env.COVALENT_API_KEY;
            if (!apiKey) return null;

            console.log(`      Fetching LP holders from Covalent...`);
            const url = `https://api.covalenthq.com/v1/base-mainnet/tokens/${poolAddress}/token_holders_v2/?key=${apiKey}&page-size=1000`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error || data.error_code || !data.data || !data.data.items) {
                console.log(`      ⚠️  Covalent API failed`);
                return null;
            }

            const holders = data.data.items
                .filter(item => item.address && item.balance && BigInt(item.balance) > 0n)
                .map(item => item.address.toLowerCase());
            
            console.log(`      ✅ Got ${holders.length} LP holders from Covalent`);
            return holders;
        } catch (error) {
            console.log(`      ⚠️  Covalent fetch failed: ${error.message}`);
            return null;
        }
    }

    async getBalanceWithRetry(contract, address, blockTag, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await contract.balanceOf(address, { blockTag, timeout: 30000 });
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`      ⏳ Retry ${i + 1}/${retries} for ${address.slice(0, 10)}...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    async processV2LikePool(poolAddress) {
        if (this.processedPools.has(poolAddress)) return;
        this.processedPools.add(poolAddress);

        console.log(`   🔄 Unwrapping V2-style Pool: ${poolAddress}`);
        try {
            // Detect if Aerodrome or UniswapV2
            let poolContract, reserves, isAerodrome = false;
            
            try {
                // Try Aerodrome first
                const aeroContract = new ethers.Contract(poolAddress, AERODROME_ABI, this.provider);
                const [token0, token1, reserve0, reserve1, lpTotalSupply] = await Promise.all([
                    aeroContract.token0({ blockTag: this.config.blockTag }),
                    aeroContract.token1({ blockTag: this.config.blockTag }),
                    aeroContract.reserve0({ blockTag: this.config.blockTag }),
                    aeroContract.reserve1({ blockTag: this.config.blockTag }),
                    aeroContract.totalSupply({ blockTag: this.config.blockTag })
                ]);
                
                poolContract = aeroContract;
                reserves = [reserve0, reserve1];
                isAerodrome = true;
                console.log(`      ✅ Aerodrome pool detected`);
                
                if (lpTotalSupply === 0n) {
                    console.log(`      ⚠️  Pool has zero total supply`);
                    return;
                }

                const btc1Reserve = token0.toLowerCase() === this.config.tokenAddress ? reserve0 : reserve1;
                await this.processPoolHolders(poolAddress, poolContract, btc1Reserve, lpTotalSupply);
                return;
            } catch (e) {
                // Not Aerodrome, try UniswapV2
            }
            
            // Try UniswapV2
            const v2Contract = new ethers.Contract(poolAddress, UNIV2_ABI, this.provider);
            const [token0, token1, reservesData, lpTotalSupply] = await Promise.all([
                v2Contract.token0({ blockTag: this.config.blockTag }),
                v2Contract.token1({ blockTag: this.config.blockTag }),
                v2Contract.getReserves({ blockTag: this.config.blockTag }),
                v2Contract.totalSupply({ blockTag: this.config.blockTag })
            ]);

            if (lpTotalSupply === 0n) {
                console.log(`      ⚠️  Pool has zero total supply`);
                return;
            }

            const btc1Reserve = token0.toLowerCase() === this.config.tokenAddress ? reservesData[0] : reservesData[1];
            console.log(`      ✅ UniswapV2 pool detected`);
            await this.processPoolHolders(poolAddress, v2Contract, btc1Reserve, lpTotalSupply);
            
        } catch (error) {
            console.error(`   ❌ Error processing pool: ${error.message}`);
        }
    }

    async processPoolHolders(poolAddress, poolContract, btc1Reserve, lpTotalSupply) {
        console.log(`      BTC1 Reserve: ${ethers.formatUnits(btc1Reserve, this.config.decimals)}`);
        console.log(`      LP Total Supply: ${ethers.formatUnits(lpTotalSupply, 18)}`);
        
        // IMPORTANT: Remove pool's direct balance first (will be replaced by LP holders' shares)
        const poolDirectBalance = this.balances.get(poolAddress) || 0n;
        if (poolDirectBalance > 0n) {
            console.log(`      🗑️  Removing pool's direct balance: ${ethers.formatUnits(poolDirectBalance, this.config.decimals)} BTC1`);
            this.balances.delete(poolAddress);
        }
        
        // Get LP holders from Covalent
        const lpHolders = await this.getLPHoldersFromCovalent(poolAddress);
        
        if (!lpHolders || lpHolders.length === 0) {
            console.log(`      ⚠️  No LP holders found, restoring pool as direct holder\n`);
            if (poolDirectBalance > 0n) {
                this.balances.set(poolAddress, poolDirectBalance);
            }
            return;
        }

        console.log(`      Calculating BTC1 shares for ${lpHolders.length} LP holders at block ${this.config.blockTag}...`);

        let validHolders = 0;
        let processedCount = 0;
        
        for (const holder of lpHolders) {
            if (this.config.excluded.includes(holder)) continue;

            try {
                processedCount++;
                if (processedCount % 10 === 0) {
                    console.log(`      Progress: ${processedCount}/${lpHolders.length}...`);
                }
                
                const lpBalance = await this.getBalanceWithRetry(poolContract, holder, this.config.blockTag);
                if (lpBalance === 0n) continue;

                const share = (lpBalance * btc1Reserve) / lpTotalSupply;
                if (share > 0n) {
                    const current = this.balances.get(holder) || 0n;
                    this.balances.set(holder, current + share);
                    
                    const meta = this.metadata.get(holder) || { type: "MIXED", sources: [] };
                    meta.sources = meta.sources || [];
                    if (!meta.sources.includes("V2_LP")) meta.sources.push("V2_LP");
                    this.metadata.set(holder, meta);
                    
                    validHolders++;
                    if (validHolders <= 5) {
                        console.log(`      └─ ${holder}: ${ethers.formatUnits(share, this.config.decimals)} BTC1 from LP (total: ${ethers.formatUnits(this.balances.get(holder), this.config.decimals)})`);
                    }
                }
            } catch (error) {
                console.log(`      ⚠️  Skipped ${holder.slice(0, 10)}...: ${error.message}`);
            }
        }
        
        console.log(`      ✅ Processed ${validHolders} valid LP holders\n`);
    }

    async processV3Pool(poolAddress) {
        if (this.processedPools.has(poolAddress)) return;
        this.processedPools.add(poolAddress);

        console.log(`   🔄 Extracting V3 Pool positions: ${poolAddress}`);
        try {
            const poolContract = new ethers.Contract(poolAddress, UNIV3_POOL_ABI, this.provider);
            const [token0, token1, fee] = await Promise.all([
                poolContract.token0({ blockTag: this.config.blockTag }),
                poolContract.token1({ blockTag: this.config.blockTag }),
                poolContract.fee({ blockTag: this.config.blockTag })
            ]);

            const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11218F";
            const pmContract = new ethers.Contract(positionManagerAddress, UNIV3_POSITION_MANAGER_ABI, this.provider);
            
            const transferFilter = pmContract.filters.Transfer();
            const BLOCKS_PER_DAY = 43200; // Base: ~2 second blocks
            const fromBlock = Math.max(0, this.config.blockTag - (BLOCKS_PER_DAY * 7)); // 7 days
            
            const transferEvents = await this.querier.queryEventsInChunks(pmContract, transferFilter, fromBlock, this.config.blockTag);
            
            const positionIds = new Set();
            for (const event of transferEvents) {
                positionIds.add(event.args.tokenId.toString());
            }

            console.log(`      Found ${positionIds.size} position NFTs`);

            let processedCount = 0;
            for (const positionId of positionIds) {
                try {
                    const position = await pmContract.positions(positionId, { blockTag: this.config.blockTag });
                    const owner = await pmContract.ownerOf(positionId, { blockTag: this.config.blockTag });

                    if (this.config.excluded.includes(owner)) continue;

                    if ((position.token0.toLowerCase() === this.config.tokenAddress || position.token1.toLowerCase() === this.config.tokenAddress) &&
                        position.liquidity > 0n) {
                        
                        const tokenShare = position.token0.toLowerCase() === this.config.tokenAddress ? position.tokensOwed0 : position.tokensOwed1;
                        
                        const current = this.balances.get(owner) || 0n;
                        this.balances.set(owner, current + tokenShare);
                        
                        const meta = this.metadata.get(owner) || { type: "MIXED", sources: [] };
                        meta.sources = meta.sources || [];
                        if (!meta.sources.includes("V3_LP")) meta.sources.push("V3_LP");
                        this.metadata.set(owner, meta);
                        
                        processedCount++;
                    }
                } catch (error) {
                    // Skip individual position errors
                }
            }
            
            console.log(`      Processed ${processedCount} V3 positions`);
        } catch (error) {
            console.error(`   ❌ Error processing V3 pool: ${error.message}`);
        }
    }

    async processV3PositionManager(managerAddress) {
        if (this.processedPools.has(managerAddress)) return;
        this.processedPools.add(managerAddress);

        console.log(`   🔄 Processing V3 Position Manager: ${managerAddress}`);
        try {
            const pmContract = new ethers.Contract(managerAddress, UNIV3_POSITION_MANAGER_ABI, this.provider);
            
            const transferFilter = pmContract.filters.Transfer();
            const BLOCKS_PER_DAY = 43200; // Base: ~2 second blocks
            const fromBlock = Math.max(0, this.config.blockTag - (BLOCKS_PER_DAY * 7)); // 7 days
            
            const transferEvents = await this.querier.queryEventsInChunks(pmContract, transferFilter, fromBlock, this.config.blockTag);
            
            const holders = new Set();
            for (const event of transferEvents) {
                if (event.args.to && event.args.to !== ZERO) {
                    holders.add(event.args.to.toLowerCase());
                }
            }

            console.log(`      Found ${holders.size} position holders`);

            let processedCount = 0;
            for (const holder of holders) {
                try {
                    const balance = await pmContract.balanceOf(holder, { blockTag: this.config.blockTag });
                    
                    for (let i = 0; i < balance; i++) {
                        const tokenId = await pmContract.tokenOfOwnerByIndex(holder, i, { blockTag: this.config.blockTag });
                        const position = await pmContract.positions(tokenId, { blockTag: this.config.blockTag });
                        
                        if ((position.token0.toLowerCase() === this.config.tokenAddress || position.token1.toLowerCase() === this.config.tokenAddress) &&
                            position.liquidity > 0n) {
                            
                            const tokenShare = position.token0.toLowerCase() === this.config.tokenAddress ? position.tokensOwed0 : position.tokensOwed1;
                            const current = this.balances.get(holder) || 0n;
                            this.balances.set(holder, current + tokenShare);
                            
                            const meta = this.metadata.get(holder) || { type: "MIXED", sources: [] };
                            meta.sources = meta.sources || [];
                            if (!meta.sources.includes("V3_LP")) meta.sources.push("V3_LP");
                            this.metadata.set(holder, meta);
                            
                            processedCount++;
                        }
                    }
                } catch (error) {
                    // Skip individual holder errors
                }
            }
            
            console.log(`      Processed ${processedCount} positions from manager`);
        } catch (error) {
            console.error(`   ❌ Error processing V3 Position Manager: ${error.message}`);
        }
    }

    async processV4Manager(managerAddress) {
        if (this.processedPools.has(managerAddress)) return;
        this.processedPools.add(managerAddress);

        console.log(`   🔄 Processing V4 Pool Manager: ${managerAddress}`);
        try {
            const v4Contract = new ethers.Contract(managerAddress, UNIV4_MANAGER_ABI, this.provider);
            
            const positionFilter = v4Contract.filters.PositionCreated();
            const BLOCKS_PER_DAY = 43200; // Base: ~2 second blocks
            const fromBlock = Math.max(0, this.config.blockTag - (BLOCKS_PER_DAY * 7)); // 7 days
            
            const positionEvents = await this.querier.queryEventsInChunks(v4Contract, positionFilter, fromBlock, this.config.blockTag);
            
            console.log(`      Found ${positionEvents.length} V4 positions`);

            let processedCount = 0;
            for (const event of positionEvents) {
                try {
                    const positionId = event.args.id;
                    const owner = event.args.owner.toLowerCase();
                    
                    if (this.config.excluded.includes(owner)) continue;

                    const position = await v4Contract.positions(positionId, { blockTag: this.config.blockTag });
                    
                    if (position && position.liquidity > 0n) {
                        const tokenShare = position.amount0 > 0n ? position.amount0 : position.amount1;
                        
                        const current = this.balances.get(owner) || 0n;
                        this.balances.set(owner, current + tokenShare);
                        
                        const meta = this.metadata.get(owner) || { type: "MIXED", sources: [] };
                        meta.sources = meta.sources || [];
                        if (!meta.sources.includes("V4_LP")) meta.sources.push("V4_LP");
                        this.metadata.set(owner, meta);
                        
                        processedCount++;
                    }
                } catch (error) {
                    // Skip individual position errors
                }
            }
            
            console.log(`      Processed ${processedCount} V4 positions`);
        } catch (error) {
            console.error(`   ❌ Error processing V4 manager: ${error.message}`);
        }
    }

    async run() {
        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║   PHASE 1: FETCH & RECONCILE HOLDER BALANCES              ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        const btc1Contract = new ethers.Contract(this.config.tokenAddress, ERC20_ABI, this.provider);
        
        // Fetch holders with multi-API fallback
        const fetcher = new MultiAPIHolderFetcher(this.config);
        const holdersData = await fetcher.fetch();

        console.log(`\n📊 Processing ${holdersData.length} holders...\n`);

        for (const holderData of holdersData) {
            const addr = holderData.address.toLowerCase();
            if (this.config.excluded.includes(addr)) continue;

            const onChainBalance = await btc1Contract.balanceOf(addr, { blockTag: this.config.blockTag });
            if (onChainBalance === 0n) continue;

            const detection = await this.detectPoolType(addr);
            console.log(`\n📍 ${addr} | Type: ${detection.type} | Balance: ${ethers.formatUnits(onChainBalance, this.config.decimals)} BTC1`);

            if (detection.type === "EOA") {
                this.balances.set(addr, onChainBalance);
                this.metadata.set(addr, { type: "EOA", sources: ["DIRECT"], balance: onChainBalance });
            } else if (detection.type === "UNIV2_POOL" || detection.type === "AERODROME_POOL") {
                await this.processV2LikePool(addr);
            } else if (detection.type === "UNIV3_POOL") {
                await this.processV3Pool(addr);
            } else if (detection.type === "UNIV3_POSITION_MANAGER") {
                await this.processV3PositionManager(addr);
            } else if (detection.type === "UNIV4_MANAGER" || detection.type === "UNIV4_POOL") {
                console.log(`   ⚠️  UniswapV4 detected. Crediting pool directly (V4 requires specialized indexing).`);
                this.balances.set(addr, onChainBalance);
                this.metadata.set(addr, { type: `${detection.type}_DIRECT`, sources: ["DIRECT"], balance: onChainBalance });
            } else {
                console.log(`   ⚠️  ${detection.type} detected. Crediting directly as fallback.`);
                this.balances.set(addr, onChainBalance);
                this.metadata.set(addr, { type: `${detection.type}_DIRECT`, sources: ["DIRECT"], balance: onChainBalance });
            }
        }

        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║   PHASE 2: GENERATE MERKLE TREE                           ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        const weekly = new ethers.Contract(this.config.distributor, ["function getCurrentDistributionInfo() view returns (uint256, uint256)"], this.provider);
        const [, rewardPerToken] = await weekly.getCurrentDistributionInfo({ blockTag: this.config.blockTag });

        const claims = [];
        let totalRewards = 0n;
        let index = 0;

        for (const [addr, bal] of this.balances) {
            const reward = (bal * BigInt(rewardPerToken || 0)) / (10n ** BigInt(this.config.decimals));
            if (reward > 0n) {
                claims.push({ index, account: addr, amount: reward, totalBalance: bal, proof: [] });
                totalRewards += reward;
                index++;
            }
        }

        const leaves = claims.map(c => ethers.solidityPackedKeccak256(["uint256", "address", "uint256"], [c.index, c.account, c.amount]));
        const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
        claims.forEach((c, i) => c.proof = tree.getHexProof(leaves[i]));

        const result = {
            root: tree.getHexRoot(),
            totalRewards: totalRewards,
            recipientCount: claims.length,
            block: this.config.blockTag,
            timestamp: new Date().toISOString(),
            claims: claims,
            metadata: Object.fromEntries(this.metadata)
        };

        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║   PHASE 3: VERIFICATION & OUTPUT                          ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        const onChainTotalSupply = await btc1Contract.totalSupply({ blockTag: this.config.blockTag });
        const calculatedTotalSupply = Array.from(this.balances.values()).reduce((a, b) => a + b, 0n);

        console.log(`✅ Merkle Root: ${result.root}`);
        console.log(`✅ Total Rewards: ${ethers.formatUnits(totalRewards, this.config.decimals)} BTC1`);
        console.log(`✅ Total Recipients: ${result.recipientCount}`);
        console.log(`✅ On-Chain Total Supply: ${ethers.formatUnits(onChainTotalSupply, this.config.decimals)} BTC1`);
        console.log(`✅ Calculated Total Supply: ${ethers.formatUnits(calculatedTotalSupply, this.config.decimals)} BTC1`);
        
        const supplyDifference = onChainTotalSupply - calculatedTotalSupply;
        console.log(`\n📊 Supply Difference: ${ethers.formatUnits(supplyDifference, this.config.decimals)} BTC1`);

        if (supplyDifference === 0n) {
            console.log("✅ ✅ ✅ RECONCILIATION SUCCESSFUL: 100% MATCH WITH ON-CHAIN DATA ✅ ✅ ✅");
        } else if (Math.abs(Number(supplyDifference)) < 1) {
            console.log("✅ ✅ ✅ RECONCILIATION SUCCESSFUL: <1 BTC1 ROUNDING DIFFERENCE (ACCEPTABLE) ✅ ✅ ✅");
        } else if (supplyDifference < 0n) {
            console.log(`⚠️  WARNING: Calculated supply exceeds on-chain by ${ethers.formatUnits(supplyDifference * -1n, this.config.decimals)} BTC1`);
        } else {
            console.log(`⚠️  WARNING: Missing ${ethers.formatUnits(supplyDifference, this.config.decimals)} BTC1 from distribution`);
            console.log(`   This may be due to undetected pools or contracts. Check metadata for details.`);
        }

        // Show all recipients with their holdings
        console.log(`\n📊 ALL RECIPIENTS AT BLOCK ${this.config.blockTag}:\n`);
        const sortedClaims = claims.sort((a, b) => Number(b.totalBalance - a.totalBalance));
        
        let directHolderCount = 0;
        let lpDerivedCount = 0;
        
        for (const claim of sortedClaims) {
            const addr = claim.account;
            const meta = this.metadata.get(addr);
            const directBal = await btc1Contract.balanceOf(addr, { blockTag: this.config.blockTag });
            const isDirectHolder = directBal > 0n;
            const isDerivedFromLP = claim.totalBalance > directBal;
            
            let label = '';
            if (isDirectHolder && isDerivedFromLP) {
                label = '(Direct + LP)';
                directHolderCount++;
                lpDerivedCount++;
            } else if (isDirectHolder) {
                label = '(Direct EOA)';
                directHolderCount++;
            } else {
                label = '(LP Provider)';
                lpDerivedCount++;
            }
            
            console.log(`${addr}: ${ethers.formatUnits(claim.totalBalance, this.config.decimals)} BTC1 → ${ethers.formatUnits(claim.amount, this.config.decimals)} reward ${label}`);
        }
        
        console.log(`\n📈 Summary:`);
        console.log(`   Direct Holders: ${directHolderCount}`);
        console.log(`   LP-Derived Recipients: ${lpDerivedCount}`);
        console.log(`   Total Recipients: ${claims.length}`);

        fs.writeFileSync("merkle_reconciled_result.json", jsonStringify(result));
        console.log("\n✅ Saved to merkle_reconciled_result.json");

        return result;
    }
}

/* ================= MAIN EXECUTION ================= */

async function main() {
    console.log("\n🚀 Starting Self-Reconciling Merkle Generator (V11 - Fixed)...\n");

    const config = {
        blockTag: TARGET_BLOCK,
        tokenAddress: BTC1USD,
        distributor: WEEKLY,
        decimals: BTC1_DECIMALS,
        excluded: EXCLUDED_ADDRESSES,
        rpcUrl: ALCHEMY_RPC
    };

    const engine = new SelfReconcilingEngineV11(config);
    await engine.run();

    console.log("\n✨ Process Complete.\n");
}

main().catch(error => {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
});
