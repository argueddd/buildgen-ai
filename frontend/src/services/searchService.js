// src/services/searchService.js
import axios from 'axios';
import { buildApiUrl, API_ENDPOINTS } from '../config/apiConfig';

export async function searchReports(query, settings = null) {
  try {
    let response;
    
    if (settings && settings.keywords && settings.keywords.length > 0) {
      // 使用POST请求进行带设置的搜索
      response = await axios.post(buildApiUrl(API_ENDPOINTS.SEARCH.REPORTS), {
        query: query,
        keywords: settings.keywords,
        filterType: settings.filterType,
        topN: settings.topN,
        threshold: settings.threshold
      });
    } else {
      // 使用GET请求进行普通搜索
      response = await axios.get(buildApiUrl(API_ENDPOINTS.SEARCH.REPORTS), {
        params: {
          query: query,
          limit: 5,
        },
      });
    }
    
    return response.data.results;
  } catch (error) {
    console.error('搜索失败:', error);
    return [];
  }
}

export async function extractKeywords(query) {
  try {
    const response = await axios.get(buildApiUrl(API_ENDPOINTS.SEARCH.EXTRACT_KEYWORDS), {
      params: {
        query: query,
      },
    });
    return response.data.keywords;
  } catch (error) {
    console.error('关键词提取失败:', error);
    return null;
  }
}

export async function searchByKeywords(keywords, filterType = 'topN', topN = 10, threshold = 0.7) {
  try {
    const response = await axios.post(buildApiUrl(API_ENDPOINTS.SEARCH.KEYWORD_SEARCH), {
      keywords: keywords,
      filterType: filterType,
      topN: topN,
      threshold: threshold
    });
    return response.data.results;
  } catch (error) {
    console.error('关键词检索失败:', error);
    return [];
  }
}