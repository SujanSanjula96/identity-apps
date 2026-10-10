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
 * OWNED: the organization owns it. SHARED: an ancestor organization shares it. INHERITED: a sub
 * organization inherits the identity attribute from its root organization.
 */
export type ResourceOrigin = "OWNED" | "SHARED" | "INHERITED";

/**
 * State of a shared resource in one target organization.
 */
export type ShareStateValue = "ACTIVE" | "CONFLICTED" | "INACTIVE_MISSING_ATTRIBUTE" | "INACTIVE_APP_NOT_SHARED";

/**
 * Why a shared resource is not active in a target organization.
 */
export type ShareStateReason =
    | "LOCAL_NAME_CONFLICT"
    | "SHARED_NAME_CONFLICT"
    | "MISSING_ATTRIBUTE"
    | "APP_NOT_SHARED";

/**
 * An organization that CDS knows, from GET /organizations. CDS stores no path and no depth.
 * The Console computes the level of an organization from the parent links.
 */
export interface CDSOrganization {
    org_id: string;
    org_handle: string;
    org_name?: string;
    parent_org_id?: string;
    root_org_id: string;
    status: "ACTIVE" | "DISABLED" | "DELETED";
    created_at?: string;
    updated_at?: string;
}

/**
 * An organization below another organization, with its level below that organization (1 for a
 * direct child).
 */
export interface CDSOrganizationNode extends CDSOrganization {
    level: number;
}

/**
 * A selected child organization of a target scope. With all_children, the policy also reaches all
 * organizations below it, also the ones created later.
 */
export interface TargetChildOrg {
    org_id: string;
    all_children?: boolean;
}

/**
 * The targets of a share policy or of the organization access. all_children reaches all
 * organizations below the initiating organization. child_orgs reaches the selected organizations.
 */
export interface TargetOrgScope {
    all_children?: boolean;
    child_orgs?: TargetChildOrg[];
}

export interface SharePolicyRequest {
    target_org_scope: TargetOrgScope;
}

export interface ShareState {
    org_id: string;
    org_handle?: string;
    state: ShareStateValue;
    reason?: ShareStateReason;
    conflicting_resource_id?: string;
}

/**
 * A share policy of a profile attribute or a unification rule.
 */
export interface SharePolicy {
    id: string;
    resource_type: "SCHEMA_ATTRIBUTE" | "UNIFICATION_RULE";
    resource_id: string;
    owning_org_id: string;
    initiating_org_id: string;
    target_org_scope: TargetOrgScope;
}

/**
 * A share policy with the state of the resource in one page of the organizations that it reaches.
 */
export interface SharePolicyWithStates extends SharePolicy {
    total_states: number;
    states: ShareState[];
}

export interface SharePolicyList {
    total_results: number;
    policies: SharePolicy[];
}

/**
 * The organization access of a root organization: the sub organizations that can use CDS.
 */
export interface OrgAccessPolicy {
    id: string;
    owning_org_id: string;
    initiating_org_id: string;
    target_org_scope: TargetOrgScope;
}

export interface OrgAccessPolicyList {
    total_results: number;
    policies: OrgAccessPolicy[];
}

/**
 * The resource that a share policy is for.
 */
export type ShareableResource =
    | { type: "attribute"; scope: string; id: string }
    | { type: "rule"; id: string };
