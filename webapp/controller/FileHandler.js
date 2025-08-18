/**
 * FileHandler.js
 * Handles file selection, validation, Excel parsing, and model updates
 */
export const FileHandler = {
    /**
     * 初始化文件处理相关模型
     * @param {sap.ui.core.mvc.Controller} ctrl
     */
    init(ctrl) {
        // 初始时禁用Extract按钮
        ctrl.byId("extractButton").setEnabled(false);

        // 初始化文件模型
        const oFileModel = new sap.ui.model.json.JSONModel({
            fileName: "",
            fileContent: { headers: [], rows: [] },
            isValid: false,
            errorMessage: ""
        });
        ctrl.getView().setModel(oFileModel, "file");
    },

    /**
     * Handles the Excel file selection event
     * Uses xlsx library to parse Excel file and prepare data for processing
     * @public
     */
    onFileSelect(ctrl, oEvent) {
        const oFile = oEvent.getParameter("files")[0];
        const sFileName = oEvent.getParameter("newValue");
        const oMessageStrip = ctrl.byId("fileNameStrip");

        if (!sFileName || !oFile) {
            oMessageStrip.setText("No file selected. Only Excel (.xlsx) files are allowed.");
            oMessageStrip.setType("Information");
            return;
        }
        if (!sFileName.endsWith(".xlsx")) {
            oMessageStrip.setText("Invalid file type. Please select an Excel (.xlsx) file");
            oMessageStrip.setType("Error");
            return;
        }
        ctrl._uploadedFile = oFile;
        oMessageStrip.setText("Selected file: " + sFileName);
        oMessageStrip.setType("Success");
        ctrl.byId("extractButton").setEnabled(true);
    },

    /**
     * 处理Extract Excel File按钮点击事件
     */
    onExtractPress(ctrl, oEvent) {
        const oMessageStrip = ctrl.byId("fileNameStrip");
        try {
            const oReader = new FileReader();
            oReader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const data = new Uint8Array(arrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    const oModel = new sap.ui.model.json.JSONModel({ rows: jsonData });
                    ctrl.getView().setModel(oModel, "excelData");
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
            oReader.readAsArrayBuffer(ctrl._uploadedFile);
        } catch (error) {
            oMessageStrip.setText("Error: " + error.message);
            oMessageStrip.setType("Error");
            console.error("Processing error:", error);
        }
    }
};
