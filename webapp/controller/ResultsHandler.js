/**
 * ResultsHandler.js
 * Handles formatting, aggregation, and UI update of batch processing results
 */
sap.ui.define([], function() {
    "use strict";
    /**
     * ResultsHandler.js
     * Handles formatting, aggregation, and UI update of batch processing results
     */
    var ResultsHandler = {
        /**
         * 处理批次API响应
         * @param {sap.ui.core.mvc.Controller} ctrl
         * @param {Object} oApiResponse API响应对象
         * @param {number} iBatchStartIndex 批次起始行索引
         */
        processBatchResponse: function(ctrl, oApiResponse, iBatchStartIndex) {
            if (!oApiResponse.data || !Array.isArray(oApiResponse.data)) {
                throw new Error("API response data format error: missing data array");
            }
            var sCustomer = ctrl.byId("customerSelect").getSelectedKey();
            var fieldMappings = {
                "C001": { customerCode: "CustomerPurchaseCode", poNumber: "PONo", poDate: "PODate", itemNo: "POItemNo", poLine: "PO+POLINE", customerPartNo: "CustomerPartNO", quantity: "QTY", requestDate: "RequestDate", netPrice: "NetPrice", partNo: "PartNo", salesOrderType: "SalesOrderType" },
                "C002": { vendorNo: "Vendor NO", customerCode: "Vendor NO", poNumber: "PO Number", poDate: "PO Date", itemNo: "Item No", deliveryDate: "Delivery Date", requestDate: "Delivery Date", quantity: "Order Qty", orderQty: "Order Qty", customerPartNo: "Manuf. P/N", partNo: "Part No", plant: "Plant", shipTo: "Ship To", soldTo: "Sold To", crd: "CRD", orderType: "Order Type", salesOrderType: "SalesOrderType" }
            };
            var mapping = fieldMappings[sCustomer] || {};
            var aTableRows = oApiResponse.data.map(function(oItem, index) {
                var row = {
                    rowIndex: iBatchStartIndex + index + 1,
                    valid: oItem.valid,
                    result: oItem.valid ? "Processing Success" : "Processing Failed",
                    reason: oItem.reason || ""
                };
                Object.keys(mapping).forEach(function(key) {
                    row[key] = oItem.data[mapping[key]] || "";
                });
                return row;
            });
            var oResultsModel = ctrl.getView().getModel("results");
            var aCurrentRows = oResultsModel.getProperty("/rows") || [];
            oResultsModel.setProperty("/rows", aCurrentRows.concat(aTableRows));
        },

        /**
         * 更新批处理统计信息
         * @param {sap.ui.core.mvc.Controller} ctrl
         * @param {Object} oApiResponse API响应对象
         */
        updateBatchStatistics: function(ctrl, oApiResponse) {
            if (oApiResponse.summary) {
                ctrl._oBatchState.processedRows += oApiResponse.summary.totalRows || 0;
                ctrl._oBatchState.successCount += oApiResponse.summary.validRows || 0;
                ctrl._oBatchState.errorCount += oApiResponse.summary.invalidRows || 0;
            } else if (oApiResponse.data) {
                var iValidCount = oApiResponse.data.filter(function(item){return item.valid;}).length;
                ctrl._oBatchState.processedRows += oApiResponse.data.length;
                ctrl._oBatchState.successCount += iValidCount;
                ctrl._oBatchState.errorCount += (oApiResponse.data.length - iValidCount);
            }
        },

        /**
         * 处理单个批次错误
         * @param {sap.ui.core.mvc.Controller} ctrl
         * @param {number} iBatchNumber 批次号
         * @param {number} iStartRow 起始行
         * @param {number} iBatchSize 批次大小
         * @param {Error} oError 错误对象
         */
        handleBatchError: function(ctrl, iBatchNumber, iStartRow, iBatchSize, oError) {
            var aErrorRows = [];
            for (var i = 0; i < iBatchSize; i++) {
                aErrorRows.push({
                    valid: false,
                    rowIndex: iStartRow + i + 1,
                    poNumber: "Batch-" + iBatchNumber + "-Row" + (i + 1),
                    result: "Batch processing failed: " + oError.message
                });
            }
            var oResultsModel = ctrl.getView().getModel("results");
            var aCurrentRows = oResultsModel.getProperty("/rows") || [];
            oResultsModel.setProperty("/rows", aCurrentRows.concat(aErrorRows));
            ctrl._oBatchState.processedRows += iBatchSize;
            ctrl._oBatchState.errorCount += iBatchSize;
            sap.m.MessageToast.show("Batch " + iBatchNumber + " processing failed, will continue with subsequent batches", { duration: 3000 });
        }
    };

    return ResultsHandler;
});
