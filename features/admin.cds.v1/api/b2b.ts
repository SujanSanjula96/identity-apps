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
import type { CDSReconcileResult, SharePolicy, ShareRequest, ShareableResource } from "../models/b2b";

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
 * Returns the share endpoint of a profile attribute or a unification rule.
 *
 * @param resource - The resource to share.
 * @returns The URL of the share policy of the resource.
 */
export const getShareEndpoint = (resource: ShareableResource): string => {
    const endpoints: Record<string, string> = store.getState().config.endpoints;

    return resource.type === "attribute"
        ? `${ endpoints.cdsProfileSchema }/${ resource.scope }/${ resource.id }/share`
        : `${ endpoints.cdsUnificationRules }/${ resource.id }/share`;
};

/**
 * POST /cds/api/v1/organizations/reconcile
 * Reads the organization tree from the identity provider again.
 *
 * @returns The organizations that CDS added and removed.
 */
export const reconcileOrganizations = (): Promise<CDSReconcileResult> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.POST,
        url: `${ store.getState().config.endpoints.cdsOrganizations }/reconcile`
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as CDSReconcileResult);
};

/**
 * PUT .../share
 * Creates the share policy of the resource, or replaces it.
 *
 * @param resource - The resource to share.
 * @param payload - The targets and the excluded organizations.
 * @returns The policy and the state of the resource in each organization.
 */
export const putSharePolicy = (resource: ShareableResource, payload: ShareRequest): Promise<SharePolicy> => {
    const requestConfig: RequestConfigInterface = {
        data: payload,
        headers: JSON_HEADERS,
        method: HttpMethods.PUT,
        url: getShareEndpoint(resource)
    };

    return httpClient(requestConfig)
        .then((response: AxiosResponse) => response.data as SharePolicy);
};

/**
 * DELETE .../share
 * Stops the share. The organizations below do not see the resource after this.
 *
 * @param resource - The resource to stop sharing.
 */
export const deleteSharePolicy = (resource: ShareableResource): Promise<void> => {
    const requestConfig: RequestConfigInterface = {
        headers: JSON_HEADERS,
        method: HttpMethods.DELETE,
        url: getShareEndpoint(resource)
    };

    return httpClient(requestConfig).then(() => undefined);
};
