import React, { useState, useRef } from 'react';
import axios from 'axios';
import { buildApiUrl, buildUploadUrl, API_ENDPOINTS } from '../../config/apiConfig';

export default function PdfUpload({ onClose, onUpload }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const validateFiles = (files) => {
    const validFiles = [];
    const invalidFiles = [];
    
    Array.from(files).forEach(file => {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });
    
    if (invalidFiles.length > 0) {
      alert(`以下文件不是PDF格式，将被忽略：\n${invalidFiles.join('\n')}`);
    }
    
    return validFiles;
  };

  const handleFiles = async (files) => {
    const validFiles = validateFiles(files);
    
    if (validFiles.length === 0) {
      alert('请选择PDF文件');
      return;
    }

    setUploading(true);
    setUploadStatus(`准备上传 ${validFiles.length} 个文件...`);

    // 初始化进度
    const initialProgress = {};
    validFiles.forEach((file, index) => {
      initialProgress[index] = { progress: 0, status: '等待上传', fileName: file.name };
    });
    setUploadProgress(initialProgress);

    try {
      if (validFiles.length === 1) {
        // 单文件上传
        await uploadSingleFile(validFiles[0], 0);
      } else {
        // 批量上传
        await uploadMultipleFiles(validFiles);
      }
    } catch (error) {
      console.error('上传失败:', error);
      setUploadStatus('上传失败');
      alert('上传失败：' + error.message);
      setUploading(false);
    }
  };

  const uploadSingleFile = async (file, index) => {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(prev => ({
          ...prev,
          [index]: { ...prev[index], progress: percentCompleted, status: '上传中' }
        }));
      },
    };

    const response = await axios.post(buildApiUrl(API_ENDPOINTS.PDF.UPLOAD_SINGLE), formData, config);
    
    if (response.data.success) {
      setUploadProgress(prev => ({
        ...prev,
        [index]: { ...prev[index], progress: 100, status: '上传完成，处理中...' }
      }));
      
      const newPdf = {
        id: response.data.file_id,
        name: file.name,
        date: new Date().toISOString().split('T')[0],
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        status: response.data.status || 'uploading',
        fileUrl: buildUploadUrl(file.name),
        chunksCount: 0
      };

      setTimeout(() => {
        onUpload(newPdf);
        setUploading(false);
        onClose();
      }, 1500);
    } else {
      throw new Error(response.data.error || '上传失败');
    }
  };

  const uploadMultipleFiles = async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      setUploadStatus('批量上传中...');
      const response = await axios.post(buildApiUrl(API_ENDPOINTS.PDF.UPLOAD_BATCH), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadStatus(`批量上传中... ${percentCompleted}%`);
        },
      });

      if (response.data.success) {
        setUploadStatus('批量上传完成，后台处理中...');
        
        // 更新每个文件的状态
        response.data.results.forEach((result, index) => {
          setUploadProgress(prev => ({
            ...prev,
            [index]: { 
              ...prev[index], 
              progress: 100, 
              status: result.success ? '上传完成，处理中...' : `失败：${result.error}` 
            }
          }));
        });

        // 创建PDF对象并通知父组件
        const successfulUploads = response.data.results
          .filter(result => result.success)
          .map((result, index) => ({
            id: result.file_id,
            name: files[index].name,
            date: new Date().toISOString().split('T')[0],
            size: `${(files[index].size / 1024 / 1024).toFixed(1)} MB`,
            status: result.status || 'uploading',
            fileUrl: buildUploadUrl(files[index].name),
            chunksCount: 0
          }));

        setTimeout(() => {
          // 批量通知上传成功
          onUpload({ type: 'batch', pdfs: successfulUploads });
          setUploading(false);
          onClose();
        }, 2000);
      } else {
        throw new Error(response.data.error || '批量上传失败');
      }
    } catch (error) {
      throw error;
    }
  };

  const onSingleFileClick = () => {
    fileInputRef.current.value = '';
    fileInputRef.current.removeAttribute('multiple');
    fileInputRef.current.removeAttribute('webkitdirectory');
    fileInputRef.current.click();
  };

  const onMultipleFilesClick = () => {
    fileInputRef.current.value = '';
    fileInputRef.current.setAttribute('multiple', true);
    fileInputRef.current.removeAttribute('webkitdirectory');
    fileInputRef.current.click();
  };

  const onFolderClick = () => {
    folderInputRef.current.value = '';
    folderInputRef.current.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">上传PDF文档</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={uploading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!uploading ? (
          <div>
            {/* 上传模式选择 */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <button
                  onClick={onSingleFileClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  单文件上传
                </button>
                <button
                  onClick={onMultipleFilesClick}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  批量上传
                </button>
                <button
                  onClick={onFolderClick}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  文件夹上传
                </button>
              </div>
            </div>

            {/* 拖拽区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  拖拽PDF文件到此处，或点击上方按钮选择上传方式
                </p>
                <p className="text-xs text-gray-500 mt-1">支持PDF格式，单文件最大50MB</p>
                <p className="text-xs text-blue-600 mt-2">支持单文件、批量文件和文件夹上传</p>
              </div>
            </div>

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleChange}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory="true"
              onChange={handleChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{uploadStatus}</p>
            
            {/* 文件上传进度列表 */}
            {Object.keys(uploadProgress).length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                {Object.entries(uploadProgress).map(([index, info]) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{info.fileName}</span>
                      <span className="text-xs text-gray-500">{info.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${info.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600">{info.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}