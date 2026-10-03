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
import { EmphasizedSegment } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Dispatch } from "redux";
import { Button, Header, Icon, Label, Message, Table } from "semantic-ui-react";
import { reconcileOrganizations } from "../api/b2b";
import useCDSOrganizations from "../hooks/use-cds-organizations";
import { CDSOrganization, CDSReconcileResult } from "../models/b2b";
import {
    descendantsOf,
    findCurrentOrganization,
    organizationLabel,
    useCurrentOrganizationRef,
    useIsSubOrganization
} from "../utils/b2b-utils";

interface OrganizationsBoxPropsInterface extends IdentifiableComponentInterface {
    /**
     * Whether CDS is enabled. In a sub organization, this is the enablement of the root.
     */
    isCDSEnabled: boolean;
    /**
     * Whether the user can change the CDS configuration.
     */
    canUpdate: boolean;
}

/**
 * Box next to the CDS enable toggle (B2B). In the root organization, it shows that the
 * enablement applies to the full organization tree, lists the sub organizations that CDS
 * knows, and syncs the tree again. In a sub organization, it shows that the root manages
 * the enablement, and lists the organizations below the current one.
 */
const OrganizationsBox: FunctionComponent<OrganizationsBoxPropsInterface> = ({
    isCDSEnabled,
    canUpdate,
    ["data-componentid"]: componentId = "cds-organizations-box"
}: OrganizationsBoxPropsInterface): ReactElement => {

    const { t } = useTranslation();
    const dispatch: Dispatch = useDispatch();
    const isSubOrganization: boolean = useIsSubOrganization();
    const currentRef: { id: string; handle: string } = useCurrentOrganizationRef();

    const { data: orgs, error, isLoading, mutate } = useCDSOrganizations(isCDSEnabled);
    const [ isSyncing, setIsSyncing ] = useState<boolean>(false);

    useEffect(() => {
        if (!error) return;

        dispatch(addAlert({
            description: t("customerDataService:b2b.organizations.notifications.fetch.error.description"),
            level: AlertLevels.ERROR,
            message: t("customerDataService:b2b.organizations.notifications.fetch.error.message")
        }));
    }, [ error ]);

    const current: CDSOrganization | undefined = useMemo(
        () => findCurrentOrganization(orgs, currentRef, isSubOrganization),
        [ orgs, currentRef?.id, currentRef?.handle, isSubOrganization ]
    );
    const root: CDSOrganization | undefined = useMemo(
        () => (orgs ?? []).find((org: CDSOrganization) => org.depth === 0),
        [ orgs ]
    );
    const below: CDSOrganization[] = useMemo(() => descendantsOf(orgs, current), [ orgs, current ]);

    const handleSync = async (): Promise<void> => {
        setIsSyncing(true);

        try {
            const result: CDSReconcileResult = await reconcileOrganizations();

            dispatch(addAlert({
                description: t("customerDataService:b2b.organizations.notifications.sync.success.description", {
                    added: result?.added?.length ?? 0,
                    deleted: result?.deleted?.length ?? 0,
                    total: result?.total ?? 0
                }),
                level: AlertLevels.SUCCESS,
                message: t("customerDataService:b2b.organizations.notifications.sync.success.message")
            }));
            mutate();
        } catch {
            dispatch(addAlert({
                description: t("customerDataService:b2b.organizations.notifications.sync.error.description"),
                level: AlertLevels.ERROR,
                message: t("customerDataService:b2b.organizations.notifications.sync.error.message")
            }));
        } finally {
            setIsSyncing(false);
        }
    };

    const renderDescription = (): ReactElement => {
        if (isSubOrganization) {
            return (
                <Message info size="small" data-componentid={ `${ componentId }-sub-org-message` }>
                    <Icon name="sitemap" />
                    { t("customerDataService:b2b.organizations.description.subOrganization", {
                        rootName: organizationLabel(root) || "-"
                    }) }
                </Message>
            );
        }

        return (
            <p data-componentid={ `${ componentId }-description` }>
                { isCDSEnabled
                    ? t("customerDataService:b2b.organizations.description.root")
                    : t("customerDataService:b2b.organizations.description.disabled") }
            </p>
        );
    };

    const renderTable = (): ReactElement => {
        if (!below.length) {
            return (
                <p className="text-muted" data-componentid={ `${ componentId }-empty` }>
                    { t("customerDataService:b2b.organizations.empty") }
                </p>
            );
        }

        return (
            <Table compact basic="very" data-componentid={ `${ componentId }-table` }>
                <Table.Header>
                    <Table.Row>
                        { [ "name", "handle", "level", "status" ].map((column: string) => (
                            <Table.HeaderCell key={ column }>
                                { t(`customerDataService:b2b.organizations.columns.${ column }`) }
                            </Table.HeaderCell>
                        )) }
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    { below.map((org: CDSOrganization) => (
                        <Table.Row key={ org.org_id } data-componentid={ `${ componentId }-row-${ org.org_handle }` }>
                            <Table.Cell>
                                <span style={ { paddingLeft: `${ (org.depth - (current?.depth ?? 0) - 1) * 20 }px` } }>
                                    <Icon name="building outline" color="grey" />
                                    { organizationLabel(org) }
                                </span>
                            </Table.Cell>
                            <Table.Cell><code>{ org.org_handle }</code></Table.Cell>
                            <Table.Cell>
                                { t("customerDataService:b2b.organizations.level.child", { depth: org.depth }) }
                            </Table.Cell>
                            <Table.Cell>
                                <Label size="mini" color={ org.status === "ACTIVE" ? "green" : "grey" } basic>
                                    { t(`customerDataService:b2b.organizations.status.${ org.status }`) }
                                </Label>
                            </Table.Cell>
                        </Table.Row>
                    )) }
                </Table.Body>
            </Table>
        );
    };

    return (
        <EmphasizedSegment padded data-componentid={ componentId }>
            <Header as="h5">
                <Icon name="sitemap" />
                <Header.Content>
                    { t("customerDataService:b2b.organizations.heading") }
                    { isCDSEnabled && !isLoading && (
                        <Label size="tiny" circular style={ { marginLeft: "8px" } }>
                            { below.length }
                        </Label>
                    ) }
                </Header.Content>
            </Header>
            { renderDescription() }
            { isCDSEnabled && (
                <>
                    { isLoading ? <Icon loading name="spinner" /> : renderTable() }
                    { !isSubOrganization && canUpdate && (
                        <>
                            <Button
                                basic
                                size="small"
                                icon="sync"
                                content={ t("customerDataService:b2b.organizations.syncButton") }
                                loading={ isSyncing }
                                disabled={ isSyncing }
                                onClick={ handleSync }
                                data-componentid={ `${ componentId }-sync-button` }
                            />
                            <p className="hint-description" style={ { marginTop: "6px" } }>
                                { t("customerDataService:b2b.organizations.syncHint") }
                            </p>
                        </>
                    ) }
                </>
            ) }
        </EmphasizedSegment>
    );
};

export default OrganizationsBox;
