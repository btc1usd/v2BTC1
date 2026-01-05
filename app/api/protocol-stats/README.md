# BTC1USD Protocol Stats API

Public API endpoint for fetching real-time protocol statistics.

## Endpoint

```
GET /api/protocol-stats
```

## Parameters

- `format` (optional): Response format
  - `json` (default): Full response with formatted values
  - `raw`: Simple response with numeric values only

## Response Format

### Full JSON Response (default)

```json
{
  "success": true,
  "timestamp": "2026-01-05T17:05:00.000Z",
  "network": "Base Sepolia",
  "chainId": 84532,
  "data": {
    "circulatingSupply": 1234.56,
    "btcReservesValue": 98765.43,
    "collateralRatio": 1.15,
    "rewardsPeriodDays": 7,
    "btcPrice": 87516.44
  },
  "formatted": {
    "circulatingSupply": "1,234.56 BTC1",
    "btcReservesValue": "$98,765.43",
    "collateralRatio": "115.00%",
    "rewardsPeriodDays": "7 days",
    "btcPrice": "$87,516.44"
  },
  "contracts": {
    "btc1usd": "0x45a235C767deCfEEC56678e6000e5Ad9a345382d",
    "vault": "0xEBDCefF95cd9982E26F267EA1E5823a2B36dDfDe",
    "oracle": "0xf67FB470E21886D1268100e4B65dfA13E7A778DC"
  }
}
```

### Raw Format

```
GET /api/protocol-stats?format=raw
```

```json
{
  "success": true,
  "circulatingSupply": 1234.56,
  "btcReservesValue": 98765.43,
  "collateralRatio": 1.15,
  "rewardsPeriodDays": 7,
  "btcPrice": 87516.44
}
```

## Usage Examples

### JavaScript/TypeScript

```javascript
// Fetch protocol stats
async function getProtocolStats() {
  const response = await fetch('https://your-domain.com/api/protocol-stats');
  const data = await response.json();
  
  if (data.success) {
    console.log('Circulating Supply:', data.formatted.circulatingSupply);
    console.log('Collateral Ratio:', data.formatted.collateralRatio);
    console.log('BTC Reserves:', data.formatted.btcReservesValue);
  }
}

// Use raw format for calculations
async function getRawStats() {
  const response = await fetch('https://your-domain.com/api/protocol-stats?format=raw');
  const data = await response.json();
  
  // Use numeric values directly
  const healthPercentage = (data.collateralRatio - 1) * 100;
  console.log('Health margin:', healthPercentage.toFixed(2) + '%');
}
```

### HTML Widget Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>BTC1USD Stats Widget</title>
  <style>
    .stats-widget {
      font-family: Arial, sans-serif;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .stat-card {
      background: white;
      padding: 15px;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #ff6b35;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="stats-widget" id="btc1usd-stats">
    <div class="stat-card">
      <div class="stat-value" id="supply">Loading...</div>
      <div class="stat-label">Circulating Supply</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="reserves">Loading...</div>
      <div class="stat-label">BTC Reserves Value</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="ratio">Loading...</div>
      <div class="stat-label">Collateral Ratio</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="period">Loading...</div>
      <div class="stat-label">Rewards Period</div>
    </div>
  </div>

  <script>
    async function loadStats() {
      try {
        const response = await fetch('https://your-domain.com/api/protocol-stats');
        const data = await response.json();
        
        if (data.success) {
          document.getElementById('supply').textContent = data.formatted.circulatingSupply;
          document.getElementById('reserves').textContent = data.formatted.btcReservesValue;
          document.getElementById('ratio').textContent = data.formatted.collateralRatio;
          document.getElementById('period').textContent = data.formatted.rewardsPeriodDays;
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }

    // Load stats on page load
    loadStats();
    
    // Refresh every 30 seconds
    setInterval(loadStats, 30000);
  </script>
</body>
</html>
```

### React Component

```tsx
import { useEffect, useState } from 'react';

interface ProtocolStats {
  success: boolean;
  data: {
    circulatingSupply: number;
    btcReservesValue: number;
    collateralRatio: number;
    rewardsPeriodDays: number;
    btcPrice: number;
  };
  formatted: {
    circulatingSupply: string;
    btcReservesValue: string;
    collateralRatio: string;
    rewardsPeriodDays: string;
    btcPrice: string;
  };
}

export function BTC1USDStats() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('https://your-domain.com/api/protocol-stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!stats?.success) return <div>Failed to load stats</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-2xl font-bold">{stats.formatted.circulatingSupply}</div>
        <div className="text-sm text-gray-600">Circulating Supply</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{stats.formatted.btcReservesValue}</div>
        <div className="text-sm text-gray-600">BTC Reserves Value</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{stats.formatted.collateralRatio}</div>
        <div className="text-sm text-gray-600">Collateral Ratio</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{stats.formatted.rewardsPeriodDays}</div>
        <div className="text-sm text-gray-600">Rewards Period</div>
      </div>
    </div>
  );
}
```

## CORS Support

This API includes full CORS support, allowing requests from any domain:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Caching

Responses are cached for 10 seconds with stale-while-revalidate for 59 seconds to optimize performance while keeping data fresh.

## Error Handling

If an error occurs, the API returns:

```json
{
  "success": false,
  "error": "Failed to fetch protocol stats",
  "message": "Error details here"
}
```

Status code: 500
