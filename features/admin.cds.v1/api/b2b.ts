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

import { AsgardeoSPAClient, HttpClientInstance } from "@asgardeo/auth-react";
import { RequestConfigInterface } from "@wso2is/admin.core.v1/hooks/use-request";
import { store } from "@wso2is/admin.core.v1/store";
import { HttpMethods } from "@wso2is/core/models";
import { AxiosResponse } from "axios";
import type {
    OrgAccessPolicy,
    OrgAccessPolicyList,
    SharePolicy,
    SharePolicyList,
    SharePolicyRequest,
    ShareableResource
} from "../models/b2b";

/**
 * Initialize an Http client.
 */
const httpClient: HttpClientInstance =
    AsgardeoSPAClient.getInstance().httpRequest.bind(AsgardeoSPAClient.getInstance());

const JSON_HEADERS: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json"
};

/**
 * Returns the collection of the share policies of a profile attribute or a unification rule.
 *
 * @param resource - The resource to share.
 * @returns The URL of the sharing policies of the resource.
 */
export const getSharingPoliciesEndpoint = (resource: ShareableResource): string => {
    const endpoints: Record<string, string> = store.getState().config.endpoints;

    return resource.type === "attribute"
        ? `${ endpoints.cdsProfileSchema }/${ resource.scope }/${ resource.id }/sharing-policies`
        : `${ endpoints.cdsUnificationRules }/${ resource.id }/sharing-policies`;
};

/**
 * Returns the URL of one share policy, with one page of its states.
 *
 * @param resource - The resource.
 * @param policyId - The ID of the policy.
 * @param limit - The page size of the states.
 * @param offset - The first state of the page.
 * @returns The URL of the policy.
 */
export const getSharePolicyEndpoint = (resource: ShareableResource, policyId: string, limit?: number,
    offset?: number): string => {
    const url: string = `${ getSharingPoliciesEndpoint(resource) }/${ policyId }`;

    return limit === undefined ? url : `${ url }?limit=${ limit }&offset=${ offset ?? 0 }`;
};

/**
 * POST .../sharing-policies
 * Creates the share policy of the resource. A second policy of the same organization gets HTTP 409.
 *
 * @param resource - The resource to share.
 * @param payload - The targets.
 * @returns The new policy.
 */
export const createSharePolicy = (resource: ShareableResource, payload: SharePolicyRequest): Promise<SharePolicy> => {
    const requestConfig: RequestConfigInterface = {
        data: payload,
        headers: JSON_HEADERS,
        method: HttpMethods.POST,
        url: getSharingPoliciesEndpoint(resource)
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as SharePolicy);
};

/**
 * GET .../sharing-policies
 * Lists the share policies of the organization for the resource. The list has a maximum of one policy.
 *
 * @param resource - The resource.
 * @returns The policies.
 */
export const listSharePolicies = (resource: ShareableResource): Promise<SharePolicyList> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.GET,
        url: getSharingPoliciesEndpoint(resource)
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as SharePolicyList);
};

/**
 * PUT .../sharing-policies/\{policyId\}
 * Replaces the targets of the share policy.
 *
 * @param resource - The resource.
 * @param policyId - The ID of the policy.
 * @param payload - The targets.
 * @returns The policy.
 */
export const updateSharePolicy = (resource: ShareableResource, policyId: string,
    payload: SharePolicyRequest): Promise<SharePolicy> => {
    const requestConfig: RequestConfigInterface = {
        data: payload,
        headers: JSON_HEADERS,
        method: HttpMethods.PUT,
        url: getSharePolicyEndpoint(resource, policyId)
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as SharePolicy);
};

/**
 * DELETE .../sharing-policies/\{policyId\}
 * Stops the share. The organizations below do not see the resource after this.
 *
 * @param resource - The resource to stop sharing.
 * @param policyId - The ID of the policy.
 */
export const deleteSharePolicy = (resource: ShareableResource, policyId: string): Promise<void> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.DELETE,
        url: getSharePolicyEndpoint(resource, policyId)
    };

    return httpClient(requestConfig).then(() => undefined);
};

/**
 * GET /config/organization-access
 * Lists the organization access policy of the root. The list has a maximum of one policy.
 *
 * @returns The policies.
 */
export const listOrganizationAccess = (): Promise<OrgAccessPolicyList> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.GET,
        url: store.getState().config.endpoints.cdsOrganizationAccess
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as OrgAccessPolicyList);
};

/**
 * POST /config/organization-access
 * Selects the sub organizations that can use CDS.
 *
 * @param payload - The selected sub organizations.
 * @returns The new policy.
 */
export const createOrganizationAccess = (payload: SharePolicyRequest): Promise<OrgAccessPolicy> => {
    const requestConfig: RequestConfigInterface = {
        data: payload,
        headers: JSON_HEADERS,
        method: HttpMethods.POST,
        url: store.getState().config.endpoints.cdsOrganizationAccess
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as OrgAccessPolicy);
};

/**
 * PUT /config/organization-access/\{id\}
 * Changes the selected sub organizations. A change between all and selected sub organizations is
 * refused: delete the policy, and create a new one.
 *
 * @param id - The ID of the policy.
 * @param payload - The selected sub organizations.
 * @returns The policy.
 */
export const updateOrganizationAccess = (id: string, payload: SharePolicyRequest): Promise<OrgAccessPolicy> => {
    const requestConfig: RequestConfigInterface = {
        data: payload,
        headers: JSON_HEADERS,
        method: HttpMethods.PUT,
        url: `${ store.getState().config.endpoints.cdsOrganizationAccess }/${ id }`
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as OrgAccessPolicy);
};

/**
 * DELETE /config/organization-access/\{id\}
 * Removes the selection. No sub organization can use CDS after this.
 *
 * @param id - The ID of the policy.
 */
export const deleteOrganizationAccess = (id: string): Promise<void> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.DELETE,
        url: `${ store.getState().config.endpoints.cdsOrganizationAccess }/${ id }`
    };

    return httpClient(requestConfig).then(() => undefined);
};
