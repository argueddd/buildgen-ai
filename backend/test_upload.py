#!/usr/bin/env python3
"""
测试PDF上传和处理流程
"""

import os
import sys
import subprocess
from pathlib import Path

def test_mineru_installation():
    """测试mineru是否已安装"""
    try:
        result = subprocess.run(['mineru', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ mineru 已安装")
            return True
        else:
            print("❌ mineru 未正确安装")
            return False
    except FileNotFoundError:
        print("❌ mineru 未找到，请先安装 mineru")
        return False

def test_directories():
    """测试必要的目录是否存在"""
    dirs = ['./uploads', './temp', './processed_pdfs', './data/output']
    for dir_path in dirs:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            print(f"✅ 创建目录: {dir_path}")
        else:
            print(f"✅ 目录已存在: {dir_path}")

def test_imports():
    """测试必要的模块导入"""
    try:
        from src.service.split_md_into_chunks import split_markdown_merge_recursively
        from src.service.question_generator import generate_questions_for_chunk
        from src.utils.vector_utils import prepare_chunk_for_insert
        from src.infrastructure.milvus_db import MilvusDbManager
        print("✅ 所有模块导入成功")
        return True
    except ImportError as e:
        print(f"❌ 模块导入失败: {e}")
        return False

def test_directory_structure():
    """测试目录结构说明"""
    print("\n📁 目录结构说明:")
    print("   ./uploads/          - 原始PDF文件存储")
    print("   ./processed_pdfs/   - 已处理的PDF信息存储")
    print("   ./temp/             - 临时处理文件")
    print("   ./data/output/      - 其他输出文件")

def main():
    print("🔍 检查PDF上传和处理环境...")
    print("=" * 50)
    
    # 测试目录
    test_directories()
    print()
    
    # 显示目录结构说明
    test_directory_structure()
    print()
    
    # 测试mineru
    mineru_ok = test_mineru_installation()
    print()
    
    # 测试模块导入
    imports_ok = test_imports()
    print()
    
    if mineru_ok and imports_ok:
        print("🎉 环境检查通过！可以开始使用PDF上传功能")
        print("\n📝 使用说明:")
        print("1. 启动后端: python app.py")
        print("2. 启动前端: npm start")
        print("3. 在PDF管理页面点击'上传'按钮")
        print("4. 选择PDF文件，系统会自动处理并存储到Milvus")
        print("5. 处理后的信息会保存在 ./processed_pdfs/ 目录中")
        print("\n📋 处理流程:")
        print("   PDF上传 → mineru转换 → Markdown切片 → 存储Milvus → 保存处理信息")
    else:
        print("❌ 环境检查失败，请解决上述问题后再试")
        
        if not mineru_ok:
            print("\n💡 安装 mineru:")
            print("   pip install mineru")
            print("   或者从官网下载: https://github.com/xusenlin/mineru")
            
        if not imports_ok:
            print("\n💡 检查依赖:")
            print("   pip install -r requirements.txt")

if __name__ == "__main__":
    main() 