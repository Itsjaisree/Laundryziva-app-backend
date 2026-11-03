# AllZiva Backend - Automated Test Cases Execution & QA Root Cause Analysis Report

- **Repository**: [Itsjaisree/Laundryziva-app-backend](https://github.com/Itsjaisree/Laundryziva-app-backend)
- **Branch**: `feature/technician-backend` (2nd Branch)
- **Workflow**: `AllZiva Backend Automated Tests` (`.github/workflows/backend-tests.yml`)
- **Latest Verified Run**: [Run #41625743438](https://github.com/Itsjaisree/Laundryziva-app-backend/actions/runs/41625743438)
- **Test Framework**: Node.js Native Test Runner (`node:test`, `node:assert`) / Node 20.x
- **Total Tests**: 34
- **Passed**: 34 (100%)
- **Failed**: 0 (0%)
- **Status**: ✅ **ALL TESTS PASSING**

---

## 1. Executive Summary

This document provides a comprehensive report of all 34 automated unit and integration service test cases for the AllZiva backend API. It outlines the purpose of each test, current execution status, failure modes, root cause analyses, and troubleshooting steps.

---

## 2. Comprehensive Test Case Execution Matrix

### Module 1: Live Status & MQTT Telemetry Publisher (`test_live_status.js`)

| Test ID | Test Case Description | Status | Time | Validation & Criteria |
| :--- | :--- | :---: | :---: | :--- |
| **TC_LS_001** | Topic is scoped to the organization and machine | ✅ PASS | 1.4ms | Publishes to `org/{orgId}/machine/{deviceId}` |
| **TC_LS_002** | Message carries what the app reads, and not noisy fields | ✅ PASS | 0.8ms | Strips unnecessary debug payloads; keeps state, cycle, duration |
| **TC_LS_003** | First sync publishes every machine; no-change sync publishes nothing | ✅ PASS | 0.3ms | Prevents bandwidth exhaustion and unnecessary MQTT traffic |
| **TC_LS_004** | A machine coming online is published, and only that machine | ✅ PASS | 0.2ms | Delta publishing verified |
| **TC_LS_005** | Signal strength or uptime changing alone publishes nothing | ✅ PASS | 0.2ms | Telemetry noise filtering verified |
| **TC_LS_006** | A machine with no organization is never published | ✅ PASS | 0.1ms | Multi-tenant isolation enforced |
| **TC_LS_007** | When broker is disconnected, pending updates queue for next sync | ✅ PASS | 0.2ms | Resiliency against broker disconnects |
| **TC_LS_008** | After a reconnect everything is sent again | ✅ PASS | 0.1ms | Full state re-synchronization on broker recovery |
| **TC_LS_009** | A finished wash (state back to IDLE) is published | ✅ PASS | 0.2ms | Cycle completion event dispatched immediately |
| **TC_LS_010** | Chat events go to task topic and carry IDs only, never raw text | ✅ PASS | 0.3ms | Privacy enforcement: prevents sensitive chat text leakage on MQTT |
| **TC_LS_011** | Publishing a chat event without broker connection is harmless | ✅ PASS | 0.2ms | Non-blocking exception handling |

---

### Module 2: Payouts & Financial Calculations (`test_payouts.js`)

| Test ID | Test Case Description | Status | Time | Validation & Criteria |
| :--- | :--- | :---: | :---: | :--- |
| **TC_PAY_001** | A date range becomes India-time (IST) bounds, inclusive of last day | ✅ PASS | 1.4ms | Converts input dates to IST boundaries (`+05:30`) |
| **TC_PAY_002** | No date range means no bounds | ✅ PASS | 0.5ms | Retrieves all records without query truncation |
| **TC_PAY_003** | Bad or reversed dates are refused | ✅ PASS | 0.2ms | Start date > end date rejected with validation error |
| **TC_PAY_004** | Summary totals the amounts and finds the last paid transfer | ✅ PASS | 0.3ms | Accurate mathematical summation of payouts |
| **TC_PAY_005** | Summary of nothing | ✅ PASS | 0.2ms | Returns zero total without throwing `null` exception |
| **TC_PAY_006** | Transfer time is shown as the India day | ✅ PASS | 0.1ms | Correct timezone display formatting |
| **TC_PAY_007** | CSV has header, one row per payout and total | ✅ PASS | 0.3ms | Valid RFC-compliant CSV formatting |
| **TC_PAY_008** | CSV of no payouts still has headers and a zero total | ✅ PASS | 0.2ms | Header structure preserved on empty data |

---

### Module 3: Phone Authentication & Token Validation (`test_phone_login.js`)

| Test ID | Test Case Description | Status | Time | Validation & Criteria |
| :--- | :--- | :---: | :---: | :--- |
| **TC_PL_001** | `lastTenDigits` ignores spaces, plus and country code | ✅ PASS | 1.7ms | Sanitizes phone number to standard 10 digits |
| **TC_PL_002** | Missing token is rejected with HTTP 400 | ✅ PASS | 0.5ms | Validates request payload schema |
| **TC_PL_003** | A token Firebase rejects is rejected with HTTP 401 | ✅ PASS | 2.3ms | Unauthorized token blocked |
| **TC_PL_004** | A verified number with no account is rejected with HTTP 401 | ✅ PASS | 0.4ms | Unregistered users cannot authenticate |
| **TC_PL_005** | A verified number signs the matching user in | ✅ PASS | 4.9ms | Issues valid JWT token and updates `last_login` |
| **TC_PL_006** | Two accounts with the same number is rejected with HTTP 409 | ✅ PASS | 0.3ms | Ambiguous duplicate identity detected |
| **TC_PL_007** | A deactivated or locked account is refused | ✅ PASS | 0.4ms | Inactive user access blocked |

---

### Module 4: Technician Task Photos Management (`test_task_photos.js`)

| Test ID | Test Case Description | Status | Time | Validation & Criteria |
| :--- | :--- | :---: | :---: | :--- |
| **TC_TP_001** | Stored list is read back; bad or empty values give empty list | ✅ PASS | 2.3ms | Safe deserialization of photo arrays |
| **TC_TP_002** | New photos are appended after existing ones | ✅ PASS | 0.3ms | Chronological photo preservation |
| **TC_TP_003** | A photo that is already present is not added twice | ✅ PASS | 0.2ms | Deduplication enforcement |
| **TC_TP_004** | A task with no photos yet takes the new ones | ✅ PASS | 0.3ms | Initial photo attachment initialization |
| **TC_TP_005** | Going over the 10-photo limit is refused | ✅ PASS | 0.4ms | Upload ceiling boundary enforcement |

---

### Module 5: Role-Based Access Control (RBAC) & Viewer Restrictions (`test_viewer_machines.js`)

| Test ID | Test Case Description | Status | Time | Validation & Criteria |
| :--- | :--- | :---: | :---: | :--- |
| **TC_RBAC_VIEWER** | `isViewerRole` recognizes viewer role keys correctly | ✅ PASS | 1.1ms | Validates `organization_viewer` and `viewer` keys |
| **TC_VMAC_ASSIGN** | Assigns valid organization machines to viewer | ✅ PASS | 1.4ms | Machine assignment table updated correctly |
| **TC_VMAC_RESTRICT** | Refuses machines not belonging to the organization | ✅ PASS | 0.5ms | Multi-tenant isolation: throws error on cross-org ID |

---

## 3. Failure Modes & Root Cause Troubleshooting Guide

### 1. Database Connection In Unit Tests (`ECONNREFUSED 127.0.0.1:5432`)
- **Root Cause**: Unit tests attempting to connect to a live PostgreSQL server that is not running in CI.
- **Resolution**: Use the in-memory mock registered via `require.cache[dbPath]` in test files (configured in `test_live_status.js`, `test_phone_login.js`, `test_viewer_machines.js`).

### 2. Multi-Tenant Machine Leakage (`TC_VMAC_RESTRICT`)
- **Root Cause**: If a user is assigned machine IDs belonging to another organization, data leakage occurs.
- **Resolution**: In `services/viewerMachineService.js`, verify `setViewerMachineAssignments()` checks:
  ```sql
  SELECT device_id FROM machines WHERE org_id = ? AND device_id IN (...)
  ```
  and rejects any ID not returned in the org's machine set.

### 3. Payout Timezone Discrepancies (`TC_PAY_001`)
- **Root Cause**: Parsing dates in UTC instead of Indian Standard Time (`UTC+05:30`), leading to transactions missing on the first or last day.
- **Resolution**: Ensure `services/payoutService.js` parses dates using explicit `+05:30` offsets so all daily transactions in India are included.

### 4. Duplicate Technician Photos & Storage Exhaustion (`TC_TP_003` & `TC_TP_005`)
- **Root Cause**: Missing deduplication or exceeding 10 photos per maintenance task.
- **Resolution**: Enforce set deduplication `Array.from(new Set(existing.concat(incoming)))` and throw `400 Bad Request` if length exceeds 10 in `services/taskPhotos.js`.

---

## 4. GitHub Actions CI Quality Gate

The workflow `.github/workflows/backend-tests.yml` executes on every push to `feature/technician-backend` and `main`. 
If any of these 34 tests fails, CI halts immediately with exit code 1 and blocks deployment.
