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
    Checkbox,
    Divider,
    Dropdown,
    DropdownItemProps,
    Form,
    Header,
    Icon,
    Label,
    Message,
    Radio,
    SemanticCOLORS,
    Table
} from "semantic-ui-react";
import { deleteSharePolicy, putSharePolicy } from "../api/b2b";
import useCDSOrganizations from "../hooks/use-cds-organizations";
import useSharePolicy from "../hooks/use-share-policy";
import {
    CDSOrganization,
    SharePolicy,
    ShareRequest,
    ShareState,
    ShareTarget,
    ShareableResource
} from "../models/b2b";
import {
    childrenOf,
    findCurrentOrganization,
    organizationLabel,
    reachOf,
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
    INACTIVE_MISSING_ATTRIBUTE: "grey"
};

/**
 * Share settings of a profile attribute or a unification rule (B2B). The admin shares with
 * all sub organizations, or with selected direct children (with or without their sub
 * organizations), and can exclude organizations. The status table shows the state of the
 * resource in each organization that the share reaches.
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

    const { data: orgs, isLoading: isOrgsLoading } = useCDSOrganizations(true);
    const {
        data: policy,
        error: policyError,
        isLoading: isPolicyLoading,
        mutate: mutatePolicy
    } = useSharePolicy(resource, true);

    // CDS returns HTTP 404 when the resource has no share policy.
    const hasPolicy: boolean = Boolean(policy?.policy_id) && !policyError;

    const [ mode, setMode ] = useState<ShareMode>("none");
    const [ selected, setSelected ] = useState<Record<string, boolean>>({});
    const [ excluded, setExcluded ] = useState<string[]>([]);
    const [ isSaving, setIsSaving ] = useState<boolean>(false);
    const [ problem, setProblem ] = useState<string>(null);

    const current: CDSOrganization | undefined = useMemo(
        () => findCurrentOrganization(orgs, currentRef, isSubOrganization),
        [ orgs, currentRef?.id, currentRef?.handle, isSubOrganization ]
    );
    const children: CDSOrganization[] = useMemo(() => childrenOf(orgs, current), [ orgs, current ]);
    const orgsById: Map<string, CDSOrganization> = useMemo(
        () => new Map((orgs ?? []).map((org: CDSOrganization) => [ org.org_id, org ])),
        [ orgs ]
    );

    // Load the form from the stored policy. "selected" maps a child to true when the share
    // includes its sub organizations (ORG_SUBTREE), and to false for the child only (ORG).
    useEffect(() => {
        if (isPolicyLoading) return;
        if (!hasPolicy) {
            setMode("none");
            setSelected({});
            setExcluded([]);

            return;
        }
        const all: boolean = policy.targets?.some((target: ShareTarget) => target.scope === "ALL_DESCENDANTS");
        const picked: Record<string, boolean> = {};

        policy.targets?.forEach((target: ShareTarget) => {
            if (target.org_id) picked[target.org_id] = target.scope === "ORG_SUBTREE";
        });
        setMode(all ? "all" : "selected");
        setSelected(picked);
        setExcluded(policy.excluded_org_ids ?? []);
    }, [ policy, hasPolicy, isPolicyLoading ]);

    const targets: ShareTarget[] = useMemo((): ShareTarget[] => {
        if (mode === "all") return [ { scope: "ALL_DESCENDANTS" } ];
        if (mode === "selected") {
            return Object.entries(selected).map(([ orgId, withSubtree ]: [ string, boolean ]) => ({
                org_id: orgId,
                scope: withSubtree ? "ORG_SUBTREE" : "ORG"
            }));
        }

        return [];
    }, [ mode, selected ]);

    const exclusionOptions: DropdownItemProps[] = useMemo(
        () => (current ? reachOf(orgs, current, targets) : []).map((org: CDSOrganization) => ({
            key: org.org_id,
            text: `${ organizationLabel(org) } (${ org.org_handle })`,
            value: org.org_id
        })),
        [ orgs, current, targets ]
    );

    // Drop exclusions that are not in the reach any more.
    useEffect(() => {
        const valid: Set<string> = new Set(exclusionOptions.map((option: DropdownItemProps) => option.value as string));

        if (excluded.some((id: string) => !valid.has(id))) {
            setExcluded(excluded.filter((id: string) => valid.has(id)));
        }
    }, [ exclusionOptions ]);

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

    const handleSave = async (): Promise<void> => {
        setProblem(null);
        setIsSaving(true);

        try {
            if (mode === "none") {
                if (hasPolicy) {
                    await deleteSharePolicy(resource);
                }
                dispatch(addAlert({
                    description: t("customerDataService:b2b.sharing.notifications.stopped.description",
                        { resource: resourceLabel }),
                    level: AlertLevels.SUCCESS,
                    message: t("customerDataService:b2b.sharing.notifications.stopped.message")
                }));
            } else {
                const payload: ShareRequest = { excluded_org_ids: excluded, targets };

                await putSharePolicy(resource, payload);
                dispatch(addAlert({
                    description: t("customerDataService:b2b.sharing.notifications.success.description",
                        { resource: resourceLabel }),
                    level: AlertLevels.SUCCESS,
                    message: t("customerDataService:b2b.sharing.notifications.success.message")
                }));
            }
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
        const states: ShareState[] = [ ...(policy as SharePolicy).states ?? [] ].sort(
            (a: ShareState, b: ShareState) =>
                (orgsById.get(a.org_id)?.path ?? "").localeCompare(orgsById.get(b.org_id)?.path ?? "")
        );

        return (
            <>
                <Divider />
                <Header as="h5">{ t("customerDataService:b2b.sharing.status.heading") }</Header>
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
            </>
        );
    };

    if (isOrgsLoading || isPolicyLoading) {
        return <Icon loading name="spinner" />;
    }

    const isSaveDisabled: boolean = readOnly || isSaving || (mode === "selected" && targets.length === 0)
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
                    { mode !== "none" && exclusionOptions.length > 0 && (
                        <Form.Field width={ 10 }>
                            <label>{ t("customerDataService:b2b.sharing.exclusions.label") }</label>
                            <Dropdown
                                multiple
                                search
                                selection
                                clearable
                                placeholder={ t("customerDataService:b2b.sharing.exclusions.placeholder") }
                                options={ exclusionOptions }
                                value={ excluded }
                                disabled={ readOnly }
                                onChange={ (_: unknown, data: { value?: unknown }) =>
                                    setExcluded((data.value as string[]) ?? []) }
                                data-componentid={ `${ componentId }-exclusions` }
                            />
                            <Hint>{ t("customerDataService:b2b.sharing.exclusions.hint") }</Hint>
                        </Form.Field>
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
