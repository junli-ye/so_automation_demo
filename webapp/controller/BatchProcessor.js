sap.ui.define([
    "./ApiService",
    "./ResultsHandler"
], function(ApiService, ResultsHandler) {
    "use strict";
    /**
     * BatchProcessor.js
     * Handles batch processing logic, progress, error handling, and delegates API/Results
     */
    var BatchProcessor = {
        /**
         * 初始化批处理相关模型
         * @param {sap.ui.core.mvc.Controller} ctrl
         */
        init: function(ctrl) {
            var oResultsModel = new sap.ui.model.json.JSONModel({ rows: [] });
            ctrl.getView().setModel(oResultsModel, "results");
            var oBatchModel = new sap.ui.model.json.JSONModel({
                batchSizes: [1, 5, 10],
                selectedBatchSize: 5,
                processingStatus: "idle",
                progress: 0,
                processed: 0,
                total: 0
            });
            ctrl.getView().setModel(oBatchModel, "batch");
            ctrl.byId("batchSizeSelect").setSelectedKey("5");
        },

        /**
         * Handles the AI Automation button click event
         * Processes Excel data in batches with real-time progress updates
         */
        onStartAutomation: async function(ctrl) {
            try {
                if (!BatchProcessor._validateInputs(ctrl)) return;
                BatchProcessor._initializeBatchProcessing(ctrl);
                var oBatchConfig = BatchProcessor._prepareBatchConfiguration(ctrl);
                await BatchProcessor._executeBatchProcessing(ctrl, oBatchConfig);
                BatchProcessor._finalizeBatchProcessing(ctrl, true);
            } catch (error) {
                BatchProcessor._handleBatchProcessingError(ctrl, error);
            }
        },

        _validateInputs: function(ctrl) {
            var sCustomer = ctrl.byId("customerSelect").getSelectedKey();
            var sBatchSize = ctrl.byId("batchSizeSelect").getSelectedKey();
            if (!sCustomer) {
                sap.m.MessageToast.show("Please select a customer first");
                return false;
            }
            if (!sBatchSize) {
                sap.m.MessageToast.show("Please select batch size");
                return false;
            }
            var oCustomerRulesModel = ctrl.getView().getModel("customerRules");
            var aRules = oCustomerRulesModel.getProperty("/rules/" + sCustomer);
            if (!aRules || !aRules.length) {
                sap.m.MessageToast.show("Selected customer has no configured rules");
                return false;
            }
            var oExcelModel = ctrl.getView().getModel("excelData");
            if (!oExcelModel || !oExcelModel.getData().rows || oExcelModel.getData().rows.length === 0) {
                sap.m.MessageToast.show("Please upload Excel file first");
                return false;
            }
            return true;
        },

        _initializeBatchProcessing: function(ctrl) {
            ctrl.byId("btnAutomation").setEnabled(false);
            ctrl.byId("customerSelect").setEnabled(false);
            ctrl.byId("batchSizeSelect").setEnabled(false);
            ctrl.byId("btnEditRule").setEnabled(false);
            ctrl.getView().getModel("results").setProperty("/rows", []);
            ctrl._oBatchState = {
                startTime: Date.now(),
                totalRows: 0,
                processedRows: 0,
                currentBatch: 0,
                totalBatches: 0,
                successCount: 0,
                errorCount: 0,
                isProcessing: true
            };
            var oBatchModel = ctrl.getView().getModel("batch");
            oBatchModel.setProperty("/processingStatus", "processing");
            oBatchModel.setProperty("/progress", 0);
            oBatchModel.setProperty("/processed", 0);
        },

        _prepareBatchConfiguration: function(ctrl) {
            var sCustomer = ctrl.byId("customerSelect").getSelectedKey();
            var iBatchSize = parseInt(ctrl.byId("batchSizeSelect").getSelectedKey(), 10);
            var oCustomerRulesModel = ctrl.getView().getModel("customerRules");
            var aRules = oCustomerRulesModel.getProperty("/rules/" + sCustomer);
            var oExcelModel = ctrl.getView().getModel("excelData");
            var oExcelData = oExcelModel.getData();
            var oBatchModel = ctrl.getView().getModel("batch");
            oBatchModel.setProperty("/selectedBatchSize", iBatchSize);
            oBatchModel.setProperty("/total", oExcelData.rows.length);
            var aHeaders = Object.keys(oExcelData.rows[0]);
            var iTotalRows = oExcelData.rows.length;
            var iTotalBatches = Math.ceil(iTotalRows / iBatchSize);
            ctrl._oBatchState.totalRows = iTotalRows;
            ctrl._oBatchState.totalBatches = iTotalBatches;
            return {
                customer: sCustomer,
                batchSize: iBatchSize,
                headers: aHeaders,
                allRows: oExcelData.rows,
                rules: aRules,
                totalBatches: iTotalBatches,
                options: {
                    validateOnly: false,
                    includeDetails: true,
                    customer: sCustomer
                }
            };
        },

        _executeBatchProcessing: async function(ctrl, oBatchConfig) {
            var aTransformedRows = oBatchConfig.allRows.map(function(row) {
                return oBatchConfig.headers.map(function(header) {
                    return row[header];
                });
            });
            for (var iBatchIndex = 0; iBatchIndex < oBatchConfig.totalBatches; iBatchIndex++) {
                if (!ctrl._oBatchState.isProcessing) break;
                try {
                    ctrl._oBatchState.currentBatch = iBatchIndex + 1;
                    BatchProcessor._updateProcessingProgress(ctrl);
                    var iBatchStart = iBatchIndex * oBatchConfig.batchSize;
                    var iBatchEnd = Math.min(iBatchStart + oBatchConfig.batchSize, aTransformedRows.length);
                    var aBatchRows = aTransformedRows.slice(iBatchStart, iBatchEnd);
                    var oApiRequest = {
                        headers: oBatchConfig.headers,
                        rows: aBatchRows,
                        rules: oBatchConfig.rules,
                        options: Object.assign({}, oBatchConfig.options, {
                            batchInfo: {
                                batchIndex: iBatchIndex + 1,
                                totalBatches: oBatchConfig.totalBatches,
                                batchStartRow: iBatchStart + 1
                            }
                        })
                    };
                    var oApiResponse = await ApiService.callBatchAPI(oApiRequest);
                    ResultsHandler.processBatchResponse(ctrl, oApiResponse, iBatchStart);
                    ResultsHandler.updateBatchStatistics(ctrl, oApiResponse);
                    var oBatchModel = ctrl.getView().getModel("batch");
                    var iProcessed = iBatchEnd;
                    var iTotal = oBatchModel.getProperty("/total");
                    var iProgress = Math.round((iProcessed / iTotal) * 100);
                    oBatchModel.setProperty("/progress", iProgress);
                    oBatchModel.setProperty("/processed", iProcessed);
                    if (iBatchIndex < oBatchConfig.totalBatches - 1) {
                        await BatchProcessor._delay(300);
                    }
                } catch (error) {
                    ResultsHandler.handleBatchError(ctrl, iBatchIndex + 1, iBatchIndex * oBatchConfig.batchSize, oBatchConfig.batchSize, error);
                }
            }
        },

        _updateProcessingProgress: function(ctrl) {
            var oState = ctrl._oBatchState;
            var iProgressPercent = Math.round((oState.currentBatch / oState.totalBatches) * 100);
            var sProgressText = "Processing... " + iProgressPercent + "% (" + oState.currentBatch + "/" + oState.totalBatches + ")";
            ctrl.byId("btnAutomation").setText(sProgressText);
            var iElapsedTime = Date.now() - oState.startTime;
            var iAvgTimePerBatch = iElapsedTime / oState.currentBatch;
            var iRemainingBatches = oState.totalBatches - oState.currentBatch;
            var iEstimatedRemainingTime = Math.round((iAvgTimePerBatch * iRemainingBatches) / 1000);
            console.log("Progress: " + iProgressPercent + "% | Batch: " + oState.currentBatch + "/" + oState.totalBatches + " | Processed: " + oState.processedRows + "/" + oState.totalRows + " | Estimated remaining: " + iEstimatedRemainingTime + "s");
        },

        _finalizeBatchProcessing: function(ctrl, bSuccess) {
            var oState = ctrl._oBatchState;
            ctrl.byId("btnAutomation").setEnabled(true);
            ctrl.byId("btnAutomation").setText("Start AI Automation");
            ctrl.byId("customerSelect").setEnabled(true);
            ctrl.byId("batchSizeSelect").setEnabled(true);
            ctrl.byId("btnEditRule").setEnabled(true);
            var oBatchModel = ctrl.getView().getModel("batch");
            oBatchModel.setProperty("/processingStatus", "completed");
            oBatchModel.setProperty("/progress", 100);
            oBatchModel.setProperty("/processed", oState.totalRows);
            var iTotalTime = Date.now() - oState.startTime;
            var sTotalTime = Math.round(iTotalTime / 1000) + "s";
            if (bSuccess) {
                var sSummaryMessage = "Batch processing completed!\n" +
                    "Total: " + oState.totalRows + " rows, Processed: " + oState.processedRows + " rows\n" +
                    "Success: " + oState.successCount + " rows, Failed: " + oState.errorCount + " rows\n" +
                    "Total time: " + sTotalTime;
                sap.m.MessageToast.show(sSummaryMessage, { duration: 6000, width: "auto" });
            }
            ctrl._oBatchState = null;
        },

        _handleBatchProcessingError: function(ctrl, oError) {
            console.error("Critical error occurred during batch processing:", oError);
            BatchProcessor._finalizeBatchProcessing(ctrl, false);
            var sUserMessage = "Batch processing failed: ";
            if (oError.message && (oError.message.indexOf("network") !== -1 || oError.message.indexOf("fetch") !== -1)) {
                sUserMessage += "Network connection error, please check your connection and try again";
            } else if (oError.message && (oError.message.indexOf("API") !== -1 || oError.message.indexOf("server") !== -1)) {
                sUserMessage += "Service temporarily unavailable, please try again later";
            } else {
                sUserMessage += oError.message;
            }
            sap.m.MessageToast.show(sUserMessage, { duration: 8000, my: "center center", at: "center center" });
        },

        _delay: function(iMs) {
            return new Promise(function(resolve) {
                setTimeout(resolve, iMs);
            });
        },

        onBatchSizeChange: function(ctrl, oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            var iBatchSize = parseInt(sSelectedKey, 10);
            var oBatchModel = ctrl.getView().getModel("batch");
            oBatchModel.setProperty("/selectedBatchSize", iBatchSize);
            console.log("Batch size changed to:", iBatchSize);
        }
    };

    return BatchProcessor;
});
