/**
 * ApiService.js
 * Handles all API calls for batch processing
 */
sap.ui.define([], function() {
    "use strict";
    /**
     * ApiService.js
     * Handles all API calls for batch processing
     */
    var ApiService = {
        /**
         * 调用批次处理API
         * @param {Object} oRequest API请求对象
         * @returns {Promise<Object>} API响应对象
         */
        callBatchAPI: async function(oRequest) {
            console.log("Calling API to process batch " + oRequest.options.batchInfo.batchIndex);
            try {
                var response = await fetch('https://yageo-poc-backend-grateful-aardvark-kn.cfapps.eu12.hana.ondemand.com/v1/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(oRequest)
                });
                if (response.status !== 200) {
                    var sErrorText = await response.text();
                    throw new Error("API call failed: " + response.status + " " + response.statusText + ". " + sErrorText);
                }
                var responseData = await response.json();
                if (responseData.status !== "success") {
                    throw new Error("API processing failed");
                }
                return {
                    success: true,
                    data: responseData.results || [],
                    summary: {
                        totalRows: responseData.processed_count,
                        validRows: responseData.results ? responseData.results.filter(function(r){return r.valid;}).length : 0,
                        invalidRows: responseData.results ? responseData.results.filter(function(r){return !r.valid;}).length : 0
                    }
                };
            } catch (error) {
                console.error("Batch " + oRequest.options.batchInfo.batchIndex + " API call failed:", error);
                throw error;
            }
        }
    };

    return ApiService;
});
