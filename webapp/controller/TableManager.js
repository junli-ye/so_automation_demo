sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/m/ViewSettingsFilterItem",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/ui/model/Sorter",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer"
], function(BaseObject, ViewSettingsDialog, ViewSettingsItem, ViewSettingsFilterItem, 
            Filter, FilterOperator, List, StandardListItem, Button, VBox, Sorter,
            Toolbar, ToolbarSpacer) {
    "use strict";
    
    var instance = null;
    
    var TableManager = BaseObject.extend("com.mycompany.myapp.controller.TableManager", {
        /**
         * 构造函数
         */
        constructor: function() {
            this._oTableSettingsDialog = null;
            this._oColumnsList = null;
            this._debugMode = true; // 启用调试模式
        },
        
        /**
         * 初始化表格管理器
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         */
        init: function(ctrl) {
            this._controller = ctrl;
            if (this._debugMode) {
                console.log("TableManager initialized with controller:", ctrl);
            }
        },
        
        /**
         * 处理表格搜索
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         * @param {sap.ui.base.Event} oEvent 搜索事件
         */
        handleSearch: function(ctrl, oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = ctrl.byId("resultsTable");
            var oBinding = oTable.getBinding("items");
            
            if (sQuery && sQuery.length > 0) {
                // 创建过滤器数组，可以搜索多个字段
                var aFilters = [
                    new Filter("poNumber", FilterOperator.Contains, sQuery),
                    new Filter("customerCode", FilterOperator.Contains, sQuery)
                    // 可以添加更多字段
                ];
                
                // 应用OR过滤器
                var oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                
                oBinding.filter(oFilter);
            } else {
                // 清除过滤器
                oBinding.filter([]);
            }
        },
        
        /**
         * 打开表格设置对话框
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         */
        openTableSettings: function(ctrl) {
            if (this._debugMode) {
                console.log("Opening table settings dialog");
            }
            
            if (!this._oTableSettingsDialog) {
                this._oTableSettingsDialog = new ViewSettingsDialog({
                    title: "Table Settings",
                    sortItems: [
                        new ViewSettingsItem({
                            key: "rowIndex",
                            text: "Row number"
                        }),
                        new ViewSettingsItem({
                            key: "poNumber",
                            text: "PO Number"
                        }),
                        new ViewSettingsItem({
                            key: "customerCode",
                            text: "CustomerCode"
                        })
                    ],
                    filterItems: [
                        new ViewSettingsFilterItem({
                            key: "valid",
                            text: "Status",
                            items: [
                                new ViewSettingsItem({
                                    key: "valid",
                                    text: "valid"
                                }),
                                new ViewSettingsItem({
                                    key: "invalid",
                                    text: "invalid"
                                })
                            ]
                        })
                    ],
                    // 添加列可见性标签页
                    customTabs: [
                        new sap.m.ViewSettingsCustomTab({
                            key: "columns",
                            title: "Columns",
                            icon: "sap-icon://table-column",
                            content: this._createColumnVisibilityContent(ctrl)
                        })
                    ],
                    confirm: this._handleDialogConfirm.bind(this, ctrl),
                    cancel: function() {
                        if (this._debugMode) {
                            console.log("Dialog canceled");
                        }
                    }.bind(this),
                    resetFilters: function() {
                        if (this._debugMode) {
                            console.log("Filters reset");
                        }
                    }.bind(this)
                });
            } else {
                // 更新列可见性内容
                this._updateColumnVisibilityContent(ctrl);
            }
            
            this._oTableSettingsDialog.open();
        },
        
        /**
         * 处理对话框确认
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         * @param {sap.ui.base.Event} oEvent 确认事件
         * @private
         */
        _handleDialogConfirm: function(ctrl, oEvent) {
            var mParams = oEvent.getParameters();
            var oTable = ctrl.byId("resultsTable");
            var oBinding = oTable.getBinding("items");
            
            if (this._debugMode) {
                console.log("Dialog confirmed with parameters:", mParams);
            }
            
            // 应用排序
            if (mParams.sortItem) {
                var bDescending = mParams.sortDescending;
                var sSortPath = mParams.sortItem.getKey();
                
                var oSorter = new Sorter(sSortPath, bDescending);
                oBinding.sort(oSorter);
                
                if (this._debugMode) {
                    console.log("Applied sorting:", sSortPath, "descending:", bDescending);
                }
            }
            
            // 应用过滤
            if (mParams.filterItems && mParams.filterItems.length) {
                var aFilters = [];
                
                mParams.filterItems.forEach(function(oItem) {
                    var sPath = oItem.getParent().getKey();
                    var sOperator = FilterOperator.EQ;
                    var sValue = oItem.getKey() === "valid";
                    
                    aFilters.push(new Filter(sPath, sOperator, sValue));
                });
                
                oBinding.filter(aFilters);
                
                if (this._debugMode) {
                    console.log("Applied filters:", aFilters);
                }
            } else {
                oBinding.filter([]);
            }
            
            // 处理列可见性
            if (this._debugMode) {
                console.log("Current tab key:", mParams.customTabKey);
            }
            
            // 无论当前是哪个标签页，都应用列可见性设置
            this._applyColumnVisibility(ctrl);
            
            // 强制表格重新渲染
            oTable.invalidate();
            
            if (this._debugMode) {
                console.log("Table invalidated for re-rendering");
                
                // 添加延迟检查，确认列可见性是否真的应用了
                setTimeout(function() {
                    var aColumns = oTable.getColumns();
                    console.log("After re-rendering, column visibility status:");
                    aColumns.forEach(function(col, idx) {
                        console.log("Column", idx, ":", col.getHeader().getText(), "visible:", col.getVisible());
                    });
                }, 500);
            }
        },
        
        /**
         * 创建列可见性内容
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         * @returns {sap.ui.core.Control} 列可见性内容
         * @private
         */
        _createColumnVisibilityContent: function(ctrl) {
            var oTable = ctrl.byId("resultsTable");
            var aColumns = oTable.getColumns();
            
            if (this._debugMode) {
                console.log("Creating column visibility content");
                console.log("Table columns:", aColumns.length);
                aColumns.forEach(function(col, idx) {
                    console.log("Column", idx, ":", col.getHeader().getText(), "visible:", col.getVisible());
                });
            }
            
            // 创建列表用于显示列选项
            if (!this._oColumnsList) {
                this._oColumnsList = new List({
                    mode: "MultiSelect",
                    includeItemInSelection: true
                });
                
                // 添加列选项
                aColumns.forEach(function(oColumn, iIndex) {
                    var oHeader = oColumn.getHeader();
                    var sText = "";
                    
                    if (oHeader instanceof sap.m.Text) {
                        sText = oHeader.getText();
                    } else if (typeof oHeader.getText === "function") {
                        sText = oHeader.getText();
                    } else {
                        sText = "Column " + (iIndex + 1);
                    }
                    
                    var oListItem = new StandardListItem({
                        title: sText,
                        type: "Active",
                        selected: oColumn.getVisible()
                    });
                    
                    // 存储列索引，用于后续处理
                    oListItem.data("columnIndex", iIndex);
                    
                    this._oColumnsList.addItem(oListItem);
                    
                    if (this._debugMode) {
                        console.log("Added list item for column:", sText, "index:", iIndex, "visible:", oColumn.getVisible());
                    }
                }.bind(this));
            }
            
            // 创建包含"全选"和"全不选"按钮的工具栏
            var oToolbar = new Toolbar({
                content: [
                    new ToolbarSpacer(),
                    new Button({
                        text: "Select All",
                        press: function() {
                            this._selectAllColumns(true);
                            if (this._debugMode) {
                                console.log("Select All button pressed");
                            }
                        }.bind(this)
                    }),
                    new Button({
                        text: "Deselect All",
                        press: function() {
                            this._selectAllColumns(false);
                            if (this._debugMode) {
                                console.log("Deselect All button pressed");
                            }
                        }.bind(this)
                    })
                ]
            });
            
            // 创建包含工具栏和列表的垂直布局
            var oVBox = new VBox({
                items: [
                    oToolbar,
                    this._oColumnsList
                ]
            });
            
            return oVBox;
        },
        
        /**
         * 更新列可见性内容
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         * @private
         */
        _updateColumnVisibilityContent: function(ctrl) {
            if (!this._oColumnsList) {
                return;
            }
            
            var oTable = ctrl.byId("resultsTable");
            var aColumns = oTable.getColumns();
            var aListItems = this._oColumnsList.getItems();
            
            if (this._debugMode) {
                console.log("Updating column visibility content");
                console.log("List items:", aListItems.length, "Table columns:", aColumns.length);
            }
            
            // 更新列表项的选中状态
            aListItems.forEach(function(oItem, iIndex) {
                var iColumnIndex = oItem.data("columnIndex");
                if (iColumnIndex !== undefined && iColumnIndex < aColumns.length) {
                    var bVisible = aColumns[iColumnIndex].getVisible();
                    oItem.setSelected(bVisible);
                    
                    if (this._debugMode) {
                        console.log("Updated list item", iIndex, "for column", iColumnIndex, "visible:", bVisible);
                    }
                }
            }.bind(this));
        },
        
        /**
         * 选择或取消选择所有列
         * @param {boolean} bSelect 是否选择
         * @private
         */
        _selectAllColumns: function(bSelect) {
            if (!this._oColumnsList) {
                return;
            }
            
            var aListItems = this._oColumnsList.getItems();
            
            aListItems.forEach(function(oItem) {
                oItem.setSelected(bSelect);
            });
            
            if (this._debugMode) {
                console.log("Set all columns selected:", bSelect);
            }
        },
        
        /**
         * 应用列可见性设置
         * @param {sap.ui.core.mvc.Controller} ctrl 控制器实例
         * @private
         */
        _applyColumnVisibility: function(ctrl) {
            if (!this._oColumnsList) {
                if (this._debugMode) {
                    console.error("Column list not initialized!");
                }
                return;
            }
            
            var oTable = ctrl.byId("resultsTable");
            var aColumns = oTable.getColumns();
            var aListItems = this._oColumnsList.getItems();
            var bAnyColumnVisible = false;
            
            if (this._debugMode) {
                console.log("Applying column visibility");
                console.log("List items:", aListItems.length, "Table columns:", aColumns.length);
            }
            
            // 遍历所有列表项，设置对应列的可见性
            aListItems.forEach(function(oItem, iIndex) {
                var bSelected = oItem.getSelected();
                var iColumnIndex = oItem.data("columnIndex");
                
                if (iColumnIndex !== undefined && iColumnIndex < aColumns.length) {
                    // 直接设置列的可见性属性
                    aColumns[iColumnIndex].setVisible(bSelected);
                    
                    if (bSelected) {
                        bAnyColumnVisible = true;
                    }
                    
                    if (this._debugMode) {
                        console.log("Setting column", iColumnIndex, "visible:", bSelected);
                    }
                } else {
                    if (this._debugMode) {
                        console.error("Invalid column index:", iColumnIndex);
                    }
                }
            }.bind(this));
            
            // 如果没有列是可见的，则显示所有列
            if (!bAnyColumnVisible) {
                if (this._debugMode) {
                    console.warn("No columns visible, showing all columns");
                }
                
                aColumns.forEach(function(oColumn) {
                    oColumn.setVisible(true);
                });
            }
            
            // 检查列可见性是否真的改变了
            if (this._debugMode) {
                console.log("Column visibility after applying:");
                aColumns.forEach(function(col, idx) {
                    console.log("Column", idx, ":", col.getHeader().getText(), "visible:", col.getVisible());
                });
            }
            
            // 尝试强制更新表格模型
            var oModel = oTable.getModel();
            if (oModel) {
                oModel.refresh(true);
                if (this._debugMode) {
                    console.log("Table model refreshed");
                }
            }
            
            // 尝试强制表格重新渲染
            oTable.rerender();
            if (this._debugMode) {
                console.log("Table rerendered");
            }
        },
        
        /**
         * 获取单例实例
         * @returns {com.mycompany.myapp.controller.TableManager} 表格管理器实例
         */
        getInstance: function() {
            if (!instance) {
                instance = new TableManager();
            }
            return instance;
        }
    });
    
    return {
        getInstance: function() {
            if (!instance) {
                instance = new TableManager();
            }
            return instance;
        }
    };
});
