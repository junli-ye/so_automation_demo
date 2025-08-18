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
    "./BatchProcessor"
], function(Controller, JSONModel, MessageToast, FileHandler, RuleManager, BatchProcessor) {
    "use strict";
    return Controller.extend("yegeoaiso.controller.View1", {
        onInit: function() {
            // 1. 初始化所有模型和配置
            FileHandler.init(this);
            RuleManager.init(this);
            BatchProcessor.init(this);

            // 2. 其他初始化操作可在此扩展
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
            await BatchProcessor.onStartAutomation(this);
        },

        // 批次大小变更
        onBatchSizeChange: function(oEvent) {
            BatchProcessor.onBatchSizeChange(this, oEvent);
        }
    });
});
