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
import type { CDSOrganization, CDSOrganizationNode } from "../models/b2b";

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

    return isSubOrganization ? undefined : orgs.find((org: CDSOrganization) => !org.parent_org_id);
};

const isActive = (org: CDSOrganization): boolean => org.status === "ACTIVE";

/**
 * Returns the active organizations below the given organization, in tree order: each organization
 * comes before its children, and the children of an organization are sorted by name. CDS stores no
 * path, so the order comes from the parent links. The level is 1 for a direct child.
 *
 * @param orgs - The organizations of the tree.
 * @param parent - The organization.
 * @returns The descendants, with their level below the organization.
 */
export const descendantsOf = (orgs: CDSOrganization[], parent: CDSOrganization): CDSOrganizationNode[] => {
    if (!parent) return [];

    const children: Map<string, CDSOrganization[]> = new Map<string, CDSOrganization[]>();

    (orgs ?? []).filter(isActive).forEach((org: CDSOrganization) => {
        if (!org.parent_org_id) return;
        children.set(org.parent_org_id, [ ...(children.get(org.parent_org_id) ?? []), org ]);
    });
    children.forEach((list: CDSOrganization[]) => list.sort((a: CDSOrganization, b: CDSOrganization) =>
        organizationLabel(a).localeCompare(organizationLabel(b))));

    const result: CDSOrganizationNode[] = [];
    const visit = (org: CDSOrganization, level: number): void => {
        (children.get(org.org_id) ?? []).forEach((child: CDSOrganization) => {
            result.push({ ...child, level });
            visit(child, level + 1);
        });
    };

    visit(parent, 1);

    return result;
};

/**
 * Returns the active direct children of the given organization.
 *
 * @param orgs - The organizations of the tree.
 * @param parent - The organization.
 * @returns The direct children.
 */
export const childrenOf = (orgs: CDSOrganization[], parent: CDSOrganization): CDSOrganizationNode[] =>
    descendantsOf(orgs, parent).filter((org: CDSOrganizationNode) => org.level === 1);

/**
 * Returns the IDs of the ancestors of an organization, up to the root, from the parent links.
 *
 * @param orgs - The organizations of the tree.
 * @param org - The organization.
 * @returns The IDs of the parent, the parent of the parent, and so on.
 */
export const ancestorIdsOf = (orgs: CDSOrganization[], org: CDSOrganization): string[] => {
    const byId: Map<string, CDSOrganization> = new Map<string, CDSOrganization>(
        (orgs ?? []).map((o: CDSOrganization) => [ o.org_id, o ]));
    const result: string[] = [];

    for (let id: string = org?.parent_org_id; id && result.length < 64; id = byId.get(id)?.parent_org_id) {
        result.push(id);
    }

    return result;
};

/**
 * Display name of an organization.
 *
 * @param org - The organization.
 * @returns The name, or the handle when the name is not known.
 */
export const organizationLabel = (org: CDSOrganization): string => org?.org_name || org?.org_handle || "";
