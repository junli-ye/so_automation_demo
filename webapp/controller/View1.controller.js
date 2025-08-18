/**
 * Main controller for the SO Automation application
 * Handles all user interactions and delegates to sub-modules
 * @namespace yegeoaiso.controller.View1
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "./FileHandler",
    "./RuleManager",
    "./BatchProcessor",
    "./ResultsHandler",
    "./TableManager"  
], function(Controller, JSONModel, MessageToast, FileHandler, RuleManager, BatchProcessor, ResultsHandler, TableManager) {
    "use strict";
    return Controller.extend("yegeoaiso.controller.View1", {
        onInit: function() {
            // 1. 初始化所有模型和配置
            FileHandler.init(this);
            RuleManager.init(this);
            BatchProcessor.init(this);
            
            // 初始化表格管理器
            this._tableManager = TableManager.getInstance();
            this._tableManager.init(this);
            
            // 初始化表格模型
            var oResultsModel = new JSONModel({
                results: []
            });
            this.getView().setModel(oResultsModel, "results");
            
            // 确保表格列定义正确
            var oTable = this.byId("resultsTable");
            
            // 如果表格是动态创建的，确保列定义正确
            if (oTable && oTable.getColumns().length === 0) {
                console.log("Initializing table columns");
                
                // 添加列定义
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "Row #" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "Status" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "Message" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "Customer Code" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "PO Number" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "PO Date" }),
                    visible: true
                }));
                
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: "Item No" }),
                    visible: true
                }));
            }
            
            // 2. 其他初始化操作可在此扩展
            this._initializeEventHandlers();
        },
        
        /**
         * 初始化事件处理程序
         * @private
         */
        _initializeEventHandlers: function() {
            // 监听表格模型变化，确保列可见性设置在模型更新后仍然保持
            var oTable = this.byId("resultsTable");
            if (oTable) {
                var oModel = oTable.getModel("results");
                if (oModel) {
                    oModel.attachPropertyChange(function() {
                        // 确保列可见性设置在模型更新后仍然保持
                        setTimeout(function() {
                            this._restoreColumnVisibility();
                        }.bind(this), 100);
                    }.bind(this));
                }
            }
        },
        
        /**
         * 恢复列可见性设置
         * @private
         */
        _restoreColumnVisibility: function() {
            // 如果存在保存的列可见性设置，则应用它们
            if (this._savedColumnVisibility) {
                var oTable = this.byId("resultsTable");
                var aColumns = oTable.getColumns();
                
                for (var i = 0; i < aColumns.length; i++) {
                    if (this._savedColumnVisibility[i] !== undefined) {
                        aColumns[i].setVisible(this._savedColumnVisibility[i]);
                    }
                }
                
                console.log("Restored column visibility settings");
            }
        },
        
        /**
         * 保存当前列可见性设置
         * @private
         */
        _saveColumnVisibility: function() {
            var oTable = this.byId("resultsTable");
            var aColumns = oTable.getColumns();
            
            this._savedColumnVisibility = [];
            
            for (var i = 0; i < aColumns.length; i++) {
                this._savedColumnVisibility[i] = aColumns[i].getVisible();
            }
            
            console.log("Saved column visibility settings");
        },

        // 文件选择
        onFileSelect: function(oEvent) {
            FileHandler.onFileSelect(this, oEvent);
        },

        // Excel提取
        onExtractPress: function(oEvent) {
            FileHandler.onExtractPress(this, oEvent);
        },

        // 客户切换
        onCustomerChange: function(oEvent) {
            RuleManager.onCustomerChange(this, oEvent);
        },

        // 规则编辑
        onEditRule: function() {
            RuleManager.onEditRule(this);
        },

        // 规则取消
        onCancelEditRule: function() {
            RuleManager.onCancelEditRule(this);
        },

        // 批处理自动化
        onStartAutomation: async function() {
            // 保存当前列可见性设置，以便在处理完成后恢复
            this._saveColumnVisibility();
            
            await BatchProcessor.onStartAutomation(this);
            
            // 在处理完成后恢复列可见性设置
            setTimeout(function() {
                this._restoreColumnVisibility();
            }.bind(this), 500);
        },

        // 批次大小变更
        onBatchSizeChange: function(oEvent) {
            BatchProcessor.onBatchSizeChange(this, oEvent);
        },
        
        // 表格搜索
        onResultsSearch: function(oEvent) {
            if (this._tableManager) {
                this._tableManager.handleSearch(this, oEvent);
            } else {
                console.error("Table manager not initialized");
            }
        },
        
        // 表格设置
        onTableSettingsPress: function() {
            if (this._tableManager) {
                // 保存当前列可见性设置，以便在对话框取消时恢复
                this._saveColumnVisibility();
                
                this._tableManager.openTableSettings(this);
            } else {
                console.error("Table manager not initialized");
                MessageToast.show("Table settings not available");
            }
        }
    });
});
