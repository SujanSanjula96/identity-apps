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

import Chip from "@oxygen-ui/react/Chip";
import Tooltip from "@oxygen-ui/react/Tooltip";
import { IdentifiableComponentInterface } from "@wso2is/core/models";
import React, { FunctionComponent, ReactElement } from "react";
import { useTranslation } from "react-i18next";

interface SharedChipPropsInterface extends IdentifiableComponentInterface {
    /**
     * Handle of the organization that owns and shares the item.
     */
    ownerOrg?: string;
}

/**
 * Marks an attribute or rule that a parent organization shares (B2B). Uses the same Oxygen
 * chip as shared connections. The owner organization shows in the tooltip.
 */
const SharedChip: FunctionComponent<SharedChipPropsInterface> = ({
    ownerOrg,
    ["data-componentid"]: componentId = "cds-shared-chip"
}: SharedChipPropsInterface): ReactElement => {

    const { t } = useTranslation();

    const chip: ReactElement = (
        <Chip
            label={ t("customerDataService:b2b.sharing.shared") }
            size="small"
            data-componentid={ componentId }
        />
    );

    if (!ownerOrg) {
        return chip;
    }

    return (
        <Tooltip title={ t("customerDataService:b2b.sharing.sharedBy", { org: ownerOrg }) }>
            { chip }
        </Tooltip>
    );
};

export default SharedChip;
