// localStorage工具函数
export const LocalStorageKeys = {
  CURRENT_PAGE: 'buildgen_current_page',
  SEARCH_RESULTS: 'buildgen_search_results',
  SELECTED_REPORTS: 'buildgen_selected_reports',
  SEARCH_KEYWORD: 'buildgen_search_keyword',
  CHAT_MESSAGES: 'buildgen_chat_messages',
  SELECTED_PDF: 'buildgen_selected_pdf',
  PDF_LIST: 'buildgen_pdf_list',
  EDITABLE_CONTENTS: 'buildgen_editable_contents'
};

// 保存数据到localStorage
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('保存到localStorage失败:', error);
  }
};

// 从localStorage读取数据
export const getFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn('从localStorage读取失败:', error);
    return defaultValue;
  }
};

// 删除localStorage中的数据
export const removeFromLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('从localStorage删除失败:', error);
  }
};

// 清空所有应用相关的localStorage数据
export const clearAllAppData = () => {
  Object.values(LocalStorageKeys).forEach(key => {
    removeFromLocalStorage(key);
  });
};