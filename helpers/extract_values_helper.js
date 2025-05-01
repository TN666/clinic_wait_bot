const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 从HTML内容中提取值
 * @param {string} htmlContent
 * @returns {Object}
 */
const extractFromHtml = (htmlContent) => {
    try {
        const $ = cheerio.load(htmlContent);
        const vcode = $('table[vcode]').attr('vcode');
        const portalIdElement = $('script:contains("C__PortalID")');
        const portalId = portalIdElement.text().match(/C__PortalID\s*=\s*'([^']+?)'/)[1];
        
        return {
            vcode,
            portalId
        };
    } catch (error) {
        throw new Error(`HTML分析失败: ${error.message}`);
    }
};

/**
 * 从URL获取并提取值
 * @param {string} url
 * @param {Object} options
 * @param {string} [options.baseUrl]
 * @param {Object} [options.axiosConfig]
 * @returns {Promise<Object>}
 */
const extractFromUrl = async (url, options = {}) => {
    const { baseUrl = '', axiosConfig = {} } = options;
    
    try {
        const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
        const response = await axios.get(fullUrl, axiosConfig);
        return extractFromHtml(response.data);
    } catch (error) {
        if (error.response) {
            throw new Error(`HTTP请求失败: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
            throw new Error(`网络请求失败: ${error.message}`);
        } else {
            throw error;
        }
    }
};

module.exports = {
    extractFromHtml,
    extractFromUrl
}; 