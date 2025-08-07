import subprocess
from pathlib import Path

def convert_pdf_to_markdown(pdf_path, output_dir):
    """使用mineru将PDF转换为Markdown"""
    try:
        mineru_exe = "mineru"
        
        cmd = [
            mineru_exe,
            "-p", pdf_path,
            "-o", output_dir,
            "--source", "modelscope"
        ]
        
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        
        # 获取PDF文件名（不含扩展名）
        pdf_name = Path(pdf_path).stem
        
        # mineru生成的结构是: output_dir/{pdf_name}/auto/{pdf_name}.md
        md_path = Path(output_dir) / pdf_name / "auto" / f"{pdf_name}.md"
        
        if md_path.exists():
            return str(md_path)
        
        # 如果上面的路径不存在，尝试查找其他可能的路径
        md_files = list(Path(output_dir).rglob("*.md"))
        if md_files:
            return str(md_files[0])
        
        return None
        
    except subprocess.CalledProcessError as e:
        print(f"mineru转换失败: {e}")
        return None
    except Exception as e:
        print(f"转换过程出错: {e}")
        return None
