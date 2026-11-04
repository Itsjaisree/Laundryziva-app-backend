# AllZiva Backend - Comprehensive Role-by-Role Automated Test Cases Execution & QA Report

- **Repository**: [Itsjaisree/Laundryziva-app-backend](https://github.com/Itsjaisree/Laundryziva-app-backend)
- **Branch**: `feature/technician-backend`
- **Workflow**: `AllZiva Backend Automated Tests` (`.github/workflows/backend-tests.yml`)
- **Latest Verified Run**: [Run #41780194888](https://github.com/Itsjaisree/Laundryziva-app-backend/actions/runs/41780194888)
- **Test Framework**: Node.js Native Test Runner (`node:test`, `node:assert`) / Node 20.x
- **Total Tests**: 62
- **Passed**: 62 (100%)
- **Failed**: 0 (0%)
- **Status**: ✅ **ALL ROLE TEST SUITES PASSING (ISOLATED EXECUTION)**

---

## 1. Executive Summary

This document provides a comprehensive report of all 62 automated unit, integration, and role-specific test cases for the AllZiva backend API.

Each role test suite is isolated into dedicated test suites and executed independently both locally and within GitHub Actions CI/CD to ensure granular status visibility.

### Role & Service Test Coverage Summary

| Suite / Role | Scope & Modules Tested | Total Tests | Status |
| :--- | :--- | :---: | :---: |
| **Role: Super Admin** | Org CRUD, strict `exact_org` scoping, user deactivation, announcements | 6 | ✅ PASS |
| **Role: Organization Owner** | Tenant machine filtering, IST payout bounds, CSV export, task validation | 5 | ✅ PASS |
| **Role: Organization Viewer** | RBAC variant matching, machine assignment, foreign machine rejection, clean unlinking | 5 | ✅ PASS |
| **Role: Field Operations / Tech** | Task status workflow, photo limit (10 cap), photo deduplication, completion | 5 | ✅ PASS |
| **Role: Customer Care Support** | Complaint tickets, escalation queries, issue resolution, tech dispatch | 5 | ✅ PASS |
| **Core: Live Status & MQTT** | Delta publishing, reconnection sync, chat privacy ID masking | 11 | ✅ PASS |
| **Core: Payouts & Finance** | IST date bounds, summarization math, RFC-compliant CSV reports | 8 | ✅ PASS |
| **Core: Phone Authentication** | Firebase ID token verification, phone normalization, account lookup | 7 | ✅ PASS |
| **Core: Task Evidence Photos** | Photo storage, sequence preservation, array merging | 5 | ✅ PASS |
| **Core: Viewer Machine Service**| Database assignment operations and multi-tenant constraints | 5 | ✅ PASS |
| **TOTAL** | **Full application backend coverage** | **62** | ✅ **100% PASS** |

---

## 2. Granular Test Case Matrix by Role

### A. Role 1: Super Admin (`test_role_super_admin.js`)

| Test ID | Module | Test Description | Validation & Criteria | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC_SA_BE_01** | `organizationController` | Org creation validation | Validates mandatory name and city; rejects empty fields | ✅ PASS |
| **TC_SA_BE_02** | `organizationController` | Full organization list retrieval | Super admin retrieves all organizations across platform | ✅ PASS |
| **TC_SA_BE_03** | `userController` | Strict `exact_org: 'true'` isolation | Query prevents unassigned/foreign org users from leaking into org modals | ✅ PASS |
| **TC_SA_BE_04** | `userController` | User unlinking from org | Setting `org_id: null` disassociates user and removes viewer machine mappings | ✅ PASS |
| **TC_SA_BE_05** | `userController` | User active status toggle | Super admin can activate (`is_active = 1`) or deactivate (`is_active = 0`) users | ✅ PASS |
| **TC_SA_BE_06** | `announcementController` | Announcement audience validation | Validates recipient target enum (`ALL`, `ORGANIZATION_OWNER`, `FIELD_OPERATIONS`, `CUSTOMER_CARE`) | ✅ PASS |

---

### B. Role 2: Organization Owner (`test_role_owner.js`)

| Test ID | Module | Test Description | Validation & Criteria | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC_OWNER_BE_01** | `machineController` | Tenant machine isolation | Returns only machines where `org_id = ?`; blocks foreign machines | ✅ PASS |
| **TC_OWNER_BE_02** | `payoutService` | India-time (IST) boundary conversion | Converts start/end dates to accurate IST ISO boundaries (`+05:30`) | ✅ PASS |
| **TC_OWNER_BE_03** | `payoutService` | Malformed date rejection | Rejects start date > end date and invalid format with validation error | ✅ PASS |
| **TC_OWNER_BE_04** | `payoutService` | Transaction CSV export generation | Formats CSV with standard headers, INR currency, and total sum row | ✅ PASS |
| **TC_OWNER_BE_05** | `technicianController` | Maintenance task constraints | Enforces non-empty title and valid priority (`Low`, `Medium`, `High`) | ✅ PASS |

---

### C. Role 3: Organization Viewer (`test_role_viewer.js`)

| Test ID | Module | Test Description | Validation & Criteria | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC_VIEWER_BE_01** | `viewerMachineService` | RBAC viewer key detection | Accurately matches `organization_viewer`, `viewer`, and rejects admin/tech/owner | ✅ PASS |
| **TC_VIEWER_BE_02** | `viewerMachineService` | Machine assignment linking | Links authorized organization machines in `viewer_machine_assignments` | ✅ PASS |
| **TC_VIEWER_BE_03** | `viewerMachineService` | Foreign machine rejection | Strictly blocks assigning machines belonging to another organization | ✅ PASS |
| **TC_VIEWER_BE_04** | `viewerMachineService` | Assignment auto-cleanup | Purges all machine mappings when viewer is unlinked from organization | ✅ PASS |
| **TC_VIEWER_BE_05** | Machine Control Security | Read-only command shield | Enforces zero machine actuation / write permissions for viewer role | ✅ PASS |

---

### D. Role 4: Field Operations / Service Technician (`test_role_technician.js`)

| Test ID | Module | Test Description | Validation & Criteria | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC_TECH_BE_01** | `technicianController` | Task scoping by technician | Query strictly returns tasks assigned to logged-in technician ID | ✅ PASS |
| **TC_TECH_BE_02** | `technicianController` | Task lifecycle transition to In Progress | Validates arrival and transitions status from `Assigned` to `In Progress` | ✅ PASS |
| **TC_TECH_BE_03** | `taskPhotos` | Arrival photo sequence merging | Preserves order of existing photos when appending new photos | ✅ PASS |
| **TC_TECH_BE_04** | `taskPhotos` | Photo deduplication & 10 cap | Prevents duplicate photo IDs and enforces strict 10-photo maximum | ✅ PASS |
| **TC_TECH_BE_05** | `technicianController` | Task completion & lock release | Transitions status to `Completed` and releases exclusive machine lock | ✅ PASS |

---

### E. Role 5: Customer Care Support (`test_role_customer_care.js`)

| Test ID | Module | Test Description | Validation & Criteria | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC_CC_BE_01** | `customerCareController` | Ticket list & priority filtering | Retrieves tickets and filters by `priority = 'High'`, `'Medium'`, `'Low'` | ✅ PASS |
| **TC_CC_BE_02** | `customerCareController` | Escalated tickets query | Query strictly isolates unresolved High-priority customer tickets | ✅ PASS |
| **TC_CC_BE_03** | `customerCareController` | Issue resolution action | Updates ticket `status = 'Resolved'` and timestamps resolution | ✅ PASS |
| **TC_CC_BE_04** | `technicianController` | Technician dispatch for complaint | Creates dispatch task directly linked to complaint via `source_ticket_id` | ✅ PASS |
| **TC_CC_BE_05** | Diagnostic Telemetry | Machine health assessment | Evaluates error codes, door open status, and online connectivity | ✅ PASS |

---

## 3. Historical Defect Root Cause Analysis & Permanent Resolutions

### Defect 1: Unassigned/Foreign Users Appearing in Org Viewer Modal
- **Root Cause**: The user query in `controllers/userController.js` previously executed:
  ```sql
  WHERE (org_id = ? OR org_id IS NULL)
  ```
  This allowed platform users without an assigned organization to leak into organization-specific modals.
- **Permanent Resolution**: Added `exact_org === 'true'` query handling to strictly enforce `WHERE org_id = ?`.
- **Automated Regression Guard**: `TC_SA_BE_03`.

### Defect 2: Viewer Removal Still Displayed Machines in Database
- **Root Cause**: `updateUser` controller failed to check if `org_id` was explicitly passed as `null`. As a result, the database column was never updated, and associated records in `viewer_machine_assignments` remained active.
- **Permanent Resolution**: Explicitly added `org_id` handling in `updateUser`:
  ```javascript
  if (req.body.org_id === null || req.body.org_id === '') {
    // update users SET org_id = NULL
    await removeViewerMachineAssignments(id);
  }
  ```
- **Automated Regression Guard**: `TC_SA_BE_04` and `TC_VIEWER_BE_04`.

---

## 4. GitHub Actions CI/CD Pipeline Configuration

The pipeline (`.github/workflows/backend-tests.yml`) executes each role test suite in isolation:
1. Core Backend Services & Live Telemetry
2. Role 1: Super Admin
3. Role 2: Organization Owner
4. Role 3: Organization Viewer
5. Role 4: Service Technician
6. Role 5: Customer Care Support

Each step publishes its own formatted test summary directly to `$GITHUB_STEP_SUMMARY`.
