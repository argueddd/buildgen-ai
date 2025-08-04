// src/services/searchService.js
import axios from 'axios';

const BASE_URL = 'http://aireportbackend.s7.tunnelfrp.com'; // 改为你的 Flask 地址

export async function searchReports(keyword) {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        query: keyword,
        limit: 5,
      },
    });
    return response.data.results;
  } catch (error) {
    console.error('搜索失败:', error);
    return [];
  }
}