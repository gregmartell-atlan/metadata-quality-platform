# Snowflake Debugging Guide

## User Report: "snowflake againnnnnn"

This means Snowflake databases still aren't showing correctly.

---

## ✅ What We've Already Fixed

**Commit c787a37**: Snowflake case sensitivity
```typescript
// Line 1457-1458 in src/services/atlan/api.ts
const normalizedConnector = connector.toLowerCase();
logger.debug('getDatabases called', { input: connector, normalized: normalizedConnector });

// Line 1467
{ term: { 'connectorName': normalizedConnector } }
```

**Status**: ✅ Fix is in the code and committed

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console
Open DevTools Console (F12) and look for:

```
[DEBUG] getDatabases called { input: "snowflake", normalized: "snowflake" }
```

If you see this, the function IS being called correctly.

### Step 2: Check Response
Look for:
```
[DEBUG] Search completed { ... }
```

Check if `entities.length > 0`. If 0, no databases were found.

### Step 3: Check What's Actually in Atlan

The query searches for databases where:
```sql
connectorName = "snowflake"
AND __typeName IN ['Database', 'SnowflakeDatabase', ...]
AND __state != 'DELETED'
```

**Possible Issues**:
1. **connectorName field is different** - Maybe it's actually "Snowflake" (capitalized) in Atlan
2. **Different field name** - Maybe Atlan uses `connectorType` not `connectorName`
3. **Databases are soft-deleted** - `__state = 'DELETED'`

### Step 4: Test in Atlan Directly

Run this query in Atlan's search:
```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "connectorName": "snowflake" } },
        { "terms": { "__typeName.keyword": ["Database", "SnowflakeDatabase"] } }
      ]
    }
  }
}
```

Does it return results? If NO:
- Try `connectorName: "Snowflake"` (capital S)
- Try wildcard: `connectorName: "*snowflake*"`

---

## 🔧 Quick Fixes to Try

### Fix 1: Case-Insensitive Wildcard

Change line 1467 from:
```typescript
{ term: { 'connectorName': normalizedConnector } }
```

To:
```typescript
{
  wildcard: {
    'connectorName': {
      value: `*${normalizedConnector}*`,
      case_insensitive: true
    }
  }
}
```

### Fix 2: Try Both Cases

```typescript
{
  bool: {
    should: [
      { term: { 'connectorName': normalizedConnector } },
      { term: { 'connectorName': connector } }, // Original case
    ],
    minimum_should_match: 1
  }
}
```

### Fix 3: Log the Response

Add after line 1491:
```typescript
const response = await search(query);

logger.debug('getDatabases response', {
  connector: normalizedConnector,
  found: response?.entities?.length || 0,
  sampleNames: response?.entities?.slice(0, 3).map(e => e.attributes.name)
});
```

---

## 🎯 Current Status

**Fix Applied**: ✅ Yes (commit c787a37)
**In Current Code**: ✅ Yes (verified at line 1457)
**Console Logs**: Shows normalization working

**But databases still not loading?**

**Next Action**: Check browser console for actual API response

---

## Workaround for User

If Snowflake databases won't load:

1. **Try BigQuery** - User said "Pivot fixed for bigquery"
2. **Check Atlan directly** - Verify databases exist
3. **Clear browser cache** - Hard refresh (Cmd+Shift+R)
4. **Clear localStorage**:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

---

## Follow-Up Investigation Needed

- [ ] Check actual Atlan API response in Network tab
- [ ] Verify connectorName field value in Atlan
- [ ] Test with wildcard query
- [ ] Check if __state field is preventing results
