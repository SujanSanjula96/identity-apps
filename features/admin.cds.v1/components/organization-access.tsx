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

import { AlertLevels, IdentifiableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { EmphasizedSegment, Hint, PrimaryButton } from "@wso2is/react-components";
import { AxiosError } from "axios";
import React, { FunctionComponent, ReactElement, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Dispatch } from "redux";
import { Checkbox, Form, Header, Icon, Message, Radio } from "semantic-ui-react";
import { createOrganizationAccess, deleteOrganizationAccess, updateOrganizationAccess } from "../api/b2b";
import useCDSOrganizations from "../hooks/use-cds-organizations";
import useOrganizationAccess from "../hooks/use-org-access";
import {
    CDSOrganization,
    CDSOrganizationNode,
    OrgAccessPolicy,
    SharePolicyRequest,
    TargetChildOrg
} from "../models/b2b";
import { ancestorIdsOf, descendantsOf, organizationLabel } from "../utils/b2b-utils";

type AccessMode = "none" | "all" | "selected";

interface OrganizationAccessPropsInterface extends IdentifiableComponentInterface {
    /**
     * Whether the user can change the organization access.
     */
    canUpdate: boolean;
}

/**
 * Organization access of the root organization (B2B): the sub organizations that can use CDS.
 * With no selection, only the root uses CDS. The root selects all sub organizations, or selected
 * ones. Each organization between the root and a selected organization must also be selected, so
 * a check also checks the organizations above, and an uncheck also unchecks the ones below.
 */
const OrganizationAccess: FunctionComponent<OrganizationAccessPropsInterface> = ({
    canUpdate,
    ["data-componentid"]: componentId = "cds-organization-access"
}: OrganizationAccessPropsInterface): ReactElement => {

    const { t } = useTranslation();
    const dispatch: Dispatch = useDispatch();

    const { data: orgs, isLoading: isOrgsLoading } = useCDSOrganizations(true);
    const { data: access, isLoading: isAccessLoading, mutate: mutateAccess } = useOrganizationAccess(true);

    // The list has a maximum of one policy.
    const policy: OrgAccessPolicy = access?.policies?.[0];
    const storedMode: AccessMode = !policy ? "none" : policy.target_org_scope?.all_children ? "all" : "selected";

    const [ mode, setMode ] = useState<AccessMode>("none");
    const [ selected, setSelected ] = useState<Record<string, boolean>>({});
    const [ isSaving, setIsSaving ] = useState<boolean>(false);
    const [ problem, setProblem ] = useState<string>(null);

    const root: CDSOrganization | undefined = useMemo(
        () => (orgs ?? []).find((org: CDSOrganization) => !org.parent_org_id),
        [ orgs ]
    );
    const below: CDSOrganizationNode[] = useMemo(() => descendantsOf(orgs, root), [ orgs, root ]);

    // Load the form from the stored policy. "selected" maps an organization to true when the
    // selection includes the organizations below it.
    useEffect(() => {
        if (isAccessLoading) return;
        const picked: Record<string, boolean> = {};

        policy?.target_org_scope?.child_orgs?.forEach((child: TargetChildOrg) => {
            picked[child.org_id] = Boolean(child.all_children);
        });
        setMode(storedMode);
        setSelected(picked);
    }, [ policy, isAccessLoading ]);

    // An organization is covered when an organization above it is selected with its sub organizations.
    const isCovered = (org: CDSOrganization): boolean =>
        ancestorIdsOf(orgs, org).some((id: string) => selected[id] === true);

    const toggleOrg = (org: CDSOrganization, checked: boolean): void => {
        const next: Record<string, boolean> = { ...selected };

        if (checked) {
            next[org.org_id] = next[org.org_id] ?? false;
            ancestorIdsOf(orgs, org)
                .filter((id: string) => id !== root?.org_id)
                .forEach((id: string) => { next[id] = next[id] ?? false; });
        } else {
            delete next[org.org_id];
            descendantsOf(orgs, org).forEach((child: CDSOrganization) => { delete next[child.org_id]; });
        }
        setSelected(next);
    };

    const toggleSubtree = (org: CDSOrganization, withSubtree: boolean): void => {
        const next: Record<string, boolean> = { ...selected, [ org.org_id ]: withSubtree };

        // The organizations below are covered now, so they are not named on their own.
        if (withSubtree) {
            descendantsOf(orgs, org).forEach((child: CDSOrganization) => { delete next[child.org_id]; });
        }
        setSelected(next);
    };

    const payload: SharePolicyRequest = useMemo((): SharePolicyRequest => {
        if (mode === "all") return { target_org_scope: { all_children: true } };

        return {
            target_org_scope: {
                child_orgs: Object.entries(selected).map(([ orgId, withSubtree ]: [ string, boolean ]) =>
                    withSubtree ? { all_children: true, org_id: orgId } : { org_id: orgId })
            }
        };
    }, [ mode, selected ]);

    // A change between all and selected sub organizations is a DELETE and a POST, as in ThunderID.
    // Between the two calls, no sub organization can use CDS (known gap G-1).
    const isModeChange: boolean = Boolean(policy) && mode !== "none" && mode !== storedMode;

    const handleSave = async (): Promise<void> => {
        setProblem(null);
        setIsSaving(true);

        try {
            if (mode === "none") {
                await deleteOrganizationAccess(policy.id);
            } else if (!policy) {
                await createOrganizationAccess(payload);
            } else if (isModeChange) {
                await deleteOrganizationAccess(policy.id);
                await createOrganizationAccess(payload);
            } else {
                await updateOrganizationAccess(policy.id, payload);
            }
            dispatch(addAlert({
                description: t("customerDataService:b2b.organizationAccess.notifications.success.description"),
                level: AlertLevels.SUCCESS,
                message: t("customerDataService:b2b.organizationAccess.notifications.success.message")
            }));
            await mutateAccess();
        } catch (error) {
            const data: { code?: string; description?: string } =
                (error as AxiosError<{ code?: string; description?: string }>)?.response?.data;
            const detail: string = data?.description
                ? `${ data.code ? `[${ data.code }] ` : "" }${ data.description }`
                : t("customerDataService:b2b.organizationAccess.notifications.error.description");

            setProblem(detail);
            dispatch(addAlert({
                description: detail,
                level: AlertLevels.ERROR,
                message: t("customerDataService:b2b.organizationAccess.notifications.error.message")
            }));
            await mutateAccess();
        } finally {
            setIsSaving(false);
        }
    };

    if (isOrgsLoading || isAccessLoading) {
        return <Icon loading name="spinner" />;
    }

    const isSaveDisabled: boolean = !canUpdate || isSaving
        || (mode === "selected" && Object.keys(selected).length === 0)
        || (mode === "none" && !policy);

    return (
        <EmphasizedSegment padded data-componentid={ componentId }>
            <Header as="h5">
                <Icon name="key" />
                <Header.Content>
                    { t("customerDataService:b2b.organizationAccess.heading") }
                    <Header.Subheader>
                        { t("customerDataService:b2b.organizationAccess.description") }
                    </Header.Subheader>
                </Header.Content>
            </Header>
            <Form>
                { ([ "none", "all", "selected" ] as AccessMode[]).map((option: AccessMode) => (
                    <Form.Field key={ option }>
                        <Radio
                            label={ t(`customerDataService:b2b.organizationAccess.options.${ option }`) }
                            checked={ mode === option }
                            disabled={ !canUpdate }
                            onChange={ () => setMode(option) }
                            data-componentid={ `${ componentId }-mode-${ option }` }
                        />
                    </Form.Field>
                )) }
                { mode === "selected" && (
                    <div style={ { marginBottom: "1em", marginLeft: "2em" } }>
                        <Hint>{ t("customerDataService:b2b.organizationAccess.options.selectedHint") }</Hint>
                        { below.length === 0 && (
                            <p className="text-muted">{ t("customerDataService:b2b.organizations.empty") }</p>
                        ) }
                        { below.map((org: CDSOrganizationNode) => {
                            const covered: boolean = isCovered(org);
                            const isPicked: boolean = covered || org.org_id in selected;

                            return (
                                <Form.Group
                                    inline
                                    key={ org.org_id }
                                    data-componentid={ `${ componentId }-org-${ org.org_handle }` }
                                >
                                    <Form.Field width={ 6 }>
                                        <span style={ { paddingLeft: `${ (org.level - 1) * 20 }px` } }>
                                            <Checkbox
                                                label={ organizationLabel(org) }
                                                checked={ isPicked }
                                                disabled={ !canUpdate || covered }
                                                onChange={ (_: unknown, data: { checked?: boolean }) =>
                                                    toggleOrg(org, Boolean(data.checked)) }
                                            />
                                        </span>
                                    </Form.Field>
                                    { isPicked && !covered && (
                                        <Form.Field>
                                            <Checkbox
                                                toggle
                                                label={ t("customerDataService:b2b.sharing.includeSubOrganizations") }
                                                checked={ selected[org.org_id] }
                                                disabled={ !canUpdate }
                                                onChange={ (_: unknown, data: { checked?: boolean }) =>
                                                    toggleSubtree(org, Boolean(data.checked)) }
                                            />
                                        </Form.Field>
                                    ) }
                                </Form.Group>
                            );
                        }) }
                    </div>
                ) }
                { isModeChange && (
                    <Message warning visible size="small" data-componentid={ `${ componentId }-mode-change-warning` }>
                        { t("customerDataService:b2b.organizationAccess.modeChangeWarning") }
                    </Message>
                ) }
                { problem && (
                    <Message negative size="small" data-componentid={ `${ componentId }-problem` }>
                        { problem }
                    </Message>
                ) }
                { canUpdate && (
                    <PrimaryButton
                        size="small"
                        loading={ isSaving }
                        disabled={ isSaveDisabled }
                        onClick={ handleSave }
                        data-componentid={ `${ componentId }-save-button` }
                    >
                        { t("customerDataService:b2b.organizationAccess.save") }
                    </PrimaryButton>
                ) }
            </Form>
        </EmphasizedSegment>
    );
};

export default OrganizationAccess;
