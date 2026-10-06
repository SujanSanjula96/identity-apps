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

import { useRequiredScopes } from "@wso2is/access-control";
import { AppConstants } from "@wso2is/admin.core.v1/constants/app-constants";
import { history } from "@wso2is/admin.core.v1/helpers/history";
import { AppState } from "@wso2is/admin.core.v1/store";
import { AlertLevels, FeatureAccessConfigInterface, IdentifiableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { PageLayout } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement, SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
import { Checkbox, CheckboxProps, Divider } from "semantic-ui-react";
import OrganizationsBox from "../components/organizations-box";
import useCDSToggle from "../hooks/use-cds-toggle";
import useCDSConfig from "../hooks/use-config";
import { useIsSubOrganization } from "../utils/b2b-utils";

/**
 * Organization settings of CDS. Holds the CDS enable toggle and the organizations box (B2B).
 * The page is always reachable, also when CDS is disabled, because it is where CDS is enabled.
 */
const OrganizationSettingsPage: FunctionComponent<IdentifiableComponentInterface> = ({
    ["data-componentid"]: componentId = "cds-organization-settings-page"
}: IdentifiableComponentInterface): ReactElement => {

    const { t } = useTranslation();
    const dispatch: Dispatch = useDispatch();

    const cdsFeatureConfig: FeatureAccessConfigInterface = useSelector(
        (state: AppState) => state?.config?.ui?.features?.customerDataService
    );

    const hasCDSUpdateScopes: boolean = useRequiredScopes(cdsFeatureConfig?.scopes?.update);

    const {
        data: cdsConfig,
        mutate: mutateCDSConfig
    } = useCDSConfig(cdsFeatureConfig?.enabled ?? false);

    const { isUpdating, toggleCDS } = useCDSToggle(cdsConfig, mutateCDSConfig);

    const isCDSEnabled: boolean = cdsConfig?.cds_enabled ?? false;

    // B2B: a sub organization inherits the enablement of its root, so it cannot change it.
    const isSubOrganization: boolean = useIsSubOrganization();

    const handleToggle: (event: SyntheticEvent, data: CheckboxProps) => Promise<void> =
        async (_: SyntheticEvent, data: CheckboxProps): Promise<void> => {
            const isUpdateSuccessful: boolean = await toggleCDS(data.checked === true);

            if (isUpdateSuccessful) {
                dispatch(addAlert({
                    description: t("customerDataService:landing.notifications.update.success.description"),
                    level: AlertLevels.SUCCESS,
                    message: t("customerDataService:landing.notifications.update.success.message")
                }));
            }
        };

    return (
        <PageLayout
            title={ t("customerDataService:organizationSettings.page.title") }
            pageTitle={ t("customerDataService:organizationSettings.page.title") }
            description={ t("customerDataService:organizationSettings.page.description") }
            backButton={ {
                onClick: (): void => history.push(AppConstants.getPaths().get("CUSTOMER_DATA_PROFILE")),
                text: t("customerDataService:landing.backButton")
            } }
            data-componentid={ `${ componentId }-layout` }
        >
            <Checkbox
                label={ t("customerDataService:landing.enable.label") }
                toggle
                onChange={ handleToggle }
                checked={ isCDSEnabled }
                readOnly={ !hasCDSUpdateScopes || isUpdating || isSubOrganization }
                disabled={ isSubOrganization }
                data-componentid={ `${ componentId }-enable-toggle` }
            />
            { isSubOrganization && (
                <p className="hint-description" data-componentid={ `${ componentId }-enable-toggle-hint` }>
                    { t("customerDataService:b2b.organizations.toggleHint") }
                </p>
            ) }
            <Divider hidden />
            <OrganizationsBox
                isCDSEnabled={ isCDSEnabled }
                canUpdate={ hasCDSUpdateScopes }
                data-componentid={ `${ componentId }-organizations-box` }
            />
        </PageLayout>
    );
};

export default OrganizationSettingsPage;
