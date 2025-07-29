#!/usr/bin/env python3
"""
测试后端API是否正常工作
"""

import requests
import json

def test_pdf_list_api():
    """测试PDF列表API"""
    try:
        response = requests.get('http://localhost:8010/pdf-list')
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ PDF列表API正常")
            print(f"找到 {len(data.get('pdfs', []))} 个PDF文件:")
            
            for pdf in data.get('pdfs', []):
                print(f"  - {pdf.get('name')} ({pdf.get('status')})")
                
            return True
        else:
            print(f"❌ API返回错误: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务器，请确保后端正在运行")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_processed_info_api():
    """测试处理信息API"""
    try:
        response = requests.get('http://localhost:8010/processed/test1')
        print(f"\n状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 处理信息API正常")
            print(f"文件: {data.get('original_name')}")
            print(f"Chunks: {data.get('chunks_count')}")
            return True
        else:
            print(f"❌ 处理信息API返回错误: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_markdown_api():
    """测试Markdown API"""
    try:
        response = requests.get('http://localhost:8010/processed/test1/markdown')
        print(f"\n状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Markdown API正常")
            print(f"Markdown内容长度: {len(data.get('markdown', ''))} 字符")
            return True
        else:
            print(f"❌ Markdown API返回错误: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def main():
    print("🔍 测试后端API...")
    print("=" * 50)
    
    # 测试PDF列表API
    pdf_list_ok = test_pdf_list_api()
    
    if pdf_list_ok:
        # 测试处理信息API
        info_ok = test_processed_info_api()
        
        # 测试Markdown API
        markdown_ok = test_markdown_api()
        
        if info_ok and markdown_ok:
            print("\n🎉 所有API测试通过！")
            print("现在可以启动前端进行测试了")
        else:
            print("\n❌ 部分API测试失败")
    else:
        print("\n❌ PDF列表API测试失败，请检查后端服务")

if __name__ == "__main__":
    main() 