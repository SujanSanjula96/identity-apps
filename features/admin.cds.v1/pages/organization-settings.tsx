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
import { FeatureAccessConfigInterface, IdentifiableComponentInterface } from "@wso2is/core/models";
import { PageLayout } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import OrganizationAccess from "../components/organization-access";
import OrganizationsBox from "../components/organizations-box";
import useCDSConfig from "../hooks/use-config";

/**
 * Organization settings of CDS (B2B). Holds the organization access (the sub organizations that
 * can use CDS) and the organizations box. The CDS enable toggle is on the Customer Data page.
 */
const OrganizationSettingsPage: FunctionComponent<IdentifiableComponentInterface> = ({
    ["data-componentid"]: componentId = "cds-organization-settings-page"
}: IdentifiableComponentInterface): ReactElement => {

    const { t } = useTranslation();

    const cdsFeatureConfig: FeatureAccessConfigInterface = useSelector(
        (state: AppState) => state?.config?.ui?.features?.customerDataService
    );

    const hasCDSUpdateScopes: boolean = useRequiredScopes(cdsFeatureConfig?.scopes?.update);

    const { data: cdsConfig } = useCDSConfig(cdsFeatureConfig?.enabled ?? false);

    const isCDSEnabled: boolean = cdsConfig?.cds_enabled ?? false;

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
            { isCDSEnabled && (
                <OrganizationAccess
                    canUpdate={ hasCDSUpdateScopes }
                    data-componentid={ `${ componentId }-organization-access` }
                />
            ) }
            <OrganizationsBox
                isCDSEnabled={ isCDSEnabled }
                data-componentid={ `${ componentId }-organizations-box` }
            />
        </PageLayout>
    );
};

export default OrganizationSettingsPage;
