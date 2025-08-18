/**
 * RuleManager.js
 * Handles customer rule selection, preview, editing, and cancellation
 */
export const RuleManager = {
    /**
     * 初始化客户规则模型
     * @param {sap.ui.core.mvc.Controller} ctrl
     */
    init(ctrl) {
        const oCustomerRulesModel = new sap.ui.model.json.JSONModel({
            customers: [
                { key: "C001", name: "Customer A" },
                { key: "C002", name: "Customer B" },
                { key: "C003", name: "Customer C" }
            ],
            rules: {
                "C001": [
                    "Check whether the value of `CustomerPurchaseCode` is `YAG-YGO`. If yes, keep the original data.",
                    "Insert a new column to the right of `POItemNo`, name it `PO+POLINE`, and set its value to `CONCATENATE(PONo, POItemNo)`.",
                    "Filter the values in the `PO+POLINE` column, keeping only the data where `PO+POLINE` is greater than `107774190400640`.",
                    "Insert a new column to the right of `BalanceQTY`, name it `QTY`, and set its value to `BalanceQTY / 1000`.",
                    "Insert a new column to the left of `PartNo`, name it `SalesOrderType`. If the first two characters of `PartNo` contain (`AT`, `RT`, values starting with `P`, `RL`, `RC0100`, `RC0075`, `RP`, `CC0100`, `500V↑`, `AC`, `CQ`, `CS`, `CC_105↑` (1 μF and above), or `RC_P`), then set the sales type to `ZOR1`. If the first two characters of `CustomerPartNO` contain (`AC`, `AA`, `RC0201↑`, `AF`, `YC`, `TC`, `RE`, `SR`, `AS`, `AH`, `RV`, `CC` general products), then set the sales type to `ZCO`.",
                    "Delete rows where the order status `POStatus` is `Block` or `To be cancel`.",
                    "Extract the following fields from the data table and output to Excel: `CustomerPurchaseCode`, `PONo`, `PODate`, `POItemNo`, `PO+POLINE`, `CustomerPartNO`, `QTY`, `RequestDate`, `NetPrice`, `PartNo`, `SalesOrderType`."
                ],
                "C002": [
                    "Delete line items with blank values in the Delivery Date column",
                    "Delete data where PO Date is less than or equal to 20241129",
                    "Add two new columns to the right of the Plant column, named 'Sold To' and 'Ship To'. The values for Sold To and Ship To are determined based on the Plant value: If Plant is 2310, then Sold To is 132274 and Ship To is 132279; If Plant is 2370, then Sold To is 132274 and Ship To is 660076; If Plant is 2350, then Sold To is 132274 and Ship To is 660082; If Plant is 2381, additional differentiation is required by checking Part No - if Part No contains letter 'A', then both Sold To and Ship To are 660081, if Part No does not contain letter 'A', then Sold To is 132274 and Ship To is 660075; If Plant is 2380, additional differentiation is required by checking Part No - if Part No contains letters 'AAA', then both Sold To and Ship To are 660084, if Part No does not contain letter 'A', then Sold To is 132274 and Ship To is 660077.",
                    "Create a new column to the right of Delivery Date, named 'CRD'. The CRD value is a date that equals Delivery Date minus 20 days.",
                    "Create a new column to the right of Order Qty, named 'Qty'. The value equals Order Qty divided by 1000.",
                    "Add a new column to the left of Manuf. P/N, named 'SalesOrderType'. For Part No values with the first two characters starting with (AT, RT, P prefix, RL, RC0100, RC0075, RP, CC0100, 500V↑, AC, CQ, CS, CC_105↑(1 uF and above)) & RC_P, the sales type is ZOR1. For CustomerPartNO values with the first two characters starting with (AC, AA, RC0201↑, AF, YC, TC, RE, SR, AS, AH, RV, CC general products), the sales type is ZCO.",
                    "Extract the following fields from the data table for Excel output: Vendor NO, PO Number, Item No, Part No, Delivery Date, PO Date, Qty, Manuf. P/N, Plant, Ship To, SalesOrderType."
                ],
                "C003": [
                    "Check that Order Qty is greater than 0",
                    "Validate that Plant is in ['PL01', 'PL02', 'PL03']"
                ]
            },                
            selectedCustomer: null,
            currentRules: []
        });
        ctrl.getView().setModel(oCustomerRulesModel, "customerRules");
        // 默认选择第一个客户
        const oCustomerSelect = ctrl.byId("customerSelect");
        if (oCustomerSelect.getItems().length > 0) {
            oCustomerSelect.setSelectedItem(oCustomerSelect.getItems()[0]);
            ctrl.onCustomerChange({
                getParameter: function(param) {
                    if (param === "selectedItem") {
                        return oCustomerSelect.getSelectedItem();
                    }
                }
            });
        }
    },

    /**
     * Handles customer selection change event
     * Loads and displays the selected customer's rule set
     */
    onCustomerChange(ctrl, oEvent) {
        const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
        const oCustomerRulesModel = ctrl.getView().getModel("customerRules");
        const oRulePreview = ctrl.byId("rulePreview");
        const oBtnEdit = ctrl.byId("btnEditRule");
        const oBtnCancel = ctrl.byId("btnCancelEditRule");
        const aRules = oCustomerRulesModel.getProperty(`/rules/${sSelectedKey}`) || [];
        const sFormattedRules = aRules.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n");
        oRulePreview.setValue(sFormattedRules);
        oRulePreview.setEditable(false);
        oRulePreview.setValueState("None");
        ctrl._sOriginalRule = sFormattedRules;
        oBtnEdit.setText("Edit Rule");
        oBtnEdit.setEnabled(true);
        oBtnCancel.setVisible(false);
        oCustomerRulesModel.setProperty("/selectedCustomer", sSelectedKey);
        oCustomerRulesModel.setProperty("/currentRules", aRules);
        oRulePreview.setValueState(sap.ui.core.ValueState.None);
    },

    /**
     * Handles the rule editing button event
     * Toggles between edit and preview modes for rule configuration
     */
    onEditRule(ctrl) {
        const oRulePreview = ctrl.byId("rulePreview");
        const oBtnEdit = ctrl.byId("btnEditRule");
        const oBtnCancel = ctrl.byId("btnCancelEditRule");
        if (oRulePreview.getEditable()) {
            oRulePreview.setEditable(false);
            oBtnEdit.setText("Edit Rule");
            oBtnCancel.setVisible(false);
            // TODO: Implement rule saving logic
        } else {
            oRulePreview.setEditable(true);
            oBtnEdit.setText("Save");
            oBtnCancel.setVisible(true);
            ctrl._sOriginalRule = oRulePreview.getValue();
        }
    },

    /**
     * Handles the cancellation of rule editing
     * Restores the original rule configuration and resets UI state
     */
    onCancelEditRule(ctrl) {
        const oRulePreview = ctrl.byId("rulePreview");
        const oBtnEdit = ctrl.byId("btnEditRule");
        const oBtnCancel = ctrl.byId("btnCancelEditRule");
        oRulePreview.setEditable(false);
        oBtnEdit.setText("Edit Rule");
        oBtnCancel.setVisible(false);
        if (ctrl._sOriginalRule) {
            oRulePreview.setValue(ctrl._sOriginalRule);
        }
        oRulePreview.setValueState(sap.ui.core.ValueState.None);
        ctrl._sOriginalRule = null;
    }
};
