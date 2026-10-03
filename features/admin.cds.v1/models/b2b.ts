/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Origin of a profile attribute or a unification rule in an organization.
 * OWNED: the organization owns it. SHARED: an ancestor organization shares it.
 */
export type ResourceOrigin = "OWNED" | "SHARED";

/**
 * State of a shared resource in one target organization.
 */
export type ShareStateValue = "ACTIVE" | "CONFLICTED" | "INACTIVE_MISSING_ATTRIBUTE";

/**
 * Why a shared resource is not active in a target organization.
 */
export type ShareStateReason = "LOCAL_NAME_CONFLICT" | "SHARED_NAME_CONFLICT" | "MISSING_ATTRIBUTE";

/**
 * Target scopes of a share policy.
 * ALL_DESCENDANTS: all organizations below the sharing organization, also the ones created later.
 * ORG: one direct child organization only.
 * ORG_SUBTREE: one direct child organization and all organizations below it.
 */
export type ShareTargetScope = "ALL_DESCENDANTS" | "ORG" | "ORG_SUBTREE";

/**
 * An organization that CDS knows, from GET /organizations.
 */
export interface CDSOrganization {
    org_id: string;
    org_handle: string;
    org_name?: string;
    parent_org_id?: string;
    root_org_id: string;
    path: string;
    depth: number;
    status: "ACTIVE" | "DISABLED" | "DELETED";
    created_at?: string;
    updated_at?: string;
    last_synced_at?: string;
}

/**
 * Result of POST /organizations/reconcile.
 */
export interface CDSReconcileResult {
    root_org_id: string;
    total: number;
    added: string[];
    deleted: string[];
}

export interface ShareTarget {
    scope: ShareTargetScope;
    org_id?: string;
}

export interface ShareRequest {
    targets: ShareTarget[];
    excluded_org_ids?: string[];
}

export interface ShareState {
    org_id: string;
    org_handle?: string;
    state: ShareStateValue;
    reason?: ShareStateReason;
    conflicting_resource_id?: string;
}

/**
 * A share policy with the state of the resource in each organization that the policy reaches.
 */
export interface SharePolicy {
    policy_id: string;
    resource_type: "SCHEMA_ATTRIBUTE" | "UNIFICATION_RULE";
    resource_id: string;
    owner_org_id: string;
    initiating_org_id: string;
    stage: "SHARE" | "RESHARE";
    version: number;
    targets: ShareTarget[];
    excluded_org_ids: string[];
    created_at: string;
    updated_at: string;
    states: ShareState[];
}

/**
 * The resource that a share policy is for.
 */
export type ShareableResource =
    | { type: "attribute"; scope: string; id: string }
    | { type: "rule"; id: string };
