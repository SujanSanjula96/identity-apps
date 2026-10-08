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
import { Hint, PrimaryButton } from "@wso2is/react-components";
import { AxiosError } from "axios";
import React, { FunctionComponent, ReactElement, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Dispatch } from "redux";
import {
    Button,
    Checkbox,
    Divider,
    Form,
    Header,
    Icon,
    Label,
    Message,
    Radio,
    SemanticCOLORS,
    Table
} from "semantic-ui-react";
import { createSharePolicy, deleteSharePolicy, listSharePolicies, updateSharePolicy } from "../api/b2b";
import useCDSOrganizations from "../hooks/use-cds-organizations";
import useSharePolicy, { useSharePolicies } from "../hooks/use-share-policy";
import {
    CDSOrganization,
    SharePolicyRequest,
    ShareState,
    ShareableResource,
    TargetChildOrg,
    TargetOrgScope
} from "../models/b2b";
import {
    childrenOf,
    findCurrentOrganization,
    organizationLabel,
    useCurrentOrganizationRef,
    useIsSubOrganization
} from "../utils/b2b-utils";

type ShareMode = "none" | "all" | "selected";

interface ShareSettingsPropsInterface extends IdentifiableComponentInterface {
    /**
     * The attribute or the rule to share.
     */
    resource: ShareableResource;
    /**
     * Whether the user can change the share settings.
     */
    readOnly?: boolean;
    /**
     * Called after the share settings change.
     */
    onUpdate?: () => void;
}

const STATE_COLORS: Record<string, SemanticCOLORS> = {
    ACTIVE: "green",
    CONFLICTED: "orange",
    INACTIVE_APP_NOT_SHARED: "grey",
    INACTIVE_MISSING_ATTRIBUTE: "grey"
};

// The page size of the state table.
const STATES_PAGE_SIZE: number = 20;

// CDS returns this code for a second policy of the same organization.
const POLICY_EXISTS_CODE: string = "CDS-17008";

/**
 * Share settings of a profile attribute or a unification rule (B2B). The admin shares with
 * all sub organizations, or with selected direct children (with or without their sub
 * organizations). The status table shows the state of the resource in each organization that
 * the share reaches, one page at a time.
 */
