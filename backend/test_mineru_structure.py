#!/usr/bin/env python3
"""
测试mineru的输出目录结构
"""

import os
import subprocess
from pathlib import Path

def test_mineru_output_structure():
    """测试mineru的输出结构"""
    print("🔍 测试mineru输出结构...")
    print("=" * 50)
    
    # 检查是否有测试PDF文件
    test_pdf = "./uploads/test1_木头盘子产品说明书.pdf"
    if not os.path.exists(test_pdf):
        print("❌ 测试PDF文件不存在，请先上传一个PDF文件")
        return False
    
    # 创建临时输出目录
    temp_output = "./temp/mineru_test"
    os.makedirs(temp_output, exist_ok=True)
    
    try:
        # 运行mineru
        print(f"运行mineru转换: {test_pdf}")
        cmd = ["mineru", "-p", test_pdf, "-o", temp_output]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        print("✅ mineru转换成功")
        
        # 检查输出目录结构
        print(f"\n📁 输出目录结构:")
        print(f"输出目录: {temp_output}")
        
        def print_directory_structure(path, indent=0):
            """递归打印目录结构"""
            for item in sorted(os.listdir(path)):
                item_path = os.path.join(path, item)
                prefix = "  " * indent
                if os.path.isdir(item_path):
                    print(f"{prefix}📁 {item}/")
                    print_directory_structure(item_path, indent + 1)
                else:
                    print(f"{prefix}📄 {item}")
        
        print_directory_structure(temp_output)
        
        # 查找markdown文件
        print(f"\n🔍 查找markdown文件:")
        md_files = list(Path(temp_output).rglob("*.md"))
        
        if md_files:
            print(f"✅ 找到 {len(md_files)} 个markdown文件:")
            for md_file in md_files:
                print(f"  - {md_file}")
                # 读取文件内容的前几行
                try:
                    with open(md_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    print(f"    内容长度: {len(content)} 字符")
                    print(f"    前100字符: {content[:100]}...")
                except Exception as e:
                    print(f"    读取失败: {e}")
        else:
            print("❌ 未找到markdown文件")
            return False
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ mineru转换失败: {e}")
        print(f"错误输出: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False
    finally:
        # 清理临时文件
        import shutil
        if os.path.exists(temp_output):
            shutil.rmtree(temp_output)
            print(f"\n🧹 清理临时目录: {temp_output}")

def main():
    success = test_mineru_output_structure()
    
    if success:
        print("\n🎉 mineru输出结构测试通过！")
        print("现在可以正确读取markdown文件了")
    else:
        print("\n❌ mineru输出结构测试失败")
        print("请检查mineru是否正确安装和配置")

if __name__ == "__main__":
    main() 