/**
 * View1 Controller
 * @namespace yegeoaiso.controller.View1
 * @description Main controller for the SO Automation application
 * Handles all user interactions, file processing, and AI automation tasks
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageToast) => {
    "use strict";
    return Controller.extend("yegeoaiso.controller.View1", {
        /**
         * Lifecycle method - Called when the controller is instantiated
         * Initializes all required models and configurations for the view
         * @public
         * @method onInit
         */
        onInit() {
            // 检查XLSX库是否可用
            if (typeof XLSX === 'undefined') {
                console.error("XLSX library is not loaded!");
            } else {
                console.log("XLSX library is available");
            }
            // 初始时禁用Extract按钮，直到选择了有效文件
            this.byId("extractButton").setEnabled(false);
    
            // Initialize the results table data model
            const oResultsModel = new JSONModel({
                rows: [] // Array to store processing results
            });
            this.getView().setModel(oResultsModel, "results");

            // TODO: Initialize additional models and configurations:
            // 1. Customer rules model - Will store predefined rules for each customer
            const oCustomerRulesModel = new JSONModel({
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
            this.getView().setModel(oCustomerRulesModel, "customerRules");
            // 2. File processing state - Track the current state of file processing
            // { headers: [], rows: [] }
            const oFileModel = new JSONModel({
                fileName: "",
                fileContent: { headers: [], rows: [] },
                isValid: false,
                errorMessage: ""
            });
            this.getView().setModel(oFileModel, "file");
            // 3. Batch processing configuration - Store batch processing parameters
            const oBatchModel = new JSONModel({
                batchSizes: [1, 5, 10],
                selectedBatchSize: 5,
                processingStatus: "idle", // idle, processing, completed, error
                progress: 0,
                processed: 0,
                total: 0
            });
            this.getView().setModel(oBatchModel, "batch");

            // 设置批处理大小选择器的初始值
            const oBatchSizeSelect = this.byId("batchSizeSelect");
            oBatchSizeSelect.setSelectedKey("5"); // 默认选择5条记录

            // 默认选择第一个客户
            const oCustomerSelect = this.byId("customerSelect");
            if (oCustomerSelect.getItems().length > 0) {
                oCustomerSelect.setSelectedItem(oCustomerSelect.getItems()[0]);
                // 手动触发change事件
                this.onCustomerChange({
                    getParameter: function(param) {
                        if (param === "selectedItem") {
                            return oCustomerSelect.getSelectedItem();
                        }
                    }
                });
            }
        },

        /**
         * Handles the Excel file selection event
         * Uses xlsx library to parse Excel file and prepare data for processing
         * @public
         * @param {sap.ui.base.Event} oEvent The file selection event object
         * @throws {Error} When file validation or parsing fails
         */
        onFileSelect(oEvent) {
            // 获取触发事件的文件上传控件
            // const oFileUploader = oEvent.getSource();
            // 获取选择的文件
            const oFile = oEvent.getParameter("files")[0];
            // 获取选择的文件名
            const sFileName = oEvent.getParameter("newValue");
            
            // 获取MessageStrip控件用于显示消息
            // Update the MessageStrip with file information
            const oMessageStrip = this.byId("fileNameStrip");
            
            // 检查是否有选择文件
           if (!sFileName || !oFile) {
                oMessageStrip.setText("No file selected. Only Excel (.xlsx) files are allowed.");
                oMessageStrip.setType("Information");
                return;  
            }
            
            // 验证文件扩展名是否为.xlsx
            if (!sFileName.endsWith(".xlsx")) {
                oMessageStrip.setText("Invalid file type. Please select an Excel (.xlsx) file");
                oMessageStrip.setType("Error");
                return;
            }

            // 存储文件对象供后续使用
            this._uploadedFile = oFile;
            
            // 更新UI显示成功消息
            // Update UI with success message
            oMessageStrip.setText("Selected file: " + sFileName);
            oMessageStrip.setType("Success");

            // 启用Extract按钮
            this.byId("extractButton").setEnabled(true);

            // TODO: Implement Excel processing logic:
            // 2. Excel parsing using xlsx
            //    - Read file using FileReader API
            //    - Parse Excel using xlsx.read(data, {type: 'binary'})
            //    - Extract first worksheet data sheet1
            // 3. Data extraction
            //    - Extract headers (first row)
            //    - Extract all data rows
            // 4. Data storage
            //    - Store parsed data in JSONModel for later use
            //    - Format: { headers: [], rows: [] }
            

        },

        /**
         * 处理Extract Excel File按钮点击事件
         * @param {sap.ui.base.Event} oEvent 事件对象
         */
        onExtractPress: function(oEvent) {
            const oMessageStrip = this.byId("fileNameStrip");
            
            try {
                // Create FileReader instance
                const oReader = new FileReader();
                
                oReader.onload = (e) => {
                    try {
                        const arrayBuffer = e.target.result;
                        const data = new Uint8Array(arrayBuffer);

                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        
                        // Convert worksheet data to JSON
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);
                        
                        // Store data in model
                        const oModel = new JSONModel({
                            rows: jsonData
                        });
                        this.getView().setModel(oModel, "excelData");
                        
                        oMessageStrip.setText(jsonData.length + " rows extracted.");
                        oMessageStrip.setType("Success");
                        
                    } catch (error) {
                        oMessageStrip.setText("File processing failed: " + error.message);
                        oMessageStrip.setType("Error");
                        console.error("Excel processing error:", error);
                    }
                };
                
                oReader.onerror = (error) => {
                    oMessageStrip.setText("File reading failed");
                    oMessageStrip.setType("Error");
                    console.error("File reading error:", error);
                };
                
                // Start reading the file
                oReader.readAsArrayBuffer(this._uploadedFile);
                
            } catch (error) {
                oMessageStrip.setText("Error: " + error.message);
                oMessageStrip.setType("Error");
                console.error("Processing error:", error);
            }
        },


        /**
         * Handles customer selection change event
         * Loads and displays the selected customer's rule set
         * @public
         * @param {sap.ui.base.Event} oEvent The selection change event object
         * @fires updateRulePreview
         */
        onCustomerChange(oEvent) {

    
            const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            
            // TODO: Implement rule management:
            const oCustomerRulesModel = this.getView().getModel("customerRules");
            const oRulePreview = this.byId("rulePreview");
            const oBtnEdit = this.byId("btnEditRule");
            const oBtnCancel = this.byId("btnCancelEditRule");

            // // 1. 加载选中客户的规则
            const aRules = oCustomerRulesModel.getProperty(`/rules/${sSelectedKey}`) || [];

            // 2. 格式化为编号列表
            const sFormattedRules = aRules.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n");

            // 3. 显示到TextArea
            oRulePreview.setValue(sFormattedRules);
            oRulePreview.setEditable(false);
            oRulePreview.setValueState("None");

            // 4. 存储原始规则内容，便于取消编辑时恢复
            this._sOriginalRule = sFormattedRules;

             // 5. UI更新：启用编辑按钮，隐藏取消按钮，重置按钮文本
            oBtnEdit.setText("Edit Rule");
            oBtnEdit.setEnabled(true);
            oBtnCancel.setVisible(false);

            // 6. 更新当前选中客户和规则到模型（如有需要）
            oCustomerRulesModel.setProperty("/selectedCustomer", sSelectedKey);
            oCustomerRulesModel.setProperty("/currentRules", aRules);

            // 7. 清理任何错误状态
            oRulePreview.setValueState(sap.ui.core.ValueState.None);
        },

        /**
         * Handles the rule editing button event
         * Toggles between edit and preview modes for rule configuration
         * Manages the state of related UI controls
         * @public
         * @fires ruleConfigurationChange
         */
        onEditRule() {
            const oRulePreview = this.byId("rulePreview");
            const oBtnEdit = this.byId("btnEditRule");
            const oBtnCancel = this.byId("btnCancelEditRule");

            if (oRulePreview.getEditable()) {
                // Save mode -> Preview mode transition
                oRulePreview.setEditable(false);
                oBtnEdit.setText("Edit Rule");
                oBtnCancel.setVisible(false);

                // TODO: Implement rule saving logic:
                // 1. Validation
                //    - Validate rule syntax
                //    - Check for required parameters
                //    - Verify rule format
                // 2. Persistence
                //    - Save updated rule to backend/model
                //    - Handle save failures gracefully
                // 3. UI Updates
                //    - Show save confirmation
                //    - Update preview with formatted rule
                //    - Reset dirty state
            } else {
                // Preview mode -> Edit mode transition
                oRulePreview.setEditable(true);
                oBtnEdit.setText("Save");
                oBtnCancel.setVisible(true);

                // Store original rule for potential cancel operation
                this._sOriginalRule = oRulePreview.getValue();
            }
        },

        /**
         * Handles the cancellation of rule editing
         * Restores the original rule configuration and resets UI state
         * @public
         * @fires ruleEditCancelled
         */
        onCancelEditRule() {
            const oRulePreview = this.byId("rulePreview");
            const oBtnEdit = this.byId("btnEditRule");
            const oBtnCancel = this.byId("btnCancelEditRule");

            // Restore preview mode state
            oRulePreview.setEditable(false);
            oBtnEdit.setText("Edit Rule");
            oBtnCancel.setVisible(false);

            // TODO: Implement cancel logic:
            // 恢复预览模式状态
            

            // 1. 状态恢复 - 从备份恢复原始规则内容
            if (this._sOriginalRule) {
                oRulePreview.setValue(this._sOriginalRule);
            }
            
            // 2. UI清理 - 重置任何错误指示
            oRulePreview.setValueState(sap.ui.core.ValueState.None);
            
            // 3. 模型更新 - 重置脏状态标志
            this._sOriginalRule = null;
        


            // 1. State restoration
            //    - Restore original rule content from backup
            //    - Reset any temporary changes
            //    - Clear any validation states
            // 2. UI cleanup
            //    - Reset any error indicators
            //    - Clear any temporary highlights
            //    - Reset scroll position if needed
            // 3. Model updates
            //    - Reset dirty state flags
            //    - Clear any temporary storage
            //    - Reset change tracking
        },


        /**
         * Handles the AI Automation button click event
         * Processes Excel data in batches with real-time progress updates
         * @public
         * @async
         * @fires automationStarted
         * @fires automationProgress
         * @fires automationCompleted
         * @fires automationError
         */
        async onStartAutomation() {
            try {
                // 1. 数据验证
                if (!this._validateInputs()) {
                    return;
                }

                // 2. 初始化批处理状态
                this._initializeBatchProcessing();

                // 3. 准备批处理数据
                const oBatchConfig = this._prepareBatchConfiguration();

                // 4. 开始自动批处理循环
                await this._executeBatchProcessing(oBatchConfig);

                // 5. 完成处理
                this._finalizeBatchProcessing(true);

            } catch (error) {
                this._handleBatchProcessingError(error);
            }
        },

        /**
         * 验证处理前提条件
         * @private
         * @returns {boolean} 验证是否通过
         */
        _validateInputs() {
            const sCustomer = this.byId("customerSelect").getSelectedKey();
            const sBatchSize = this.byId("batchSizeSelect").getSelectedKey();
            
            // 检查客户选择
            if (!sCustomer) {
                MessageToast.show("Please select a customer first");
                return false;
            }

            // 检查批次大小
            if (!sBatchSize) {
                MessageToast.show("Please select batch size");
                return false;
            }
            
            // 获取规则
            const oCustomerRulesModel = this.getView().getModel("customerRules");
            const aRules = oCustomerRulesModel.getProperty(`/rules/${sCustomer}`);
            
            // 检查规则配置
            if (!aRules || !aRules.length) {
                MessageToast.show("Selected customer has no configured rules");
                return false;
            }

            // 检查Excel数据
            const oExcelModel = this.getView().getModel("excelData");
            if (!oExcelModel || !oExcelModel.getData().rows || oExcelModel.getData().rows.length === 0) {
                MessageToast.show("Please upload Excel file first");
                return false;
            }

            return true;
        },

        /**
         * 初始化批处理状态
         * @private
         */
        _initializeBatchProcessing() {
            // 禁用相关控件防止重复操作
            this.byId("btnAutomation").setEnabled(false);
            this.byId("customerSelect").setEnabled(false);
            this.byId("batchSizeSelect").setEnabled(false);
            this.byId("btnEditRule").setEnabled(false);

            // 清空结果表
            const oResultsModel = this.getView().getModel("results");
            oResultsModel.setProperty("/rows", []);

            // 初始化批处理状态追踪
            this._oBatchState = {
                startTime: Date.now(),
                totalRows: 0,
                processedRows: 0,
                currentBatch: 0,
                totalBatches: 0,
                successCount: 0,
                errorCount: 0,
                isProcessing: true
            };

            // 更新批处理模型状态
            const oBatchModel = this.getView().getModel("batch");
            oBatchModel.setProperty("/processingStatus", "processing");
            oBatchModel.setProperty("/progress", 0);
            oBatchModel.setProperty("/processed", 0);

            console.log("Batch processing initialized");
        },

        /**
         * 准备批处理配置
         * @private
         * @returns {Object} 批处理配置对象
         */
        _prepareBatchConfiguration() {
            const sCustomer = this.byId("customerSelect").getSelectedKey();
            const iBatchSize = parseInt(this.byId("batchSizeSelect").getSelectedKey(), 10);
            const oCustomerRulesModel = this.getView().getModel("customerRules");
            const aRules = oCustomerRulesModel.getProperty(`/rules/${sCustomer}`);
            const oExcelModel = this.getView().getModel("excelData");
            const oExcelData = oExcelModel.getData();
            
            // 更新批处理模型中的选定批处理大小
            const oBatchModel = this.getView().getModel("batch");
            oBatchModel.setProperty("/selectedBatchSize", iBatchSize);
            oBatchModel.setProperty("/total", oExcelData.rows.length);

            // 获取表头
            const aHeaders = Object.keys(oExcelData.rows[0]);

            // 计算批次信息
            const iTotalRows = oExcelData.rows.length;
            const iTotalBatches = Math.ceil(iTotalRows / iBatchSize);

            // 更新状态
            this._oBatchState.totalRows = iTotalRows;
            this._oBatchState.totalBatches = iTotalBatches;

            console.log(`Preparing batch processing: ${iTotalRows} rows, ${iTotalBatches} batches, ${iBatchSize} rows per batch`);

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

        /**
         * 执行自动批处理循环
         * @private
         * @async
         * @param {Object} oBatchConfig 批处理配置
         */
        async _executeBatchProcessing(oBatchConfig) {
            console.log("Starting automatic batch processing loop");

            // 将对象格式的行转换为数组格式
            const aTransformedRows = oBatchConfig.allRows.map(row => 
                oBatchConfig.headers.map(header => row[header])
            );

            // 循环处理每个批次
            for (let iBatchIndex = 0; iBatchIndex < oBatchConfig.totalBatches; iBatchIndex++) {
                // 检查是否应该停止处理（用户可能想要取消）
                if (!this._oBatchState.isProcessing) {
                    console.log("Batch processing interrupted by user");
                    break;
                }

                try {
                    // 更新当前批次状态
                    this._oBatchState.currentBatch = iBatchIndex + 1;
            
                    // 更新UI进度
                    this._updateProcessingProgress();

                    // 准备当前批次数据
                    const iBatchStart = iBatchIndex * oBatchConfig.batchSize;
                    const iBatchEnd = Math.min(iBatchStart + oBatchConfig.batchSize, aTransformedRows.length);
                    const aBatchRows = aTransformedRows.slice(iBatchStart, iBatchEnd);

                    console.log(`Processing batch ${iBatchIndex + 1}/${oBatchConfig.totalBatches} (rows ${iBatchStart + 1}-${iBatchEnd})`);

                    // 构建API请求
                    const oApiRequest = {
                        headers: oBatchConfig.headers,
                        rows: aBatchRows,
                        rules: oBatchConfig.rules,
                        options: {
                            ...oBatchConfig.options,
                            batchInfo: {
                                batchIndex: iBatchIndex + 1,
                                totalBatches: oBatchConfig.totalBatches,
                                batchStartRow: iBatchStart + 1
                            }
                        }
                    };

                    console.log(`Batch ${iBatchIndex + 1} request data:`, oApiRequest);

                    // 调用同步API处理当前批次
                    const oApiResponse = await this._callBatchAPI(oApiRequest);

                    // 处理API响应并更新结果表
                    this._processBatchResponse(oApiResponse, iBatchStart);

                    // 更新统计信息
                    this._updateBatchStatistics(oApiResponse);
                    
                    // 更新批处理模型进度
                    const oBatchModel = this.getView().getModel("batch");
                    const iProcessed = iBatchEnd;
                    const iTotal = oBatchModel.getProperty("/total");
                    const iProgress = Math.round((iProcessed / iTotal) * 100);
                    
                    oBatchModel.setProperty("/progress", iProgress);
                    oBatchModel.setProperty("/processed", iProcessed);

                    // 批次间短暂延迟，避免服务器压力过大
                    if (iBatchIndex < oBatchConfig.totalBatches - 1) {
                        await this._delay(300); // 300ms延迟
                    }

                } catch (error) {
                    console.error(`Batch ${iBatchIndex + 1} processing failed:`, error);
            
                    // 处理单个批次的错误，但继续处理下一批次
                    this._handleBatchError(iBatchIndex + 1, iBatchStart, iBatchEnd - iBatchStart, error);
                }
            }
        },

        /**
         * 调用批次处理API
         * @private
         * @async
         * @param {Object} oRequest API请求对象
         * @returns {Promise<Object>} API响应对象
         */
        async _callBatchAPI(oRequest) {
            console.log(`Calling API to process batch ${oRequest.options.batchInfo.batchIndex}`);

            try {
                const response = await fetch('https://yageo-poc-backend-grateful-aardvark-kn.cfapps.eu12.hana.ondemand.com/v1/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(oRequest)
                });

                console.log(`Batch ${oRequest.options.batchInfo.batchIndex} API response status: ${response.status}`);
                
                // 检查HTTP状态码
                if (response.status !== 200) {
                    const sErrorText = await response.text();
                    throw new Error(`API call failed: ${response.status} ${response.statusText}. ${sErrorText}`);
                }

                // 先获取 JSON 数据,避免重复读取响应体
                const responseData = await response.json();
                console.log(`Batch ${oRequest.options.batchInfo.batchIndex} API response content:`, responseData);

                // 验证响应格式
                if (responseData.status !== "success") {
                    throw new Error("API processing failed");
                }

                return {
                    success: true,
                    data: responseData.results || [],
                    summary: {
                        totalRows: responseData.processed_count,
                        validRows: responseData.results.filter(r => r.valid).length,
                        invalidRows: responseData.results.filter(r => !r.valid).length
                    }
                };

            } catch (error) {
                console.error(`Batch ${oRequest.options.batchInfo.batchIndex} API call failed:`, error);
                throw error;
            }
        },

        /**
         * 处理批次API响应
         * @private
         * @param {Object} oApiResponse API响应对象
         * @param {number} iBatchStartIndex 批次起始行索引
         */
        _processBatchResponse(oApiResponse, iBatchStartIndex) {
    if (!oApiResponse.data || !Array.isArray(oApiResponse.data)) {
        throw new Error("API response data format error: missing data array");
    }

    const sCustomer = this.byId("customerSelect").getSelectedKey();
    
    // 根据不同客户的字段映射规则
    const fieldMappings = {
        "C001": {  // Customer A
            customerCode: "CustomerPurchaseCode",
            poNumber: "PONo",
            poDate: "PODate",
            itemNo: "POItemNo", // 注意这里的命名
            poLine: "PO+POLINE",
            customerPartNo: "CustomerPartNO",
            quantity: "QTY",
            requestDate: "RequestDate",
            netPrice: "NetPrice",
            partNo: "PartNo",
            salesOrderType: "SalesOrderType"
        },
        "C002": {  // Customer B
            vendorNo: "Vendor NO",         // Vendor Number
            customerCode: "Vendor NO",      // Customer Code uses Vendor Number
            poNumber: "PO Number",         // Purchase Order Number
            poDate: "PO Date",            // Purchase Order Date
            itemNo: "Item No",            // Item Number
            deliveryDate: "Delivery Date", // Delivery Date
            requestDate: "Delivery Date",  // Request Date uses Delivery Date
            quantity: "Order Qty",         // Order Quantity
            orderQty: "Order Qty",        // Original Order Quantity
            customerPartNo: "Manuf. P/N",  // Customer Part Number
            partNo: "Part No",            // Part Number
            plant: "Plant",               // Plant
            shipTo: "Ship To",            // Ship To
            soldTo: "Sold To",            // Sold To
            crd: "CRD",                   // Customer Request Date
            orderType: "Order Type",      // Order Type
            salesOrderType: "SalesOrderType"   // Sales Order Type
        }
    };

    const mapping = fieldMappings[sCustomer] || {};

    // 转换为表格显示格式
    const aTableRows = oApiResponse.data.map((oItem, index) => {
        const row = {
            rowIndex: iBatchStartIndex + index + 1,
            valid: oItem.valid,
            result: oItem.valid ? "Processing Success" : "Processing Failed",
            // 添加 reason 字段，只有在 invalid 时才显示错误原因
            reason: oItem.reason || ""
            
        };

        // 获取当前客户的字段映射
        const mapping = fieldMappings[sCustomer] || {};

        // 根据映射规则添加字段
        Object.keys(mapping).forEach(key => {
            row[key] = oItem.data[mapping[key]] || "";
        });

        return row;
    });
    

    // 追加到结果表格
    const oResultsModel = this.getView().getModel("results");
    const aCurrentRows = oResultsModel.getProperty("/rows") || [];
    oResultsModel.setProperty("/rows", [...aCurrentRows, ...aTableRows]);
},

        /**
        * 更新批处理统计信息
        * @private
        * @param {Object} oApiResponse API响应对象
        */
        _updateBatchStatistics(oApiResponse) {
            if (oApiResponse.summary) {
                this._oBatchState.processedRows += oApiResponse.summary.totalRows || 0;
                this._oBatchState.successCount += oApiResponse.summary.validRows || 0;
                this._oBatchState.errorCount += oApiResponse.summary.invalidRows || 0;
            } else if (oApiResponse.data) {
                // 如果没有summary，从data计算
                const iValidCount = oApiResponse.data.filter(item => item.valid).length;
                this._oBatchState.processedRows += oApiResponse.data.length;
                this._oBatchState.successCount += iValidCount;
                this._oBatchState.errorCount += (oApiResponse.data.length - iValidCount);
            }
        },

        /**
         * 处理单个批次错误
         * @private
         * @param {number} iBatchNumber 批次号
         * @param {number} iStartRow 起始行
         * @param {number} iBatchSize 批次大小
         * @param {Error} oError 错误对象
         */
        _handleBatchError(iBatchNumber, iStartRow, iBatchSize, oError) {
            // 为失败的批次创建错误记录
            const aErrorRows = [];
            for (let i = 0; i < iBatchSize; i++) {
                aErrorRows.push({
                    valid: false,
                    rowIndex: iStartRow + i + 1,
                    poNumber: `Batch-${iBatchNumber}-Row${i + 1}`,
                    result: `Batch processing failed: ${oError.message}`
                });
            }

            // 添加到结果表格
            const oResultsModel = this.getView().getModel("results");
            const aCurrentRows = oResultsModel.getProperty("/rows") || [];
            oResultsModel.setProperty("/rows", [...aCurrentRows, ...aErrorRows]);

            // 更新统计
            this._oBatchState.processedRows += iBatchSize;
            this._oBatchState.errorCount += iBatchSize;

            // 显示错误提示但不中断整体处理
            MessageToast.show(`Batch ${iBatchNumber} processing failed, will continue with subsequent batches`, {
                duration: 3000
            });
        },

        /**
         * 更新处理进度显示
         * @private
         */
        _updateProcessingProgress() {
            const oState = this._oBatchState;

            // 计算进度百分比
            const iProgressPercent = Math.round((oState.currentBatch / oState.totalBatches) * 100);

            // 更新按钮文本显示进度
            const sProgressText = `Processing... ${iProgressPercent}% (${oState.currentBatch}/${oState.totalBatches})`;
            this.byId("btnAutomation").setText(sProgressText);

            // 计算预估剩余时间
            const iElapsedTime = Date.now() - oState.startTime;
            const iAvgTimePerBatch = iElapsedTime / oState.currentBatch;
            const iRemainingBatches = oState.totalBatches - oState.currentBatch;
            const iEstimatedRemainingTime = Math.round((iAvgTimePerBatch * iRemainingBatches) / 1000);

            // 控制台输出详细进度信息
            console.log(`Progress: ${iProgressPercent}% | Batch: ${oState.currentBatch}/${oState.totalBatches} | Processed: ${oState.processedRows}/${oState.totalRows} | Estimated remaining: ${iEstimatedRemainingTime}s`);
        },

        /**
         * 完成批处理流程
         * @private
         * @param {boolean} bSuccess 是否成功完成
         */
        _finalizeBatchProcessing(bSuccess = true) {
            const oState = this._oBatchState;

            // 恢复控件状态
            this.byId("btnAutomation").setEnabled(true);
            this.byId("btnAutomation").setText("Start AI Automation");
            this.byId("customerSelect").setEnabled(true);
            this.byId("batchSizeSelect").setEnabled(true);
            this.byId("btnEditRule").setEnabled(true);

            // 更新批处理模型状态
            const oBatchModel = this.getView().getModel("batch");
            oBatchModel.setProperty("/processingStatus", "completed");
            oBatchModel.setProperty("/progress", 100);
            oBatchModel.setProperty("/processed", oState.totalRows);

            // 计算总耗时
            const iTotalTime = Date.now() - oState.startTime;
            const sTotalTime = `${Math.round(iTotalTime / 1000)}s`;

            // 显示完成摘要
            if (bSuccess) {
                const sSummaryMessage = `Batch processing completed!\n` +
                    `Total: ${oState.totalRows} rows, Processed: ${oState.processedRows} rows\n` +
                    `Success: ${oState.successCount} rows, Failed: ${oState.errorCount} rows\n` +
                    `Total time: ${sTotalTime}`;
            
                MessageToast.show(sSummaryMessage, { 
                    duration: 6000,
                    width: "auto"
                });

                console.log("Batch processing completed successfully:", {
                    totalRows: oState.totalRows,
                    processedRows: oState.processedRows,
                    successRows: oState.successCount,
                    failedRows: oState.errorCount,
                    totalBatches: oState.totalBatches,
                    duration: sTotalTime
                });
            }

            // 清理状态
            this._oBatchState = null;
        },

        /**
         * 处理批处理过程中的错误
         * @private
         * @param {Error} oError 错误对象
         */
        _handleBatchProcessingError(oError) {
            console.error("Critical error occurred during batch processing:", oError);

            // 恢复UI状态
            this._finalizeBatchProcessing(false);

            // 显示错误信息
            let sUserMessage = "Batch processing failed: ";
            if (oError.message.includes("network") || oError.message.includes("fetch")) {
                sUserMessage += "Network connection error, please check your connection and try again";
            } else if (oError.message.includes("API") || oError.message.includes("server")) {
                sUserMessage += "Service temporarily unavailable, please try again later";
            } else {
                sUserMessage += oError.message;
            }

            MessageToast.show(sUserMessage, { 
                duration: 8000,
                my: "center center",
                at: "center center"
            });
        },

        /**
         * 延迟函数
         * @private
         * @param {number} iMs 延迟毫秒数
         * @returns {Promise} 延迟Promise
         */
        _delay(iMs) {
            return new Promise(resolve => setTimeout(resolve, iMs));
        },

        /**
         * Handles batch size selection change
         * Updates the batch model with the selected batch size
         * @public
         * @param {sap.ui.base.Event} oEvent The selection change event
         */
        onBatchSizeChange: function(oEvent) {
            const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            const iBatchSize = parseInt(sSelectedKey, 10);
            
            // 更新批处理模型中的选定批处理大小
            const oBatchModel = this.getView().getModel("batch");
            oBatchModel.setProperty("/selectedBatchSize", iBatchSize);
            
            console.log("Batch size changed to:", iBatchSize);
        },


                /**
         * Updates the results table with new processing results from API
         * Handles the incremental update of the results display
         * @private
         * @param {Array} aResults Array of API processing results
         * @param {Object} aResults[].valid Boolean indicating if the record passed all rules
         * @param {Object} aResults[].rowIndex Original Excel row index
         * @param {Object} aResults[].poNumber Purchase Order number for reference
         * @param {Object} aResults[].result Processing result or error message
         * @throws {Error} When results format is invalid
         */
        _updateResultsTable(aResults) {
            const oResultsModel = this.getView().getModel("results");
            const aCurrentRows = oResultsModel.getProperty("/rows");
            
            // TODO: Implement results handling:
            // 1. Data transformation
            //    - Transform API response to table format
            //    - Format values for display
            //    - Add row indices for reference
            // 2. Results aggregation
            //    - Combine with existing results
            //    - Maintain processing order
            //    - Track completion status
            // 3. UI updates
            //    - Update table incrementally
            //    - Show processing status
            //    - Highlight new entries
            // 4. Performance
            //    - Handle large result sets
            //    - Implement progressive loading
            //    - Optimize memory usage
            
            // Append new results to the table
            oResultsModel.setProperty("/rows", [...aCurrentRows, ...aResults]);
        }
    });
});