const ShareSettings: FunctionComponent<ShareSettingsPropsInterface> = ({
    resource,
    readOnly = false,
    onUpdate,
    ["data-componentid"]: componentId = "cds-share-settings"
}: ShareSettingsPropsInterface): ReactElement => {

    const { t } = useTranslation();
    const dispatch: Dispatch = useDispatch();
    const isSubOrganization: boolean = useIsSubOrganization();
    const currentRef: { id: string; handle: string } = useCurrentOrganizationRef();
    const resourceLabel: string = t(`customerDataService:b2b.sharing.resource.${ resource.type }`);

    const [ offset, setOffset ] = useState<number>(0);

    const { data: orgs, isLoading: isOrgsLoading } = useCDSOrganizations(true);
    const {
        data: policies,
        isLoading: isPoliciesLoading,
        mutate: mutatePolicies
    } = useSharePolicies(resource, true);
    // The list has a maximum of one policy: the policy of the current organization.
    const policyId: string = policies?.policies?.[0]?.id;
    const {
        data: policy,
        isLoading: isPolicyLoading,
        mutate: mutatePolicy
    } = useSharePolicy(resource, policyId, STATES_PAGE_SIZE, offset);

    const hasPolicy: boolean = Boolean(policyId);

    const [ mode, setMode ] = useState<ShareMode>("none");
    const [ selected, setSelected ] = useState<Record<string, boolean>>({});
    const [ isSaving, setIsSaving ] = useState<boolean>(false);
    const [ problem, setProblem ] = useState<string>(null);

    const current: CDSOrganization | undefined = useMemo(
        () => findCurrentOrganization(orgs, currentRef, isSubOrganization),
        [ orgs, currentRef?.id, currentRef?.handle, isSubOrganization ]
    );
    const children: CDSOrganization[] = useMemo(() => childrenOf(orgs, current), [ orgs, current ]);
    const scope: TargetOrgScope = policies?.policies?.[0]?.target_org_scope;
    const orgsById: Map<string, CDSOrganization> = useMemo(
        () => new Map((orgs ?? []).map((org: CDSOrganization) => [ org.org_id, org ])),
        [ orgs ]
    );

    // Load the form from the stored policy. "selected" maps a child to true when the share
    // includes its sub organizations (all_children of the child), and to false for the child only.
    useEffect(() => {
        if (isPoliciesLoading) return;
        if (!scope) {
            setMode("none");
            setSelected({});

            return;
        }
        const picked: Record<string, boolean> = {};

        scope.child_orgs?.forEach((child: TargetChildOrg) => {
            picked[child.org_id] = Boolean(child.all_children);
        });
        setMode(scope.all_children ? "all" : "selected");
        setSelected(picked);
    }, [ scope, isPoliciesLoading ]);

    const payload: SharePolicyRequest = useMemo((): SharePolicyRequest => {
        if (mode === "all") return { target_org_scope: { all_children: true } };

        return {
            target_org_scope: {
                child_orgs: Object.entries(selected).map(([ orgId, withSubtree ]: [ string, boolean ]) =>
                    withSubtree ? { all_children: true, org_id: orgId } : { org_id: orgId })
            }
        };
    }, [ mode, selected ]);

    const toggleChild = (orgId: string, checked: boolean): void => {
        const next: Record<string, boolean> = { ...selected };

        if (checked) {
            next[orgId] = true;
        } else {
            delete next[orgId];
        }
        setSelected(next);
    };

    const toggleSubtree = (orgId: string, withSubtree: boolean): void => {
        setSelected({ ...selected, [ orgId ]: withSubtree });
    };

    // Creates the policy, or replaces its targets. When another tab created the policy first, CDS
    // returns HTTP 409, and the targets of that policy are replaced.
    const saveSharePolicy = async (): Promise<void> => {
        if (hasPolicy) {
            await updateSharePolicy(resource, policyId, payload);

            return;
        }

        try {
            await createSharePolicy(resource, payload);
        } catch (error) {
            if ((error as AxiosError<{ code?: string }>)?.response?.data?.code !== POLICY_EXISTS_CODE) {
                throw error;
            }
            const existing: string = (await listSharePolicies(resource))?.policies?.[0]?.id;

            if (!existing) throw error;
            await updateSharePolicy(resource, existing, payload);
        }
    };

    const handleSave = async (): Promise<void> => {
        setProblem(null);
        setIsSaving(true);

        try {
            if (mode === "none") {
                if (hasPolicy) {
                    await deleteSharePolicy(resource, policyId);
                }
                dispatch(addAlert({
                    description: t("customerDataService:b2b.sharing.notifications.stopped.description",
                        { resource: resourceLabel }),
                    level: AlertLevels.SUCCESS,
                    message: t("customerDataService:b2b.sharing.notifications.stopped.message")
                }));
            } else {
                await saveSharePolicy();
                dispatch(addAlert({
                    description: t("customerDataService:b2b.sharing.notifications.success.description",
                        { resource: resourceLabel }),
                    level: AlertLevels.SUCCESS,
                    message: t("customerDataService:b2b.sharing.notifications.success.message")
                }));
            }
            setOffset(0);
            await mutatePolicies();
            await mutatePolicy();
            onUpdate?.();
        } catch (error) {
            const data: { code?: string; description?: string; message?: string } =
                (error as AxiosError<{ code?: string; description?: string; message?: string }>)?.response?.data;
            const detail: string = data?.description
                ? `${ data.code ? `[${ data.code }] ` : "" }${ data.description }`
                : t("customerDataService:b2b.sharing.notifications.error.description");

            setProblem(detail);
            dispatch(addAlert({
                description: detail,
                level: AlertLevels.ERROR,
                message: t("customerDataService:b2b.sharing.notifications.error.message")
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const renderStatus = (): ReactElement => {
        if (!hasPolicy) return null;
        // CDS sorts the states by the level of the organization, and then by the handle.
        const states: ShareState[] = policy?.states ?? [];
        const total: number = policy?.total_states ?? 0;

        return (
            <>
                <Divider />
                <Header as="h5">{ t("customerDataService:b2b.sharing.status.heading") }</Header>
                <Hint>{ t("customerDataService:b2b.sharing.status.enabledOnly") }</Hint>
                { states.length === 0 ? (
                    <p>{ t("customerDataService:b2b.sharing.status.empty") }</p>
                ) : (
                    <Table compact basic="very" data-componentid={ `${ componentId }-status-table` }>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>
                                    { t("customerDataService:b2b.sharing.status.columns.organization") }
                                </Table.HeaderCell>
                                <Table.HeaderCell>
                                    { t("customerDataService:b2b.sharing.status.columns.state") }
                                </Table.HeaderCell>
                                <Table.HeaderCell>
                                    { t("customerDataService:b2b.sharing.status.columns.reason") }
                                </Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            { states.map((state: ShareState) => {
                                const org: CDSOrganization = orgsById.get(state.org_id);

                                return (
                                    <Table.Row
                                        key={ state.org_id }
                                        data-componentid={ `${ componentId }-status-${ state.org_handle }` }
                                    >
                                        <Table.Cell>
                                            { org ? organizationLabel(org) : state.org_handle }
                                            { " " }<code>{ state.org_handle }</code>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Label size="mini" color={ STATE_COLORS[state.state] ?? "grey" }>
                                                { t(`customerDataService:b2b.sharing.status.states.${ state.state }`) }
                                            </Label>
                                        </Table.Cell>
                                        <Table.Cell>
                                            { state.reason
                                                ? t(`customerDataService:b2b.sharing.status.reasons.${ state.reason }`,
                                                    { resource: resourceLabel })
                                                : "" }
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }) }
                        </Table.Body>
                    </Table>
                ) }
                { total > STATES_PAGE_SIZE && (
                    <div data-componentid={ `${ componentId }-status-pages` }>
                        <Button
                            basic
                            size="mini"
                            icon="angle left"
                            disabled={ offset === 0 }
                            onClick={ () => setOffset(Math.max(0, offset - STATES_PAGE_SIZE)) }
                            data-componentid={ `${ componentId }-status-previous` }
                        />
                        <span style={ { margin: "0 1em" } }>
                            { t("customerDataService:b2b.sharing.status.page", {
                                from: offset + 1,
                                to: Math.min(offset + STATES_PAGE_SIZE, total),
                                total
                            }) }
                        </span>
                        <Button
                            basic
                            size="mini"
                            icon="angle right"
                            disabled={ offset + STATES_PAGE_SIZE >= total }
                            onClick={ () => setOffset(offset + STATES_PAGE_SIZE) }
                            data-componentid={ `${ componentId }-status-next` }
                        />
                    </div>
                ) }
            </>
        );
    };

    if (isOrgsLoading || isPoliciesLoading || (hasPolicy && isPolicyLoading && !policy)) {
        return <Icon loading name="spinner" />;
    }

    const isSaveDisabled: boolean = readOnly || isSaving
        || (mode === "selected" && Object.keys(selected).length === 0)
        || (mode === "none" && !hasPolicy);

    return (
        <div data-componentid={ componentId }>
            <Header as="h5">
                { t("customerDataService:b2b.sharing.heading") }
                <Header.Subheader>
                    { t("customerDataService:b2b.sharing.description", { resource: resourceLabel }) }
                </Header.Subheader>
            </Header>
            { children.length === 0 && !hasPolicy ? (
                <Message info size="small">{ t("customerDataService:b2b.sharing.noChildren") }</Message>
            ) : (
                <Form>
                    <Form.Field>
                        <Radio
                            label={ t("customerDataService:b2b.sharing.options.none") }
                            checked={ mode === "none" }
                            disabled={ readOnly }
                            onChange={ () => setMode("none") }
                            data-componentid={ `${ componentId }-mode-none` }
                        />
                    </Form.Field>
                    <Form.Field>
                        <Radio
                            label={ t("customerDataService:b2b.sharing.options.all") }
                            checked={ mode === "all" }
                            disabled={ readOnly }
                            onChange={ () => setMode("all") }
                            data-componentid={ `${ componentId }-mode-all` }
                        />
                        <Hint>{ t("customerDataService:b2b.sharing.options.allHint") }</Hint>
                    </Form.Field>
                    <Form.Field>
                        <Radio
                            label={ t("customerDataService:b2b.sharing.options.selected") }
                            checked={ mode === "selected" }
                            disabled={ readOnly }
                            onChange={ () => setMode("selected") }
                            data-componentid={ `${ componentId }-mode-selected` }
                        />
                    </Form.Field>
                    { mode === "selected" && (
                        <div style={ { marginBottom: "1em", marginLeft: "2em" } }>
                            <Hint>{ t("customerDataService:b2b.sharing.options.selectedHint") }</Hint>
                            { children.map((child: CDSOrganization) => {
                                const isPicked: boolean = child.org_id in selected;

                                return (
                                    <Form.Group
                                        inline
                                        key={ child.org_id }
                                        data-componentid={ `${ componentId }-child-${ child.org_handle }` }
                                    >
                                        <Form.Field width={ 6 }>
                                            <Checkbox
                                                label={ organizationLabel(child) }
                                                checked={ isPicked }
                                                disabled={ readOnly }
                                                onChange={ (_: unknown, data: { checked?: boolean }) =>
                                                    toggleChild(child.org_id, Boolean(data.checked)) }
                                            />
                                        </Form.Field>
                                        { isPicked && (
                                            <Form.Field>
                                                <Checkbox
                                                    toggle
                                                    label={
                                                        t("customerDataService:b2b.sharing.includeSubOrganizations")
                                                    }
                                                    checked={ selected[child.org_id] }
                                                    disabled={ readOnly }
                                                    onChange={ (_: unknown, data: { checked?: boolean }) =>
                                                        toggleSubtree(child.org_id, Boolean(data.checked)) }
                                                />
                                            </Form.Field>
                                        ) }
                                    </Form.Group>
                                );
                            }) }
                        </div>
                    ) }
                    { problem && (
                        <Message negative size="small" data-componentid={ `${ componentId }-problem` }>
                            { problem }
                        </Message>
                    ) }
                    { !readOnly && (
                        <PrimaryButton
                            size="small"
                            loading={ isSaving }
                            disabled={ isSaveDisabled }
                            onClick={ handleSave }
                            data-componentid={ `${ componentId }-save-button` }
                        >
                            { t("customerDataService:b2b.sharing.actions.save") }
                        </PrimaryButton>
                    ) }
                </Form>
            ) }
            { renderStatus() }
        </div>
    );
};

export default ShareSettings;
