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

import { OrganizationType } from "@wso2is/admin.core.v1/constants/organization-constants";
import { AppState } from "@wso2is/admin.core.v1/store";
import { useSelector } from "react-redux";
import type { CDSOrganization, ShareTarget } from "../models/b2b";

/**
 * Hook that tells whether the Console runs in a sub organization.
 *
 * @returns True in a sub organization.
 */
export const useIsSubOrganization = (): boolean => {
    const organizationType: OrganizationType = useSelector(
        (state: AppState) => state?.organization?.organizationType
    );

    return organizationType === OrganizationType.SUBORGANIZATION;
};

/**
 * Hook that returns the ID and the handle of the current organization of the Console.
 *
 * @returns The ID and the handle of the current organization.
 */
export const useCurrentOrganizationRef = (): { id: string; handle: string } => {
    const id: string = useSelector((state: AppState) => state?.organization?.organization?.id);
    const handle: string = useSelector((state: AppState) => state?.organization?.organization?.orgHandle);

    return { handle, id };
};

/**
 * Finds the CDS record of the current organization. In the root organization, the Console
 * can have the ID of the super organization, so the root of the tree is the fallback.
 *
 * @param orgs - The organizations of the tree.
 * @param ref - The ID and the handle of the current organization.
 * @param isSubOrganization - Whether the Console runs in a sub organization.
 * @returns The current organization, or undefined.
 */
export const findCurrentOrganization = (
    orgs: CDSOrganization[],
    ref: { id: string; handle: string },
    isSubOrganization: boolean
): CDSOrganization | undefined => {
    if (!orgs?.length) return undefined;

    const match: CDSOrganization | undefined = orgs.find((org: CDSOrganization) =>
        org.org_id === ref?.id || (ref?.handle && org.org_handle === ref.handle));

    if (match) return match;

    return isSubOrganization ? undefined : orgs.find((org: CDSOrganization) => org.depth === 0);
};

const isActive = (org: CDSOrganization): boolean => org.status === "ACTIVE";

/**
 * Returns the active organizations below the given organization, in tree order.
 *
 * @param orgs - The organizations of the tree.
 * @param parent - The organization.
 * @returns The descendants.
 */
export const descendantsOf = (orgs: CDSOrganization[], parent: CDSOrganization): CDSOrganization[] => {
    if (!parent) return [];

    return (orgs ?? [])
        .filter((org: CDSOrganization) =>
            isActive(org) && org.org_id !== parent.org_id && org.path?.startsWith(parent.path))
        .sort((a: CDSOrganization, b: CDSOrganization) => a.path.localeCompare(b.path));
};

/**
 * Returns the active direct children of the given organization.
 *
 * @param orgs - The organizations of the tree.
 * @param parent - The organization.
 * @returns The direct children.
 */
export const childrenOf = (orgs: CDSOrganization[], parent: CDSOrganization): CDSOrganization[] =>
    descendantsOf(orgs, parent).filter((org: CDSOrganization) => org.parent_org_id === parent.org_id);

/**
 * Returns the organizations that a set of targets reaches, before the exclusions.
 * This is the same rule as the share engine of CDS.
 *
 * @param orgs - The organizations of the tree.
 * @param initiator - The organization that shares.
 * @param targets - The targets of the share.
 * @returns The organizations in the reach.
 */
export const reachOf = (
    orgs: CDSOrganization[],
    initiator: CDSOrganization,
    targets: ShareTarget[]
): CDSOrganization[] => {
    const below: CDSOrganization[] = descendantsOf(orgs, initiator);
    const reached: Map<string, CDSOrganization> = new Map<string, CDSOrganization>();

    targets.forEach((target: ShareTarget) => {
        if (target.scope === "ALL_DESCENDANTS") {
            below.forEach((org: CDSOrganization) => reached.set(org.org_id, org));

            return;
        }
        const child: CDSOrganization | undefined = below.find((org: CDSOrganization) =>
            org.org_id === target.org_id && org.parent_org_id === initiator.org_id);

        if (!child) return;
        reached.set(child.org_id, child);
        if (target.scope === "ORG_SUBTREE") {
            descendantsOf(orgs, child).forEach((org: CDSOrganization) => reached.set(org.org_id, org));
        }
    });

    return below.filter((org: CDSOrganization) => reached.has(org.org_id));
};

/**
 * Display name of an organization.
 *
 * @param org - The organization.
 * @returns The name, or the handle when the name is not known.
 */
export const organizationLabel = (org: CDSOrganization): string => org?.org_name || org?.org_handle || "";
